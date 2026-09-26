/**
 * Universal Browser Control Runtime — WebDriver BiDi / Firefox Adapter
 *
 * Provides browser-neutral control for Firefox and other browsers supporting
 * the W3C WebDriver BiDi protocol (or Playwright's Firefox protocol layer).
 *
 * Distinct from ChromiumAdapter:
 *   - Does NOT use Chrome DevTools Protocol (CDP).
 *   - Uses standard WebDriver BiDi connection models.
 *   - Does not assume Chromium-specific command flags or page lifecycle timing.
 *   - Accurately detects host installation and declares capabilities truthfully.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { firefox } from 'playwright-core';
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

export class BiDiAdapter extends BaseBrowserAdapter {
  /**
   * @param {object} [customCapabilities] - Optional capability overrides
   */
  constructor(customCapabilities = {}) {
    super('bidi', {
      attachMode: true,
      managedMode: true,
      extensionMode: false,
      iframes: true,
      crossOriginIframes: false, // BiDi cross-origin framing varies by implementation
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
  //  FIREFOX BROWSER DETECTION
  // ==========================================================================

  /**
   * Detects installed Mozilla Firefox executable on host system.
   *
   * @returns {{ name: string, path: string | null, installed: boolean, status: string }}
   */
  static detectFirefox() {
    const platform = os.platform();
    const candidatePaths = [];

    if (platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || '';
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

      candidatePaths.push(
        path.join(programFiles, 'Mozilla Firefox', 'firefox.exe'),
        path.join(programFilesX86, 'Mozilla Firefox', 'firefox.exe'),
        path.join(localAppData, 'Mozilla Firefox', 'firefox.exe')
      );
    } else if (platform === 'darwin') {
      const home = os.homedir();
      candidatePaths.push(
        '/Applications/Firefox.app/Contents/MacOS/firefox',
        path.join(home, 'Applications/Firefox.app/Contents/MacOS/firefox'),
        '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
        '/Applications/Firefox Nightly.app/Contents/MacOS/firefox'
      );
    } else {
      // Linux / Unix
      candidatePaths.push(
        '/usr/bin/firefox',
        '/usr/local/bin/firefox',
        '/snap/bin/firefox',
        '/var/lib/flatpak/exports/bin/org.mozilla.firefox'
      );
    }

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return {
          name: 'Mozilla Firefox',
          path: p,
          installed: true,
          status: 'INSTALLED'
        };
      }
    }

    return {
      name: 'Mozilla Firefox',
      path: null,
      installed: false,
      status: 'NOT_INSTALLED'
    };
  }

  // ==========================================================================
  //  CONNECTION
  // ==========================================================================

  /**
   * Connect to or launch a Firefox / BiDi browser instance.
   *
   * @param {object} [config]
   * @param {'attach' | 'managed'} [config.mode='managed']
   * @param {string} [config.executablePath]
   * @param {boolean} [config.headless=true]
   * @param {string} [config.wsEndpoint]
   * @returns {Promise<void>}
   */
  async connect(config = {}) {
    if (this.connected) {
      await this.disconnect();
    }

    const mode = config.mode || (config.wsEndpoint ? 'attach' : 'managed');
    this.connectionMode = mode;

    try {
      if (mode === 'managed') {
        let execPath = config.executablePath;
        if (!execPath) {
          const detected = BiDiAdapter.detectFirefox();
          if (!detected.installed) {
            throw new ConnectionError(
              'Mozilla Firefox is not installed on this system',
              {
                mode: 'managed',
                status: 'NOT_INSTALLED',
                reason: 'No Firefox executable found in standard system locations',
                suggestion: 'Install Mozilla Firefox or use ChromiumAdapter'
              }
            );
          }
          execPath = detected.path;
        }

        const headless = config.headless !== false;
        const timeout = config.timeout || 15000;
        const args = config.args || [];

        this.browser = await firefox.launch({
          executablePath: execPath,
          headless,
          args,
          timeout
        });
        this.context = await this.browser.newContext();

      } else if (mode === 'attach') {
        const endpoint = config.wsEndpoint || (config.port ? `ws://127.0.0.1:${config.port}/session` : null);
        if (!endpoint) {
          throw new ConnectionError('Attach mode requires wsEndpoint or port', {
            mode: 'attach',
            suggestion: 'Provide wsEndpoint (e.g. ws://127.0.0.1:9222/session)'
          });
        }

        const timeout = config.timeout || 8000;
        // Connect over BiDi / WebSocket protocol
        this.browser = await firefox.connect(endpoint, { timeout });
        const contexts = this.browser.contexts();
        this.context = contexts[0] || (await this.browser.newContext());
      } else {
        throw new ConnectionError(`Unsupported connection mode '${mode}' for BiDi adapter`, { mode });
      }

      this.connected = true;
      await this._syncTabs();
    } catch (err) {
      this.connected = false;
      this.browser = null;
      this.context = null;
      this.connectionMode = null;

      if (err instanceof ConnectionError) throw err;

      throw new ConnectionError(`Failed to connect to Firefox via BiDi: ${err.message}`, {
        mode,
        reason: err.message,
        suggestion: 'Ensure Firefox is installed or remote debugging server is running'
      });
    }
  }

  /**
   * Disconnect from browser.
   * @returns {Promise<void>}
   */
  async disconnect() {
    this._tabs.clear();
    this._tabMeta.clear();

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Handled
      }
      this.browser = null;
    }

    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // Handled
      }
      this.context = null;
    }

    this.connected = false;
    this.connectionMode = null;
  }

  // ==========================================================================
  //  TAB MANAGEMENT
  // ==========================================================================

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

      this._dialogManager.attach(page, id);
      this._downloadManager.attach(page, id);

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

  async _syncTabs() {
    const contexts = this.browser ? this.browser.contexts() : (this.context ? [this.context] : []);
    for (const ctx of contexts) {
      ctx.on('page', async (p) => {
        let openerId = null;
        try {
          const openerPage = await p.opener();
          if (openerPage) openerId = this._pageToTabId.get(openerPage) || null;
        } catch {}
        this._registerPage(p, { isPopup: Boolean(openerId), openerTabId: openerId });
      });

      for (const p of ctx.pages()) {
        if (!p.isClosed()) {
          this._registerPage(p);
        }
      }
    }

    if (this._tabs.size === 0 && this.context) {
      const p = await this.context.newPage();
      this._registerPage(p);
    }
  }

  _resolvePage(tabId) {
    if (!this.connected) {
      throw new ConnectionError('Cannot perform operation; browser is not connected');
    }

    if (typeof tabId === 'string' && this._tabs.has(tabId)) {
      const p = this._tabs.get(tabId);
      if (p && !p.isClosed()) return p;
      this._tabs.delete(tabId);
    }

    const asNum = Number(tabId);
    if (!isNaN(asNum) && Number.isInteger(asNum)) {
      const activePages = Array.from(this._tabs.values()).filter(p => !p.isClosed());
      if (asNum >= 0 && asNum < activePages.length) {
        return activePages[asNum];
      }
    }

    throw new TabNotFoundError(String(tabId));
  }

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
      } catch {}

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

  async getTab(tabId) {
    const page = this._resolvePage(tabId);
    const id = this._pageToTabId.get(page) || tabId;
    const tabs = await this.listTabs();
    const found = tabs.find(t => t.id === id);
    if (!found) throw new TabNotFoundError(String(tabId));
    return found;
  }

  async createTab(url = 'about:blank') {
    if (!this.connected) throw new ConnectionError('Cannot create tab; browser is not connected');
    const ctx = this.context || (this.browser ? this.browser.contexts()[0] : null);
    if (!ctx) throw new ConnectionError('No browser context available to create tab');

    const page = await ctx.newPage();
    const id = this._registerPage(page);
    if (url && url !== 'about:blank') {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }
    return await this.getTab(id);
  }

  async closeTab(tabId) {
    const page = this._resolvePage(tabId);
    const id = this._pageToTabId.get(page) || tabId;
    await page.close();
    this._tabs.delete(id);
    this._tabMeta.delete(id);
  }

  async activateTab(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    await page.bringToFront();
    return await this.getTab(tabId);
  }

  // ==========================================================================
  //  NAVIGATION
  // ==========================================================================

  async navigate(tabId, url, options = {}) {
    const page = this._resolvePage(tabId);
    const waitUntil = options.waitUntil || 'domcontentloaded';
    const timeout = options.timeout || 30000;

    try {
      const response = await page.goto(url, { waitUntil, timeout });
      return {
        url: page.url(),
        title: await page.title(),
        httpStatus: response ? response.status() : 200,
        ok: response ? response.ok() : true
      };
    } catch (err) {
      throw new NavigationError(url, tabId, { reason: err.message });
    }
  }

  async goBack(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    await page.goBack({ waitUntil: options.waitUntil || 'domcontentloaded', timeout: options.timeout || 15000 });
    return { url: page.url(), title: await page.title(), ok: true };
  }

  async goForward(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    await page.goForward({ waitUntil: options.waitUntil || 'domcontentloaded', timeout: options.timeout || 15000 });
    return { url: page.url(), title: await page.title(), ok: true };
  }

  async reload(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    await page.reload({ waitUntil: options.waitUntil || 'domcontentloaded', timeout: options.timeout || 15000 });
    return { url: page.url(), title: await page.title(), ok: true };
  }

  // ==========================================================================
  //  OBSERVATION
  // ==========================================================================

  async inspect(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._observationEngine.observe(page, options);
  }

  async resolveRef(tabId, ref, options = {}) {
    const page = this._resolvePage(tabId);
    const registry = this._observationEngine.getRegistry();
    return await registry.resolve(page, ref, options);
  }

  // ==========================================================================
  //  ACTIONS
  // ==========================================================================

  async click(tabId, ref, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.click(tabId, page, ref, options);
  }

  async type(tabId, ref, text, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.type(tabId, page, ref, text, options);
  }

  async press(tabId, key, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.press(tabId, page, key, options);
  }

  async scroll(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.scroll(tabId, page, options);
  }

  async hover(tabId, ref, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.hover(tabId, page, ref, options);
  }

  async select(tabId, ref, value, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.select(tabId, page, ref, value, options);
  }

  async upload(tabId, ref, filePaths, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.upload(tabId, page, ref, filePaths, options);
  }

  async waitFor(tabId, condition, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._actionExecutor.waitFor(tabId, page, condition, {
      ...options,
      tabId,
      dialogManager: this._dialogManager,
      downloadManager: this._downloadManager
    });
  }

  async batch(tabId, actions, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._batchExecutor.executeBatch(tabId, page, actions, options);
  }

  // ==========================================================================
  //  EXTRACTION
  // ==========================================================================

  async extract(tabId, type, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._dataExtractor.extract(page, type, options);
  }

  // ==========================================================================
  //  DIALOGS
  // ==========================================================================

  async handleDialog(tabId, options = {}) {
    return await this._dialogManager.handleDialog(tabId, options);
  }

  setDialogMode(tabId, mode, options = {}) {
    this._dialogManager.setPolicy(tabId, { mode, ...options });
  }

  // ==========================================================================
  //  DOWNLOADS
  // ==========================================================================

  async waitForDownload(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    return await this._downloadManager.waitForDownload(tabId, page, options.triggerFn, options);
  }

  getDownloads(tabId) {
    return this._downloadManager.getDownloads(tabId);
  }

  // ==========================================================================
  //  POPUPS
  // ==========================================================================

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

  // ==========================================================================
  //  SCREENSHOT
  // ==========================================================================

  async screenshot(tabId, options = {}) {
    const page = this._resolvePage(tabId);
    const format = options.format === 'png' ? 'png' : 'jpeg';
    const quality = format === 'jpeg' ? (options.quality || 75) : undefined;
    const fullPage = options.fullPage === true;

    let buffer;
    if (options.ref) {
      const locator = await this.resolveRef(tabId, options.ref);
      buffer = await locator.screenshot({ type: format, quality });
    } else {
      buffer = await page.screenshot({ type: format, quality, fullPage });
    }

    return `data:image/${format};base64,${buffer.toString('base64')}`;
  }

  // ==========================================================================
  //  JAVASCRIPT EVALUATION
  // ==========================================================================

  async evaluate(tabId, script, options = {}) {
    const page = this._resolvePage(tabId);
    let target = page;

    if (options.frameId) {
      const frames = page.frames();
      const targetFrame = frames.find(f => f.name() === options.frameId || f.url().includes(options.frameId));
      if (!targetFrame) {
        throw new Error(`Frame "${options.frameId}" not found in tab "${tabId}"`);
      }
      target = targetFrame;
    }

    return await target.evaluate(script);
  }
}
