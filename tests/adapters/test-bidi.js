/**
 * tests/adapters/test-bidi.js
 *
 * Verifies the WebDriver BiDi / Firefox Adapter contract (Phase 6):
 *   1. Adapter Identity: name, capability flags, inheritance
 *   2. Detection Engine: detectFirefox() returns truthful host status
 *   3. Connection Safety: clean ConnectionError when Firefox is not installed
 *   4. Interface Completeness: all BaseBrowserAdapter methods implemented
 *   5. BrowserRuntime Integration: transparent adapter swapping and capability reflection
 */

import { BaseBrowserAdapter } from '../../src/core/base-adapter.js';
import { BiDiAdapter } from '../../src/adapters/bidi.js';
import { BrowserRuntime } from '../../src/core/browser-runtime.js';
import { ConnectionError } from '../../src/core/errors.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ FAIL  ${name}`);
    console.log(`         ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
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

async function run() {
  console.log('\n============================================================');
  console.log('🧪 test-bidi.js — Firefox / WebDriver BiDi Adapter (Phase 6)');
  console.log('============================================================\n');

  // --- Suite 1: Identity & Capabilities ---
  console.log('--- Suite 1: Identity & Capabilities ---');

  test('BiDiAdapter — extends BaseBrowserAdapter', () => {
    const adapter = new BiDiAdapter();
    assert(adapter instanceof BaseBrowserAdapter, 'Inherits from BaseBrowserAdapter');
  });

  test('BiDiAdapter — getName() returns "bidi"', () => {
    const adapter = new BiDiAdapter();
    assertEqual(adapter.getName(), 'bidi', 'Name is bidi');
  });

  test('BiDiAdapter — capabilities declared truthfully', () => {
    const adapter = new BiDiAdapter();
    const caps = adapter.getCapabilities();
    assertEqual(caps.attachMode, true, 'attachMode is true');
    assertEqual(caps.managedMode, true, 'managedMode is true');
    assertEqual(caps.extensionMode, false, 'extensionMode is false');
    assertEqual(caps.iframes, true, 'iframes is true');
    assertEqual(caps.crossOriginIframes, false, 'crossOriginIframes is false (truthful BiDi constraint)');
    assertEqual(caps.shadowDom, true, 'shadowDom is true');
    assertEqual(caps.dialogs, true, 'dialogs is true');
    assertEqual(caps.downloads, true, 'downloads is true');
    assertEqual(caps.popups, true, 'popups is true');
  });

  test('BiDiAdapter — isConnected() is false initially', () => {
    const adapter = new BiDiAdapter();
    assertEqual(adapter.isConnected(), false, 'isConnected starts false');
  });

  // --- Suite 2: Firefox Detection Engine ---
  console.log('\n--- Suite 2: Detection Engine ---');

  test('BiDiAdapter.detectFirefox() — returns structured detection result', () => {
    const result = BiDiAdapter.detectFirefox();
    assert(typeof result.name === 'string', 'Has browser name');
    assert(typeof result.installed === 'boolean', 'Has boolean installed flag');
    assert(typeof result.status === 'string', 'Has status string');
    if (result.installed) {
      assert(result.path !== null, 'Path is non-null when installed');
      assertEqual(result.status, 'INSTALLED');
    } else {
      assertEqual(result.path, null, 'Path is null when not installed');
      assertEqual(result.status, 'NOT_INSTALLED');
    }
  });

  // --- Suite 3: Connection Safety & Error Handling ---
  console.log('\n--- Suite 3: Connection Safety & Error Handling ---');

  await testAsync('BiDiAdapter.connect() — rejects with ConnectionError when Firefox is NOT_INSTALLED', async () => {
    const detection = BiDiAdapter.detectFirefox();
    if (!detection.installed) {
      const adapter = new BiDiAdapter();
      let threw = false;
      try {
        await adapter.connect({ mode: 'managed' });
      } catch (err) {
        threw = true;
        assert(err instanceof ConnectionError, 'Throws ConnectionError');
        assertEqual(err.details.status, 'NOT_INSTALLED', 'Reports NOT_INSTALLED status');
        assert(err.message.includes('not installed'), 'Error message states not installed');
        assertEqual(adapter.isConnected(), false, 'isConnected remains false');
      }
      assert(threw, 'Should throw when connecting on uninstalled browser');
    } else {
      console.log('    (Skipping uninstalled test — Firefox is present on this machine)');
    }
  });

  await testAsync('BiDiAdapter.connect() — rejects invalid attach configuration', async () => {
    const adapter = new BiDiAdapter();
    let threw = false;
    try {
      await adapter.connect({ mode: 'attach' }); // missing endpoint/port
    } catch (err) {
      threw = true;
      assert(err instanceof ConnectionError, 'Throws ConnectionError on missing endpoint');
    }
    assert(threw, 'Should throw for missing attach endpoint');
  });

  await testAsync('BiDiAdapter.disconnect() — safe and idempotent when not connected', async () => {
    const adapter = new BiDiAdapter();
    await adapter.disconnect();
    assertEqual(adapter.isConnected(), false);
  });

  // --- Suite 4: Interface Contract Completeness ---
  console.log('\n--- Suite 4: Interface Contract Completeness ---');

  test('BiDiAdapter — implements all BaseBrowserAdapter methods', () => {
    const adapter = new BiDiAdapter();
    const requiredMethods = [
      'connect', 'disconnect', 'isConnected',
      'listTabs', 'getTab', 'createTab', 'closeTab', 'activateTab',
      'navigate', 'goBack', 'goForward', 'reload',
      'inspect', 'resolveRef',
      'click', 'type', 'press', 'scroll', 'hover', 'select', 'upload',
      'waitFor', 'batch',
      'extract', 'screenshot', 'evaluate',
      'handleDialog', 'setDialogMode', 'waitForDownload', 'getDownloads', 'waitForPopup'
    ];

    for (const m of requiredMethods) {
      assert(typeof adapter[m] === 'function', `Method ${m} must be implemented`);
    }
  });

  // --- Suite 5: BrowserRuntime Integration ---
  console.log('\n--- Suite 5: BrowserRuntime Integration ---');

  test('BrowserRuntime — accepts BiDiAdapter and reflects capabilities', () => {
    const adapter = new BiDiAdapter();
    const runtime = new BrowserRuntime(adapter);

    assertEqual(runtime.getAdapterName(), 'bidi', 'Runtime adapter name is bidi');
    assertEqual(runtime.supports('crossOriginIframes'), false, 'Reflects false crossOriginIframes');
    assertEqual(runtime.supports('managedMode'), true, 'Reflects true managedMode');
    assertEqual(runtime.supports('downloads'), true, 'Reflects true downloads');
  });

  await testAsync('BrowserRuntime — propagates BiDi ConnectionError to callers', async () => {
    const detection = BiDiAdapter.detectFirefox();
    if (!detection.installed) {
      const adapter = new BiDiAdapter();
      const runtime = new BrowserRuntime(adapter);
      let threw = false;
      try {
        await runtime.connect({ mode: 'managed' });
      } catch (err) {
        threw = true;
        assert(err instanceof ConnectionError, 'Propagates ConnectionError');
      }
      assert(threw, 'Should throw through runtime');
    }
  });

  console.log('\n===================================');
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('===================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL BIDI ADAPTER TESTS PASSED\n');
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
