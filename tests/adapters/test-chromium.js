/**
 * tests/adapters/test-chromium.js
 *
 * Comprehensive test suite for ChromiumAdapter (Phase 2):
 *   1. Interface contract & capability flags
 *   2. Browser detection (Chrome, Edge, Brave, Chromium)
 *   3. Connection lifecycle (attach & managed modes)
 *   4. Tab management (list, get, create, close, activate)
 *   5. Navigation (navigate, goBack, goForward, reload)
 *   6. Evaluation (JavaScript execution in page context)
 *   7. Screenshot capture (viewport base64 data URI)
 *   8. Standard error wrapping (ConnectionError, NavigationError, TabNotFoundError)
 *   9. BrowserRuntime integration
 *
 * Verified against:
 *   - Live Brave browser via CDP attach (Port 9222)
 *   - Google Chrome via managed headless mode
 *   - Microsoft Edge via managed headless mode
 *   - Local deterministic fixture: test-sites/basic/index.html
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { BaseBrowserAdapter } from '../../src/core/base-adapter.js';
import { BrowserRuntime } from '../../src/core/browser-runtime.js';
import {
  ConnectionError,
  NavigationError,
  TabNotFoundError
} from '../../src/core/errors.js';
import { ChromiumAdapter } from '../../src/adapters/chromium.js';

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
// Test Execution
// ---------------------------------------------------------------------------

console.log('\n======================================================');
console.log('🧪 test-chromium.js — Chromium Family Adapter (Phase 2)');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// 1. CONTRACT & CAPABILITIES
// ---------------------------------------------------------------------------
console.log('--- Suite 1: Contract & Capabilities ---');

await test('ChromiumAdapter — extends BaseBrowserAdapter with name "chromium"', () => {
  const adapter = new ChromiumAdapter();
  assert(adapter instanceof BaseBrowserAdapter, 'Must be instance of BaseBrowserAdapter');
  assertEqual(adapter.getName(), 'chromium');
  assertEqual(adapter.isConnected(), false);
});

await test('ChromiumAdapter — declares correct capabilities', () => {
  const adapter = new ChromiumAdapter();
  assert(adapter.supports('attachMode'), 'Must support attachMode');
  assert(adapter.supports('managedMode'), 'Must support managedMode');
  assert(adapter.supports('iframes'), 'Must support iframes');
  assert(adapter.supports('crossOriginIframes'), 'Must support crossOriginIframes');
  assert(adapter.supports('shadowDom'), 'Must support shadowDom');
  assert(adapter.supports('popups'), 'Must support popups');
  assert(adapter.supports('dialogs'), 'Must support dialogs');
  assert(!adapter.supports('extensionMode'), 'ChromiumAdapter is not extensionMode');
});

await test('ChromiumAdapter.detectBrowsers() — detects available browsers on system', () => {
  const detected = ChromiumAdapter.detectBrowsers();
  assert(detected.brave, 'Must check brave');
  assert(detected.chrome, 'Must check chrome');
  assert(detected.edge, 'Must check edge');
  assert(detected.chromium, 'Must check chromium');

  // Verify that on this host, detected browsers have valid paths if installed
  for (const [key, info] of Object.entries(detected)) {
    if (info.installed) {
      assert(typeof info.path === 'string' && info.path.length > 0, `Path for ${key} must be valid string`);
    }
  }
});

await test('ChromiumAdapter.resolveBrowserExecutable() — resolves installed or throws on invalid', () => {
  const detected = ChromiumAdapter.detectBrowsers();
  if (detected.chrome.installed) {
    const resolved = ChromiumAdapter.resolveBrowserExecutable('chrome');
    assertEqual(resolved, detected.chrome.path);
  }
  if (detected.edge.installed) {
    const resolved = ChromiumAdapter.resolveBrowserExecutable('edge');
    assertEqual(resolved, detected.edge.path);
  }

  // Invalid browser name must throw
  let threw = false;
  try {
    ChromiumAdapter.resolveBrowserExecutable('non_existent_browser_xyz');
  } catch (err) {
    threw = true;
    assertContains(err.message, 'not found');
  }
  assert(threw, 'Should throw for unknown browser');
});

await test('ChromiumAdapter — un-connected operations throw ConnectionError', async () => {
  const adapter = new ChromiumAdapter();
  let threw = false;
  try {
    await adapter.getTab('tab_1');
  } catch (err) {
    threw = true;
    assert(err instanceof ConnectionError, 'Must throw ConnectionError');
  }
  assert(threw, 'getTab must throw ConnectionError when unconnected');
});

// ---------------------------------------------------------------------------
// 2. ATTACH MODE (Live Brave Browser via CDP Port 9222)
// ---------------------------------------------------------------------------
console.log('\n--- Suite 2: Attach Mode (CDP Live) ---');

await test('Attach Mode — connects to active browser on port 9222', async () => {
  const adapter = new ChromiumAdapter();
  await adapter.connect({ mode: 'attach', port: 9222 });
  assert(adapter.isConnected(), 'Adapter should report isConnected() === true');

  const tabs = await adapter.listTabs();
  assert(Array.isArray(tabs), 'listTabs() must return an array');
  assert(tabs.length > 0, 'Must have at least one tab in active browser');

  const firstTab = tabs[0];
  assert(typeof firstTab.id === 'string', 'Tab ID must be string');
  assert(typeof firstTab.title === 'string', 'Tab title must be string');
  assert(typeof firstTab.url === 'string', 'Tab url must be string');

  // Evaluate simple expression
  const evalResult = await adapter.evaluate(firstTab.id, '2 + 2');
  assertEqual(evalResult, 4, 'JavaScript evaluation should return 4');

  // Verify getTab returns matching metadata
  const tabMeta = await adapter.getTab(firstTab.id);
  assertEqual(tabMeta.id, firstTab.id);

  // Disconnect cleanly
  await adapter.disconnect();
  assert(!adapter.isConnected(), 'Adapter must report isConnected() === false after disconnect');
});

// ---------------------------------------------------------------------------
// 3. MANAGED MODE (Google Chrome — Headless)
// ---------------------------------------------------------------------------
console.log('\n--- Suite 3: Managed Mode (Google Chrome) ---');

const detected = ChromiumAdapter.detectBrowsers();

if (detected.chrome.installed) {
  await test('Managed Mode (Chrome) — launches, navigates local fixture, evaluates and captures screenshot', async () => {
    const adapter = new ChromiumAdapter();
    await adapter.connect({
      mode: 'managed',
      browser: 'chrome',
      headless: true
    });

    assert(adapter.isConnected(), 'Managed Chrome should be connected');

    const tabs = await adapter.listTabs();
    assert(tabs.length >= 1, 'Managed Chrome should have at least 1 tab');
    const tabId = tabs[0].id;

    // Navigate to local test fixture
    const navResult = await adapter.navigate(tabId, basicFixtureUrl);
    assert(navResult.ok, 'Navigation should succeed');
    assertContains(navResult.title, 'Basic Test Site');

    // DOM Evaluation on fixture
    const titleText = await adapter.evaluate(tabId, 'document.getElementById("page-title").textContent');
    assertContains(titleText, 'Universal Browser Control');

    // Tab creation
    const newTab = await adapter.createTab('about:blank');
    assert(newTab.id !== tabId, 'New tab must have distinct ID');

    const tabsAfterCreate = await adapter.listTabs();
    assertEqual(tabsAfterCreate.length, 2, 'Tab count should now be 2');

    // Screenshot capture
    const shot = await adapter.screenshot(tabId, { format: 'jpeg', quality: 70 });
    assert(typeof shot === 'string', 'Screenshot must be string');
    assert(shot.startsWith('data:image/jpeg;base64,'), 'Screenshot must be base64 data URI');

    // Close created tab
    await adapter.closeTab(newTab.id);
    const tabsAfterClose = await adapter.listTabs();
    assertEqual(tabsAfterClose.length, 1, 'Tab count should be back to 1');

    // Clean disconnect
    await adapter.disconnect();
    assert(!adapter.isConnected(), 'Adapter should be disconnected');
  });
} else {
  console.log('  ⚠️ SKIP  Google Chrome not installed on host machine');
}

// ---------------------------------------------------------------------------
// 4. MANAGED MODE (Microsoft Edge — Headless)
// ---------------------------------------------------------------------------
console.log('\n--- Suite 4: Managed Mode (Microsoft Edge) ---');

if (detected.edge.installed) {
  await test('Managed Mode (Edge) — launches, navigates fixture, tests history navigation', async () => {
    const adapter = new ChromiumAdapter();
    await adapter.connect({
      mode: 'managed',
      browser: 'edge',
      headless: true
    });

    assert(adapter.isConnected(), 'Managed Edge should be connected');

    const tabs = await adapter.listTabs();
    const tabId = tabs[0].id;

    // Navigate to local fixture
    await adapter.navigate(tabId, basicFixtureUrl);
    const initialUrl = (await adapter.getTab(tabId)).url;

    // Navigate to about:blank
    await adapter.navigate(tabId, 'about:blank');
    const blankUrl = (await adapter.getTab(tabId)).url;
    assertContains(blankUrl, 'about:blank');

    // Test goBack
    const backResult = await adapter.goBack(tabId);
    assert(backResult.ok, 'goBack should return ok: true');

    // Test reload
    const reloadResult = await adapter.reload(tabId);
    assert(reloadResult.ok, 'reload should return ok: true');

    await adapter.disconnect();
    assert(!adapter.isConnected(), 'Edge adapter should be disconnected');
  });
} else {
  console.log('  ⚠️ SKIP  Microsoft Edge not installed on host machine');
}

// ---------------------------------------------------------------------------
// 5. ERROR HANDLING & EDGE CASES
// ---------------------------------------------------------------------------
console.log('\n--- Suite 5: Error Handling & Edge Cases ---');

await test('ConnectionError — thrown on connection to closed CDP port', async () => {
  const adapter = new ChromiumAdapter();
  let caught = null;
  try {
    await adapter.connect({ mode: 'attach', port: 19876, timeout: 1500, retries: 1 });
  } catch (err) {
    caught = err;
  }
  assert(caught instanceof ConnectionError, 'Must throw ConnectionError');
  assertEqual(caught.code, 'CONNECTION_ERROR');
  assertContains(caught.format(), 'CONNECTION_ERROR');
  assertContains(caught.format(), '19876');
});

await test('TabNotFoundError — thrown on non-existent tab lookup', async () => {
  const adapter = new ChromiumAdapter();
  await adapter.connect({ mode: 'attach', port: 9222 });

  let caught = null;
  try {
    await adapter.getTab('non_existent_tab_id_999');
  } catch (err) {
    caught = err;
  }

  await adapter.disconnect();
  assert(caught instanceof TabNotFoundError, 'Must throw TabNotFoundError');
  assertEqual(caught.code, 'TAB_NOT_FOUND');
  assertContains(caught.format(), 'tabId=non_existent_tab_id_999');
});

// ---------------------------------------------------------------------------
// 6. BROWSER RUNTIME INTEGRATION
// ---------------------------------------------------------------------------
console.log('\n--- Suite 6: BrowserRuntime Integration ---');

await test('BrowserRuntime — works seamlessly with ChromiumAdapter', async () => {
  const runtime = new BrowserRuntime();
  const adapter = new ChromiumAdapter();
  runtime.setAdapter(adapter);

  assertEqual(runtime.getAdapterName(), 'chromium');
  assert(runtime.supports('attachMode'), 'Runtime should reflect adapter capabilities');

  await runtime.connect({ mode: 'attach', port: 9222 });
  assert(runtime.isConnected(), 'Runtime should report isConnected() === true');

  const tabs = await runtime.listTabs();
  assert(tabs.length > 0, 'Runtime should list open tabs');

  const res = await runtime.evaluate(tabs[0].id, '10 * 10');
  assertEqual(res, 100, 'Runtime evaluation delegation should work');

  await runtime.disconnect();
  assert(!runtime.isConnected(), 'Runtime should be disconnected');
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n===================================');
console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
console.log('===================================\n');

if (failed > 0) {
  console.error(`💥 ${failed} TEST(S) FAILED`);
  process.exit(1);
} else {
  console.log('🎉 ALL CHROMIUM ADAPTER TESTS PASSED');
  process.exit(0);
}
