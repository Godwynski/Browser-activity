/**
 * Universal Browser Control Runtime — Token Optimization Benchmark Engine
 *
 * EMPIRICAL MEASUREMENT RUNNER (Zero Fabrication - Rule 1):
 * Measures real character length, UTF-8 byte sizes, and estimated token counts
 * across all progressive observation levels, formats, scoped views, and extraction modalities.
 *
 * Saves machine-readable results to `benchmarks/token-report.json`.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BrowserRuntime } from '../src/core/browser-runtime.js';
import { ChromiumAdapter } from '../src/adapters/chromium.js';
import { ProgressiveLevel } from '../src/observation/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const basicFixturePath = path.resolve(rootDir, 'test-sites/basic/index.html');
const basicFixtureUrl = `file:///${basicFixturePath.replace(/\\/g, '/')}`;

const advancedFixturePath = path.resolve(rootDir, 'test-sites/advanced/index.html');
const advancedFixtureUrl = `file:///${advancedFixturePath.replace(/\\/g, '/')}`;

/**
 * Accurately calculate token metrics for text/JSON payload
 * @param {string|object} content
 * @returns {{ charLength: number, byteLength: number, tokenEstimate: number }}
 */
export function measureTokens(content) {
  if (content === undefined || content === null) {
    return { charLength: 0, byteLength: 0, tokenEstimate: 0 };
  }
  const str = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const charLength = str.length;
  const byteLength = Buffer.byteLength(str, 'utf8');
  // Standard token estimate heuristic: ~4 chars per token for English & code
  const tokenEstimate = Math.ceil(charLength / 4);
  return { charLength, byteLength, tokenEstimate };
}

/**
 * Calculates percentage savings: ((baseline - current) / baseline) * 100
 */
export function calculateSavings(baselineTokens, currentTokens) {
  if (baselineTokens === 0) return 0;
  const pct = ((baselineTokens - currentTokens) / baselineTokens) * 100;
  return Math.round(pct * 10) / 10;
}

export async function runTokenBenchmarks() {
  console.log('========================================================================');
  console.log('📊 UNIVERSAL BROWSER RUNTIME — TOKEN OPTIMIZATION BENCHMARK SUITE');
  console.log('========================================================================\n');

  const adapter = new ChromiumAdapter();
  const runtime = new BrowserRuntime(adapter);

  // Connect using managed headless mode
  await runtime.connect({ mode: 'managed', headless: true, browser: 'edge' });

  const tab = await runtime.createTab('about:blank');
  const tabId = tab.id;
  const page = adapter._resolvePage(tabId);

  const report = {
    timestamp: new Date().toISOString(),
    engine: 'Universal Browser Control Runtime v3.0.0',
    heuristic: 'tokens = Math.ceil(characterCount / 4)',
    sites: {}
  };

  const testSites = [
    { name: 'Basic Test Bench', url: basicFixtureUrl, key: 'basic', scopeTarget: '#section-form', queryTarget: 'button' },
    { name: 'Advanced Test Bench', url: advancedFixtureUrl, key: 'advanced', scopeTarget: '#tables-section', queryTarget: 'table' }
  ];

  for (const site of testSites) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`🌐 Benchmarking: ${site.name}`);
    console.log(`------------------------------------------------------------------------`);

    await runtime.navigate(tabId, site.url);
    await runtime.waitFor(tabId, { type: 'dom_stable' });

    // 1. Raw DOM HTML
    const rawHtml = await page.content();
    const rawMetrics = measureTokens(rawHtml);

    // 2. Level 0: Minimal State
    const obsL0 = await runtime.inspect(tabId, { level: ProgressiveLevel.MINIMAL });
    const l0Payload = JSON.stringify(obsL0.page, null, 2);
    const l0Metrics = measureTokens(l0Payload);
    const l0Savings = calculateSavings(rawMetrics.tokenEstimate, l0Metrics.tokenEstimate);

    // 3. Level 1: Compact 1-line format
    const obsL1 = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
    const l1CompactMetrics = measureTokens(obsL1.compact);
    const l1SavingsVsRaw = calculateSavings(rawMetrics.tokenEstimate, l1CompactMetrics.tokenEstimate);

    // 4. Level 1: Full JSON Format (Verbose representation of elements)
    const l1JsonMetrics = measureTokens(obsL1.elements);
    const compactVsJsonSavings = calculateSavings(l1JsonMetrics.tokenEstimate, l1CompactMetrics.tokenEstimate);

    // 5. Level 2: Targeted Query Inspection
    const obsL2Query = await runtime.inspect(tabId, { level: ProgressiveLevel.TARGETED, query: site.queryTarget });
    const l2QueryMetrics = measureTokens(obsL2Query.compact);
    const l2QuerySavingsVsL1 = calculateSavings(l1CompactMetrics.tokenEstimate, l2QueryMetrics.tokenEstimate);

    // 6. Level 2: Scoped Container Inspection
    const obsL2Scope = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT, scope: site.scopeTarget });
    const l2ScopeMetrics = measureTokens(obsL2Scope.compact);
    const l2ScopeSavingsVsL1 = calculateSavings(l1CompactMetrics.tokenEstimate, l2ScopeMetrics.tokenEstimate);

    // 7. Level 3: Full Observation Tree
    const obsL3 = await runtime.inspect(tabId, { level: ProgressiveLevel.FULL });
    const l3Metrics = measureTokens(obsL3.elements);

    // 8. Level 4: Screenshot Capture
    const obsL4 = await runtime.inspect(tabId, { level: ProgressiveLevel.SCREENSHOT });
    const l4Metrics = measureTokens(obsL4.screenshot || '');

    // 9. Structured Extractions
    const extText = await runtime.extract(tabId, 'text');
    const textMetrics = measureTokens(extText.data?.text || extText.text);

    const extTables = await runtime.extract(tabId, 'table');
    const tablesMetrics = measureTokens(extTables.data?.tables || extTables.tables);

    const extLinks = await runtime.extract(tabId, 'link');
    const linksMetrics = measureTokens(extLinks.data?.links || extLinks.links);

    const extForms = await runtime.extract(tabId, 'form');
    const formsMetrics = measureTokens(extForms.data?.forms || extForms.forms);

    const extMeta = await runtime.extract(tabId, 'metadata');
    const metaMetrics = measureTokens(extMeta.data || extMeta);

    // 10. Direct Evaluate (0 observation tokens)
    const evalResult = await runtime.evaluate(tabId, 'document.title');
    const evalMetrics = measureTokens(evalResult);

    // 11. Token Budget Enforcement & Compaction
    const obsBudget50 = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT, maxTokens: 50 });
    const budgetMetrics = measureTokens(obsBudget50.compact);

    const siteResult = {
      rawDom: { ...rawMetrics },
      level0Minimal: { ...l0Metrics, savingsVsRawPct: l0Savings },
      level1Compact: { ...l1CompactMetrics, elementCount: obsL1.elementCount, savingsVsRawPct: l1SavingsVsRaw },
      level1VerboseJson: { ...l1JsonMetrics, compactVsJsonSavingsPct: compactVsJsonSavings },
      level2TargetedQuery: { ...l2QueryMetrics, query: site.queryTarget, elementCount: obsL2Query.elementCount, savingsVsL1Pct: l2QuerySavingsVsL1 },
      level2Scoped: { ...l2ScopeMetrics, scope: site.scopeTarget, elementCount: obsL2Scope.elementCount, savingsVsL1Pct: l2ScopeSavingsVsL1 },
      level3FullJson: { ...l3Metrics, elementCount: obsL3.elementCount },
      level4ScreenshotBase64: { ...l4Metrics },
      structuredExtraction: {
        text: { ...textMetrics, savingsVsRawPct: calculateSavings(rawMetrics.tokenEstimate, textMetrics.tokenEstimate) },
        tables: { ...tablesMetrics, savingsVsRawPct: calculateSavings(rawMetrics.tokenEstimate, tablesMetrics.tokenEstimate) },
        links: { ...linksMetrics, savingsVsRawPct: calculateSavings(rawMetrics.tokenEstimate, linksMetrics.tokenEstimate) },
        forms: { ...formsMetrics, savingsVsRawPct: calculateSavings(rawMetrics.tokenEstimate, formsMetrics.tokenEstimate) },
        metadata: { ...metaMetrics, savingsVsRawPct: calculateSavings(rawMetrics.tokenEstimate, metaMetrics.tokenEstimate) }
      },
      directEvaluate: { ...evalMetrics, observationOverheadTokens: 0 },
      tokenBudgetEnforced: {
        maxTokensParam: 50,
        ...budgetMetrics,
        truncated: obsBudget50.truncated || false,
        tokenBudgetMeta: obsBudget50.tokenBudget || null
      }
    };

    report.sites[site.key] = siteResult;

    // Display formatted results
    console.log(`  [Raw Full Page DOM]       Chars: ${rawMetrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${rawMetrics.tokenEstimate.toLocaleString().padStart(5)} | Baseline`);
    console.log(`  [Level 0 Minimal State]    Chars: ${l0Metrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${l0Metrics.tokenEstimate.toLocaleString().padStart(5)} | -${l0Savings}% vs Raw`);
    console.log(`  [Level 1 Verbose JSON]     Chars: ${l1JsonMetrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${l1JsonMetrics.tokenEstimate.toLocaleString().padStart(5)} | (${obsL1.elementCount} elements)`);
    console.log(`  [Level 1 Compact Notation] Chars: ${l1CompactMetrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${l1CompactMetrics.tokenEstimate.toLocaleString().padStart(5)} | -${compactVsJsonSavings}% vs JSON, -${l1SavingsVsRaw}% vs Raw`);
    console.log(`  [Level 2 Scoped Container] Chars: ${l2ScopeMetrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${l2ScopeMetrics.tokenEstimate.toLocaleString().padStart(5)} | -${l2ScopeSavingsVsL1}% vs L1 (${site.scopeTarget})`);
    console.log(`  [Level 2 Targeted Query]   Chars: ${l2QueryMetrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${l2QueryMetrics.tokenEstimate.toLocaleString().padStart(5)} | -${l2QuerySavingsVsL1}% vs L1 ("${site.queryTarget}")`);
    console.log(`  [Level 3 Full JSON Tree]   Chars: ${l3Metrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${l3Metrics.tokenEstimate.toLocaleString().padStart(5)} | (${obsL3.elementCount} elements)`);
    console.log(`  [Level 4 Screenshot B64]   Chars: ${l4Metrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${l4Metrics.tokenEstimate.toLocaleString().padStart(5)}`);
    console.log(`  [Extract: Tables]          Chars: ${tablesMetrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${tablesMetrics.tokenEstimate.toLocaleString().padStart(5)} | -${siteResult.structuredExtraction.tables.savingsVsRawPct}% vs Raw`);
    console.log(`  [Extract: Text/Markdown]   Chars: ${textMetrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${textMetrics.tokenEstimate.toLocaleString().padStart(5)} | -${siteResult.structuredExtraction.text.savingsVsRawPct}% vs Raw`);
    console.log(`  [Direct JS evaluate()]     Chars: ${evalMetrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${evalMetrics.tokenEstimate.toLocaleString().padStart(5)} | 0 observation tokens`);
    console.log(`  [Budget Enforced (50 tkn)] Chars: ${budgetMetrics.charLength.toLocaleString().padStart(7)} | Tokens: ~${budgetMetrics.tokenEstimate.toLocaleString().padStart(5)} | truncated: ${obsBudget50.truncated}`);
  }

  await runtime.disconnect();

  // Save report to benchmarks/token-report.json
  const reportPath = path.resolve(rootDir, 'benchmarks/token-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`\n✅ Empirical token benchmark report written to: ${reportPath}\n`);
  return report;
}

// Allow direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTokenBenchmarks()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Benchmark error:', err);
      process.exit(1);
    });
}
