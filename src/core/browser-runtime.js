/**
 * Universal Browser Control Runtime — Core Orchestration Layer
 *
 * BrowserRuntime is the single entry point for all browser-control operations.
 *
 * It holds a reference to the active BaseBrowserAdapter and delegates every
 * operation to it. This means the AI agent, the MCP tools, and the CLI all
 * talk exclusively to BrowserRuntime — never to an adapter directly.
 *
 * Usage (attach mode):
 *   import { BrowserRuntime } from './src/core/browser-runtime.js';
 *   import { ChromiumAdapter } from './src/adapters/chromium.js';
 *
 *   const runtime = new BrowserRuntime();
 *   runtime.setAdapter(new ChromiumAdapter());
 *   await runtime.connect({ mode: 'attach', port: 9222 });
 *
 *   const tabs = await runtime.listTabs();
 *   const obs   = await runtime.inspect(tabs[0].id);
 *   await runtime.click(tabs[0].id, 'e3');
 *
 * Architecture notes:
 *   - BrowserRuntime has zero protocol knowledge.
 *   - Adapter swapping (e.g. switching from CDP to BiDi) requires only
 *     calling setAdapter() with the new adapter instance.
 *   - All errors originate from the adapter and propagate unchanged.
 */

import { NoAdapterError, ConnectionError } from './errors.js';

export class BrowserRuntime {
  constructor(adapter = null) {
    /** @type {import('./base-adapter.js').BaseBrowserAdapter | null} */
    this._adapter = null;

    /** @type {object} - Last connection configuration used */
    this._config = {};

    if (adapter) {
      this.setAdapter(adapter);
    }
  }

  // ==========================================================================
  //  ADAPTER MANAGEMENT
  // ==========================================================================

  /**
   * Set the active browser adapter.
   * This does NOT connect — call connect() afterwards.
   *
   * @param {import('./base-adapter.js').BaseBrowserAdapter} adapter
   */
  setAdapter(adapter) {
    if (!adapter || typeof adapter.connect !== 'function') {
      throw new TypeError('setAdapter() requires a valid BaseBrowserAdapter instance');
    }
    this._adapter = adapter;
  }

  /**
   * Get the active adapter, throwing NoAdapterError if none is set.
   * @returns {import('./base-adapter.js').BaseBrowserAdapter}
   */
  getAdapter() {
    if (!this._adapter) {
      throw new NoAdapterError();
    }
    return this._adapter;
  }

  /**
   * Returns whether an adapter has been configured (regardless of connection state).
   * @returns {boolean}
   */
  hasAdapter() {
    return this._adapter !== null;
  }

  // ==========================================================================
  //  CONNECTION
  // ==========================================================================

  /**
   * Connect to the browser using the configured adapter.
   *
   * @param {object} config - Adapter-specific connection config
   * @returns {Promise<void>}
   */
  async connect(config = {}) {
    this._config = config;
    await this.getAdapter().connect(config);
  }

  /**
   * Disconnect from the browser and release all adapter resources.
   * Safe to call even when already disconnected.
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this._adapter && this._adapter.isConnected()) {
      await this._adapter.disconnect();
    }
  }

  /**
   * Whether the runtime currently has an active browser connection.
   * @returns {boolean}
   */
  isConnected() {
    return this._adapter ? this._adapter.isConnected() : false;
  }

  /**
   * Returns the capabilities of the active adapter.
   * Returns an empty object if no adapter is configured.
   * @returns {object}
   */
  getCapabilities() {
    return this._adapter ? this._adapter.getCapabilities() : {};
  }

  /**
   * Returns the name of the active adapter, or null.
   * @returns {string|null}
   */
  getAdapterName() {
    return this._adapter ? this._adapter.getName() : null;
  }

  /**
   * Check whether the active adapter supports a specific capability.
   * @param {string} capability
   * @returns {boolean}
   */
  supports(capability) {
    return this._adapter ? this._adapter.supports(capability) : false;
  }

  // ==========================================================================
  //  TAB MANAGEMENT  (delegated)
  // ==========================================================================

  async listTabs()                       { return this.getAdapter().listTabs(); }
  async getTab(id)                       { return this.getAdapter().getTab(id); }
  async createTab(url)                   { return this.getAdapter().createTab(url); }
  async closeTab(id)                     { return this.getAdapter().closeTab(id); }
  async activateTab(id, options)         { return this.getAdapter().activateTab(id, options); }

  // ==========================================================================
  //  NAVIGATION  (delegated)
  // ==========================================================================

  async navigate(tabId, url, options)    { return this.getAdapter().navigate(tabId, url, options); }
  async goBack(tabId, options)           { return this.getAdapter().goBack(tabId, options); }
  async goForward(tabId, options)        { return this.getAdapter().goForward(tabId, options); }
  async reload(tabId, options)           { return this.getAdapter().reload(tabId, options); }

  // ==========================================================================
  //  OBSERVATION  (delegated)
  // ==========================================================================

  async inspect(tabId, options)          { return this.getAdapter().inspect(tabId, options); }
  async resolveRef(tabId, ref, options)   { return this.getAdapter().resolveRef(tabId, ref, options); }

  // ==========================================================================
  //  ACTIONS  (delegated)
  // ==========================================================================

  async click(tabId, ref, options)               { return this.getAdapter().click(tabId, ref, options); }
  async type(tabId, ref, text, options)          { return this.getAdapter().type(tabId, ref, text, options); }
  async press(tabId, key, options)               { return this.getAdapter().press(tabId, key, options); }
  async scroll(tabId, options)                   { return this.getAdapter().scroll(tabId, options); }
  async hover(tabId, ref, options)               { return this.getAdapter().hover(tabId, ref, options); }
  async select(tabId, ref, value, options)       { return this.getAdapter().select(tabId, ref, value, options); }
  async upload(tabId, ref, filePaths, options)   { return this.getAdapter().upload(tabId, ref, filePaths, options); }
  async batch(tabId, actions, options)           { return this.getAdapter().batch(tabId, actions, options); }

  // ==========================================================================
  //  WAITING  (delegated)
  // ==========================================================================

  async waitFor(tabId, condition, options)       { return this.getAdapter().waitFor(tabId, condition, options); }

  // ==========================================================================
  //  EXTRACTION  (delegated)
  // ==========================================================================

  async extract(tabId, type, options)            { return this.getAdapter().extract(tabId, type, options); }

  // ==========================================================================
  //  DIALOGS & DOWNLOADS & POPUPS (delegated)
  // ==========================================================================

  async handleDialog(tabId, options)             { return this.getAdapter().handleDialog(tabId, options); }
  setDialogMode(tabId, mode, options)            { return this.getAdapter().setDialogMode(tabId, mode, options); }
  async waitForDownload(tabId, options)          { return this.getAdapter().waitForDownload(tabId, options); }
  getDownloads(tabId)                            { return this.getAdapter().getDownloads(tabId); }
  async waitForPopup(tabId, options)             { return this.getAdapter().waitForPopup(tabId, options); }

  // ==========================================================================
  //  SCREENSHOT  (delegated)
  // ==========================================================================

  async screenshot(tabId, options)               { return this.getAdapter().screenshot(tabId, options); }

  // ==========================================================================
  //  JAVASCRIPT EVALUATION  (delegated)
  // ==========================================================================

  async evaluate(tabId, script, options)         { return this.getAdapter().evaluate(tabId, script, options); }

  // ==========================================================================
  //  DIAGNOSTICS
  // ==========================================================================

  /**
   * Returns a compact status string for the `browser-agent status` CLI command.
   * @returns {string}
   */
  toString() {
    if (!this._adapter) {
      return '[BrowserRuntime] NO ADAPTER';
    }
    return `[BrowserRuntime] adapter=${this._adapter.getName()} connected=${this.isConnected()}`;
  }
}
