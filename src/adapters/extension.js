/**
 * Universal Browser Control Runtime — Extension Bridge Adapter
 *
 * Implements BaseBrowserAdapter for browser control mediated entirely through
 * a companion browser extension (Mode C).
 *
 * Use Cases:
 *   - Browsers running without --remote-debugging-port
 *   - Environments with strict corporate security policies blocking CDP
 *   - User-interactive co-browsing where extension HUD is active
 *
 * Documented Limitations:
 *   - No control over browser chrome / OS dialogs
 *   - File uploads and native download events are blocked by browser extension sandbox
 *   - Content scripts cannot automate modal web page dialogs (alert/confirm/prompt)
 *     because they freeze the JavaScript execution thread in content scripts
 *   - Content scripts cannot reach cross-origin sandboxed iframes without elevated privileges
 */

import { BaseBrowserAdapter } from '../core/base-adapter.js';
import { ExtensionBridgeServer } from './extension-bridge-server.js';
import {
  ConnectionError,
  NavigationError,
  TabNotFoundError,
  UnsupportedOperationError,
  ActionFailedError
} from '../core/errors.js';

export class ExtensionAdapter extends BaseBrowserAdapter {
  /**
   * @param {object} [customCapabilities]
   * @param {object} [options]
   * @param {number} [options.port=8766]
   * @param {string} [options.host='127.0.0.1']
   */
  constructor(customCapabilities = {}, options = {}) {
    super('extension', {
      attachMode: false,
      managedMode: false,
      extensionMode: true,
      iframes: false,
      crossOriginIframes: false,
      shadowDom: true,
      closedShadowDom: false,
      popups: false,
      multipleContexts: false,
      downloads: false,
      uploads: false,
      dialogs: false,
      geolocation: false,
      permissions: false,
      networkInterception: false,
      ...customCapabilities
    });

    this.serverOptions = options;
    /** @type {ExtensionBridgeServer | null} */
    this.bridgeServer = null;
    this.port = options.port || 8766;
    this.host = options.host || '127.0.0.1';
  }

  // ==========================================================================
  //  CONNECTION
  // ==========================================================================

  /**
   * Start bridge server and wait for extension client connection.
   *
   * @param {object} [config]
   * @param {number} [config.port]
   * @param {string} [config.host]
   * @param {boolean} [config.waitForClient=false]
   * @param {number} [config.timeout=10000]
   * @returns {Promise<void>}
   */
  async connect(config = {}) {
    if (this.connected) {
      await this.disconnect();
    }

    this.port = config.port || this.serverOptions.port || 8766;
    this.host = config.host || this.serverOptions.host || '127.0.0.1';

    try {
      this.bridgeServer = new ExtensionBridgeServer({
        port: this.port,
        host: this.host
      });

      this.bridgeServer.on('tab:created', (data) => this.emit('tab:created', data));
      this.bridgeServer.on('tab:closed', (data) => this.emit('tab:closed', data));

      await this.bridgeServer.start();

      if (config.waitForClient) {
        const timeout = config.timeout || 10000;
        await this.bridgeServer.waitForClient(timeout);
      }

      this.connected = true;
    } catch (err) {
      this.connected = false;
      if (this.bridgeServer) {
        await this.bridgeServer.stop().catch(() => {});
        this.bridgeServer = null;
      }
      throw new ConnectionError(`Failed to initialize extension bridge: ${err.message}`, {
        port: this.port,
        host: this.host,
        reason: err.message,
        suggestion: 'Verify the Antigravity extension is active and pointing to the bridge port'
      });
    }
  }

  /**
   * Disconnect and shutdown the bridge server.
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.bridgeServer) {
      await this.bridgeServer.stop().catch(() => {});
      this.bridgeServer = null;
    }
    this.connected = false;
  }

  _ensureConnected() {
    if (!this.connected || !this.bridgeServer) {
      throw new ConnectionError('Extension bridge adapter is not connected', {
        suggestion: 'Call adapter.connect() before performing operations'
      });
    }
  }

  // ==========================================================================
  //  TAB MANAGEMENT
  // ==========================================================================

  async listTabs() {
    this._ensureConnected();
    const result = await this.bridgeServer.sendRequest('tabs.list');
    return result || [];
  }

  async getTab(tabId) {
    this._ensureConnected();
    const tabs = await this.listTabs();
    const found = tabs.find(t => String(t.id) === String(tabId) || t.index === Number(tabId));
    if (!found) throw new TabNotFoundError(String(tabId));
    return found;
  }

  async createTab(url = 'about:blank') {
    this._ensureConnected();
    const res = await this.bridgeServer.sendRequest('tabs.create', { url });
    return res;
  }

  async closeTab(tabId) {
    this._ensureConnected();
    await this.bridgeServer.sendRequest('tabs.close', { tabId: String(tabId) });
  }

  async activateTab(tabId, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('tabs.activate', { tabId: String(tabId) });
  }

  // ==========================================================================
  //  NAVIGATION
  // ==========================================================================

  async navigate(tabId, url, options = {}) {
    this._ensureConnected();
    try {
      return await this.bridgeServer.sendRequest('tabs.navigate', {
        tabId: String(tabId),
        url,
        ...options
      });
    } catch (err) {
      throw new NavigationError(url, String(tabId), { reason: err.message });
    }
  }

  async goBack(tabId, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('tabs.goBack', { tabId: String(tabId) });
  }

  async goForward(tabId, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('tabs.goForward', { tabId: String(tabId) });
  }

  async reload(tabId, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('tabs.reload', { tabId: String(tabId) });
  }

  // ==========================================================================
  //  OBSERVATION
  // ==========================================================================

  async inspect(tabId, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.observe', {
      tabId: String(tabId),
      options
    });
  }

  async resolveRef(tabId, ref, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.resolveRef', {
      tabId: String(tabId),
      ref
    });
  }

  // ==========================================================================
  //  ACTIONS
  // ==========================================================================

  async click(tabId, ref, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.click', { tabId: String(tabId), ref, options });
  }

  async type(tabId, ref, text, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.type', { tabId: String(tabId), ref, text, options });
  }

  async press(tabId, key, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.press', { tabId: String(tabId), key, options });
  }

  async scroll(tabId, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.scroll', { tabId: String(tabId), options });
  }

  async hover(tabId, ref, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.hover', { tabId: String(tabId), ref, options });
  }

  async select(tabId, ref, value, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.select', { tabId: String(tabId), ref, value, options });
  }

  async upload(tabId, ref, filePaths, options = {}) {
    throw new UnsupportedOperationError(
      'upload',
      this.name,
      {
        reason: 'Browser extension sandbox security model strictly prohibits programmatic manipulation of file input selection without native messaging host integration',
        suggestion: 'Use ChromiumAdapter or BiDiAdapter for file upload workflows'
      }
    );
  }

  async waitFor(tabId, condition, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.waitFor', { tabId: String(tabId), condition, options });
  }

  async batch(tabId, actions, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.batch', { tabId: String(tabId), actions, options });
  }

  // ==========================================================================
  //  EXTRACTION
  // ==========================================================================

  async extract(tabId, type, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('dom.extract', { tabId: String(tabId), type, options });
  }

  // ==========================================================================
  //  SCREENSHOT & EVALUATE
  // ==========================================================================

  async screenshot(tabId, options = {}) {
    this._ensureConnected();
    const result = await this.bridgeServer.sendRequest('tabs.screenshot', { tabId: String(tabId), options });
    return result.dataUri;
  }

  async evaluate(tabId, script, options = {}) {
    this._ensureConnected();
    return await this.bridgeServer.sendRequest('script.evaluate', { tabId: String(tabId), script, options });
  }

  // ==========================================================================
  //  DIALOGS & DOWNLOADS (Documented Limitations)
  // ==========================================================================

  async handleDialog(tabId, options = {}) {
    throw new UnsupportedOperationError(
      'handleDialog',
      this.name,
      {
        reason: 'JavaScript web page modal dialogs (alert/confirm/prompt) block content script execution and cannot be dismissed through an extension content bridge',
        suggestion: 'Use ChromiumAdapter for native dialog interception'
      }
    );
  }

  setDialogMode(tabId, mode, options = {}) {
    throw new UnsupportedOperationError(
      'setDialogMode',
      this.name,
      {
        reason: 'Dialog auto-handling policies require browser-level protocol interception (CDP or BiDi)',
        suggestion: 'Use ChromiumAdapter or BiDiAdapter for dialog automation'
      }
    );
  }

  async waitForDownload(tabId, options = {}) {
    throw new UnsupportedOperationError(
      'waitForDownload',
      this.name,
      {
        reason: 'Native download lifecycle monitoring requires browser-level CDP/BiDi protocol interception',
        suggestion: 'Use ChromiumAdapter for download automation'
      }
    );
  }

  getDownloads(tabId) {
    return [];
  }

  async waitForPopup(tabId, options = {}) {
    throw new UnsupportedOperationError(
      'waitForPopup',
      this.name,
      {
        reason: 'Arbitrary popup tracking across windows is limited under standard extension permissions',
        suggestion: 'Use ChromiumAdapter or BiDiAdapter for popup and multi-window automation'
      }
    );
  }
}
