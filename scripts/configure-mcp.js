#!/usr/bin/env node
/**
 * Automated MCP Configuration & Diagnostic Script
 * Automatically configures Antigravity / Gemini CLI and Claude Desktop MCP configurations.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';

const repoDir = process.cwd();
const runMcpCmd = path.join(repoDir, 'brave-mcp', 'run-mcp.cmd');
const universalCli = path.join(repoDir, 'bin', 'browser-agent.js');

console.log('========================================================');
console.log(' Universal Browser Control - Automated MCP Configurator');
console.log('========================================================\n');
console.log(`[INFO] Current Repository Root: ${repoDir}`);

// 1. Configure Antigravity / Gemini CLI
const geminiConfigDir = path.join(os.homedir(), '.gemini', 'config');
const geminiConfigFile = path.join(geminiConfigDir, 'mcp_config.json');

try {
  fs.mkdirSync(geminiConfigDir, { recursive: true });
  let geminiConfig = { mcpServers: {} };
  if (fs.existsSync(geminiConfigFile)) {
    try {
      geminiConfig = JSON.parse(fs.readFileSync(geminiConfigFile, 'utf8'));
    } catch {
      geminiConfig = { mcpServers: {} };
    }
  }

  geminiConfig.mcpServers = geminiConfig.mcpServers || {};
  geminiConfig.mcpServers['brave-control'] = {
    command: 'cmd.exe',
    args: ['/c', runMcpCmd]
  };

  fs.writeFileSync(geminiConfigFile, JSON.stringify(geminiConfig, null, 2), 'utf8');
  console.log(`[✓] Antigravity MCP Configured successfully:`);
  console.log(`    Location: ${geminiConfigFile}`);
  console.log(`    Server: brave-control -> ${runMcpCmd}`);
} catch (err) {
  console.error(`[!] Failed to update Antigravity config: ${err.message}`);
}

// 2. Configure Claude Desktop if Claude config directory exists
const appData = process.env.APPDATA || (os.platform() === 'win32' ? path.join(os.homedir(), 'AppData', 'Roaming') : null);
if (appData) {
  const claudeConfigDir = path.join(appData, 'Claude');
  const claudeConfigFile = path.join(claudeConfigDir, 'claude_desktop_config.json');

  if (fs.existsSync(claudeConfigDir)) {
    try {
      let claudeConfig = { mcpServers: {} };
      if (fs.existsSync(claudeConfigFile)) {
        try {
          claudeConfig = JSON.parse(fs.readFileSync(claudeConfigFile, 'utf8'));
        } catch {
          claudeConfig = { mcpServers: {} };
        }
      }

      claudeConfig.mcpServers = claudeConfig.mcpServers || {};
      claudeConfig.mcpServers['brave-control'] = {
        command: 'cmd.exe',
        args: ['/c', runMcpCmd]
      };

      fs.writeFileSync(claudeConfigFile, JSON.stringify(claudeConfig, null, 2), 'utf8');
      console.log(`[✓] Claude Desktop MCP Configured successfully:`);
      console.log(`    Location: ${claudeConfigFile}`);
    } catch (err) {
      console.warn(`[!] Note: Claude Desktop config update skipped (${err.message})`);
    }
  }
}

// 3. Port 9222 Status Check
console.log('\n[INFO] Checking Browser Remote Debugging status (Port 9222)...');
const req = http.get('http://127.0.0.1:9222/json/version', { timeout: 1500 }, (res) => {
  if (res.statusCode === 200) {
    console.log('[✓] Port 9222 is ACTIVE and reachable! Browser is ready for agent connection.');
  } else {
    console.log('[i] Port 9222 responded, but status was ' + res.statusCode);
  }
});

req.on('error', () => {
  console.log('[i] Port 9222 is currently not active.');
  console.log('    To connect your browser, simply launch Brave using the desktop shortcut or run:');
  console.log('    brave-launcher\\launch-brave.cmd');
});

req.end();
