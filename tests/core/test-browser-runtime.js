/**
 * tests/core/test-browser-runtime.js
 *
 * Verifies BrowserRuntime orchestration:
 *   1. Throws NoAdapterError before an adapter is set
 *   2. Delegates operations to the active adapter
 *   3. Adapter can be swapped without affecting interface
 *   4. isConnected() tracks adapter connection state
 *   5. getCapabilities() returns active adapter capabilities
 *   6. setAdapter() rejects invalid values
 */

import { BrowserRuntime } from '../../src/core/browser-runtime.js';
import { BaseBrowserAdapter } from '../../src/core/base-adapter.js';
import { NoAdapterError, UnsupportedOperationError } from '../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------

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
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

async function assertThrows(fn, ErrorType, msg) {
  let threw = false;
  let actual = null;
  try { await fn(); } catch (e) { threw = true; actual = e; }
  if (!threw) throw new Error(msg || `Expected ${ErrorType.name} to be thrown`);
  if (!(actual instanceof ErrorType)) {
    throw new Error(`Expected ${ErrorType.name}, got ${actual.constructor.name}: ${actual.message}`);
  }
  return actual;
}

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

/** Full mock adapter that tracks method calls */
class MockAdapter extends BaseBrowserAdapter {
  constructor(name = 'mock') {
    super(name, { attachMode: true, downloads: true, iframes: true });
    this.calls = [];
  }

  async connect(config)       { this.connected = true; this.calls.push(['connect', config]); }
  async disconnect()          { this.connected = false; this.calls.push(['disconnect']); }
  async listTabs()            { this.calls.push(['listTabs']); return [{ id: 't1', title: 'Mock', url: 'https://mock.test', active: true, index: 0 }]; }
  async getTab(id)            { this.calls.push(['getTab', id]); return { id, title: 'Mock', url: 'https://mock.test', active: true, index: 0 }; }
  async createTab(url)        { this.calls.push(['createTab', url]); return { id: 't2', title: '', url, active: false, index: 1 }; }
  async closeTab(id)          { this.calls.push(['closeTab', id]); }
  async activateTab(id, opts) { this.calls.push(['activateTab', id]); return { id, title: 'Mock', url: 'https://mock.test', active: true, index: 0 }; }

  async navigate(tabId, url, opts)     { this.calls.push(['navigate', tabId, url]); return { url, title: 'Mock', ok: true }; }
  async goBack(tabId, opts)            { this.calls.push(['goBack', tabId]); return { url: 'https://prev.test', title: 'Prev', ok: true }; }
  async goForward(tabId, opts)         { this.calls.push(['goForward', tabId]); return { url: 'https://next.test', title: 'Next', ok: true }; }
  async reload(tabId, opts)            { this.calls.push(['reload', tabId]); return { url: 'https://mock.test', title: 'Mock', ok: true }; }

  async inspect(tabId, opts)           { this.calls.push(['inspect', tabId]); return { obsId: 'obs_mock', page: {}, compact: '[e1] button "OK"', elements: [], elementCount: 0 }; }
  async resolveRef(tabId, ref, opts)   { this.calls.push(['resolveRef', tabId, ref]); return { ref, candidate: {}, recovered: false }; }

  async click(tabId, ref, opts)        { this.calls.push(['click', tabId, ref]); return { ok: true, action: 'click', ref, changes: [], before: {}, after: {} }; }
  async type(tabId, ref, text, opts)   { this.calls.push(['type', tabId, ref, text]); return { ok: true, action: 'type', ref, changes: [], before: {}, after: {} }; }
  async press(tabId, key, opts)        { this.calls.push(['press', tabId, key]); return { ok: true, action: 'press', changes: [], before: {}, after: {} }; }
  async scroll(tabId, opts)            { this.calls.push(['scroll', tabId]); return { ok: true, action: 'scroll', changes: [], before: {}, after: {} }; }
  async hover(tabId, ref, opts)        { this.calls.push(['hover', tabId, ref]); return { ok: true, action: 'hover', ref, changes: [], before: {}, after: {} }; }
  async select(tabId, ref, val, opts)  { this.calls.push(['select', tabId, ref, val]); return { ok: true, action: 'select', ref, changes: [], before: {}, after: {} }; }
  async upload(tabId, ref, fps, opts)  { this.calls.push(['upload', tabId, ref, fps]); return { ok: true, action: 'upload', ref, changes: [], before: {}, after: {} }; }
  async batch(tabId, actions, opts)    { this.calls.push(['batch', tabId, actions]); return { ok: true, completed: actions.length, total: actions.length, receipts: [] }; }

  async waitFor(tabId, cond, opts)     { this.calls.push(['waitFor', tabId, cond]); }
  async extract(tabId, type, opts)     { this.calls.push(['extract', tabId, type]); return { type, data: [], itemCount: 0 }; }
  async screenshot(tabId, opts)        { this.calls.push(['screenshot', tabId]); return 'data:image/jpeg;base64,MOCK'; }
  async evaluate(tabId, script, opts)  { this.calls.push(['evaluate', tabId, script]); return 'mock_result'; }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\n===================================');
console.log('🧪 test-browser-runtime.js — Orchestration Layer');
console.log('===================================\n');

// 1. Pre-adapter state
test('BrowserRuntime — hasAdapter() is false before setAdapter()', () => {
  const rt = new BrowserRuntime();
  assert(!rt.hasAdapter());
});

test('BrowserRuntime — isConnected() is false before setAdapter()', () => {
  const rt = new BrowserRuntime();
  assert(!rt.isConnected());
});

test('BrowserRuntime — getCapabilities() returns {} before setAdapter()', () => {
  const rt = new BrowserRuntime();
  const caps = rt.getCapabilities();
  assertEqual(Object.keys(caps).length, 0);
});

test('BrowserRuntime — getAdapterName() returns null before setAdapter()', () => {
  const rt = new BrowserRuntime();
  assertEqual(rt.getAdapterName(), null);
});

// 2. NoAdapterError enforcement
await testAsync('BrowserRuntime — getAdapter() throws NoAdapterError before setAdapter()', async () => {
  const rt = new BrowserRuntime();
  await assertThrows(() => Promise.resolve(rt.getAdapter()), NoAdapterError);
});

await testAsync('BrowserRuntime — listTabs() throws NoAdapterError before setAdapter()', async () => {
  const rt = new BrowserRuntime();
  await assertThrows(() => rt.listTabs(), NoAdapterError);
});

await testAsync('BrowserRuntime — connect() throws NoAdapterError before setAdapter()', async () => {
  const rt = new BrowserRuntime();
  await assertThrows(() => rt.connect({}), NoAdapterError);
});

// 3. setAdapter() validation
test('BrowserRuntime — setAdapter() rejects null', () => {
  const rt = new BrowserRuntime();
  let threw = false;
  try { rt.setAdapter(null); } catch (e) { threw = true; }
  assert(threw, 'setAdapter(null) should throw');
});

test('BrowserRuntime — setAdapter() rejects plain object', () => {
  const rt = new BrowserRuntime();
  let threw = false;
  try { rt.setAdapter({ connect: 'not-a-function' }); } catch (e) { threw = true; }
  assert(threw, 'setAdapter({}) should throw');
});

// 4. Post-adapter state
test('BrowserRuntime — hasAdapter() is true after setAdapter()', () => {
  const rt = new BrowserRuntime();
  rt.setAdapter(new MockAdapter());
  assert(rt.hasAdapter());
});

test('BrowserRuntime — getAdapterName() returns adapter name', () => {
  const rt = new BrowserRuntime();
  rt.setAdapter(new MockAdapter('chromium'));
  assertEqual(rt.getAdapterName(), 'chromium');
});

test('BrowserRuntime — getCapabilities() returns adapter capabilities', () => {
  const rt = new BrowserRuntime();
  rt.setAdapter(new MockAdapter());
  const caps = rt.getCapabilities();
  assert(caps.attachMode === true, 'attachMode should be true');
});

test('BrowserRuntime — supports() delegates to adapter', () => {
  const rt = new BrowserRuntime();
  rt.setAdapter(new MockAdapter());
  assert(rt.supports('downloads'));
  assert(!rt.supports('firefox'));
});

// 5. Connection delegation
await testAsync('BrowserRuntime — connect() delegates to adapter', async () => {
  const rt = new BrowserRuntime();
  const adapter = new MockAdapter();
  rt.setAdapter(adapter);
  assert(!rt.isConnected());
  await rt.connect({ mode: 'attach', port: 9222 });
  assert(rt.isConnected());
  assertEqual(adapter.calls[0][0], 'connect');
  assertEqual(adapter.calls[0][1].port, 9222);
});

await testAsync('BrowserRuntime — disconnect() delegates to adapter', async () => {
  const rt = new BrowserRuntime();
  const adapter = new MockAdapter();
  rt.setAdapter(adapter);
  await rt.connect({});
  await rt.disconnect();
  assert(!rt.isConnected());
});

await testAsync('BrowserRuntime — disconnect() is safe when not connected', async () => {
  const rt = new BrowserRuntime();
  rt.setAdapter(new MockAdapter());
  // Should not throw
  await rt.disconnect();
});

// 6. Full delegation coverage
const DELEGATED_CALLS = [
  ['listTabs',   rt => rt.listTabs()],
  ['getTab',     rt => rt.getTab('t1')],
  ['createTab',  rt => rt.createTab('https://example.com')],
  ['closeTab',   rt => rt.closeTab('t1')],
  ['activateTab',rt => rt.activateTab('t1')],
  ['navigate',   rt => rt.navigate('t1', 'https://x.com')],
  ['goBack',     rt => rt.goBack('t1')],
  ['goForward',  rt => rt.goForward('t1')],
  ['reload',     rt => rt.reload('t1')],
  ['inspect',    rt => rt.inspect('t1')],
  ['resolveRef', rt => rt.resolveRef('t1', 'e1')],
  ['click',      rt => rt.click('t1', 'e1')],
  ['type',       rt => rt.type('t1', 'e1', 'hello')],
  ['press',      rt => rt.press('t1', 'Enter')],
  ['scroll',     rt => rt.scroll('t1', { direction: 'down' })],
  ['hover',      rt => rt.hover('t1', 'e1')],
  ['select',     rt => rt.select('t1', 'e1', 'Option A')],
  ['upload',     rt => rt.upload('t1', 'e1', ['/tmp/f.txt'])],
  ['batch',      rt => rt.batch('t1', [{ type: 'click', ref: 'e1' }])],
  ['waitFor',    rt => rt.waitFor('t1', { type: 'navigation_complete' })],
  ['extract',    rt => rt.extract('t1', 'text')],
  ['screenshot', rt => rt.screenshot('t1')],
  ['evaluate',   rt => rt.evaluate('t1', 'document.title')]
];

for (const [method, invoke] of DELEGATED_CALLS) {
  await testAsync(`BrowserRuntime — ${method}() delegates to adapter`, async () => {
    const rt = new BrowserRuntime();
    const adapter = new MockAdapter();
    rt.setAdapter(adapter);
    await invoke(rt);
    const call = adapter.calls.find(c => c[0] === method);
    assert(call, `Adapter.${method}() was not called`);
  });
}

// 7. Adapter swap
await testAsync('BrowserRuntime — adapter can be swapped mid-session', async () => {
  const rt = new BrowserRuntime();
  const a1 = new MockAdapter('first');
  const a2 = new MockAdapter('second');

  rt.setAdapter(a1);
  await rt.connect({});
  assertEqual(rt.getAdapterName(), 'first');

  // Swap to second adapter
  rt.setAdapter(a2);
  await rt.connect({});
  assertEqual(rt.getAdapterName(), 'second');
  assert(a2.isConnected());
});

// 8. toString()
test('BrowserRuntime — toString() includes adapter name and connection state', () => {
  const rt = new BrowserRuntime();
  rt.setAdapter(new MockAdapter('chromium'));
  const str = rt.toString();
  assert(str.includes('chromium'));
  assert(str.includes('connected=false'));
});

test('BrowserRuntime — toString() says NO ADAPTER when adapter not set', () => {
  const rt = new BrowserRuntime();
  const str = rt.toString();
  assert(str.includes('NO ADAPTER'));
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n===================================`);
console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
console.log(`===================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL BROWSER RUNTIME TESTS PASSED\n');
  process.exit(0);
}
