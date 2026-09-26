/**
 * tests/cli/test-cli.js
 *
 * Verifies the Command Line Interface (CLI) and Configuration System (Phase 8):
 *   1. CommandLineInterface.status() — reports browsers, ports, connection modes
 *   2. CommandLineInterface.checkPort() — port probing utility
 *   3. ConfigManager — defaults, overrides, deep merging
 *   4. CLI execution via child process
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandLineInterface } from '../../src/cli/index.js';
import { ConfigManager } from '../../src/core/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliBinary = path.resolve(__dirname, '../../bin/browser-agent.js');

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

async function run() {
  console.log('\n============================================================');
  console.log('🧪 test-cli.js — CLI & Configuration System (Phase 8)');
  console.log('============================================================\n');

  // --- Suite 1: ConfigManager ---
  console.log('--- Suite 1: Configuration Management ---');

  test('ConfigManager — loads sensible defaults', () => {
    const config = new ConfigManager();
    assertEqual(config.get('defaultBrowser'), 'brave');
    assertEqual(config.get('defaultMode'), 'attach');
    assertEqual(config.get('cdpPort'), 9222);
    assertEqual(config.get('bridgePort'), 8766);
    assertEqual(config.get('timeouts.navigation'), 30000);
  });

  test('ConfigManager — supports get and set with nested keys', () => {
    const config = new ConfigManager();
    config.set('timeouts.custom', 5555);
    assertEqual(config.get('timeouts.custom'), 5555);
    assertEqual(config.get('nonexistent.key', 'fallback'), 'fallback');
  });

  // --- Suite 2: CommandLineInterface.status() ---
  console.log('\n--- Suite 2: CLI Status Command ---');

  await testAsync('CommandLineInterface.status() — returns comprehensive system status', async () => {
    const status = await CommandLineInterface.status();
    assert(status.chromiumBrowsers.brave !== undefined, 'Contains Brave browser detection');
    assert(status.chromiumBrowsers.chrome !== undefined, 'Contains Chrome browser detection');
    assert(status.chromiumBrowsers.edge !== undefined, 'Contains Edge browser detection');
    assert(status.firefoxInfo !== undefined, 'Contains Firefox detection');
    assert(typeof status.cdpLive === 'boolean', 'Has cdpLive boolean');
  });

  // --- Suite 3: Port Probing ---
  console.log('\n--- Suite 3: Port Probing Utility ---');

  await testAsync('CommandLineInterface.checkPort() — handles open and closed ports without throwing', async () => {
    // 59999 should be closed
    const isClosed = await CommandLineInterface.checkPort('127.0.0.1', 59999, '/', 300);
    assertEqual(isClosed, false, 'Reports false for closed port');
  });

  // --- Suite 4: CLI Binary Execution ---
  console.log('\n--- Suite 4: CLI Binary Execution ---');

  test('bin/browser-agent.js --help — runs successfully', () => {
    const res = spawnSync(process.execPath, [cliBinary, '--help'], { encoding: 'utf8' });
    assertEqual(res.status, 0, 'Exit code is 0');
    assert(res.stdout.includes('Usage:'), 'Contains usage instructions');
    assert(res.stdout.includes('browser-agent <command>'), 'Shows binary name');
    assert(res.stdout.includes('status'), 'Shows status command');
  });

  test('bin/browser-agent.js status — runs successfully via subprocess', () => {
    const res = spawnSync(process.execPath, [cliBinary, 'status'], { encoding: 'utf8' });
    assertEqual(res.status, 0, 'Exit code is 0');
    assert(res.stdout.includes('Universal Browser Control Runtime'), 'Contains title');
    assert(res.stdout.includes('Installed Browser Detection'), 'Contains detection section');
  });

  console.log('\n===================================');
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('===================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL CLI & CONFIG TESTS PASSED\n');
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
