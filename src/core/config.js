/**
 * Universal Browser Control Runtime — Centralized Configuration
 *
 * Loads runtime settings from configuration files, environment variables,
 * or sensible defaults.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = {
  defaultBrowser: 'brave',
  defaultMode: 'attach',
  cdpHost: '127.0.0.1',
  cdpPort: 9222,
  bridgeHost: '127.0.0.1',
  bridgePort: 8766,
  headless: true,
  observationLevel: 1,
  observationFormat: 'compact',
  timeouts: {
    connection: 10000,
    navigation: 30000,
    action: 10000,
    wait: 10000
  },
  downloadsDir: path.resolve(process.cwd(), 'artifacts', 'downloads'),
  logging: {
    level: 'info',
    telemetryPort: 8765
  }
};

export class ConfigManager {
  /**
   * @param {string} [configPath] - Optional custom path to JSON configuration
   */
  constructor(configPath = null) {
    this.config = { ...DEFAULT_CONFIG };
    this._load(configPath);
  }

  _load(customPath) {
    const searchPaths = [
      customPath,
      process.env.BROWSER_CONTROL_CONFIG,
      path.resolve(process.cwd(), 'browser-control.json'),
      path.resolve(process.cwd(), 'config.json')
    ].filter(Boolean);

    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, 'utf8');
          const parsed = JSON.parse(raw);
          this.config = this._deepMerge(this.config, parsed);
          break;
        } catch {
          // Ignore invalid config file, continue with defaults
        }
      }
    }

    // Apply environment variables overrides
    if (process.env.BROWSER_DEFAULT) this.config.defaultBrowser = process.env.BROWSER_DEFAULT;
    if (process.env.BROWSER_MODE) this.config.defaultMode = process.env.BROWSER_MODE;
    if (process.env.CDP_PORT) this.config.cdpPort = parseInt(process.env.CDP_PORT, 10);
    if (process.env.CDP_HOST) this.config.cdpHost = process.env.CDP_HOST;
    if (process.env.BRIDGE_PORT) this.config.bridgePort = parseInt(process.env.BRIDGE_PORT, 10);
    if (process.env.HEADLESS !== undefined) this.config.headless = process.env.HEADLESS === 'true';
  }

  _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  get(key, defaultValue = undefined) {
    if (!key) return this.config;
    const parts = key.split('.');
    let curr = this.config;
    for (const part of parts) {
      if (curr === undefined || curr === null) return defaultValue;
      curr = curr[part];
    }
    return curr !== undefined ? curr : defaultValue;
  }

  set(key, value) {
    const parts = key.split('.');
    let curr = this.config;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!curr[part] || typeof curr[part] !== 'object') {
        curr[part] = {};
      }
      curr = curr[part];
    }
    curr[parts[parts.length - 1]] = value;
  }
}

export const globalConfig = new ConfigManager();
