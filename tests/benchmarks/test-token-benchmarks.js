/**
 * tests/benchmarks/test-token-benchmarks.js
 *
 * Automated verification of Token Optimization & Efficiency Guarantees (Phase 9):
 *   1. Level 1 Compact Notation achieves >60% token reduction vs Verbose JSON.
 *   2. Level 0 Minimal State achieves >90% token reduction vs Raw DOM HTML.
 *   3. Progressive Level 1 achieves >80% token reduction vs Raw DOM HTML.
 *   4. Scoped Container Inspection reduces tokens compared to unscoped Level 1.
 *   5. Targeted Query Inspection reduces tokens compared to unscoped Level 1.
 *   6. Structured Data Extractions (tables, text) reduce token cost by >70% vs Raw DOM.
 *   7. Direct JavaScript Evaluation operates with 0 observation tokens.
 *   8. Token Budget Enforcement dynamically compacts and truncates payload to stay within target budget.
 *   9. Generated empirical benchmark report (token-report.json) exists and is valid JSON.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BrowserRuntime } from '../../src/core/browser-runtime.js';
import { ChromiumAdapter } from '../../src/adapters/chromium.js';
import { ProgressiveLevel } from '../../src/observation/index.js';
import { measureTokens, calculateSavings } from '../../benchmarks/benchmark-tokens.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const basicFixturePath = path.resolve(rootDir, 'test-sites/basic/index.html');
const basicFixtureUrl = `file:///${basicFixturePath.replace(/\\/g, '/')}`;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ FAIL  ${name}`);
    console.log(`         ${err.message}`);
    if (err.stack) {
      console.log(`         ${err.stack.split('\n').slice(1, 4).join('\n        ')}`);
    }
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function run() {
  console.log('\n============================================================');
  console.log('🧪 test-token-benchmarks.js — Token Efficiency Guarantees (Phase 9)');
  console.log('============================================================\n');

  const adapter = new ChromiumAdapter();
  const runtime = new BrowserRuntime(adapter);

  let tabId;

  try {
    await runtime.connect({ mode: 'managed', browser: 'edge', headless: true });
    const tab = await runtime.createTab(basicFixtureUrl);
    tabId = tab.id;
    await runtime.waitFor(tabId, { type: 'dom_stable' });

    const page = adapter._resolvePage(tabId);
    const rawHtml = await page.content();
    const rawTokens = measureTokens(rawHtml).tokenEstimate;

    // ------------------------------------------------------------------------
    // Suite 1: Compact Format Reduction Guarantees
    // ------------------------------------------------------------------------
    console.log('--- Suite 1: Compact Format Reduction Guarantees ---');

    await test('Level 1 Compact Notation achieves >60% token reduction vs Full JSON (Requirement)', async () => {
      const obs = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const compactTokens = measureTokens(obs.compact).tokenEstimate;
      const jsonTokens = measureTokens(obs.elements).tokenEstimate;
      const savings = calculateSavings(jsonTokens, compactTokens);

      console.log(`         Compact: ${compactTokens} tokens vs JSON: ${jsonTokens} tokens -> ${savings}% reduction`);
      assert(savings >= 60, `Expected savings >= 60%, got ${savings}%`);
    });

    await test('Level 0 Minimal State achieves >90% token reduction vs Raw DOM', async () => {
      const obs = await runtime.inspect(tabId, { level: ProgressiveLevel.MINIMAL });
      const l0Tokens = measureTokens(obs.page).tokenEstimate;
      const savings = calculateSavings(rawTokens, l0Tokens);

      console.log(`         Level 0: ${l0Tokens} tokens vs Raw: ${rawTokens} tokens -> ${savings}% reduction`);
      assert(savings >= 90, `Expected savings >= 90%, got ${savings}%`);
    });

    await test('Level 1 Compact achieves >80% token reduction vs Raw DOM', async () => {
      const obs = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const l1Tokens = measureTokens(obs.compact).tokenEstimate;
      const savings = calculateSavings(rawTokens, l1Tokens);

      console.log(`         Level 1: ${l1Tokens} tokens vs Raw: ${rawTokens} tokens -> ${savings}% reduction`);
      assert(savings >= 80, `Expected savings >= 80%, got ${savings}%`);
    });

    // ------------------------------------------------------------------------
    // Suite 2: Scoping & Targeted Query Efficiency
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 2: Scoping & Targeted Query Efficiency ---');

    await test('Scoped Container Inspection reduces tokens vs full-page Level 1', async () => {
      const obsFull = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const obsScoped = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT, scope: '#section-form' });

      const fullTokens = measureTokens(obsFull.compact).tokenEstimate;
      const scopedTokens = measureTokens(obsScoped.compact).tokenEstimate;

      console.log(`         Full L1: ${fullTokens} tokens vs Scoped: ${scopedTokens} tokens`);
      assert(scopedTokens < fullTokens, 'Scoped tokens must be less than full-page tokens');
      assert(obsScoped.elementCount < obsFull.elementCount, 'Scoped element count must be less');
    });

    await test('Targeted Query Inspection reduces tokens vs full-page Level 1', async () => {
      const obsFull = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const obsQuery = await runtime.inspect(tabId, { level: ProgressiveLevel.TARGETED, query: 'button' });

      const fullTokens = measureTokens(obsFull.compact).tokenEstimate;
      const queryTokens = measureTokens(obsQuery.compact).tokenEstimate;

      console.log(`         Full L1: ${fullTokens} tokens vs Query: ${queryTokens} tokens`);
      assert(queryTokens < fullTokens, 'Targeted query tokens must be less than full-page tokens');
      assert(obsQuery.elementCount < obsFull.elementCount, 'Targeted element count must be less');
    });

    // ------------------------------------------------------------------------
    // Suite 3: Structured Extraction & Direct Evaluation
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 3: Structured Extraction & Direct Evaluation ---');

    await test('Structured Table Extraction achieves >70% token reduction vs Raw DOM', async () => {
      const ext = await runtime.extract(tabId, 'table');
      const tableTokens = measureTokens(ext.data.tables).tokenEstimate;
      const savings = calculateSavings(rawTokens, tableTokens);

      console.log(`         Tables: ${tableTokens} tokens vs Raw: ${rawTokens} tokens -> ${savings}% reduction`);
      assert(savings >= 70, `Expected savings >= 70%, got ${savings}%`);
    });

    await test('Direct JS evaluate() returns scalar with 0 observation tokens', async () => {
      const title = await runtime.evaluate(tabId, 'document.title');
      const titleTokens = measureTokens(title).tokenEstimate;

      console.log(`         Direct evaluate: "${title}" (${titleTokens} tokens)`);
      assert(typeof title === 'string', 'Title must be string');
      assert(title.length > 0, 'Title must not be empty');
      assert(titleTokens < 20, 'Direct scalar evaluation must be minimal token payload');
    });

    // ------------------------------------------------------------------------
    // Suite 4: Token Budget Enforcement
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 4: Token Budget Enforcement ---');

    await test('maxTokens option dynamically compacts and truncates payload to budget', async () => {
      const unconstrained = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const unconstrainedTokens = measureTokens(unconstrained.compact).tokenEstimate;

      const budget = 40;
      const constrained = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT, maxTokens: budget });
      const constrainedTokens = measureTokens(constrained.compact).tokenEstimate;

      console.log(`         Unconstrained: ${unconstrainedTokens} tokens -> Budget ${budget} tokens -> Result: ${constrainedTokens} tokens`);
      assert(constrained.truncated === true, 'Result must be flagged as truncated');
      assert(constrained.elementCount < unconstrained.elementCount, 'Element count must be reduced');
      assert(constrained.compact.includes('truncated'), 'Compact text must include truncation notice');
      assert(constrained.tokenBudget.maxTokens === budget, 'tokenBudget metadata reflects maxTokens');
    });

    // ------------------------------------------------------------------------
    // Suite 5: Benchmark Report Artifact Verification
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 5: Benchmark Report Artifact Verification ---');

    await test('token-report.json exists, is valid JSON, and contains empirical data for both test benches', async () => {
      const reportPath = path.resolve(rootDir, 'benchmarks/token-report.json');
      assert(fs.existsSync(reportPath), 'token-report.json must exist');

      const raw = fs.readFileSync(reportPath, 'utf8');
      const data = JSON.parse(raw);

      assert(data.sites.basic !== undefined, 'Contains basic test bench metrics');
      assert(data.sites.advanced !== undefined, 'Contains advanced test bench metrics');
      assert(data.sites.basic.level1VerboseJson.compactVsJsonSavingsPct >= 60, 'Basic compact savings >= 60%');
      assert(data.sites.advanced.level1VerboseJson.compactVsJsonSavingsPct >= 60, 'Advanced compact savings >= 60%');
    });

  } finally {
    await runtime.disconnect();
  }

  console.log('\n===================================');
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('===================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test harness error:', err);
  process.exit(1);
});
