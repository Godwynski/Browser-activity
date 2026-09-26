/**
 * tests/observation/test-observation.js
 *
 * Comprehensive test suite for Progressive Observation Engine (Phase 3):
 *   1. Progressive Levels (0: Minimal, 1: Compact, 2: Targeted, 3: Full, 4: Screenshot)
 *   2. Scoping (scope: '#section-form') and Filtering (inputs, buttons_links)
 *   3. Deep traversal: Open Shadow DOM & Nested Shadow Roots
 *   4. Deep traversal: Embedded Same-Origin Iframes
 *   5. Ephemeral reference generation (e1, e2, ...) and compact formatting
 *   6. Server-Side Element Registry and Candidate Fingerprinting
 *   7. Stale Reference Recovery:
 *      - Automatic semantic recovery on DOM mutation
 *      - Ambiguity detection (AmbiguousTargetError)
 *      - Zero match detection (StaleRefError)
 *      - Unknown ref rejection (ElementNotFoundError)
 *   8. Seamless integration with ChromiumAdapter and BrowserRuntime
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { BrowserRuntime } from '../../src/core/browser-runtime.js';
import { ChromiumAdapter } from '../../src/adapters/chromium.js';
import {
  ObservationEngine,
  ProgressiveLevel,
  ElementRegistry
} from '../../src/observation/index.js';
import {
  ElementNotFoundError,
  StaleRefError,
  AmbiguousTargetError
} from '../../src/core/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basicFixturePath = path.resolve(__dirname, '../../test-sites/basic/index.html');
const basicFixtureUrl = `file:///${basicFixturePath.replace(/\\/g, '/')}`;

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

console.log('\n========================================================');
console.log('🧪 test-observation.js — Progressive Observation Engine');
console.log('========================================================\n');

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
// 1. PROGRESSIVE OBSERVATION LEVELS (0 to 4)
// ---------------------------------------------------------------------------
console.log('--- Suite 1: Progressive Observation Levels ---');

await test('Level 0 (Minimal State) — returns 0 elements with url/title/scroll/viewport', async () => {
  const obs = await adapter.inspect(tabId, { level: ProgressiveLevel.MINIMAL });
  assertEqual(obs.level, 0);
  assertEqual(obs.elements.length, 0);
  assertEqual(obs.elementCount, 0);
  assertEqual(obs.compact, '');
  assertEqual(obs.screenshot, null);
  assertContains(obs.page.url, 'basic/index.html');
  assertContains(obs.page.title, 'Basic Test Site');
  assert(obs.page.viewport.width > 0, 'Viewport width should be > 0');
  assert(obs.page.viewport.height > 0, 'Viewport height should be > 0');
});

await test('Level 1 (Compact Interactive) — returns visible actionable elements in 1-line format', async () => {
  const obs = await adapter.inspect(tabId, { level: ProgressiveLevel.COMPACT });
  assertEqual(obs.level, 1);
  assert(obs.elements.length > 5, 'Should discover multiple interactive elements');
  assert(obs.compact.length > 0, 'Compact text should not be empty');

  // Verify compact format contains [e1] tag "name"
  assert(obs.compact.includes('[e1]'), 'Should contain [e1]');
  assertContains(obs.compact, 'button "Submit Form"');
  assertContains(obs.compact, 'textbox');

  // Check first element structure
  const first = obs.elements[0];
  assert(typeof first.ref === 'string', 'Element must have ref');
  assert(typeof first.role === 'string', 'Element must have role');
  assert(first.inViewport === true || first.inViewport === false);
});

await test('Level 2 (Targeted Inspection) — filters elements matching semantic query', async () => {
  const obs = await adapter.inspect(tabId, {
    level: ProgressiveLevel.TARGETED,
    query: 'Mutate'
  });

  assertEqual(obs.level, 2);
  assert(obs.elements.length >= 1, 'Should find matching element');
  for (const el of obs.elements) {
    const matches = (el.name && el.name.toLowerCase().includes('mutate')) ||
                    (el.role && el.role.toLowerCase().includes('mutate')) ||
                    (el.domMeta?.id && el.domMeta.id.toLowerCase().includes('mutate'));
    assert(matches, `Element ${el.ref} should match query "Mutate"`);
  }
});

await test('Level 2 (Targeted Inspection) — returns 0 elements for non-existent query', async () => {
  const obs = await adapter.inspect(tabId, {
    level: ProgressiveLevel.TARGETED,
    query: 'non_existent_search_query_12345'
  });

  assertEqual(obs.elements.length, 0);
  assertEqual(obs.compact, '(No interactive elements found)');
});

await test('Level 3 (Full Inspection) — includes structural and off-screen elements', async () => {
  const compactObs = await adapter.inspect(tabId, { level: ProgressiveLevel.COMPACT });
  const fullObs = await adapter.inspect(tabId, { level: ProgressiveLevel.FULL });

  assert(fullObs.elements.length >= compactObs.elements.length,
    `Full inspection (${fullObs.elements.length}) should have at least as many elements as compact (${compactObs.elements.length})`
  );
});

await test('Level 4 (Screenshot) — includes base64 viewport capture', async () => {
  const obs = await adapter.inspect(tabId, {
    level: ProgressiveLevel.SCREENSHOT,
    screenshotFormat: 'jpeg',
    screenshotQuality: 60
  });

  assertEqual(obs.level, 4);
  assert(typeof obs.screenshot === 'string', 'Screenshot should be string');
  assert(obs.screenshot.startsWith('data:image/jpeg;base64,'), 'Screenshot should be data URI');
  assert(obs.elements.length > 0, 'Should still include discovered elements');
});

// ---------------------------------------------------------------------------
// 2. SCOPING & FILTERING
// ---------------------------------------------------------------------------
console.log('\n--- Suite 2: Scoping & Filtering ---');

await test('Scope Selector — restricts observation to specified container (#section-form)', async () => {
  const obs = await adapter.inspect(tabId, {
    level: ProgressiveLevel.COMPACT,
    scope: '#section-form'
  });

  assert(obs.elements.length > 0, 'Form section should contain elements');
  for (const el of obs.elements) {
    // None should be the "Mutate DOM" button from section 2
    assert(el.name !== 'Mutate DOM', 'Should not contain elements outside #section-form');
  }
});

await test('Filter "inputs" — returns only input/textbox/select/checkbox controls', async () => {
  const obs = await adapter.inspect(tabId, {
    level: ProgressiveLevel.COMPACT,
    filter: 'inputs'
  });

  assert(obs.elements.length > 0, 'Should find inputs');
  const allowed = new Set(['textbox', 'combobox', 'checkbox', 'radio', 'input']);
  for (const el of obs.elements) {
    assert(allowed.has(el.role), `Role '${el.role}' should be an input role`);
  }
});

await test('Filter "buttons_links" — returns only buttons and links', async () => {
  const obs = await adapter.inspect(tabId, {
    level: ProgressiveLevel.COMPACT,
    filter: 'buttons_links'
  });

  assert(obs.elements.length > 0, 'Should find buttons and links');
  const allowed = new Set(['button', 'link', 'tab']);
  for (const el of obs.elements) {
    assert(allowed.has(el.role), `Role '${el.role}' should be button or link`);
  }
});

// ---------------------------------------------------------------------------
// 3. SHADOW DOM & IFRAME TRAVERSAL
// ---------------------------------------------------------------------------
console.log('\n--- Suite 3: Shadow DOM & Iframes ---');

await test('Open Shadow DOM — discovers elements nested inside open shadow root', async () => {
  const obs = await adapter.inspect(tabId, {
    level: ProgressiveLevel.COMPACT,
    scope: '#section-shadow'
  });

  assert(obs.elements.length >= 2, 'Should discover shadow DOM elements');
  const shadowBtn = obs.elements.find(e => e.domMeta?.id === 'shadow-btn' || (e.name && e.name.includes('Shadow Button')));
  assert(shadowBtn, 'Must discover button inside open shadow root');
  assert(shadowBtn.isShadow, 'Candidate must be flagged isShadow === true');
  assertContains(obs.compact, '(shadow)');
});

await test('Embedded Iframe — discovers elements nested inside same-origin iframe', async () => {
  const obs = await adapter.inspect(tabId, {
    level: ProgressiveLevel.COMPACT,
    scope: '#section-iframe'
  });

  assert(obs.elements.length >= 1, 'Should discover iframe elements');
  const iframeBtn = obs.elements.find(e => e.domMeta?.id === 'iframe-btn' || (e.name && e.name.includes('Iframe Button')));
  assert(iframeBtn, 'Must discover button inside iframe');
  assert(iframeBtn.frameIndex > 0, 'Must have frameIndex > 0');
  assertContains(obs.compact, `(iframe ${iframeBtn.frameIndex})`);
});

// ---------------------------------------------------------------------------
// 4. SERVER-SIDE ELEMENT REGISTRY & STALE-REF RECOVERY
// ---------------------------------------------------------------------------
console.log('\n--- Suite 4: Element Registry & Stale-Ref Recovery ---');

await test('Registry — stores observation history and looks up candidate by ref', async () => {
  const obs = await adapter.inspect(tabId, { level: ProgressiveLevel.COMPACT });
  const registry = adapter.getObservationEngine().registry;

  const latest = registry.getLatestObservation(tabId);
  assertEqual(latest.obsId, obs.obsId);

  const candidate = registry.findElementCandidate(tabId, 'e1');
  assert(candidate, 'Must find candidate for e1');
  assertEqual(candidate.ref, 'e1');
});

await test('Live Resolution — resolveRef() returns live Playwright locator for valid ref', async () => {
  const obs = await adapter.inspect(tabId, { level: ProgressiveLevel.COMPACT });
  const submitCandidate = obs.elements.find(e => e.domMeta?.id === 'btn-submit-form');
  assert(submitCandidate, 'Submit button candidate must exist');

  const resolved = await adapter.resolveRef(tabId, submitCandidate.ref);
  assertEqual(resolved.ref, submitCandidate.ref);
  assertEqual(resolved.recovered, false);
  assert(resolved.locator, 'Must return live Playwright locator');
  assertEqual(await resolved.locator.count(), 1);
});

await test('Stale-Ref Recovery (Automatic) — recovers element using semantic fingerprint when ref is from previous state', async () => {
  const registry = adapter.getObservationEngine().registry;

  // Synthesize an older candidate whose direct ID is outdated/stale, but role + name match
  const fakeOldCandidate = {
    ref: 'eOld99',
    role: 'button',
    name: 'Mutate DOM',
    frameIndex: 0,
    domMeta: {
      id: 'old-stale-mutated-id-123',
      tag: 'button'
    }
  };

  registry.registerObservation(tabId, {
    obsId: 'obs_synthetic_history',
    level: 1,
    pageState: {},
    elements: [fakeOldCandidate]
  });

  // Call resolveRef on eOld99 — direct lookup in latest won't find it, semantic recovery kicks in
  const resolved = await adapter.resolveRef(tabId, 'eOld99');
  assertEqual(resolved.ref, 'eOld99');
  assertEqual(resolved.recovered, true);
  assertEqual(resolved.recoveryMethod, 'role_and_exact_name');
  assertEqual(await resolved.locator.count(), 1);
});

await test('Stale-Ref Recovery (Ambiguous Target) — throws AmbiguousTargetError when multiple duplicates exist', async () => {
  const registry = adapter.getObservationEngine().registry;

  // Inject duplicate elements into DOM to create ambiguity
  await page.evaluate(() => {
    const div = document.createElement('div');
    div.id = 'ambiguity-test-container';
    div.innerHTML = `
      <button class="dup-btn" name="dup">Duplicate Action</button>
      <button class="dup-btn" name="dup">Duplicate Action</button>
      <button class="dup-btn" name="dup">Duplicate Action</button>
    `;
    document.body.appendChild(div);
  });

  const fakeAmbiguousCandidate = {
    ref: 'eDup1',
    role: 'button',
    name: 'Duplicate Action',
    frameIndex: 0,
    domMeta: {
      tag: 'button',
      nameAttr: 'dup'
    }
  };

  registry.registerObservation(tabId, {
    obsId: 'obs_ambiguous_test',
    level: 1,
    pageState: {},
    elements: [fakeAmbiguousCandidate]
  });

  let caught = null;
  try {
    await adapter.resolveRef(tabId, 'eDup1');
  } catch (err) {
    caught = err;
  }

  // Cleanup test container
  await page.evaluate(() => {
    document.getElementById('ambiguity-test-container')?.remove();
  });

  assert(caught instanceof AmbiguousTargetError, 'Must throw AmbiguousTargetError');
  assertEqual(caught.code, 'AMBIGUOUS_TARGET');
  assertContains(caught.format(), 'AMBIGUOUS_TARGET');
  assertContains(caught.format(), 'matches=3');
});

await test('Stale-Ref Recovery (Zero Candidates) — throws StaleRefError when element was deleted', async () => {
  const registry = adapter.getObservationEngine().registry;

  const fakeDeletedCandidate = {
    ref: 'eDeleted1',
    role: 'button',
    name: 'Completely Gone Button 987654321',
    frameIndex: 0,
    domMeta: {
      id: 'btn-never-existed-xyz',
      tag: 'button'
    }
  };

  registry.registerObservation(tabId, {
    obsId: 'obs_deleted_test',
    level: 1,
    pageState: {},
    elements: [fakeDeletedCandidate]
  });

  let caught = null;
  try {
    await adapter.resolveRef(tabId, 'eDeleted1');
  } catch (err) {
    caught = err;
  }

  assert(caught instanceof StaleRefError, 'Must throw StaleRefError');
  assertEqual(caught.code, 'STALE_REF');
  assertContains(caught.format(), 'STALE_REF');
  assertContains(caught.format(), 'recovery=failed');
});

await test('ElementNotFoundError — throws when ref was never registered in any observation', async () => {
  let caught = null;
  try {
    await adapter.resolveRef(tabId, 'eNonExistent99999');
  } catch (err) {
    caught = err;
  }

  assert(caught instanceof ElementNotFoundError, 'Must throw ElementNotFoundError');
  assertEqual(caught.code, 'ELEMENT_NOT_FOUND');
  assertContains(caught.format(), 'ref=eNonExistent99999');
});

// ---------------------------------------------------------------------------
// 5. BROWSER RUNTIME INTEGRATION
// ---------------------------------------------------------------------------
console.log('\n--- Suite 5: BrowserRuntime Integration ---');

await test('BrowserRuntime — inspect() and resolveRef() delegate smoothly to adapter', async () => {
  const runtime = new BrowserRuntime();
  runtime.setAdapter(adapter);

  const obs = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
  assert(obs.elements.length > 0, 'Runtime inspect should return elements');

  const resolved = await runtime.resolveRef(tabId, obs.elements[0].ref);
  assert(resolved.locator, 'Runtime resolveRef should return locator');
});

// ---------------------------------------------------------------------------
// 6. DEDICATED TEST BENCHES (Nested Shadow DOM & Nested Iframes)
// ---------------------------------------------------------------------------
console.log('\n--- Suite 6: Dedicated Test Benches ---');

await test('Nested Shadow DOM Test Bench — pierces multiple nested open shadow roots', async () => {
  const shadowFixturePath = path.resolve(__dirname, '../../test-sites/shadow-dom/index.html');
  const shadowUrl = `file:///${shadowFixturePath.replace(/\\/g, '/')}`;
  await adapter.navigate(tabId, shadowUrl);

  const obs = await adapter.inspect(tabId, { level: ProgressiveLevel.COMPACT });
  assert(obs.elements.length >= 4, 'Should discover all shadow root elements');

  const deepNestedBtn = obs.elements.find(e => e.domMeta?.id === 'btn-nested-shadow');
  assert(deepNestedBtn, 'Must discover deeply nested button in child shadow root');
  assert(deepNestedBtn.isShadow, 'Must be flagged isShadow === true');

  const parentShadowBtn = obs.elements.find(e => e.domMeta?.id === 'btn-parent-shadow');
  assert(parentShadowBtn, 'Must discover parent shadow button');
});

await test('Nested Iframes Test Bench — discovers elements across nested child frames', async () => {
  const iframeFixturePath = path.resolve(__dirname, '../../test-sites/iframe/index.html');
  const iframeUrl = `file:///${iframeFixturePath.replace(/\\/g, '/')}`;
  await adapter.navigate(tabId, iframeUrl);

  const obs = await adapter.inspect(tabId, { level: ProgressiveLevel.COMPACT });
  assert(obs.elements.length >= 3, 'Should discover elements across primary and nested frames');

  const f1Btn = obs.elements.find(e => e.domMeta?.id === 'f1-btn');
  assert(f1Btn, 'Must discover button in Frame 1');

  const f3Btn = obs.elements.find(e => e.domMeta?.id === 'f3-btn');
  assert(f3Btn, 'Must discover button in nested Frame 3');
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
  console.log('🎉 ALL OBSERVATION ENGINE TESTS PASSED');
  process.exit(0);
}
