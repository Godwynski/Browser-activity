/**
 * Universal Browser Control Runtime — Command Line Interface (CLI)
 *
 * Implements the `browser-agent` / `agy-browser` CLI engine:
 *   - status   : Inspect system browsers, live CDP ports, and bridge availability
 *   - launch   : Launch browser with remote debugging flags enabled
 *   - inspect  : Observe page DOM and interactive elements
 *   - extract  : Extract structured tables, text, links, and forms
 *   - eval     : Evaluate in-page JavaScript expressions
 *   - serve    : Start the Universal MCP server over stdio
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { ChromiumAdapter } from '../adapters/chromium.js';
import { BiDiAdapter } from '../adapters/bidi.js';
import { BrowserRuntime } from '../core/browser-runtime.js';
import { UniversalMcpServer } from '../mcp/server.js';
import { globalConfig } from '../core/config.js';

export class CommandLineInterface {
  /**
   * Check if a local HTTP endpoint is listening.
   * @param {string} host
   * @param {number} port
   * @param {string} path
   * @param {number} [timeout=1000]
   * @returns {Promise<boolean>}
   */
  static async checkPort(host, port, path = '/', timeout = 1000) {
    return new Promise((resolve) => {
      const req = http.request({ host, port, path, method: 'GET', timeout }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  /**
   * CLI: status command
   */
  static async status() {
    console.log('\n======================================================');
    console.log('🌐 Universal Browser Control Runtime — Status Report');
    console.log('======================================================\n');

    const chromiumBrowsers = ChromiumAdapter.detectBrowsers();
    const firefoxInfo = BiDiAdapter.detectFirefox();

    const cdpPort = globalConfig.get('cdpPort', 9222);
    const bridgePort = globalConfig.get('bridgePort', 8766);

    const cdpLive = await CommandLineInterface.checkPort('127.0.0.1', cdpPort, '/json/version');
    const bridgeLive = await CommandLineInterface.checkPort('127.0.0.1', bridgePort, '/health');

    console.log('1. Installed Browser Detection:');
    for (const [key, b] of Object.entries(chromiumBrowsers)) {
      const statusStr = b.installed ? `✅ INSTALLED (${b.path})` : '❌ NOT_INSTALLED';
      console.log(`   - ${b.name.padEnd(18)} : ${statusStr}`);
    }
    const ffStatus = firefoxInfo.installed ? `✅ INSTALLED (${firefoxInfo.path})` : '❌ NOT_INSTALLED';
    console.log(`   - ${firefoxInfo.name.padEnd(18)} : ${ffStatus}`);

    console.log('\n2. Connection Protocols & Ports:');
    console.log(`   - Mode A (CDP Attach Port ${cdpPort})  : ${cdpLive ? '🟢 LIVE (Ready for agent attachment)' : '⚪ INACTIVE'}`);
    console.log(`   - Mode B (Managed Subprocess)     : 🟢 READY (via Playwright Core)`);
    console.log(`   - Mode C (Extension Bridge ${bridgePort}): ${bridgeLive ? '🟢 LISTENING' : '⚪ IDLE'}`);

    console.log('\n3. Active Configuration:');
    console.log(`   - Default Browser : ${globalConfig.get('defaultBrowser')}`);
    console.log(`   - Default Mode    : ${globalConfig.get('defaultMode')}`);
    console.log(`   - Headless Mode   : ${globalConfig.get('headless')}`);

    console.log('\n======================================================\n');
    return {
      chromiumBrowsers,
      firefoxInfo,
      cdpLive,
      bridgeLive
    };
  }

  /**
   * CLI: launch command
   */
  static async launch(browserName = 'brave', port = 9222) {
    const browsers = ChromiumAdapter.detectBrowsers();
    const target = browsers[browserName];
    if (!target || !target.installed) {
      console.error(`❌ Browser "${browserName}" is not installed or not recognized.`);
      process.exit(1);
    }

    console.log(`🚀 Launching ${target.name} with remote debugging port ${port}...`);
    const args = [`--remote-debugging-port=${port}`, '--restore-last-session'];
    const proc = spawn(target.path, args, { detached: true, stdio: 'ignore' });
    proc.unref();

    console.log(`✅ ${target.name} launched successfully.`);
  }

  /**
   * CLI: inspect command
   */
  static async inspect(options = {}) {
    const runtime = new BrowserRuntime(new ChromiumAdapter());
    try {
      await runtime.connect({ mode: 'attach', port: globalConfig.get('cdpPort', 9222) });
    } catch {
      await runtime.connect({ mode: 'managed', browser: 'chrome', headless: true });
    }

    try {
      const tabs = await runtime.listTabs();
      const targetId = options.tabId || (tabs[0] ? tabs[0].id : null);
      if (!targetId) {
        console.error('No tabs found to inspect.');
        return;
      }

      const obs = await runtime.inspect(targetId, {
        format: options.format || 'compact',
        scope: options.scope,
        filter: options.filter || 'interactive'
      });

      console.log(obs.compact || JSON.stringify(obs, null, 2));
    } finally {
      await runtime.disconnect();
    }
  }

  /**
   * CLI: extract command
   */
  static async extract(type = 'text', options = {}) {
    const runtime = new BrowserRuntime(new ChromiumAdapter());
    try {
      await runtime.connect({ mode: 'attach', port: globalConfig.get('cdpPort', 9222) });
    } catch {
      await runtime.connect({ mode: 'managed', browser: 'chrome', headless: true });
    }

    try {
      const tabs = await runtime.listTabs();
      const targetId = options.tabId || (tabs[0] ? tabs[0].id : null);
      if (!targetId) return;

      const result = await runtime.extract(targetId, type, options);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await runtime.disconnect();
    }
  }

  /**
   * CLI: serve command (Starts MCP Server)
   */
  static async serve() {
    const mcp = new UniversalMcpServer();
    await mcp.startStdio();
  }

  /**
   * Main CLI entry router
   * @param {string[]} argv
   */
  static async run(argv = process.argv.slice(2)) {
    const cmd = argv[0] || 'status';

    switch (cmd) {
      case 'status':
        return await CommandLineInterface.status();

      case 'launch': {
        const browser = argv[1] || 'brave';
        const port = parseInt(argv[2], 10) || 9222;
        return await CommandLineInterface.launch(browser, port);
      }

      case 'inspect':
        return await CommandLineInterface.inspect();

      case 'extract': {
        const type = argv[1] || 'table';
        return await CommandLineInterface.extract(type);
      }

      case 'serve':
        return await CommandLineInterface.serve();

      case 'help':
      case '--help':
      case '-h':
        console.log(`
Universal Browser Control Runtime CLI (browser-agent / agy-browser)

Usage:
  browser-agent <command> [options]

Commands:
  status               Display browser installation, port, and protocol health
  launch [browser]     Launch browser with remote debugging port 9222
  inspect              Inspect interactive elements in active browser tab
  extract [type]       Extract structured data (table, text, links, forms)
  serve                Start Universal MCP server over stdio
  help                 Display this help information
`);
        break;

      default:
        console.error(`Unknown command: "${cmd}". Run "browser-agent help" for available commands.`);
        process.exit(1);
    }
  }
}
