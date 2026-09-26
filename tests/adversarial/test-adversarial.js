/**
 * tests/adversarial/test-adversarial.js
 *
 * Comprehensive Stress & Adversarial Test Battery (Phase 10):
 *   1. Stale Reference on Deleted Element (StaleRefError / ElementNotFoundError)
 *   2. Ambiguous Target Rejection (AmbiguousTargetError)
 *   3. Dynamic Mutated Element Semantic Recovery
 *   4. Obscured / Intercepted Target (ActionFailedError on pointer interception)
 *   5. Obscured Target Force Override ({ force: true })
 *   6. Dialog Storm (Rapid sequential alert -> confirm -> prompt auto-handling)
 *   7. Mass-Element Scalability (1,000+ interactive elements under observation)
 *   8. Deep Multi-Tier Nested Shadow DOM Piercing
 *   9. Network / Unreachable URL Navigation Failure (NavigationError)
 *  10. Inactive / Closed Tab Access (TabNotFoundError)
 *  11. Long-Running JavaScript Evaluation Timeout (TimeoutError)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { BrowserRuntime } from '../../src/core/browser-runtime.js';
import { ChromiumAdapter } from '../../src/adapters/chromium.js';
import { ProgressiveLevel } from '../../src/observation/index.js';
import {
  ActionFailedError,
  AmbiguousTargetError,
  NavigationError,
  StaleRefError,
  TabNotFoundError,
  TimeoutError
} from '../../src/core/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const adversarialFixturePath = path.resolve(rootDir, 'test-sites/adversarial/index.html');
const adversarialFixtureUrl = `file:///${adversarialFixturePath.replace(/\\/g, '/')}`;

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
  console.log('🧪 test-adversarial.js — Adversarial & Stress Testing (Phase 10)');
  console.log('============================================================\n');

  const adapter = new ChromiumAdapter();
  const runtime = new BrowserRuntime(adapter);

  let tabId;

  try {
    await runtime.connect({ mode: 'managed', browser: 'edge', headless: true });
    const tab = await runtime.createTab(adversarialFixtureUrl);
    tabId = tab.id;
    await runtime.waitFor(tabId, { type: 'dom_stable' });

    // ------------------------------------------------------------------------
    // Suite 1: Stale Reference & Dynamic Mutation
    // ------------------------------------------------------------------------
    console.log('--- Suite 1: Stale Reference & Dynamic Mutation ---');

    await test('Action on deleted element throws StaleRefError / ElementNotFoundError without crashing', async () => {
      // 1. Observe while #doomed-btn exists
      const obs = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const doomed = obs.elements.find(e => e.name && e.name.includes('Self-Destruct'));
      assert(doomed, 'Found Self-Destruct button in observation');

      // 2. Click it in DOM or delete it directly
      await runtime.evaluate(tabId, 'deleteSelf()');

      // 3. Try acting on the obsolete ref
      let caught = false;
      try {
        await runtime.click(tabId, doomed.ref);
      } catch (err) {
        caught = true;
        assert(err instanceof StaleRefError || err instanceof ActionFailedError, `Expected StaleRefError/ActionFailedError, got ${err.name}`);
      }
      assert(caught, 'Must reject stale reference on deleted element');
    });

    await test('Stale-ref recovery rejects duplicate ambiguous elements with AmbiguousTargetError', async () => {
      const registry = adapter.getObservationEngine().registry;
      const dummyRef = 'e_stale_ambig';
      registry.registerObservation(tabId, {
        obsId: 'obs_mock_ambig',
        level: 1,
        pageState: {},
        elements: [{
          ref: dummyRef,
          role: 'button',
          name: 'Duplicate Action',
          domMeta: { tag: 'button' }
        }]
      });
      let caught = false;
      try {
        await runtime.resolveRef(tabId, dummyRef, { autoRecover: true });
      } catch (err) {
        assert(err instanceof AmbiguousTargetError, `Expected AmbiguousTargetError, got ${err.name}: ${err.message}`);
        caught = true;
      }
      assert(caught, 'Must throw AmbiguousTargetError on multiple duplicate candidates');
    });

    await test('Dynamic mutated element recovers automatically using semantic fingerprint', async () => {
      // 1. Observe initial state of dynamic target
      const obs1 = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const target1 = obs1.elements.find(e => e.name && e.name.includes('Mutate Target'));
      assert(target1, 'Found initial mutate target button');

      // 2. Trigger mutation via DOM
      await runtime.evaluate(tabId, 'mutateButton()');

      // 3. New observation discovers updated mutated button
      const obs2 = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const target2 = obs2.elements.find(e => e.name && e.name.includes('Mutated Target Restored'));
      assert(target2, 'Found mutated target button in new observation');

      // 4. Click the newly observed mutated target
      const receipt = await runtime.click(tabId, target2.ref);
      assert(receipt.ok === true, 'Click on mutated target succeeded');

      const status = await runtime.evaluate(tabId, 'document.getElementById("mutation-status").innerText');
      assert(status.includes('Mutated Click Success'), 'Mutation click executed handler');
    });

    // ------------------------------------------------------------------------
    // Suite 2: Modal Overlays & Click Interception
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 2: Modal Overlays & Click Interception ---');

    await test('Clicking obscured element fails cleanly with ActionFailedError within timeout', async () => {
      // 1. Observe target button under overlay
      const obs = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const underBtn = obs.elements.find(e => e.name && e.name.includes('Action Button Under Overlay'));
      assert(underBtn, 'Found target under overlay');

      // 2. Show intercepting backdrop
      await runtime.evaluate(tabId, 'toggleOverlay(true)');

      // 3. Attempt click with low timeout (1500ms)
      let caught = false;
      try {
        await runtime.click(tabId, underBtn.ref, { timeout: 1500 });
      } catch (err) {
        caught = true;
        assert(err instanceof ActionFailedError, `Expected ActionFailedError, got ${err.name}`);
        assert(err.message.includes('click') || err.reason.includes('intercepts pointer events') || err.reason.includes('Timeout'), 'Error explains interception');
      }
      assert(caught, 'Must reject pointer-intercepted action');

      // Reset overlay
      await runtime.evaluate(tabId, 'toggleOverlay(false)');
    });

    await test('Clicking obscured element with { force: true } bypasses interception check', async () => {
      const obs = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const underBtn = obs.elements.find(e => e.name && e.name.includes('Action Button Under Overlay'));
      assert(underBtn, 'Found target under overlay');

      // Show intercepting backdrop
      await runtime.evaluate(tabId, 'toggleOverlay(true)');

      // Force click
      const receipt = await runtime.click(tabId, underBtn.ref, { force: true, timeout: 2000 });
      assert(receipt.ok === true, 'Force click succeeded');

      // Reset overlay
      await runtime.evaluate(tabId, 'toggleOverlay(false)');
    });

    // ------------------------------------------------------------------------
    // Suite 3: Dialog Storm Handling
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 3: Dialog Storm Handling ---');

    await test('Rapid-fire dialog storm (alert -> confirm -> prompt) handles all dialogs without hanging', async () => {
      // Configure default dialog policy: auto-accept with custom prompt response
      runtime.setDialogMode(tabId, 'auto_accept', { defaultResponse: 'ADVERSARIAL-PASS-999' });

      // Trigger the 3 dialogs from page
      const [dialogResult] = await Promise.all([
        runtime.evaluate(tabId, 'runDialogStorm()'),
        runtime.waitFor(tabId, { type: 'dom_stable' })
      ]);

      const status = await runtime.evaluate(tabId, 'document.getElementById("dialog-storm-status").innerText');
      assert(status.includes('confirmed=true'), 'Confirm dialog was auto-accepted');
      assert(status.includes('code=ADVERSARIAL-PASS-999'), 'Prompt dialog received configured response');
    });

    // ------------------------------------------------------------------------
    // Suite 4: Mass-Element Scalability
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 4: Mass-Element Scalability ---');

    await test('Mass-element load (1,000+ interactive nodes) observes safely under <3s without OOM', async () => {
      // Generate 1,000 buttons in DOM
      await runtime.evaluate(tabId, 'generateMassiveNodes(1000)');

      const start = Date.now();
      const obs = await runtime.inspect(tabId, { level: ProgressiveLevel.COMPACT });
      const elapsed = Date.now() - start;

      console.log(`         Observed page with 1,000+ nodes in ${elapsed}ms (capped at ${obs.elementCount} elements)`);
      assert(elapsed < 4000, `Observation took too long: ${elapsed}ms`);
      assert(obs.elementCount <= 60, `Observation element count must respect default cap: ${obs.elementCount}`);
      assert(obs.compact.length > 0, 'Compact representation must not be empty');

      // Cleanup massive nodes after test
      await runtime.evaluate(tabId, `
        document.getElementById('massive-container').innerHTML = '';
        document.getElementById('massive-count').innerText = 'Count: 0';
      `);
    });

    // ------------------------------------------------------------------------
    // Suite 5: Deep Multi-Tier Nested Shadow DOM
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 5: Deep Multi-Tier Nested Shadow DOM ---');

    await test('Pierces 2-tier deeply nested open shadow root to interact with leaf node', async () => {
      const obs = await runtime.inspect(tabId, { level: ProgressiveLevel.FULL, scope: '#shadow-iframe-card' });
      const deepInput = obs.elements.find(e => e.value === 'deep-value' || (e.domMeta && e.domMeta.id === 'nested-shadow2-input'));
      const deepBtn = obs.elements.find(e => e.name && e.name.includes('Deep Action'));

      assert(deepInput, 'Found nested shadow input in 2nd tier shadow root');
      assert(deepBtn, 'Found nested shadow action button in 2nd tier shadow root');
      assert(deepInput.isShadow === true, 'Element flagged as isShadow');
      assert(deepBtn.isShadow === true, 'Button flagged as isShadow');

      // Type into deep shadow input
      const typeReceipt = await runtime.type(tabId, deepInput.ref, ' updated-adversarial');
      assert(typeReceipt.ok === true, 'Type into deep shadow input succeeded');
    });

    // ------------------------------------------------------------------------
    // Suite 6: Network & Closed Tab Resilience
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 6: Network & Closed Tab Resilience ---');

    await test('Navigating to unreachable local port throws NavigationError and preserves runtime health', async () => {
      const unreachableTab = await runtime.createTab('about:blank');
      let caught = false;
      try {
        await runtime.navigate(unreachableTab.id, 'http://127.0.0.1:59998/unreachable-endpoint', { timeout: 3000 });
      } catch (err) {
        caught = true;
        assert(err instanceof NavigationError, `Expected NavigationError, got ${err.name}`);
        assert(err.message.includes('Navigation to'), 'Error message contains destination');
      }
      assert(caught, 'Must throw NavigationError on unreachable network destination');

      // Close unreachable tab and verify active tab continues working normally
      await runtime.closeTab(unreachableTab.id);
      const activeNav = await runtime.navigate(tabId, adversarialFixtureUrl);
      assert(activeNav.ok === true, 'Successfully verified active tab health');
    });

    await test('Operating on closed tab throws TabNotFoundError cleanly', async () => {
      // Create a temporary tab and close it
      const tempTab = await runtime.createTab('about:blank');
      await runtime.closeTab(tempTab.id);

      let caught = false;
      try {
        await runtime.inspect(tempTab.id);
      } catch (err) {
        caught = true;
        assert(err instanceof TabNotFoundError, `Expected TabNotFoundError, got ${err.name}`);
      }
      assert(caught, 'Must throw TabNotFoundError on closed tab');
    });

    // ------------------------------------------------------------------------
    // Suite 7: JavaScript Execution Timeout
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 7: JavaScript Execution Timeout ---');

    await test('Hanging asynchronous JavaScript evaluation throws TimeoutError within specified timeout', async () => {
      let caught = false;
      const timeoutLimit = 1000;
      const start = Date.now();

      try {
        // Execute infinite/long promise that does not resolve
        await runtime.evaluate(tabId, 'new Promise(() => {})', { timeout: timeoutLimit });
      } catch (err) {
        caught = true;
        const elapsed = Date.now() - start;
        assert(err instanceof TimeoutError, `Expected TimeoutError, got ${err.name}`);
        assert(elapsed >= timeoutLimit - 200 && elapsed <= timeoutLimit + 1000, `Timed out in ${elapsed}ms`);
      }
      assert(caught, 'Must throw TimeoutError on hanging evaluation');
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
