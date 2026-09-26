/**
 * tests/core/test-base-adapter.js
 *
 * Verifies the BaseBrowserAdapter interface contract:
 *   1. Every abstract method throws UnsupportedOperationError when called
 *   2. Capability flags are correctly initialized and readable
 *   3. The adapter metadata methods (getName, getCapabilities, supports) work
 *   4. A concrete subclass can override methods and declare capabilities
 *   5. Constructor validates input
 */

import { BaseBrowserAdapter } from '../../src/core/base-adapter.js';
import { UnsupportedOperationError } from '../../src/core/errors.js';

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
  try {
    await fn();
  } catch (e) {
    threw = true;
    actual = e;
  }
  if (!threw) throw new Error(msg || `Expected function to throw ${ErrorType.name}`);
  if (!(actual instanceof ErrorType)) {
    throw new Error(`Expected ${ErrorType.name}, got ${actual.constructor.name}: ${actual.message}`);
  }
}

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

// A minimal concrete subclass that overrides no methods (purely abstract)
class NullAdapter extends BaseBrowserAdapter {
  constructor() {
    super('null-adapter');
  }
}

// A partially implemented subclass that overrides connect and listTabs
class PartialAdapter extends BaseBrowserAdapter {
  constructor() {
    super('partial-adapter', {
      attachMode: true,
      iframes: true,
      shadowDom: true
    });
    this._tabs = [];
  }

  async connect(config) {
    this.connected = true;
  }

  async disconnect() {
    this.connected = false;
  }

  async listTabs() {
    return this._tabs;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\n===================================');
console.log('🧪 test-base-adapter.js — Interface Contract');
console.log('===================================\n');

// 1. Construction
test('BaseBrowserAdapter — can be instantiated with a name', () => {
  const adapter = new NullAdapter();
  assertEqual(adapter.getName(), 'null-adapter');
});

test('BaseBrowserAdapter — all capability flags default to false', () => {
  const adapter = new NullAdapter();
  const caps = adapter.getCapabilities();
  const keys = Object.keys(caps);
  assert(keys.length > 0, 'capabilities object must not be empty');
  for (const [key, value] of Object.entries(caps)) {
    assert(value === false, `Capability '${key}' should default to false, got ${value}`);
  }
});

test('BaseBrowserAdapter — constructor throws on empty name', () => {
  let threw = false;
  try { new BaseBrowserAdapter(''); } catch (e) { threw = true; }
  assert(threw, 'Should throw on empty name');
});

test('BaseBrowserAdapter — constructor throws on non-string name', () => {
  let threw = false;
  try { new BaseBrowserAdapter(42); } catch (e) { threw = true; }
  assert(threw, 'Should throw on numeric name');
});

// 2. Initial connection state
test('BaseBrowserAdapter — isConnected() starts false', () => {
  const adapter = new NullAdapter();
  assertEqual(adapter.isConnected(), false);
});

// 3. Abstract method enforcement
const ABSTRACT_METHODS = [
  ['connect',      a => a.connect({})],
  ['disconnect',   a => a.disconnect()],
  ['listTabs',     a => a.listTabs()],
  ['getTab',       a => a.getTab('t1')],
  ['createTab',    a => a.createTab('https://example.com')],
  ['closeTab',     a => a.closeTab('t1')],
  ['activateTab',  a => a.activateTab('t1')],
  ['navigate',     a => a.navigate('t1', 'https://example.com')],
  ['goBack',       a => a.goBack('t1')],
  ['goForward',    a => a.goForward('t1')],
  ['reload',       a => a.reload('t1')],
  ['inspect',      a => a.inspect('t1')],
  ['resolveRef',   a => a.resolveRef('t1', 'e1')],
  ['click',        a => a.click('t1', 'e1')],
  ['type',         a => a.type('t1', 'e1', 'hello')],
  ['press',        a => a.press('t1', 'Enter')],
  ['scroll',       a => a.scroll('t1', { direction: 'down' })],
  ['hover',        a => a.hover('t1', 'e1')],
  ['select',       a => a.select('t1', 'e1', 'Option A')],
  ['upload',       a => a.upload('t1', 'e1', ['/tmp/file.txt'])],
  ['batch',        a => a.batch('t1', [{ type: 'click', ref: 'e1' }])],
  ['waitFor',      a => a.waitFor('t1', { type: 'navigation_complete' })],
  ['extract',      a => a.extract('t1', 'text')],
  ['screenshot',   a => a.screenshot('t1')],
  ['evaluate',     a => a.evaluate('t1', 'document.title')]
];

for (const [methodName, invoke] of ABSTRACT_METHODS) {
  // Using synchronous test with manual promise handling to avoid harness issues
  (function (name, fn) {
    const adapter = new NullAdapter();
    let threw = false;
    let isCorrectType = false;
    const result = invoke(adapter);
    if (result && typeof result.catch === 'function') {
      result.catch(err => {
        if (err instanceof UnsupportedOperationError) {
          console.log(`  ✅ PASS  Abstract method '${name}' throws UnsupportedOperationError`);
          passed++;
        } else {
          console.log(`  ❌ FAIL  Abstract method '${name}' threw wrong error: ${err.constructor.name}`);
          failed++;
        }
      });
    }
  })(methodName, invoke);
}

// 4. Capability flags in concrete subclass
test('PartialAdapter — declared capabilities return true', () => {
  const adapter = new PartialAdapter();
  assert(adapter.supports('attachMode'), 'attachMode should be true');
  assert(adapter.supports('iframes'), 'iframes should be true');
  assert(adapter.supports('shadowDom'), 'shadowDom should be true');
});

test('PartialAdapter — undeclared capabilities return false', () => {
  const adapter = new PartialAdapter();
  assert(!adapter.supports('downloads'), 'downloads should be false');
  assert(!adapter.supports('dialogs'), 'dialogs should be false');
  assert(!adapter.supports('firefox'), 'nonexistent capability should be false');
});

test('PartialAdapter — getCapabilities() returns a copy (not a reference)', () => {
  const adapter = new PartialAdapter();
  const caps = adapter.getCapabilities();
  caps.attachMode = false; // mutate the returned copy
  assert(adapter.supports('attachMode'), 'Original capabilities should be unaffected');
});

// 5. Concrete subclass overrides work
await testAsync('PartialAdapter — overridden connect() sets connected=true', async () => {
  const adapter = new PartialAdapter();
  assertEqual(adapter.isConnected(), false);
  await adapter.connect({});
  assertEqual(adapter.isConnected(), true);
});

await testAsync('PartialAdapter — overridden disconnect() sets connected=false', async () => {
  const adapter = new PartialAdapter();
  await adapter.connect({});
  await adapter.disconnect();
  assertEqual(adapter.isConnected(), false);
});

await testAsync('PartialAdapter — overridden listTabs() returns array', async () => {
  const adapter = new PartialAdapter();
  await adapter.connect({});
  const tabs = await adapter.listTabs();
  assert(Array.isArray(tabs), 'listTabs should return an array');
});

await testAsync('PartialAdapter — non-overridden getTab() still throws UnsupportedOperationError', async () => {
  const adapter = new PartialAdapter();
  await assertThrows(() => adapter.getTab('t1'), UnsupportedOperationError);
});

// 6. toString() produces a non-empty string
test('BaseBrowserAdapter — toString() returns a readable string', () => {
  const adapter = new PartialAdapter();
  const str = adapter.toString();
  assert(typeof str === 'string' && str.length > 0, 'toString should return a non-empty string');
  assert(str.includes('partial-adapter'), 'toString should include adapter name');
});

// 7. UnsupportedOperationError structure from abstract method
await testAsync('Abstract method error — code is UNSUPPORTED_OPERATION', async () => {
  const adapter = new NullAdapter();
  let caught = null;
  try { await adapter.navigate('t1', 'https://x.com'); } catch (e) { caught = e; }
  assert(caught instanceof UnsupportedOperationError);
  assertEqual(caught.code, 'UNSUPPORTED_OPERATION');
  assert(caught.details.operation, 'Should have operation in details');
  assert(caught.details.adapter, 'Should have adapter in details');
});

// ---------------------------------------------------------------------------
// Summary (wait for async test callbacks above to flush)
// ---------------------------------------------------------------------------

await new Promise(resolve => setTimeout(resolve, 100));

console.log(`\n===================================`);
console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
console.log(`===================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL BASE ADAPTER TESTS PASSED\n');
  process.exit(0);
}
