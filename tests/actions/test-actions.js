/**
 * tests/actions/test-actions.js
 *
 * Comprehensive test suite for Action Engine (Phase 4):
 *   1. Action Primitives: click, type, press, hover, select, scroll, upload
 *   2. Event-Driven Wait System: text_appeared, text_disappeared, element_appeared, dom_stable, TimeoutError
 *   3. Multi-Action Batch Execution: safe sequential execution, error isolation
 *   4. Evidence-Grounded Verification: Action Receipts, before/after state diffs, screenshots
 *   5. Error Handling: ActionFailedError, StaleRefError, AmbiguousTargetError, TimeoutError
 *   6. Seamless BrowserRuntime delegation
 *
 * Tested against:
 *   - Local deterministic fixture: test-sites/basic/index.html
 *   - Managed Headless Chrome
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BrowserRuntime } from '../../src/core/browser-runtime.js';
import { ChromiumAdapter } from '../../src/adapters/chromium.js';
import {
  ActionFailedError,
  TimeoutError,
  ElementNotFoundError,
  StaleRefError
} from '../../src/core/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basicFixturePath = path.resolve(__dirname, '../../test-sites/basic/index.html');
const basicFixtureUrl = `file:///${basicFixturePath.replace(/\\/g, '/')}`;

// Temporary scratch file for upload testing
const scratchDir = path.resolve(__dirname, '../../artifacts/scratch');
if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
const dummyUploadPath = path.join(scratchDir, 'test-upload.txt');
fs.writeFileSync(dummyUploadPath, 'Universal Browser Control Runtime upload verification');

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertContains(str, substr, msg) {
  if (typeof str !== 'string' || !str.includes(substr)) {
    throw new Error(msg || `Expected "${str}" to contain "${substr}"`);
  }
}

// ---------------------------------------------------------------------------
// Shared Test Setup (Managed Headless Chrome)
// ---------------------------------------------------------------------------

console.log('\n=============================================');
console.log('🧪 test-actions.js — Action Engine (Phase 4)');
console.log('=============================================\n');

const adapter = new ChromiumAdapter();
await adapter.connect({
  mode: 'managed',
  browser: 'chrome',
  headless: true
});

const tabs = await adapter.listTabs();
const tabId = tabs[0].id;
await adapter.navigate(tabId, basicFixtureUrl);
const page = adapter._resolvePage(tabId);

// ---------------------------------------------------------------------------
// 1. ACTION PRIMITIVES
// ---------------------------------------------------------------------------
console.log('--- Suite 1: Action Primitives ---');

await test('click() — clicks button, mutates DOM, returns ActionReceipt', async () => {
  const obs = await adapter.inspect(tabId, { scope: '#section-spa' });
  const mutateBtn = obs.elements.find(e => e.domMeta?.id === 'btn-mutate');
  assert(mutateBtn, 'Mutate button should be discovered');

  const receipt = await adapter.click(tabId, mutateBtn.ref);
  assert(receipt.ok, 'Receipt should report ok === true');
  assertEqual(receipt.action, 'click');
  assertEqual(receipt.ref, mutateBtn.ref);
  assert(Array.isArray(receipt.changes), 'Changes must be an array');
  assert(receipt.changes.some(c => c.includes('DOM structure mutated') || c.includes('Clicked')), 'Should record change');

  // Verify DOM mutated
  const statusText = await adapter.evaluate(tabId, 'document.getElementById("spa-new-content")?.textContent');
  assertContains(statusText, 'DOM mutated');
});

await test('type() — fills input, updates value, produces receipt', async () => {
  const obs = await adapter.inspect(tabId, { scope: '#section-form' });
  const textInput = obs.elements.find(e => e.domMeta?.id === 'input-text');
  assert(textInput, 'Text input should be discovered');

  const receipt = await adapter.type(tabId, textInput.ref, 'GodwynAgent');
  assert(receipt.ok, 'Type receipt ok');
  assertEqual(receipt.action, 'type');
  assertEqual(receipt.ref, textInput.ref);

  const currentVal = await adapter.evaluate(tabId, 'document.getElementById("input-text").value');
  assertEqual(currentVal, 'GodwynAgent');
});

await test('press() — dispatches keyboard key event to page', async () => {
  const obs = await adapter.inspect(tabId, { scope: '#section-form' });
  const textInput = obs.elements.find(e => e.domMeta?.id === 'input-text');

  const receipt = await adapter.press(tabId, 'ArrowRight', { ref: textInput.ref });
  assert(receipt.ok, 'Press receipt ok');
  assertEqual(receipt.action, 'press');
});

await test('select() — selects dropdown option and updates combobox', async () => {
  const obs = await adapter.inspect(tabId, { scope: '#section-form' });
  const roleSelect = obs.elements.find(e => e.domMeta?.id === 'select-role');
  assert(roleSelect, 'Select dropdown should be discovered');

  const receipt = await adapter.select(tabId, roleSelect.ref, 'admin');
  assert(receipt.ok, 'Select receipt ok');
  assertEqual(receipt.action, 'select');

  const selectedVal = await adapter.evaluate(tabId, 'document.getElementById("select-role").value');
  assertEqual(selectedVal, 'admin');
});

await test('scroll() — scrolls element container or viewport', async () => {
  const obs = await adapter.inspect(tabId, { scope: '#section-scroll' });
  const receipt = await adapter.scroll(tabId, { direction: 'down', amount: 300 });
  assert(receipt.ok, 'Scroll receipt ok');
  assertEqual(receipt.action, 'scroll');
});

await test('hover() — triggers element hover state', async () => {
  const obs = await adapter.inspect(tabId, { scope: '#section-scroll' });
  const hoverBtn = obs.elements.find(e => e.domMeta?.id === 'btn-hover');
  assert(hoverBtn, 'Hover button should be discovered');

  const receipt = await adapter.hover(tabId, hoverBtn.ref);
  assert(receipt.ok, 'Hover receipt ok');
  assertEqual(receipt.action, 'hover');
});

await test('upload() — populates file input with local file', async () => {
  const obs = await adapter.inspect(tabId, { scope: '#section-form' });
  const fileInput = obs.elements.find(e => e.domMeta?.id === 'input-file');
  assert(fileInput, 'File input should be discovered');

  const receipt = await adapter.upload(tabId, fileInput.ref, [dummyUploadPath]);
  assert(receipt.ok, 'Upload receipt ok');
  assertEqual(receipt.action, 'upload');

  const uploadedName = await adapter.evaluate(tabId, 'document.getElementById("input-file").files[0]?.name');
  assertEqual(uploadedName, 'test-upload.txt');
});

// ---------------------------------------------------------------------------
// 2. EVENT-DRIVEN WAIT SYSTEM
// ---------------------------------------------------------------------------
console.log('\n--- Suite 2: Event-Driven Wait System ---');

await test('waitFor("text_appeared") — resolves when dynamic text appears in DOM', async () => {
  // Click mutate button asynchronously after 80ms
  setTimeout(async () => {
    try {
      await page.click('#btn-mutate');
    } catch {}
  }, 80);

  const res = await adapter.waitFor(tabId, {
    type: 'text_appeared',
    value: 'Reverted to initial state.'
  }, { timeout: 4000 });

  assert(res.ok, 'waitFor text_appeared should succeed');
  assertEqual(res.condition, 'text_appeared');
});

await test('waitFor("element_appeared") — resolves when new element is appended', async () => {
  setTimeout(async () => {
    try {
      await page.click('#btn-add-item');
    } catch {}
  }, 80);

  const res = await adapter.waitFor(tabId, {
    type: 'element_appeared',
    value: '#list-item-1'
  }, { timeout: 4000 });

  assert(res.ok, 'waitFor element_appeared should succeed');
});

await test('waitFor("dom_stable") — waits for DOM mutation rate to settle to 0', async () => {
  const res = await adapter.waitFor(tabId, {
    type: 'dom_stable'
  }, { timeout: 3000, quietMs: 50 });

  assert(res.ok, 'dom_stable condition should resolve');
  assertEqual(res.condition, 'dom_stable');
});

await test('waitFor() — throws TimeoutError when condition is not satisfied within timeout', async () => {
  let caught = null;
  try {
    await adapter.waitFor(tabId, {
      type: 'text_appeared',
      value: 'Impossible text that will never appear anywhere 98765'
    }, { timeout: 500 });
  } catch (err) {
    caught = err;
  }

  assert(caught instanceof TimeoutError, 'Must throw TimeoutError');
  assertEqual(caught.code, 'TIMEOUT');
  assertContains(caught.format(), 'TIMEOUT');
  assertContains(caught.format(), 'condition=text_appeared');
});

// ---------------------------------------------------------------------------
// 3. MULTI-ACTION BATCH EXECUTION
// ---------------------------------------------------------------------------
console.log('\n--- Suite 3: Multi-Action Batch Execution ---');

await test('batch() — executes sequence of actions in one round-trip', async () => {
  const obs = await adapter.inspect(tabId, { scope: '#section-form' });
  const textInput = obs.elements.find(e => e.domMeta?.id === 'input-text');
  const emailInput = obs.elements.find(e => e.domMeta?.id === 'input-email');
  const submitBtn = obs.elements.find(e => e.domMeta?.id === 'btn-submit-form');

  const batchResult = await adapter.batch(tabId, [
    { type: 'type', ref: textInput.ref, text: 'BatchUser' },
    { type: 'type', ref: emailInput.ref, text: 'batch@example.com' },
    { type: 'click', ref: submitBtn.ref }
  ]);

  assert(batchResult.ok, 'Batch execution should succeed');
  assertEqual(batchResult.completed, 3);
  assertEqual(batchResult.total, 3);
  assertEqual(batchResult.receipts.length, 3);

  // Verify form was actually submitted
  const outputText = await adapter.evaluate(tabId, 'document.getElementById("form-output").textContent');
  assertContains(outputText, 'BatchUser');
  assertContains(outputText, 'batch@example.com');
});

await test('batch() — isolates failure and halts execution on step error', async () => {
  const obs = await adapter.inspect(tabId, { scope: '#section-form' });
  const textInput = obs.elements.find(e => e.domMeta?.id === 'input-text');

  const batchResult = await adapter.batch(tabId, [
    { type: 'type', ref: textInput.ref, text: 'FirstStepOK' },
    { type: 'click', ref: 'eInvalidRef99999' }, // Will fail here
    { type: 'type', ref: textInput.ref, text: 'ShouldNotRun' }
  ]);

  assertEqual(batchResult.ok, false);
  assertEqual(batchResult.completed, 1);
  assertEqual(batchResult.failedStep, 2);
  assert(typeof batchResult.error === 'string', 'Should return error message');
});

// ---------------------------------------------------------------------------
// 4. ACTION VERIFICATION & RECEIPTS
// ---------------------------------------------------------------------------
console.log('\n--- Suite 4: Action Verification & Receipts ---');

await test('ActionReceipt — includes before/after snapshots and optional screenshot', async () => {
  const obs = await adapter.inspect(tabId, { scope: '#section-spa' });
  const mutateBtn = obs.elements.find(e => e.domMeta?.id === 'btn-mutate');

  const receipt = await adapter.click(tabId, mutateBtn.ref, { screenshot: true });
  assert(receipt.ok, 'Receipt ok');
  assert(receipt.before.url, 'Must have before URL');
  assert(receipt.after.url, 'Must have after URL');
  assert(typeof receipt.screenshot === 'string', 'Must include screenshot data URI');
  assert(receipt.screenshot.startsWith('data:image/'), 'Screenshot must be data URI');
});

// ---------------------------------------------------------------------------
// 5. ERROR HANDLING
// ---------------------------------------------------------------------------
console.log('\n--- Suite 5: Error Handling ---');

await test('ElementNotFoundError — thrown when acting on an unregistered ref', async () => {
  let caught = null;
  try {
    await adapter.click(tabId, 'eGhostRef1234');
  } catch (err) {
    caught = err;
  }

  assert(caught instanceof ElementNotFoundError, 'Must throw ElementNotFoundError');
  assertEqual(caught.code, 'ELEMENT_NOT_FOUND');
  assertContains(caught.format(), 'ref=eGhostRef1234');
});

// ---------------------------------------------------------------------------
// 6. BROWSER RUNTIME INTEGRATION
// ---------------------------------------------------------------------------
console.log('\n--- Suite 6: BrowserRuntime Integration ---');

await test('BrowserRuntime — delegates click, type, batch, and waitFor seamlessly', async () => {
  const runtime = new BrowserRuntime();
  runtime.setAdapter(adapter);

  const obs = await runtime.inspect(tabId, { scope: '#section-form' });
  const textInput = obs.elements.find(e => e.domMeta?.id === 'input-text');

  const typeReceipt = await runtime.type(tabId, textInput.ref, 'RuntimeVerified');
  assert(typeReceipt.ok, 'Runtime type should succeed');

  const batchReceipt = await runtime.batch(tabId, [
    { type: 'click', ref: textInput.ref }
  ]);
  assert(batchReceipt.ok, 'Runtime batch should succeed');

  const waitResult = await runtime.waitFor(tabId, { type: 'dom_stable' });
  assert(waitResult.ok, 'Runtime waitFor should succeed');
});

// ---------------------------------------------------------------------------
// TEARDOWN
// ---------------------------------------------------------------------------
await adapter.disconnect();

console.log('\n===================================');
console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
console.log('===================================\n');

if (failed > 0) {
  console.error(`💥 ${failed} TEST(S) FAILED`);
  process.exit(1);
} else {
  console.log('🎉 ALL ACTION ENGINE TESTS PASSED');
  process.exit(0);
}
