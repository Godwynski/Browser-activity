/**
 * CyberQ Quiz Runner — brave_eval injection snippets
 * ====================================================
 * Paste any section into brave_eval (tabIndex: 0, target: "user")
 *
 * DESIGN:
 *   Old approach:  ~6 MCP calls/question, ~400 tokens/question
 *   New approach:  2 MCP calls/question, ~100 tokens/question
 *
 * HOW IT WORKS:
 *   1. SCAN: One call reads all topic buttons on the module page → agent picks topic
 *   2. START: One call clicks the START button
 *   3. PER QUESTION LOOP:
 *      a. READ call  → returns {state, q, opts}   (compact, ~80 tokens to LLM)
 *      b. ANSWER call → submits answer, immediately returns next question state
 *   4. DONE: handleDone() clicks OK → proceeds → returns result
 *   5. RESULT: proceed() clicks "PROCEED WITH NEXT TOPIC" → returns next state
 */

// ═══════════════════════════════════════════════════════════════════
// SNIPPET A — readState()
// Call this once at any point. Returns compact page state.
// Use as your READ call in the loop.
// ═══════════════════════════════════════════════════════════════════
/*
(function readState() {
  var url = window.location.href;

  if (url.includes('ProgressiveResult')) {
    var rt = document.body.innerText;
    return {
      state: 'result',
      passed: rt.includes('successfully'),
      score: (rt.match(/increased by [\d.]+%/) || [''])[0],
      hasNext: rt.includes('PROCEED WITH NEXT TOPIC')
    };
  }

  if (url.includes('ExamPrep_ProgressiveTest')) {
    var rows = Array.from(document.querySelectorAll('[id*="rptrSections_ctl"]'));
    var seen = {}, topics = [];
    rows.forEach(function(el) {
      var m = el.id.match(/rptrSections_(ctl\d+)/);
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
      if (t.length > 30 && t.length < 700 && t.indexOf('\n') === -1 &&
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
*/

// ═══════════════════════════════════════════════════════════════════
// SNIPPET B — submitAnswer(idx)
// Replace IDX with 0/1/2/3. Submits answer and immediately reads
// next state. This is your ANSWER+READ in a single call.
// ═══════════════════════════════════════════════════════════════════
/*
(function submitAnswer(idx) {
  // 1. Select the radio
  var r = document.getElementById('rbtnOptions_' + idx);
  if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }

  // 2. Click Answer button
  var btn = document.getElementById('btnAnswer');
  if (!btn) return { error: 'No btnAnswer found' };
  btn.click();

  // 3. Read the new state after click (synchronous DOM read — the click triggers postback)
  // NOTE: On postback pages, the DOM updates. Return current visible state so the next
  // read call can be skipped if the question already loaded.
  return { submitted: idx, note: 'Call readState() next to get new question or done state' };
})(IDX);
*/

// ═══════════════════════════════════════════════════════════════════
// SNIPPET C — handleDone()
// Call when readState() returns {state: 'done'}. Clicks OK and
// returns the result page state in one call.
// ═══════════════════════════════════════════════════════════════════
/*
(function handleDone() {
  var btns = Array.from(document.querySelectorAll('input[type="submit"], button'));
  var ok = btns.find(function(b) { return (b.value || b.innerText || '').match(/OK|Continue/i); });
  if (ok) { ok.click(); return 'OK clicked'; }
  return { error: 'No OK button found', btns: btns.map(function(b){return b.value||b.innerText;}) };
})();
*/

// ═══════════════════════════════════════════════════════════════════
// SNIPPET D — proceedNext()
// Call when on result page (state: 'result'). Clicks "PROCEED WITH
// NEXT TOPIC" link, then re-navigates to module if needed.
// ═══════════════════════════════════════════════════════════════════
/*
(function proceedNext() {
  var els = Array.from(document.querySelectorAll('a, input[type="submit"], button'));
  var next = els.find(function(e) { return (e.innerText || e.value || '').match(/PROCEED/i); });
  if (next) { next.click(); return 'PROCEED clicked'; }
  return { error: 'No PROCEED button', url: window.location.href };
})();
*/

// ═══════════════════════════════════════════════════════════════════
// SNIPPET E — switchModule(ctlIndex)
// Switch to a module tab by its ctl index (0=M01, 1=M02 ... 11=M12)
// ═══════════════════════════════════════════════════════════════════
/*
(function switchModule(idx) {
  var padded = idx < 10 ? '0' + idx : '' + idx;
  __doPostBack('ctl00$ContentPlaceHolder1$rptrForms$ctl' + padded + '$lbtnFormid', '');
  return 'Switched to module ctl' + padded;
})(MODULE_INDEX);
*/

// ═══════════════════════════════════════════════════════════════════
// AGENT USAGE PROTOCOL
// ═══════════════════════════════════════════════════════════════════
/*
  FLOW PER TOPIC:
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. switchModule(5)          → gets to M06                   │
  │ 2. readState()              → {state:'module', topics:[...]}│
  │ 3. click START via btnId    → navigates to quiz             │
  │                                                             │
  │ LOOP:                                                       │
  │ 4. readState()              → {state:'question', q, opts}   │
  │    LLM reasons from q+opts → picks idx (e.g. 2)            │
  │ 5. submitAnswer(2)          → submits                       │
  │ 6. readState()              → next question OR {state:done} │
  │    (if question → goto 5)                                   │
  │    (if done → goto 7)                                       │
  │                                                             │
  │ 7. handleDone()             → clicks OK                     │
  │ 8. readState()              → {state:'result', score:...}   │
  │ 9. proceedNext()            → clicks PROCEED or goes home   │
  │ 10. Repeat from step 2 for next topic                       │
  └─────────────────────────────────────────────────────────────┘

  TOKEN COST (optimized):
    readState():     ~80 tokens out per question
    submitAnswer():  ~20 tokens in
    Total:           ~100 tokens/question  (was ~400+ before)

  MCP CALLS PER QUESTION:
    readState + submitAnswer = 2 calls  (was 5-6 before)
*/
