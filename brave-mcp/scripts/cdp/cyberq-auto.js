#!/usr/bin/env node
/**
 * CyberQ Automated Quiz Runner
 * ==============================
 * A Node.js script that autonomously completes EC-Council CyberQ exam prep
 * topics via CDP (port 9222), using Gemini to answer questions.
 *
 * Usage:
 *   node cyberq-auto.js --module 6                   # do all of module 6
 *   node cyberq-auto.js --module 6 --topic 3         # specific topic
 *   node cyberq-auto.js --all                         # everything remaining
 *
 * How it works:
 *   1. Connects to Brave via CDP (port 9222)
 *   2. Finds the CyberQ tab
 *   3. For each target topic:
 *      a. Clicks START
 *      b. Loops: reads question → calls Gemini → submits answer
 *      c. Handles done modal → result page → proceeds
 *   4. Reports summary at the end
 *
 * Token optimization:
 *   - Questions are batched and sent to Gemini in groups (not one at a time)
 *   - Gemini returns a JSON array of indices → no per-question LLM call
 *   - DOM reads are single-call, compact (readState snippet)
 */

'use strict';

const CDP = require('chrome-remote-interface');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Config ────────────────────────────────────────────────────────────────────
const CDP_PORT = 9222;
const CYBERQ_URL_PATTERN = 'cyberq.eccouncil.org';
const GEMINI_MODEL = 'gemini-2.0-flash';
const DELAY_MS = 800; // ms between actions (avoids race conditions)

// ── Gemini client ─────────────────────────────────────────────────────────────
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── CDP helpers ───────────────────────────────────────────────────────────────
async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function evalInPage(client, code) {
  const { result } = await client.Runtime.evaluate({
    expression: code,
    returnByValue: true,
    awaitPromise: false
  });
  if (result.type === 'object' && result.value !== undefined) return result.value;
  if (result.type === 'string') return result.value;
  return null;
}

// ── DOM snippets (inline strings for evalInPage) ──────────────────────────────

const SNIPPET_READ_STATE = `
(function readState() {
  var url = window.location.href;

  if (url.includes('ProgressiveResult')) {
    var rt = document.body.innerText;
    return {
      state: 'result',
      passed: rt.includes('successfully'),
      score: (rt.match(/increased by [\\d.]+%/) || [''])[0],
      hasNext: rt.includes('PROCEED WITH NEXT TOPIC')
    };
  }

  if (url.includes('ExamPrep_ProgressiveTest')) {
    var rows = Array.from(document.querySelectorAll('[id*="rptrSections_ctl"]'));
    var seen = {}, topics = [];
    rows.forEach(function(el) {
      var m = el.id.match(/rptrSections_(ctl\\d+)/);
      if (!m || seen[m[1]]) return;
      seen[m[1]] = true;
      var key = m[1];
      var nameEl = document.getElementById('ctl00_ContentPlaceHolder1_rptrSections_' + key + '_lblSectionName');
      var startBtn = document.getElementById('ctl00_ContentPlaceHolder1_rptrSections_' + key + '_btnStartTest');
      var retakeBtn = document.getElementById('ctl00_ContentPlaceHolder1_rptrSections_' + key + '_btnRetakeTest');
      if (nameEl) topics.push({
        name: nameEl.innerText.trim(),
        status: startBtn ? 'START' : 'RETAKE',
        btnId: (startBtn || retakeBtn || {}).id || null
      });
    });
    return { state: 'module', topics: topics };
  }

  if (url.includes('TakeProgressiveTest')) {
    var bodyText = document.body.innerText;
    if (bodyText.includes('completed the assessment for this topic')) {
      return { state: 'done' };
    }
    var qText = '';
    var allEls = Array.from(document.querySelectorAll('span, td, p'));
    for (var i = 0; i < allEls.length; i++) {
      var t = (allEls[i].innerText || '').trim();
      if (t.length > 30 && t.length < 700 && t.indexOf('\\n') === -1 &&
          !t.match(/^(Module|Copyright|Godwyn|Email|Dashboard|Logout|FAQ)/)) {
        qText = t; break;
      }
    }
    var opts = Array.from(document.querySelectorAll('input[type="radio"]')).map(function(r) {
      var lbl = document.querySelector('label[for="' + r.id + '"]');
      return { idx: r.id.replace('rbtnOptions_', ''), text: lbl ? lbl.innerText.trim() : r.value };
    });
    if (!qText || !opts.length) return { state: 'unknown', url: url, snippet: bodyText.slice(200, 500) };
    return { state: 'question', q: qText, opts: opts };
  }

  return { state: 'unknown', url: url };
})();
`;

function snippetSubmitAnswer(idx) {
  return `
(function() {
  var r = document.getElementById('rbtnOptions_${idx}');
  if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  var btn = document.getElementById('btnAnswer');
  if (!btn) return { error: 'No btnAnswer' };
  btn.click();
  return { submitted: ${idx} };
})();
`;
}

const SNIPPET_HANDLE_DONE = `
(function() {
  var btns = Array.from(document.querySelectorAll('input[type="submit"], button'));
  var ok = btns.find(function(b) { return (b.value || b.innerText || '').match(/OK|Continue/i); });
  if (ok) { ok.click(); return 'OK'; }
  return 'no-ok-btn';
})();
`;

const SNIPPET_PROCEED_NEXT = `
(function() {
  var els = Array.from(document.querySelectorAll('a, input[type="submit"], button'));
  var next = els.find(function(e) { return (e.innerText || e.value || '').match(/PROCEED/i); });
  if (next) { next.click(); return 'PROCEED'; }
  return 'no-proceed';
})();
`;

function snippetSwitchModule(idx) {
  const padded = idx < 10 ? '0' + idx : '' + idx;
  return `(function(){ __doPostBack('ctl00$ContentPlaceHolder1$rptrForms$ctl${padded}$lbtnFormid',''); return 'M${padded}'; })();`;
}

function snippetClickBtn(btnId) {
  return `(function(){ var b=document.getElementById('${btnId}'); if(b){b.click();return 'clicked';} return 'not found'; })();`;
}

// ── Gemini answering ──────────────────────────────────────────────────────────
/**
 * Batch-answer multiple questions in a single Gemini API call.
 * This is the key optimization: instead of one LLM call per question,
 * we send all questions at once and get back an array of indices.
 *
 * @param {Array<{q: string, opts: Array<{idx, text}>}>} questions
 * @returns {Array<number>} answer indices (0-3)
 */
async function batchAnswer(questions) {
  const model = genai.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `You are an expert in cybersecurity and ethical hacking (EC-Council EHE syllabus).
Answer each multiple-choice question below by returning ONLY a JSON array of answer indices (0-3).
No explanation needed. Just the array.

Questions:
${questions.map((q, i) => `
Q${i + 1}: ${q.q}
Options:
${q.opts.map(o => `  ${o.idx}: ${o.text}`).join('\n')}
`).join('\n')}

Return format: [idx1, idx2, ...]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Parse JSON array from response
  const match = text.match(/\[[\d,\s]+\]/);
  if (!match) throw new Error('Failed to parse Gemini response: ' + text);
  return JSON.parse(match[0]);
}

// ── Main quiz loop ────────────────────────────────────────────────────────────
async function doTopic(client, log) {
  log('  Starting topic quiz loop...');

  // Collect all questions first (max 10, usually 5)
  const collectedQuestions = [];
  let loopState = await evalInPage(client, SNIPPET_READ_STATE);

  // Phase 1: Read all questions upfront by cycling through them
  // NOTE: Some topics only show 1 question at a time, so we answer as we go
  // This is the streaming approach:
  let answered = 0;
  const pendingAnswers = [];

  while (true) {
    await sleep(DELAY_MS);
    loopState = await evalInPage(client, SNIPPET_READ_STATE);

    if (!loopState) {
      log('  Warning: null state returned, retrying...');
      continue;
    }

    if (loopState.state === 'question') {
      const q = loopState;
      log(`  Q${answered + 1}: ${q.q.slice(0, 60)}...`);
      log(`  Options: ${q.opts.map(o => o.idx + ':' + o.text).join(' | ')}`);

      // Answer this question (single-question Gemini call for accuracy)
      const [idx] = await batchAnswer([{ q: q.q, opts: q.opts }]);
      log(`  → Answering idx ${idx} (${q.opts.find(o => o.idx == idx)?.text})`);

      await evalInPage(client, snippetSubmitAnswer(idx));
      answered++;

    } else if (loopState.state === 'done') {
      log(`  Topic complete after ${answered} questions. Clicking OK...`);
      await evalInPage(client, SNIPPET_HANDLE_DONE);
      break;

    } else if (loopState.state === 'result') {
      log(`  Result: ${loopState.passed ? 'PASSED ✓' : 'FAILED ✗'} ${loopState.score}`);
      return loopState;

    } else if (loopState.state === 'unknown') {
      log(`  Unknown state: ${JSON.stringify(loopState).slice(0, 100)}`);
      await sleep(1000);
    }
  }

  // Wait for result page
  await sleep(1000);
  const resultState = await evalInPage(client, SNIPPET_READ_STATE);
  if (resultState.state === 'result') {
    log(`  Result: ${resultState.passed ? 'PASSED ✓' : 'FAILED ✗'} ${resultState.score}`);
    return resultState;
  }
  return { state: 'unknown' };
}

async function doModule(client, moduleIndex, topicFilter, log) {
  log(`\n=== Module ${moduleIndex + 1} ===`);

  // Navigate to the module tab
  await evalInPage(client, snippetSwitchModule(moduleIndex));
  await sleep(1000);

  const moduleState = await evalInPage(client, SNIPPET_READ_STATE);
  if (moduleState.state !== 'module') {
    log(`Unexpected state after module switch: ${JSON.stringify(moduleState)}`);
    return;
  }

  log(`Topics found: ${moduleState.topics.length}`);
  const toProcess = moduleState.topics.filter((t, i) =>
    t.status === 'START' && (topicFilter == null || i === topicFilter)
  );

  log(`Topics to do: ${toProcess.length}`);

  for (let i = 0; i < toProcess.length; i++) {
    const topic = toProcess[i];
    log(`\n  Topic: ${topic.name}`);

    // Click START
    await evalInPage(client, snippetClickBtn(topic.btnId));
    await sleep(1200);

    const result = await doTopic(client, log);

    if (result && result.hasNext) {
      // Proceed to next topic if offered
      await evalInPage(client, SNIPPET_PROCEED_NEXT);
      await sleep(800);

      // Check if we got redirected to the module page
      const afterProceed = await evalInPage(client, SNIPPET_READ_STATE);
      if (afterProceed.state === 'module') {
        // Re-read the module topics (statuses have updated)
        // Click the next available START directly
        const nextStart = afterProceed.topics.find(t => t.status === 'START');
        if (nextStart && i < toProcess.length - 1) {
          log(`  Auto-starting next: ${nextStart.name}`);
          await evalInPage(client, snippetClickBtn(nextStart.btnId));
          await sleep(1000);
        }
      }
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const moduleIdx = args.includes('--module') ? parseInt(args[args.indexOf('--module') + 1]) - 1 : null;
  const topicIdx = args.includes('--topic') ? parseInt(args[args.indexOf('--topic') + 1]) - 1 : null;
  const doAll = args.includes('--all');

  const log = (msg) => console.log(msg);

  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: Set GEMINI_API_KEY environment variable first.');
    process.exit(1);
  }

  log('Connecting to Brave CDP on port ' + CDP_PORT + '...');

  let client;
  try {
    // Find the CyberQ tab
    const targets = await CDP.List({ port: CDP_PORT });
    const cyberqTarget = targets.find(t => t.url && t.url.includes(CYBERQ_URL_PATTERN));
    if (!cyberqTarget) {
      console.error('ERROR: CyberQ tab not found. Open it in Brave first.');
      process.exit(1);
    }
    log('Found CyberQ tab: ' + cyberqTarget.url);

    client = await CDP({ target: cyberqTarget.id, port: CDP_PORT });
    await client.Runtime.enable();

    if (doAll) {
      // Process all modules 6–12 (assuming 1–5 done)
      for (let m = 5; m <= 11; m++) {
        await doModule(client, m, null, log);
      }
    } else if (moduleIdx !== null) {
      await doModule(client, moduleIdx, topicIdx, log);
    } else {
      console.log('Usage: node cyberq-auto.js --module <1-12> [--topic <1-N>] | --all');
      process.exit(0);
    }

    log('\n✓ Done!');
  } finally {
    if (client) await client.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
