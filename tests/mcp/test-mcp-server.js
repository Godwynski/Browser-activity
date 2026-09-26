/**
 * tests/mcp/test-mcp-server.js
 *
 * Verifies the Universal MCP Server interface & protocol (Phase 8):
 *   1. Tool Registration: 5 universal tools (browser, inspect, act, extract, evaluate)
 *   2. Legacy Aliases: brave_tabs, brave_observe, brave_act, brave_batch_act, brave_eval, brave_navigate
 *   3. Universal Tool Execution: browser, inspect, extract, evaluate on local fixture
 *   4. Legacy Tool Execution: transparent backward compatibility
 *   5. Error Handling: structured error output formatted for AI context windows
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { UniversalMcpServer } from '../../src/mcp/server.js';
import { BrowserRuntime } from '../../src/core/browser-runtime.js';
import { ChromiumAdapter } from '../../src/adapters/chromium.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basicFixturePath = path.resolve(__dirname, '../../test-sites/basic/index.html');
const basicFixtureUrl = `file:///${basicFixturePath.replace(/\\/g, '/')}`;

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

async function run() {
  console.log('\n============================================================');
  console.log('🧪 test-mcp-server.js — Universal MCP Server (Phase 8)');
  console.log('============================================================\n');

  const adapter = new ChromiumAdapter();
  const runtime = new BrowserRuntime(adapter);
  await runtime.connect({ mode: 'managed', browser: 'chrome', headless: true });

  const tab = await runtime.createTab(basicFixtureUrl);
  await runtime.navigate(tab.id, basicFixtureUrl);

  const mcp = new UniversalMcpServer({ runtime, includeLegacyAliases: true });

  try {
    // --- Suite 1: Tool Registration ---
    console.log('--- Suite 1: Tool Registration ---');

    let toolsList = [];
    await test('ListTools — registers all 5 core universal tools', async () => {
      const listHandler = mcp.server._requestHandlers.get('tools/list');
      const response = await listHandler({ method: 'tools/list', params: {} });
      toolsList = response.tools;

      const universalToolNames = ['browser', 'inspect', 'act', 'extract', 'evaluate'];
      for (const name of universalToolNames) {
        const found = toolsList.find(t => t.name === name);
        assert(found !== undefined, `Universal tool '${name}' is registered`);
        assert(found.description.length > 10, `'${name}' has description`);
      }
    });

    await test('ListTools — registers legacy brave_* aliases for backward compatibility', async () => {
      const legacyNames = ['brave_tabs', 'brave_observe', 'brave_act', 'brave_batch_act', 'brave_eval', 'brave_navigate'];
      for (const name of legacyNames) {
        const found = toolsList.find(t => t.name === name);
        assert(found !== undefined, `Legacy alias '${name}' is registered`);
      }
    });

    // Helper to call tool directly via CallTool handler
    const callTool = async (name, args) => {
      const handler = mcp.server._requestHandlers.get('tools/call');
      return await handler({ method: 'tools/call', params: { name, arguments: args } });
    };

    // --- Suite 2: Universal Tools Execution ---
    console.log('\n--- Suite 2: Universal Tools Execution ---');

    await test('Tool "browser" — lists open tabs', async () => {
      const res = await callTool('browser', { action: 'list' });
      assert(!res.isError, 'No error');
      const tabs = JSON.parse(res.content[0].text);
      assert(Array.isArray(tabs), 'Returned tabs array');
      assert(tabs.length >= 1, 'Contains at least 1 tab');
    });

    await test('Tool "inspect" — returns compact observation', async () => {
      const res = await callTool('inspect', { tabId: tab.id, level: 1 });
      assert(!res.isError, 'No error');
      const text = res.content[0].text;
      assert(text.includes('[e') || text.includes('button') || text.includes('obs_'), 'Contains compact element refs');
    });

    await test('Tool "act" — executes click primitive on element', async () => {
      const res = await callTool('act', { tabId: tab.id, action: 'click', ref: 'e1' });
      assert(!res.isError, 'No error');
      const receipt = JSON.parse(res.content[0].text);
      assertEqual(receipt.action, 'click');
      assertEqual(receipt.ok, true);
    });

    await test('Tool "extract" — extracts structured data from page', async () => {
      const res = await callTool('extract', { tabId: tab.id, type: 'text' });
      assert(!res.isError, 'No error');
      const extracted = JSON.parse(res.content[0].text);
      assertEqual(extracted.type, 'text');
      assert(extracted.data.text.length > 10, 'Extracted text present');
    });

    await test('Tool "evaluate" — evaluates JavaScript expression', async () => {
      const res = await callTool('evaluate', { tabId: tab.id, script: '1 + 1' });
      assert(!res.isError, 'No error');
      assertEqual(res.content[0].text, '2');
    });

    // --- Suite 3: Legacy Aliases Execution ---
    console.log('\n--- Suite 3: Legacy Aliases Execution ---');

    await test('Legacy "brave_tabs" — returns tabs array', async () => {
      const res = await callTool('brave_tabs', { action: 'list' });
      assert(!res.isError);
      const tabs = JSON.parse(res.content[0].text);
      assert(Array.isArray(tabs));
    });

    await test('Legacy "brave_observe" — returns observation', async () => {
      const res = await callTool('brave_observe', { target: 'agent' });
      assert(!res.isError);
      assert(res.content[0].text.length > 10);
    });

    await test('Legacy "brave_eval" — evaluates expression', async () => {
      const res = await callTool('brave_eval', { tabIndex: 1, script: 'document.title' });
      assert(!res.isError);
      assert(res.content[0].text.includes('Basic Test Site'));
    });

    // --- Suite 4: Structured Error Handling ---
    console.log('\n--- Suite 4: Structured Error Handling ---');

    await test('CallTool — formats errors as actionable agent text', async () => {
      const res = await callTool('act', { tabId: tab.id, action: 'click', ref: 'e99999' });
      assertEqual(res.isError, true, 'isError flag is true');
      assert(res.content[0].text.includes('ELEMENT_NOT_FOUND') || res.content[0].text.includes('ref=e99999'), 'Machine readable error format');
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
    console.log('🎉 ALL UNIVERSAL MCP TESTS PASSED\n');
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
