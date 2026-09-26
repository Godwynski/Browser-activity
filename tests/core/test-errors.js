/**
 * tests/core/test-errors.js
 *
 * Verifies that all error types:
 *   1. Are instances of BrowserControlError
 *   2. Expose a machine-readable code
 *   3. Produce correct format() output
 *   4. Are JSON-serialisable via toJSON()
 */

import {
  BrowserControlError,
  ConnectionError,
  NavigationError,
  TabNotFoundError,
  ElementNotFoundError,
  StaleRefError,
  AmbiguousTargetError,
  ActionFailedError,
  TimeoutError,
  UnsupportedOperationError,
  NoAdapterError,
  UnhandledDialogError
} from '../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Minimal test harness (no external dependencies)
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

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertContains(str, substr, msg) {
  if (!str.includes(substr)) {
    throw new Error(msg || `Expected "${str}" to contain "${substr}"`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\n===================================');
console.log('🧪 test-errors.js — Error Types');
console.log('===================================\n');

// 1. BrowserControlError base class
test('BrowserControlError — is an Error', () => {
  const e = new BrowserControlError('TEST_CODE', 'test message', { key: 'val' });
  assert(e instanceof Error);
  assert(e instanceof BrowserControlError);
  assertEqual(e.code, 'TEST_CODE');
  assertEqual(e.message, 'test message');
});

test('BrowserControlError — format() includes code and details', () => {
  const e = new BrowserControlError('TEST_CODE', 'test', { ref: 'e4', suggestion: 'inspect' });
  const formatted = e.format();
  assertContains(formatted, 'TEST_CODE');
  assertContains(formatted, 'ref=e4');
  assertContains(formatted, 'suggestion=inspect');
});

test('BrowserControlError — toJSON() returns serialisable object', () => {
  const e = new BrowserControlError('TEST_CODE', 'test', { ref: 'e4' });
  const json = e.toJSON();
  assertEqual(json.error, 'TEST_CODE');
  assertEqual(json.ref, 'e4');
  // Must be JSON-serialisable
  JSON.stringify(json);
});

// 2. ConnectionError
test('ConnectionError — correct code and suggestion', () => {
  const e = new ConnectionError('Could not reach browser', { endpoint: 'http://127.0.0.1:9222' });
  assert(e instanceof BrowserControlError);
  assertEqual(e.code, 'CONNECTION_ERROR');
  assertContains(e.details.suggestion, 'debugging');
  assertContains(e.format(), 'CONNECTION_ERROR');
  assertContains(e.format(), 'endpoint=http://127.0.0.1:9222');
});

// 3. NavigationError
test('NavigationError — correct code', () => {
  const e = new NavigationError('Timeout after 15000ms', { url: 'https://example.com' });
  assertEqual(e.code, 'NAVIGATION_ERROR');
  assertContains(e.format(), 'url=https://example.com');
});

// 3b. TabNotFoundError
test('TabNotFoundError — correct code and format', () => {
  const e = new TabNotFoundError('tab_99');
  assertEqual(e.code, 'TAB_NOT_FOUND');
  assertContains(e.format(), 'tabId=tab_99');
  assertContains(e.format(), 'suggestion=call listTabs to get current open tab IDs');
});

// 4. ElementNotFoundError
test('ElementNotFoundError — includes ref in format()', () => {
  const e = new ElementNotFoundError('e7');
  assertEqual(e.code, 'ELEMENT_NOT_FOUND');
  assertContains(e.format(), 'ref=e7');
  assertContains(e.format(), 'suggestion=inspect');
  assertContains(e.message, 'e7');
});

// 5. StaleRefError
test('StaleRefError — includes ref and recovery=failed', () => {
  const e = new StaleRefError('e4');
  assertEqual(e.code, 'STALE_REF');
  assertContains(e.format(), 'ref=e4');
  assertContains(e.format(), 'recovery=failed');
  assertContains(e.format(), 'suggestion=inspect');
});

test('StaleRefError — recovery can be overridden', () => {
  const e = new StaleRefError('e4', { recovery: 'succeeded_via_name_match' });
  assertContains(e.format(), 'recovery=succeeded_via_name_match');
});

// 6. AmbiguousTargetError
test('AmbiguousTargetError — includes query and match count', () => {
  const e = new AmbiguousTargetError('Submit', 3);
  assertEqual(e.code, 'AMBIGUOUS_TARGET');
  assertContains(e.format(), 'query=Submit');
  assertContains(e.format(), 'matches=3');
  assertContains(e.format(), 'suggestion=inspect');
});

// 7. ActionFailedError
test('ActionFailedError — correct code, ref, reason', () => {
  const e = new ActionFailedError('e4', 'element_not_interactable');
  assertEqual(e.code, 'ACTION_FAILED');
  assertContains(e.format(), 'ref=e4');
  assertContains(e.format(), 'reason=element_not_interactable');
  assertContains(e.format(), 'suggestion=inspect');
});

// 8. TimeoutError
test('TimeoutError — includes condition and timeout', () => {
  const e = new TimeoutError('text_appeared', 5000, { value: 'Welcome' });
  assertEqual(e.code, 'TIMEOUT');
  assertContains(e.format(), 'condition=text_appeared');
  assertContains(e.format(), 'timeoutMs=5000');
  assertContains(e.format(), 'value=Welcome');
});

// 9. UnsupportedOperationError
test('UnsupportedOperationError — includes operation and adapter', () => {
  const e = new UnsupportedOperationError('upload', 'extension');
  assertEqual(e.code, 'UNSUPPORTED_OPERATION');
  assertContains(e.format(), 'operation=upload');
  assertContains(e.format(), 'adapter=extension');
});

// 10. NoAdapterError
test('NoAdapterError — correct code and suggestion', () => {
  const e = new NoAdapterError();
  assertEqual(e.code, 'NO_ADAPTER');
  assertContains(e.details.suggestion, 'setAdapter');
});

// 11. UnhandledDialogError
test('UnhandledDialogError — includes dialog type and message', () => {
  const e = new UnhandledDialogError('alert', 'Session expired');
  assertEqual(e.code, 'UNHANDLED_DIALOG');
  assertContains(e.format(), 'dialogType=alert');
  assertContains(e.format(), 'dialogMessage=Session expired');
});

// 12. All error subclasses extend BrowserControlError
test('All error types are instances of BrowserControlError', () => {
  const errors = [
    new ConnectionError('x'),
    new NavigationError('x'),
    new ElementNotFoundError('e1'),
    new StaleRefError('e1'),
    new AmbiguousTargetError('x', 2),
    new ActionFailedError('e1', 'r'),
    new TimeoutError('x', 1000),
    new UnsupportedOperationError('x', 'y'),
    new NoAdapterError(),
    new UnhandledDialogError('alert', 'msg')
  ];
  for (const e of errors) {
    assert(e instanceof BrowserControlError, `${e.code} is not a BrowserControlError`);
    assert(e instanceof Error, `${e.code} is not an Error`);
    // Every error must have a suggestion
    assert(e.details.suggestion, `${e.code} missing suggestion in details`);
  }
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
  console.log('🎉 ALL ERROR TYPE TESTS PASSED\n');
  process.exit(0);
}
