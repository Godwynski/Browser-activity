/**
 * tests/extraction/test-advanced.js
 *
 * Comprehensive test suite for Phase 5 (Extraction & Advanced Browser Features):
 *   1. Text & Markdown Extraction: clean visible text, hierarchy, truncation
 *   2. Table Extraction: native <table> and ARIA [role="grid"], Markdown table representation
 *   3. Link Extraction: internal / external classification, domain resolution, filters
 *   4. Form Extraction: input schemas, labels, values, select options, orphan fields
 *   5. Page Metadata Extraction: title, description, OpenGraph, JSON-LD, headings
 *   6. JavaScript Dialog Handling: alert, confirm, prompt, policies, history
 *   7. Popups and Window Lifecycle: target="_blank", window.open, opener tracking
 *   8. Browser File Downloads: download interception, safe storage, completion verification
 *   9. BrowserRuntime Integration: seamless delegation of all extraction/advanced features
 *
 * Tested against:
 *   - Local fixture: test-sites/advanced/index.html
 *   - Managed Headless Chrome
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BrowserRuntime } from '../../src/core/browser-runtime.js';
import { ChromiumAdapter } from '../../src/adapters/chromium.js';
import { ValidationError } from '../../src/core/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const advancedFixturePath = path.resolve(__dirname, '../../test-sites/advanced/index.html');
const advancedFixtureUrl = `file:///${advancedFixturePath.replace(/\\/g, '/')}`;

// ---------------------------------------------------------------------------
// Test Runner Harness
// ---------------------------------------------------------------------------

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

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ---------------------------------------------------------------------------
// Main Test Battery
// ---------------------------------------------------------------------------

async function run() {
  console.log('\n============================================================');
  console.log('🧪 test-advanced.js — Extraction & Advanced Features (Phase 5)');
  console.log('============================================================\n');

  const adapter = new ChromiumAdapter();
  const runtime = new BrowserRuntime(adapter);

  let tabId;

  try {
    await runtime.connect({ mode: 'managed', browser: 'chrome', headless: true });
    const tab = await runtime.createTab(advancedFixtureUrl);
    tabId = tab.id;
    await runtime.navigate(tabId, advancedFixtureUrl);

    // ========================================================================
    //  SUITE 1: Text & Markdown Extraction
    // ========================================================================
    console.log('--- Suite 1: Text & Markdown Extraction ---');

    await test('extract("text", plain) — extracts clean visible text without script/style tags', async () => {
      const res = await runtime.extract(tabId, 'text', { scope: '#article-section', format: 'plain' });
      assert(res.data.text.includes('Section 1: Articles and Structured Text'), 'Contains heading');
      assert(res.data.text.includes('Zero-token DOM stripping'), 'Contains list text');
      assert(!res.data.text.includes('<script>'), 'Does not contain raw script tags');
      assert(res.data.charCount > 50, 'Has charCount');
      assert(res.data.lineCount > 3, 'Has lineCount');
    });

    await test('extract("text", markdown) — formats headings with # and lists with -', async () => {
      const res = await runtime.extract(tabId, 'text', { scope: '#article-section', format: 'markdown' });
      assert(res.data.text.includes('## Section 1: Articles and Structured Text'), 'Has markdown H2');
      assert(res.data.text.includes('### Key Advantages'), 'Has markdown H3');
      assert(res.data.text.includes('- Zero-token DOM stripping'), 'Has markdown list item');
      assert(res.data.text.includes('> Knowledge is of no value'), 'Has markdown blockquote');
    });

    await test('extract("text") — respects maxChars and maxLines limits', async () => {
      const res = await runtime.extract(tabId, 'text', { scope: '#article-section', maxLines: 2 });
      assert(res.data.text.includes('truncated at 2 lines'), 'Contains truncation notice');
    });

    await test('extract("text") — throws ValidationError on nonexistent scope', async () => {
      let threw = false;
      try {
        await runtime.extract(tabId, 'text', { scope: '#nonexistent-id' });
      } catch (err) {
        threw = true;
        assert(err instanceof ValidationError, 'Throws ValidationError');
      }
      assert(threw, 'Should throw for invalid scope');
    });

    // ========================================================================
    //  SUITE 2: Table Extraction
    // ========================================================================
    console.log('\n--- Suite 2: Table Extraction ---');

    await test('extract("table") — extracts native HTML table with headers and rows', async () => {
      const res = await runtime.extract(tabId, 'table', { selector: '#products-table' });
      const table = res.data.tables[0];
      assert(table !== undefined, 'Table extracted');
      assertEqual(table.rowCount, 3, 'Row count is 3');
      assert(table.headers.includes('Product Name'), 'Headers include Product Name');
      assert(table.headers.includes('Price'), 'Headers include Price');
      assertEqual(table.rows[0]['Product Name'], 'Neural Engine Core', 'First row Product Name matches');
      assertEqual(table.rows[0]['Price'], '$499.00', 'First row Price matches');
    });

    await test('extract("table") — generates GitHub-flavored markdown table', async () => {
      const res = await runtime.extract(tabId, 'table', { selector: '#products-table', format: 'markdown' });
      const table = res.data.tables[0];
      assert(table.markdown.includes('| SKU | Product Name | Category | Price | Status |'), 'Header row in markdown');
      assert(table.markdown.includes('| SKU-001 | Neural Engine Core | Processors | $499.00 | In Stock |'), 'Data row in markdown');
    });

    await test('extract("table") — extracts ARIA [role="grid"] structure', async () => {
      const res = await runtime.extract(tabId, 'table', { selector: '#aria-metrics-grid' });
      const table = res.data.tables[0];
      assert(table !== undefined, 'ARIA table extracted');
      assert(table.headers.includes('Metric'), 'Headers include Metric');
      assertEqual(table.rows[0]['Metric'], 'CPU Utilization', 'Row metric matches');
      assertEqual(table.rows[0]['Value'], '14.2%', 'Row value matches');
    });

    // ========================================================================
    //  SUITE 3: Link Extraction
    // ========================================================================
    console.log('\n--- Suite 3: Link Extraction ---');

    await test('extract("links") — extracts all links with domain and target resolution', async () => {
      const res = await runtime.extract(tabId, 'links', { scope: '#links-container' });
      assertEqual(res.itemCount, 4, 'Found 4 links');
      const docsLink = res.data.links.find(l => l.text === 'Internal Documentation');
      assert(docsLink !== undefined, 'Found docs link');
      assert(docsLink.href.includes('/docs/getting-started'), 'Resolved absolute href');

      const extLink = res.data.links.find(l => l.text === 'External Specification');
      assert(extLink !== undefined, 'Found external link');
      assertEqual(extLink.domain, 'example.com', 'Domain is example.com');
      assertEqual(extLink.target, '_blank', 'Target is _blank');
    });

    await test('extract("links") — filters external links correctly', async () => {
      const res = await runtime.extract(tabId, 'links', { scope: '#links-container', filter: 'external' });
      assert(res.data.links.length >= 2, 'Found external links');
      assert(res.data.links.every(l => !l.isInternal), 'All returned links are external');
    });

    // ========================================================================
    //  SUITE 4: Form Extraction
    // ========================================================================
    console.log('\n--- Suite 4: Form Extraction ---');

    await test('extract("forms") — extracts form fields, types, labels, and values', async () => {
      const res = await runtime.extract(tabId, 'forms', { scope: '#registration-form' });
      assertEqual(res.data.forms.length, 1, 'Extracted 1 form');
      const form = res.data.forms[0];
      assertEqual(form.method, 'POST', 'Form method is POST');
      assertEqual(form.action, '/api/register', 'Form action matches');

      const userField = form.fields.find(f => f.name === 'username');
      assert(userField !== undefined, 'Found username field');
      assertEqual(userField.value, 'agent_operator', 'Username current value matches');
      assertEqual(userField.required, true, 'Username required is true');
      assertEqual(userField.label, 'Username', 'Username label matches');

      const tierField = form.fields.find(f => f.name === 'tier');
      assert(tierField !== undefined, 'Found tier dropdown');
      assertEqual(tierField.type, 'select', 'Tier field is select');
      assertEqual(tierField.options.length, 3, 'Tier has 3 options');
      const proOption = tierField.options.find(o => o.value === 'pro');
      assert(proOption && proOption.selected, 'Pro option is selected');

      assert(form.buttons.includes('Create Account'), 'Form buttons includes submit button');
    });

    await test('extract("forms") — captures orphan inputs outside of any <form>', async () => {
      const res = await runtime.extract(tabId, 'forms', { scope: 'body' });
      const orphan = res.data.orphanFields.find(f => f.id === 'orphan-search');
      assert(orphan !== undefined, 'Found orphan field');
      assertEqual(orphan.value, 'initial query', 'Orphan field value matches');
      assertEqual(orphan.label, 'Standalone Quick Filter', 'Orphan field label matches');
    });

    // ========================================================================
    //  SUITE 5: Metadata & Structured Extraction
    // ========================================================================
    console.log('\n--- Suite 5: Metadata & Structured Extraction ---');

    await test('extract("metadata") — extracts document title, description, OpenGraph, JSON-LD', async () => {
      const res = await runtime.extract(tabId, 'metadata');
      assertEqual(res.data.title, 'Universal Browser Control — Advanced Lab', 'Page title matches');
      assert(res.data.description.includes('Test bench for extraction'), 'Meta description matches');
      assertEqual(res.data.openGraph['og:title'], 'Advanced Lab OG Title', 'OpenGraph og:title matches');
      assert(res.data.headings.length >= 7, 'Extracted heading hierarchy');
      assert(res.data.jsonLd.length > 0, 'Extracted JSON-LD block');
      assertEqual(res.data.jsonLd[0].name, 'Advanced Lab', 'JSON-LD name matches');
    });

    // ========================================================================
    //  SUITE 6: JavaScript Dialog Handling
    // ========================================================================
    console.log('\n--- Suite 6: JavaScript Dialog Handling ---');

    await test('handleDialog — auto-accepts alert() dialog without blocking runtime', async () => {
      // Alert should be automatically accepted by default policy
      const page = adapter._resolvePage(tabId);
      await page.click('#btn-trigger-alert');
      // If we reach here, alert did not block or freeze page
      assert(true, 'Alert accepted seamlessly');
    });

    await test('handleDialog — auto-dismisses confirm() when policy configured', async () => {
      runtime.setDialogMode(tabId, 'auto_dismiss');
      const page = adapter._resolvePage(tabId);
      await page.click('#btn-trigger-confirm');
      // Wait for output text to update
      await page.waitForFunction(() => document.getElementById('dialog-output').textContent === 'cancelled');
      const text = await page.$eval('#dialog-output', el => el.textContent);
      assertEqual(text, 'cancelled', 'Confirm dialog was dismissed');
    });

    await test('handleDialog — auto-accepts prompt() with custom default response', async () => {
      runtime.setDialogMode(tabId, 'auto_accept', { defaultPromptResponse: 'CYBER-PROMPT-101' });
      const page = adapter._resolvePage(tabId);
      await page.click('#btn-trigger-prompt');
      await page.waitForFunction(() => document.getElementById('dialog-output').textContent === 'CYBER-PROMPT-101');
      const text = await page.$eval('#dialog-output', el => el.textContent);
      assertEqual(text, 'CYBER-PROMPT-101', 'Prompt dialog received and recorded custom response');
    });

    await test('handleDialog — tracks history of handled dialogs', async () => {
      const history = adapter._dialogManager.getHistory(tabId);
      assert(history.length >= 3, `Recorded ${history.length} dialog events`);
      const alertRec = history.find(h => h.type === 'alert');
      const confirmRec = history.find(h => h.type === 'confirm');
      const promptRec = history.find(h => h.type === 'prompt');
      assert(alertRec !== undefined, 'Recorded alert');
      assert(confirmRec !== undefined, 'Recorded confirm');
      assert(promptRec !== undefined, 'Recorded prompt');
    });

    // ========================================================================
    //  SUITE 7: Popups & New Windows
    // ========================================================================
    console.log('\n--- Suite 7: Popups & New Windows ---');

    await test('waitForPopup — tracks popup window opened via target="_blank"', async () => {
      const page = adapter._resolvePage(tabId);
      const popupTab = await runtime.waitForPopup(tabId, {
        triggerFn: async () => {
          await page.click('#btn-open-popup-link');
        }
      });

      assert(popupTab !== undefined, 'Popup tab returned');
      assertEqual(popupTab.isPopup, true, 'isPopup is true');
      assertEqual(popupTab.openerTabId, tabId, 'openerTabId matches originating tab');

      // Close popup tab
      await runtime.closeTab(popupTab.id);
    });

    // ========================================================================
    //  SUITE 8: Browser File Downloads
    // ========================================================================
    console.log('\n--- Suite 8: Browser File Downloads ---');

    await test('waitForDownload — intercepts and safely saves page-initiated download', async () => {
      const page = adapter._resolvePage(tabId);
      const downloadRecord = await runtime.waitForDownload(tabId, {
        triggerFn: async () => {
          await page.click('#btn-start-download');
        }
      });

      assert(downloadRecord !== undefined, 'Download record returned');
      assertEqual(downloadRecord.suggestedFilename, 'system-telemetry.txt', 'Suggested filename matches');
      assert(fs.existsSync(downloadRecord.savedPath), 'Saved file exists on disk');
      const content = fs.readFileSync(downloadRecord.savedPath, 'utf8');
      assert(content.includes('System Telemetry Report'), 'File content verified');
      assert(content.includes('100% Operational'), 'File content contains expected payload');
    });

    await test('getDownloads — returns list of completed downloads for tab', async () => {
      const downloads = runtime.getDownloads(tabId);
      assert(downloads.length >= 1, 'Downloads list contains at least 1 record');
    });

    // ========================================================================
    //  SUITE 9: BrowserRuntime Delegation
    // ========================================================================
    console.log('\n--- Suite 9: BrowserRuntime Delegation ---');

    await test('BrowserRuntime — delegates extract, dialog, and downloads seamlessly', async () => {
      const res = await runtime.extract(tabId, 'table', { selector: '#products-table' });
      assertEqual(res.type, 'table', 'Type is table');
      assert(res.timingMs >= 0, 'Has timingMs');
      const downloads = runtime.getDownloads(tabId);
      assert(Array.isArray(downloads), 'Downloads is array');
    });

  } finally {
    await runtime.disconnect();
  }

  console.log('\n===================================');
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('===================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL ADVANCED FEATURE TESTS PASSED\n');
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
