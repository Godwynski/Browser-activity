/**
 * tests/adapters/test-extension.js
 *
 * Verifies the Extension Bridge Adapter contract & protocol (Phase 7):
 *   1. Adapter Identity: name, capability flags, inheritance
 *   2. Bridge Server Lifecycle: WebSocket server bind, /health endpoint, client handshake
 *   3. JSON-RPC Communication: tab management, navigation, observation, and actions
 *   4. Enforced Limitations: throws UnsupportedOperationError on uploads, downloads, dialogs
 *   5. Disconnection & Cleanup: clean shutdown and error resilience
 *   6. BrowserRuntime Integration: transparent adapter swapping and capability reflection
 */

import http from 'node:http';
import { WebSocket } from 'ws';
import { BaseBrowserAdapter } from '../../src/core/base-adapter.js';
import { ExtensionAdapter } from '../../src/adapters/extension.js';
import { BrowserRuntime } from '../../src/core/browser-runtime.js';
import {
  ConnectionError,
  UnsupportedOperationError
} from '../../src/core/errors.js';

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
  console.log('🧪 test-extension.js — Extension Bridge Adapter (Phase 7)');
  console.log('============================================================\n');

  // --- Suite 1: Identity & Capabilities ---
  console.log('--- Suite 1: Identity & Capabilities ---');

  test('ExtensionAdapter — extends BaseBrowserAdapter with name "extension"', () => {
    const adapter = new ExtensionAdapter();
    assert(adapter instanceof BaseBrowserAdapter, 'Inherits from BaseBrowserAdapter');
    assertEqual(adapter.getName(), 'extension', 'Name is extension');
  });

  test('ExtensionAdapter — declares truthful capabilities reflecting extension constraints', () => {
    const adapter = new ExtensionAdapter();
    const caps = adapter.getCapabilities();
    assertEqual(caps.extensionMode, true, 'extensionMode is true');
    assertEqual(caps.attachMode, false, 'attachMode is false');
    assertEqual(caps.managedMode, false, 'managedMode is false');
    assertEqual(caps.uploads, false, 'uploads is false (sandbox limitation)');
    assertEqual(caps.downloads, false, 'downloads is false (no native interception)');
    assertEqual(caps.dialogs, false, 'dialogs is false (modal dialogs freeze content script)');
    assertEqual(caps.shadowDom, true, 'shadowDom is true');
  });

  test('ExtensionAdapter — isConnected() is false initially', () => {
    const adapter = new ExtensionAdapter();
    assertEqual(adapter.isConnected(), false);
  });

  // --- Suite 2: Bridge Server Lifecycle & Handshake ---
  console.log('\n--- Suite 2: Bridge Server Lifecycle & Handshake ---');

  const testPort = 8791;
  const adapter = new ExtensionAdapter({}, { port: testPort });

  await testAsync('ExtensionAdapter.connect() — starts local bridge server and /health endpoint', async () => {
    await adapter.connect({ port: testPort });
    assertEqual(adapter.isConnected(), true, 'Adapter is connected');

    // Query health endpoint
    const health = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${testPort}/health`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    assertEqual(health.status, 'ok', 'Health status is ok');
    assertEqual(health.clientConnected, false, 'Client connected is initially false');
  });

  // Connect a simulated extension client
  let clientWs = null;

  await testAsync('Extension client — connects to bridge server via WebSocket', async () => {
    clientWs = new WebSocket(`ws://127.0.0.1:${testPort}`);

    await new Promise((resolve, reject) => {
      clientWs.on('open', resolve);
      clientWs.on('error', reject);
    });

    assertEqual(adapter.bridgeServer.isClientConnected(), true, 'Bridge server detects connected client');

    // Mock response handler on simulated extension client
    clientWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.method === 'tabs.list') {
        clientWs.send(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: [
            { id: 'tab_ext_1', title: 'Extension Active Tab', url: 'https://example.com/app', active: true, index: 0 }
          ]
        }));
      } else if (msg.method === 'tabs.navigate') {
        clientWs.send(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: { url: msg.params.url, title: 'Navigated via Extension', ok: true }
        }));
      } else if (msg.method === 'dom.observe') {
        clientWs.send(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: { obsId: 'obs_ext_99', elements: [{ ref: 'e1', role: 'button', name: 'Save' }] }
        }));
      } else if (msg.method === 'dom.click') {
        clientWs.send(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: { ok: true, action: 'click', ref: msg.params.ref }
        }));
      } else if (msg.method === 'dom.extract') {
        clientWs.send(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: { text: 'Extracted content from extension DOM', charCount: 35 }
        }));
      }
    });
  });

  // --- Suite 3: JSON-RPC Operation Routing ---
  console.log('\n--- Suite 3: JSON-RPC Operation Routing ---');

  await testAsync('ExtensionAdapter.listTabs() — queries extension over RPC', async () => {
    const tabs = await adapter.listTabs();
    assertEqual(tabs.length, 1, 'Got 1 tab');
    assertEqual(tabs[0].title, 'Extension Active Tab');
  });

  await testAsync('ExtensionAdapter.navigate() — dispatches navigation over RPC', async () => {
    const nav = await adapter.navigate('tab_ext_1', 'https://example.com/target');
    assertEqual(nav.ok, true);
    assertEqual(nav.url, 'https://example.com/target');
  });

  await testAsync('ExtensionAdapter.inspect() — receives observation from extension content script', async () => {
    const obs = await adapter.inspect('tab_ext_1');
    assertEqual(obs.obsId, 'obs_ext_99');
    assertEqual(obs.elements[0].ref, 'e1');
  });

  await testAsync('ExtensionAdapter.click() — performs click action via extension bridge', async () => {
    const act = await adapter.click('tab_ext_1', 'e1');
    assertEqual(act.ok, true);
    assertEqual(act.action, 'click');
  });

  await testAsync('ExtensionAdapter.extract() — extracts structured data via extension bridge', async () => {
    const ext = await adapter.extract('tab_ext_1', 'text');
    assert(ext.text.includes('Extracted content'), 'Extracted text received');
  });

  // --- Suite 4: Documented Limitations Enforcement ---
  console.log('\n--- Suite 4: Documented Limitations Enforcement ---');

  await testAsync('upload() — throws UnsupportedOperationError with clear explanation', async () => {
    let threw = false;
    try {
      await adapter.upload('tab_ext_1', 'e1', ['/path/to/file.txt']);
    } catch (err) {
      threw = true;
      assert(err instanceof UnsupportedOperationError, 'Throws UnsupportedOperationError');
      assert(err.message.includes('upload'), 'Mentions upload operation');
      assert(err.details.reason.includes('security model'), 'Mentions extension security model');
    }
    assert(threw, 'Should reject upload in extension mode');
  });

  await testAsync('handleDialog() — throws UnsupportedOperationError', async () => {
    let threw = false;
    try {
      await adapter.handleDialog('tab_ext_1', { action: 'accept' });
    } catch (err) {
      threw = true;
      assert(err instanceof UnsupportedOperationError, 'Throws UnsupportedOperationError');
    }
    assert(threw, 'Should reject handleDialog in extension mode');
  });

  await testAsync('waitForDownload() — throws UnsupportedOperationError', async () => {
    let threw = false;
    try {
      await adapter.waitForDownload('tab_ext_1');
    } catch (err) {
      threw = true;
      assert(err instanceof UnsupportedOperationError, 'Throws UnsupportedOperationError');
    }
    assert(threw, 'Should reject waitForDownload in extension mode');
  });

  // --- Suite 5: Disconnect & Cleanup ---
  console.log('\n--- Suite 5: Disconnect & Cleanup ---');

  await testAsync('ExtensionAdapter.disconnect() — shuts down bridge and resets connection', async () => {
    if (clientWs) {
      clientWs.close();
      clientWs = null;
    }
    await adapter.disconnect();
    assertEqual(adapter.isConnected(), false, 'Adapter disconnected');

    // Operations throw ConnectionError when not connected
    let threw = false;
    try {
      await adapter.listTabs();
    } catch (err) {
      threw = true;
      assert(err instanceof ConnectionError, 'Throws ConnectionError when disconnected');
    }
    assert(threw, 'Should reject calls after disconnect');
  });

  // --- Suite 6: BrowserRuntime Integration ---
  console.log('\n--- Suite 6: BrowserRuntime Integration ---');

  test('BrowserRuntime — seamlessly adopts ExtensionAdapter', () => {
    const extAdapter = new ExtensionAdapter();
    const runtime = new BrowserRuntime(extAdapter);

    assertEqual(runtime.getAdapterName(), 'extension');
    assertEqual(runtime.supports('extensionMode'), true);
    assertEqual(runtime.supports('uploads'), false);
    assertEqual(runtime.supports('managedMode'), false);
  });

  console.log('\n===================================');
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('===================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL EXTENSION ADAPTER TESTS PASSED\n');
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
