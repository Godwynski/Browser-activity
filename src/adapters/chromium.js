/**
 * Universal Browser Control Runtime — Chromium Family Adapter
 *
 * Provides browser-neutral control for Chromium-based browsers:
 *   - Google Chrome
 *   - Microsoft Edge
 *   - Brave Browser
 *   - Ungoogled Chromium / generic Chromium
 *
 * Implements BaseBrowserAdapter using Playwright's CDP connection or
 * managed browser launch capabilities.
 *
 * Supports two primary connection modes:
 *   1. Mode A: Attach — Connect to an already running browser on CDP port (default: 9222)
 *   2. Mode B: Managed — Launch a dedicated browser instance (Chrome, Edge, Brave, etc.)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { chromium } from 'playwright-core';
import { BaseBrowserAdapter } from '../core/base-adapter.js';
import {
  ConnectionError,
  NavigationError,
  TabNotFoundError
} from '../core/errors.js';
import { ObservationEngine } from '../observation/index.js';
import { ActionExecutor, BatchExecutor } from '../actions/index.js';
import { DataExtractor } from '../extraction/index.js';
import { DialogManager } from '../dialogs/index.js';
import { DownloadManager } from '../downloads/index.js';

export class ChromiumAdapter extends BaseBrowserAdapter {
  /**
   * @param {object} [customCapabilities] - Optional capability overrides
   */
  constructor(customCapabilities = {}) {
    super('chromium', {
      attachMode: true,
      managedMode: true,
      extensionMode: false,
      iframes: true,
      crossOriginIframes: true,
      shadowDom: true,
      closedShadowDom: false,
      popups: true,
      multipleContexts: true,
      downloads: true,
      uploads: true,
      dialogs: true,
      geolocation: true,
      permissions: true,
      networkInterception: true,
      ...customCapabilities
    });

    /** @type {import('playwright-core').Browser | null} */
    this.browser = null;

    /** @type {import('playwright-core').BrowserContext | null} */
    this.context = null;

    /** @type {'attach' | 'managed' | null} */
    this.connectionMode = null;

    /** @type {Map<string, import('playwright-core').Page>} */
    this._tabs = new Map();

    /** @type {WeakMap<import('playwright-core').Page, string>} */
    this._pageToTabId = new WeakMap();

    /** @type {Map<string, object>} */
    this._tabMeta = new Map();

    /** @type {number} */
    this._tabCounter = 0;

    /** @type {ObservationEngine} */
    this._observationEngine = new ObservationEngine();

    /** @type {ActionExecutor} */
    this._actionExecutor = new ActionExecutor({ observationEngine: this._observationEngine });

    /** @type {BatchExecutor} */
    this._batchExecutor = new BatchExecutor(this._actionExecutor);

    /** @type {DataExtractor} */
    this._dataExtractor = new DataExtractor();

    /** @type {DialogManager} */
    this._dialogManager = new DialogManager();

    /** @type {DownloadManager} */
    this._downloadManager = new DownloadManager();

    // Forward events
    this._dialogManager.on('dialog', (rec) => this.emit('dialog', rec));
    this._downloadManager.on('download_started', (rec) => this.emit('download_started', rec));
    this._downloadManager.on('download_completed', (rec) => this.emit('download_completed', rec));
  }

  // ==========================================================================
  //  BROWSER DETECTION & RESOLUTION
  // ==========================================================================

  /**
   * Detects installed Chromium browsers on the current host system.
   *
   * @returns {Record<string, { name: string, path: string | null, installed: boolean }>}
   */
  static detectBrowsers() {
    const platform = os.platform();
    const results = {
      brave: { name: 'Brave Browser', path: null, installed: false },
      chrome: { name: 'Google Chrome', path: null, installed: false },
      edge: { name: 'Microsoft Edge', path: null, installed: false },
      chromium: { name: 'Chromium', path: null, installed: false }
    };

    const candidatePaths = {
      brave: [],
      chrome: [],
      edge: [],
      chromium: []
    };

    if (platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || '';
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

      candidatePaths.brave.push(
        path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
        path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
      );
      candidatePaths.chrome.push(
        path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
      );
      candidatePaths.edge.push(
        path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
      );
      candidatePaths.chromium.push(
        path.join(localAppData, 'Chromium', 'Application', 'chrome.exe')
      );
    } else if (platform === 'darwin') {
      candidatePaths.brave.push('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser');
      candidatePaths.chrome.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
      candidatePaths.edge.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
      candidatePaths.chromium.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
    } else {
      // Linux & BSD
      candidatePaths.brave.push('/usr/bin/brave-browser', '/usr/bin/brave');
      candidatePaths.chrome.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable');
      candidatePaths.edge.push('/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable');
      candidatePaths.chromium.push('/usr/bin/chromium', '/usr/bin/chromium-browser');
    }

    for (const [key, paths] of Object.entries(candidatePaths)) {
      for (const p of paths) {
        if (p && fs.existsSync(p)) {
          results[key].path = p;
          results[key].installed = true;
          break;
        }
      }
    }

    return results;
  }

  /**
   * Resolves a browser executable path by name ('chrome', 'edge', 'brave', 'chromium')
   * or verifies an explicit executable path.
   *
   * @param {string} browserNameOrPath
   * @returns {string}
   */
  static resolveBrowserExecutable(browserNameOrPath) {
    if (!browserNameOrPath) {
      throw new Error('Browser name or executable path must be specified');
    }

    // Direct path check
    if (fs.existsSync(browserNameOrPath)) {
      return browserNameOrPath;
    }

    const detected = ChromiumAdapter.detectBrowsers();
    const key = browserNameOrPath.toLowerCase().trim();
    if (detected[key] && detected[key].installed && detected[key].path) {
      return detected[key].path;
    }

    throw new Error(
      `Chromium browser '${browserNameOrPath}' not found on host system.\n` +
      `Available detected browsers: ${Object.entries(detected)
        .filter(([, v]) => v.installed)
        .map(([k]) => k)
        .join(', ') || 'none'}`
    );
  }

  // ==========================================================================
  //  CONNECTION
  // ==========================================================================

  /**
   * Connect to an existing browser via CDP or launch a managed browser process.
   *
   * Config options:
   *   Attach mode:
   *     { mode: 'attach', port: 9222, host: '127.0.0.1' }
   *     { mode: 'attach', cdpUrl: 'http://127.0.0.1:9222' }
   *     { mode: 'attach', wsEndpoint: 'ws://127.0.0.1:9222/devtools/browser/...' }
   *
   *   Managed mode:
   *     { mode: 'managed', browser: 'chrome' | 'edge' | 'brave', headless: true }
   *     { mode: 'managed', executablePath: '/path/to/binary', headless: true }
   *     { mode: 'managed', userDataDir: '/path/to/profile', headless: false }
   *
   * @param {object} config
   * @returns {Promise<void>}
   */
  async connect(config = {}) {
    if (this.connected) {
      await this.disconnect();
    }

    const mode = config.mode || (config.executablePath || config.browser ? 'managed' : 'attach');
    this.connectionMode = mode;

    try {
      if (mode === 'attach') {
        await this._connectAttach(config);
      } else if (mode === 'managed') {
        await this._connectManaged(config);
      } else {
        throw new Error(`Unsupported connection mode '${mode}'. Expected 'attach' or 'managed'.`);
      }

      this.connected = true;
      await this._syncTabs();
    } catch (err) {
      this.connected = false;
      this.browser = null;
      this.context = null;
      this.connectionMode = null;

      if (err instanceof ConnectionError) throw err;

      throw new ConnectionError(err.message, {
        mode,
        endpoint: config.wsEndpoint || config.cdpUrl || (config.port ? `http://127.0.0.1:${config.port}` : undefined),
        executablePath: config.executablePath,
        reason: err.message
      });
    }
  }

  /**
   * Disconnect from browser and release all held resources.
   * Safe and idempotent.
   * @returns {Promise<void>}
   */
  async disconnect() {
    this._tabs.clear();

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore errors during browser closing
      }
      this.browser = null;
    }

    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // Ignore errors during context closing
      }
      this.context = null;
    }

    this.connected = false;
    this.connectionMode = null;
  }

  // ==========================================================================
  //  INTERNAL CONNECTION HELPERS
  // ==========================================================================

  async _connectAttach(config) {
    const host = config.host || '127.0.0.1';
    const port = config.port || 9222;
    const endpoint = config.wsEndpoint || config.cdpUrl || `http://${host}:${port}`;
    const timeout = config.timeout || 6000;

    let lastErr = null;
    const maxRetries = config.retries || 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.browser = await chromium.connectOverCDP(endpoint, { timeout });
        const contexts = this.browser.contexts();
        this.context = contexts[0] || null;
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    throw new ConnectionError(
      `Could not attach to browser on ${endpoint} (${lastErr?.message})`,
      { endpoint, reason: lastErr?.message, suggestion: 'ensure browser is running with --remote-debugging-port=9222' }
    );
  }

  async _connectManaged(config) {
    let executablePath = config.executablePath;
    if (!executablePath && config.browser) {
      executablePath = ChromiumAdapter.resolveBrowserExecutable(config.browser);
    }

    const headless = config.headless !== false;
    const args = config.args || ['--no-sandbox', '--disable-setuid-sandbox'];
    const timeout = config.timeout || 15000;

    if (config.userDataDir) {
      this.context = await chromium.launchPersistentContext(config.userDataDir, {
        executablePath,
        headless,
        args,
        timeout
      });
      this.browser = null;
    } else {
      this.browser = await chromium.launch({
        executablePath,
        headless,
        args,
        timeout
      });
      this.context = await this.browser.newContext();
    }
  }

  // ==========================================================================
  //  TAB MANAGEMENT & TRACKING
  // ==========================================================================

  /**
   * Internal helper to register a Playwright Page with a stable tabId.
   * @param {import('playwright-core').Page} page
   * @param {object} [meta]
   * @param {boolean} [meta.isPopup=false]
   * @param {string} [meta.openerTabId=null]
   * @returns {string}
   */
  _registerPage(page, meta = {}) {
    if (!page || page.isClosed()) return null;

    let id = this._pageToTabId.get(page);
    if (!id) {
      id = `tab_${++this._tabCounter}`;
      this._pageToTabId.set(page, id);
      this._tabs.set(id, page);
      this._tabMeta.set(id, {
        isPopup: Boolean(meta.isPopup),
        openerTabId: meta.openerTabId || null,
        createdAt: Date.now()
      });

      // Attach dialog and download managers
      this._dialogManager.attach(page, id);
      this._downloadManager.attach(page, id);

      // Listen for child popups
      page.on('popup', (popupPage) => {
        const popupId = this._registerPage(popupPage, { isPopup: true, openerTabId: id });
        this.emit('popup', { popupId, openerTabId: id, url: popupPage.url() });
      });

      page.on('close', () => {
        this._tabs.delete(id);
        this._tabMeta.delete(id);
        this.emit('tab:closed', { id });
      });

      this.emit('tab:created', {
        id,
        isPopup: Boolean(meta.isPopup),
        openerTabId: meta.openerTabId || null
      });
    } else {
      if (meta.isPopup !== undefined || meta.openerTabId !== undefined) {
        const existing = this._tabMeta.get(id) || {};
        this._tabMeta.set(id, {
          ...existing,
          isPopup: meta.isPopup !== undefined ? Boolean(meta.isPopup) : existing.isPopup,
          openerTabId: meta.openerTabId !== undefined ? meta.openerTabId : existing.openerTabId
        });
      }
    }

    return id;
  }

  /**
   * Synchronises tab map with currently open pages across all contexts.
   */
  async _syncTabs() {
    const contexts = this.browser ? this.browser.contexts() : (this.context ? [this.context] : []);
    for (const ctx of contexts) {
      // Wire new page listener
      ctx.on('page', async (p) => {
        let openerId = null;
        try {
          const openerPage = await p.opener();
          if (openerPage) {
            openerId = this._pageToTabId.get(openerPage) || null;
          }
        } catch {
          // Ignore opener resolution errors
        }
        this._registerPage(p, { isPopup: Boolean(openerId), openerTabId: openerId });
      });

      for (const p of ctx.pages()) {
        if (!p.isClosed()) {
          this._registerPage(p);
        }
      }
    }

    // Ensure at least one tab exists if context is present
    if (this._tabs.size === 0 && this.context) {
      const p = await this.context.newPage();
      this._registerPage(p);
    }
  }

  /**
   * Resolves a tabId string or index to a live Playwright Page instance.
   * @param {string|number} tabId
   * @returns {import('playwright-core').Page}
   */
  _resolvePage(tabId) {
    if (!this.connected) {
      throw new ConnectionError('Cannot perform operation; browser is not connected');
    }

    // Direct lookup by tab ID
    if (typeof tabId === 'string' && this._tabs.has(tabId)) {
      const p = this._tabs.get(tabId);
      if (p && !p.isClosed()) return p;
      this._tabs.delete(tabId);
    }

    // Lookup by 0-based index if numeric or numeric string
    const asNum = Number(tabId);
    if (!isNaN(asNum) && Number.isInteger(asNum)) {
      const activePages = Array.from(this._tabs.values()).filter(p => !p.isClosed());
      if (asNum >= 0 && asNum < activePages.length) {
        return activePages[asNum];
      }
    }

    throw new TabNotFoundError(String(tabId));
  }

  /**
   * List all open tabs.
   * @returns {Promise<import('../core/base-adapter.js').TabInfo[]>}
   */
  async listTabs() {
    await this._syncTabs();

    const tabs = [];
    let index = 0;

    for (const [id, page] of this._tabs.entries()) {
      if (page.isClosed()) continue;

      let title = 'Untitled';
      let url = 'about:blank';
      let active = false;

      try {
        title = await page.title();
        url = page.url();
        active = await page.evaluate(() => document.visibilityState === 'visible').catch(() => false);
      } catch {
        // Page state read fallback
      }

      const meta = this._tabMeta.get(id) || {};

      tabs.push({
        id,
        title,
        url,
        active,
        index: index++,
        isPopup: Boolean(meta.isPopup),
        openerTabId: meta.openerTabId || null
      });
    }

    return tabs;
  }

  /**
   * Get metadata for a specific tab.
   * @param {string} tabId
   * @returns {Promise<import('../core/base-adapter.js').TabInfo>}
   */
  async getTab(tabId) {
    const page = this._resolvePage(tabId);
    const id = this._pageToTabId.get(page) || tabId;
    const tabs = await this.listTabs();
    const found = tabs.find(t => t.id === id);
    if (!found) {
      throw new TabNotFoundError(String(tabId));
    }
    return found;
  }

  /**
   * Open a new tab in the browser context.
   * @param {string} [url='about:blank']
   * @returns {Promise<import('../core/base-adapter.js').TabInfo>}
   */
  async createTab(url = 'about:blank') {
    if (!this.connected) {
      throw new ConnectionError('Cannot create tab; browser is not connected');
    }

    const ctx = this.context || (this.browser ? this.browser.contexts()[0] : null);
    if (!ctx) {
      throw new Error('No browser context available to create new tab');
    }

    const page = await ctx.newPage();
    const id = this._registerPage(page);

    if (url && url !== 'about:blank') {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (err) {
        throw new NavigationError(err.message, { url, reason: err.message });
      }
    }

    return await this.getTab(id);
  }

  /**
   * Close a tab by ID.
   * @param {string} tabId
   * @returns {Promise<void>}
   */
  async closeTab(tabId) {
    const page = this._resolvePage(tabId);
    const id = this._pageToTabId.get(page) || tabId;
    await page.close();
    this._tabs.delete(id);
  }

  /**
   * Bring a tab to the front / make active.
   * @param {string} tabId
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').TabInfo>}
   */
  async activateTab(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    if (options.bringToFront !== false) {
      await page.bringToFront().catch(() => {});
    }
    return await this.getTab(tabId);
  }

  // ==========================================================================
  //  NAVIGATION
  // ==========================================================================

  /**
   * Navigate a tab to a specified URL.
   * @param {string} tabId
   * @param {string} url
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').NavigationResult>}
   */
  async navigate(tabId, url, options = {}) {
    const page = this._resolvePage(tabId);
    const waitUntil = options.waitUntil || 'domcontentloaded';
    const timeout = options.timeout || 15000;

    try {
      await page.goto(url, { waitUntil, timeout });
      return {
        url: page.url(),
        title: await page.title(),
        ok: true
      };
    } catch (err) {
      throw new NavigationError(`Navigation to '${url}' failed: ${err.message}`, {
        url,
        reason: err.message,
        suggestion: 'verify URL is accessible or increase navigation timeout'
      });
    }
  }

  /**
   * Navigate back in tab history.
   * @param {string} tabId
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').NavigationResult>}
   */
  async goBack(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    const waitUntil = options.waitUntil || 'domcontentloaded';
    const timeout = options.timeout || 15000;

    await page.goBack({ waitUntil, timeout });
    return {
      url: page.url(),
      title: await page.title(),
      ok: true
    };
  }

  /**
   * Navigate forward in tab history.
   * @param {string} tabId
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').NavigationResult>}
   */
  async goForward(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    const waitUntil = options.waitUntil || 'domcontentloaded';
    const timeout = options.timeout || 15000;

    await page.goForward({ waitUntil, timeout });
    return {
      url: page.url(),
      title: await page.title(),
      ok: true
    };
  }

  /**
   * Reload current page.
   * @param {string} tabId
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').NavigationResult>}
   */
  async reload(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    const waitUntil = options.waitUntil || 'domcontentloaded';
    const timeout = options.timeout || 15000;

    await page.reload({ waitUntil, timeout });
    return {
      url: page.url(),
      title: await page.title(),
      ok: true
    };
  }

  // ==========================================================================
  //  EVALUATION (JavaScript Escape Hatch)
  // ==========================================================================

  /**
   * Evaluate JavaScript in the tab's execution context.
   * @param {string} tabId
   * @param {string|Function} script
   * @param {object} [options]
   * @returns {Promise<*>}
   */
  async evaluate(tabId, script, options = {}) {
    const page = this._resolvePage(tabId);
    let target = page;

    if (options.frameId) {
      const frame = page.frames().find(
        f => f.name() === options.frameId || f.url().includes(options.frameId)
      );
      if (frame) target = frame;
    }

    return await target.evaluate(script);
  }

  // ==========================================================================
  //  SCREENSHOT
  // ==========================================================================

  /**
   * Capture a viewport or element screenshot.
   * @param {string} tabId
   * @param {object} [options]
   * @returns {Promise<string>} - Base64 data URI
   */
  async screenshot(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    const format = options.format === 'png' ? 'png' : 'jpeg';
    const quality = format === 'jpeg' ? (options.quality || 75) : undefined;
    const fullPage = options.fullPage || false;

    let buffer;
    if (options.ref) {
      // Element scoped screenshot will be wired to registry in Phase 3/4
      buffer = await page.screenshot({ type: format, quality, fullPage });
    } else {
      buffer = await page.screenshot({ type: format, quality, fullPage });
    }

    return `data:image/${format};base64,${buffer.toString('base64')}`;
  }

  // ==========================================================================
  //  OBSERVATION & ELEMENT RESOLUTION
  // ==========================================================================

  /**
   * Observe page state and discover interactive elements at progressive level.
   *
   * @param {string} tabId
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ObservationResult>}
   */
  async inspect(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._observationEngine.observe(page, { tabId, ...options });
  }

  /**
   * Resolves an element ref using the observation engine & server-side registry.
   *
   * @param {string} tabId
   * @param {string} ref
   * @param {object} [options]
   * @returns {Promise<{ ref: string, candidate: object, recovered: boolean, locator: any }>}
   */
  async resolveRef(tabId, ref, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._observationEngine.resolveRef(tabId, ref, { page, ...options });
  }

  /**
   * Returns the underlying ObservationEngine instance.
   * @returns {ObservationEngine}
   */
  getObservationEngine() {
    return this._observationEngine;
  }

  // ==========================================================================
  //  ACTIONS
  // ==========================================================================

  /**
   * Click an element identified by ref.
   * @param {string} tabId
   * @param {string} ref
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async click(tabId, ref, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.click(tabId, page, ref, options);
  }

  /**
   * Type text into an element.
   * @param {string} tabId
   * @param {string} ref
   * @param {string} text
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async type(tabId, ref, text, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.type(tabId, page, ref, text, options);
  }

  /**
   * Press a keyboard key.
   * @param {string} tabId
   * @param {string} key
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async press(tabId, key, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.press(tabId, page, key, options);
  }

  /**
   * Scroll page or element.
   * @param {string} tabId
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async scroll(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.scroll(tabId, page, options);
  }

  /**
   * Hover over an element.
   * @param {string} tabId
   * @param {string} ref
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async hover(tabId, ref, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.hover(tabId, page, ref, options);
  }

  /**
   * Select a dropdown option.
   * @param {string} tabId
   * @param {string} ref
   * @param {string} value
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async select(tabId, ref, value, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.select(tabId, page, ref, value, options);
  }

  /**
   * Upload file(s) into a file input.
   * @param {string} tabId
   * @param {string} ref
   * @param {string[]} filePaths
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async upload(tabId, ref, filePaths, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.upload(tabId, page, ref, filePaths, options);
  }

  /**
   * Wait for a browser condition.
   * @param {string} tabId
   * @param {object} condition
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async waitFor(tabId, condition, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.waitFor(tabId, page, condition, {
      ...options,
      tabId,
      dialogManager: this._dialogManager,
      downloadManager: this._downloadManager
    });
  }

  /**
   * Execute an array of sequential actions in batch.
   * @param {string} tabId
   * @param {Array<object>} actions
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async batch(tabId, actions, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._batchExecutor.executeBatch(tabId, page, actions, options);
  }

  // ==========================================================================
  //  EXTRACTION
  // ==========================================================================

  /**
   * Extract targeted structured information from a page.
   *
   * @param {string} tabId
   * @param {string} type - 'text' | 'table' | 'tables' | 'links' | 'form' | 'forms' | 'structured' | 'metadata'
   * @param {object} [options]
   * @returns {Promise<import('../extraction/index.js').ExtractionResponse>}
   */
  async extract(tabId, type, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._dataExtractor.extract(page, type, options);
  }

  // ==========================================================================
  //  DIALOG HANDLING
  // ==========================================================================

  /**
   * Handle an active or pending dialog on a tab.
   *
   * @param {string} tabId
   * @param {object} [options]
   * @param {'accept' | 'dismiss'} [options.action='accept']
   * @param {string} [options.promptText]
   * @returns {Promise<object>}
   */
  async handleDialog(tabId, options = {}) {
    return await this._dialogManager.handleDialog(tabId, options);
  }

  /**
   * Configure the dialog policy for a tab.
   *
   * @param {string} tabId
   * @param {'auto_accept' | 'auto_dismiss' | 'manual'} mode
   * @param {object} [options]
   * @param {string} [options.defaultPromptResponse]
   * @returns {void}
   */
  setDialogMode(tabId, mode, options = {}) {
    this._dialogManager.setPolicy(tabId, { mode, ...options });
  }

  // ==========================================================================
  //  DOWNLOAD MANAGEMENT
  // ==========================================================================

  /**
   * Wait for a download to initiate and complete.
   *
   * @param {string} tabId
   * @param {object} [options]
   * @param {Function} [options.triggerFn]
   * @param {number} [options.timeout=30000]
   * @returns {Promise<object>}
   */
  async waitForDownload(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._downloadManager.waitForDownload(tabId, page, options.triggerFn, options);
  }

  /**
   * Get all tracked downloads for a tab.
   *
   * @param {string} tabId
   * @returns {Array<object>}
   */
  getDownloads(tabId) {
    return this._downloadManager.getDownloads(tabId);
  }

  // ==========================================================================
  //  POPUP & WINDOW MANAGEMENT
  // ==========================================================================

  /**
   * Wait for a popup tab opened by this tab.
   *
   * @param {string} tabId
   * @param {object} [options]
   * @param {Function} [options.triggerFn]
   * @param {number} [options.timeout=10000]
   * @returns {Promise<import('../core/base-adapter.js').TabInfo>}
   */
  async waitForPopup(tabId, options = {}) {
    const timeout = options.timeout || 10000;
    const page = this._resolvePage(tabId);
    let popupPage;

    if (options.triggerFn && typeof options.triggerFn === 'function') {
      [popupPage] = await Promise.all([
        page.waitForEvent('popup', { timeout }),
        options.triggerFn()
      ]);
    } else {
      popupPage = await page.waitForEvent('popup', { timeout });
    }

    const popupId = this._registerPage(popupPage, { isPopup: true, openerTabId: tabId });
    return await this.getTab(popupId);
  }
}

