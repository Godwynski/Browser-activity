/**
 * Universal Browser Control Runtime — Base Browser Adapter Interface
 *
 * ALL browser adapters MUST extend this class.
 *
 * An adapter is the translation layer between the browser-agnostic runtime
 * and a specific browser protocol:
 *
 *   ChromiumAdapter  →  Chrome DevTools Protocol (CDP) via Playwright
 *   BiDiAdapter      →  WebDriver BiDi (Firefox, future Safari)
 *   ExtensionAdapter →  Browser Extension + native messaging bridge
 *
 * The adapter receives browser-neutral operations (click, inspect, navigate)
 * and translates them into protocol-specific calls. The core runtime and MCP
 * layer must NEVER contain protocol-specific code.
 *
 * Capability Flags
 * ----------------
 * Each adapter declares which capabilities it supports via the `capabilities`
 * object. Unsupported operations throw UnsupportedOperationError — never silently
 * fail or return fabricated results.
 *
 * All unimplemented methods throw UnsupportedOperationError. Subclasses must
 * override every method they intend to support.
 */

import { EventEmitter } from 'node:events';
import { UnsupportedOperationError } from './errors.js';

export class BaseBrowserAdapter extends EventEmitter {
  /**
   * @param {string} name         - Adapter name (e.g. 'chromium', 'bidi', 'extension')
   * @param {object} capabilities - Feature flags (merged over defaults)
   */
  constructor(name, capabilities = {}) {
    super();
    if (!name || typeof name !== 'string') {
      throw new TypeError('Adapter name must be a non-empty string');
    }
    this.name = name;

    this.capabilities = {
      // ----- Connection modes -----
      attachMode:           false,  // Attach to existing browser process via debug port
      managedMode:          false,  // Launch & manage a browser process
      extensionMode:        false,  // Operate via browser extension bridge

      // ----- Frame traversal -----
      iframes:              false,  // Same-origin iframe traversal
      crossOriginIframes:   false,  // Cross-origin iframe traversal (protocol-dependent)
      shadowDom:            false,  // Open shadow DOM traversal
      closedShadowDom:      false,  // Closed shadow DOM (rarely supported)

      // ----- Window management -----
      popups:               false,  // Popup windows & target="_blank" adoption
      multipleContexts:     false,  // Multiple browser contexts / profiles

      // ----- File & download -----
      downloads:            false,  // Download interception & lifecycle tracking
      uploads:              false,  // File input population

      // ----- Dialog handling -----
      dialogs:              false,  // alert / confirm / prompt handling

      // ----- Browser-level -----
      geolocation:          false,  // Geolocation spoofing
      permissions:          false,  // Permission grant / deny
      networkInterception:  false,  // Request / response interception

      // Override with adapter-specific values
      ...capabilities
    };

    /** @type {boolean} */
    this.connected = false;
  }

  // ==========================================================================
  //  CONNECTION
  // ==========================================================================

  /**
   * Connect to or launch the browser.
   *
   * Config shape depends on the chosen mode:
   *
   *   Attach mode:
   *     { mode: 'attach', port: 9222 }
   *     { mode: 'attach', wsEndpoint: 'ws://127.0.0.1:9222/devtools/browser/...' }
   *
   *   Managed mode:
   *     { mode: 'managed', executablePath: '/path/to/chrome', headless: true }
   *     { mode: 'managed', executablePath: '/path/to/brave',  userDataDir: '/tmp/profile' }
   *
   *   Extension mode:
   *     { mode: 'extension', nativePort: 9333 }
   *
   * @param {object} config
   * @returns {Promise<void>}
   */
  async connect(config = {}) {
    throw new UnsupportedOperationError('connect', this.name);
  }

  /**
   * Disconnect from the browser and release all held resources.
   * Must be idempotent — safe to call even if already disconnected.
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new UnsupportedOperationError('disconnect', this.name);
  }

  /**
   * Whether the adapter currently has an active browser connection.
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }

  // ==========================================================================
  //  TAB MANAGEMENT
  // ==========================================================================

  /**
   * List all open tabs / pages.
   *
   * @returns {Promise<TabInfo[]>}
   *
   * @typedef {object} TabInfo
   * @property {string}  id     - Stable tab identifier (protocol-specific)
   * @property {string}  title  - Page title
   * @property {string}  url    - Current URL
   * @property {boolean} active - Whether this is the currently visible/focused tab
   * @property {number}  index  - 0-based position in the tab strip
   */
  async listTabs() {
    throw new UnsupportedOperationError('listTabs', this.name);
  }

  /**
   * Get metadata for a single tab.
   * @param {string} tabId
   * @returns {Promise<TabInfo>}
   */
  async getTab(tabId) {
    throw new UnsupportedOperationError('getTab', this.name);
  }

  /**
   * Open a new tab.
   * @param {string} [url='about:blank']
   * @returns {Promise<TabInfo>}
   */
  async createTab(url = 'about:blank') {
    throw new UnsupportedOperationError('createTab', this.name);
  }

  /**
   * Close a tab.
   * @param {string} tabId
   * @returns {Promise<void>}
   */
  async closeTab(tabId) {
    throw new UnsupportedOperationError('closeTab', this.name);
  }

  /**
   * Bring a tab into focus / make it the active tab.
   * @param {string} tabId
   * @param {object} [options]
   * @param {boolean} [options.bringToFront=false] - Also raise the browser window
   * @returns {Promise<TabInfo>}
   */
  async activateTab(tabId, options = {}) {
    throw new UnsupportedOperationError('activateTab', this.name);
  }

  // ==========================================================================
  //  NAVIGATION
  // ==========================================================================

  /**
   * Navigate a tab to a URL.
   *
   * @param {string} tabId
   * @param {string} url
   * @param {object} [options]
   * @param {string} [options.waitUntil='domcontentloaded']
   *   'load' | 'domcontentloaded' | 'networkidle' | 'commit'
   * @param {number} [options.timeout=15000]
   * @returns {Promise<NavigationResult>}
   *
   * @typedef {object} NavigationResult
   * @property {string}  url    - Final URL after navigation (may differ due to redirects)
   * @property {string}  title  - Page title after navigation
   * @property {boolean} ok     - Whether navigation completed without error
   */
  async navigate(tabId, url, options = {}) {
    throw new UnsupportedOperationError('navigate', this.name);
  }

  /**
   * Navigate back in the tab's history.
   * @param {string} tabId
   * @param {object} [options]
   * @returns {Promise<NavigationResult>}
   */
  async goBack(tabId, options = {}) {
    throw new UnsupportedOperationError('goBack', this.name);
  }

  /**
   * Navigate forward in the tab's history.
   * @param {string} tabId
   * @param {object} [options]
   * @returns {Promise<NavigationResult>}
   */
  async goForward(tabId, options = {}) {
    throw new UnsupportedOperationError('goForward', this.name);
  }

  /**
   * Reload the current page.
   * @param {string} tabId
   * @param {object} [options]
   * @param {boolean} [options.ignoreCache=false]
   * @returns {Promise<NavigationResult>}
   */
  async reload(tabId, options = {}) {
    throw new UnsupportedOperationError('reload', this.name);
  }

  // ==========================================================================
  //  OBSERVATION / INSPECTION
  // ==========================================================================

  /**
   * Observe the current page state and return structured element data.
   *
   * Progressive observation levels:
   *
   *   Level 0 — Minimal state: url, title, readyState, viewport, scroll.
   *             Zero elements returned. Cheapest possible context footprint.
   *
   *   Level 1 — Compact interactive state (default):
   *             Returns only visible, interactive elements in 1-line compact format.
   *             Example: [e1] button "Search"
   *
   *   Level 2 — Targeted inspection:
   *             Uses options.query to search for matching elements by text/role/label.
   *             Returns only relevant candidates.
   *
   *   Level 3 — Full inspection:
   *             Returns all elements including off-screen and non-interactive ones.
   *             High token cost; use only when necessary.
   *
   *   Level 4 — Screenshot:
   *             Captures a viewport screenshot in addition to inspection.
   *             Highest token cost; use only for visual verification or canvas content.
   *
   * @param {string} tabId
   * @param {object} [options]
   * @param {number} [options.level=1]            - 0 | 1 | 2 | 3 | 4
   * @param {string} [options.scope]              - CSS selector to scope the inspection
   * @param {string} [options.filter='interactive'] - 'interactive' | 'inputs' | 'buttons_links' | 'all'
   * @param {string} [options.query]              - Semantic search query (level 2)
   * @param {number} [options.maxElements=60]     - Maximum elements to include
   * @returns {Promise<ObservationResult>}
   *
   * @typedef {object} ObservationResult
   * @property {string}       obsId        - Unique observation ID (e.g. 'obs_1234567890')
   * @property {PageState}    page         - Current page state
   * @property {string}       compact      - Compact text representation of elements
   * @property {ElementInfo[]} elements    - Full structured element array
   * @property {number}       elementCount - Number of elements returned
   * @property {string|null}  screenshot   - Base64 data URI (level 4 only)
   *
   * @typedef {object} PageState
   * @property {string}  url
   * @property {string}  title
   * @property {boolean} loading
   * @property {object}  viewport  - { width, height }
   * @property {object}  scroll    - { x, y, documentHeight }
   *
   * @typedef {object} ElementInfo
   * @property {string}   ref        - Ephemeral reference token (e.g. 'e1')
   * @property {string}   role       - ARIA role (e.g. 'button', 'textbox', 'link')
   * @property {string}   [name]     - Accessible name / visible label
   * @property {string}   [value]    - Current element value
   * @property {boolean}  [checked]  - Checkbox / radio / switch state
   * @property {boolean}  [disabled] - Whether the element is disabled
   * @property {boolean}  [inViewport] - Whether element is in the visible viewport
   */
  async inspect(tabId, options = {}) {
    throw new UnsupportedOperationError('inspect', this.name);
  }

  /**
   * Resolve an ephemeral element ref to a concrete candidate or locator.
   * @param {string} tabId
   * @param {string} ref
   * @param {object} [options]
   * @returns {Promise<any>}
   */
  async resolveRef(tabId, ref, options = {}) {
    throw new UnsupportedOperationError('resolveRef', this.name);
  }

  // ==========================================================================
  //  ACTIONS
  // ==========================================================================

  /**
   * Click an element identified by a ref from a prior inspect() call.
   *
   * @param {string} tabId
   * @param {string} ref                        - Ephemeral element reference (e.g. 'e4')
   * @param {object} [options]
   * @param {string} [options.obsId]            - Observation ID; validates ref is not stale
   * @param {number} [options.timeout=6000]
   * @returns {Promise<ActionReceipt>}
   *
   * @typedef {object} ActionReceipt
   * @property {boolean}  ok        - Whether the action succeeded
   * @property {string}   action    - Action type (e.g. 'click')
   * @property {string}   [ref]     - Element ref acted upon
   * @property {string[]} changes   - Human-readable change observations
   * @property {object}   before    - { url, title } snapshot before action
   * @property {object}   after     - { url, title } snapshot after action
   * @property {string|null} screenshot - Post-action screenshot (if requested)
   */
  async click(tabId, ref, options = {}) {
    throw new UnsupportedOperationError('click', this.name);
  }

  /**
   * Type text into an element (fill or keyboard-type).
   *
   * @param {string} tabId
   * @param {string} ref
   * @param {string} text                         - Text to type
   * @param {object} [options]
   * @param {string} [options.obsId]
   * @param {boolean} [options.pressEnter=false]   - Press Enter after typing
   * @param {boolean} [options.append=false]        - Append to existing value
   * @returns {Promise<ActionReceipt>}
   */
  async type(tabId, ref, text, options = {}) {
    throw new UnsupportedOperationError('type', this.name);
  }

  /**
   * Press a keyboard key (global or on a focused element).
   *
   * Key names follow the Playwright / WebDriver BiDi key naming convention:
   * 'Enter', 'Tab', 'Escape', 'ArrowDown', 'Backspace', etc.
   *
   * @param {string} tabId
   * @param {string} key                          - Key name
   * @param {object} [options]
   * @param {string} [options.ref]                - Element to focus before pressing
   * @returns {Promise<ActionReceipt>}
   */
  async press(tabId, key, options = {}) {
    throw new UnsupportedOperationError('press', this.name);
  }

  /**
   * Scroll the page or a specific element.
   *
   * @param {string} tabId
   * @param {object} [options]
   * @param {string} [options.direction='down']   - 'up' | 'down' | 'left' | 'right' | 'top' | 'bottom'
   * @param {number} [options.amount=500]         - Scroll distance in pixels
   * @param {string} [options.ref]                - Element to scroll within (default: page)
   * @returns {Promise<ActionReceipt>}
   */
  async scroll(tabId, options = {}) {
    throw new UnsupportedOperationError('scroll', this.name);
  }

  /**
   * Move the mouse pointer over an element (trigger hover states).
   *
   * @param {string} tabId
   * @param {string} ref
   * @param {object} [options]
   * @param {string} [options.obsId]
   * @returns {Promise<ActionReceipt>}
   */
  async hover(tabId, ref, options = {}) {
    throw new UnsupportedOperationError('hover', this.name);
  }

  /**
   * Select an option in a native <select> or custom ARIA dropdown.
   *
   * @param {string} tabId
   * @param {string} ref
   * @param {string} value                        - Option value attribute or visible label
   * @param {object} [options]
   * @param {string} [options.obsId]
   * @returns {Promise<ActionReceipt>}
   */
  async select(tabId, ref, value, options = {}) {
    throw new UnsupportedOperationError('select', this.name);
  }

  /**
   * Set files on a file input element.
   *
   * @param {string}   tabId
   * @param {string}   ref
   * @param {string[]} filePaths                  - Absolute local file paths
   * @param {object}   [options]
   * @param {string}   [options.obsId]
   * @returns {Promise<ActionReceipt>}
   */
  async upload(tabId, ref, filePaths, options = {}) {
    throw new UnsupportedOperationError('upload', this.name);
  }

  /**
   * Execute an array of sequential actions in batch.
   *
   * @param {string} tabId
   * @param {Array<object>} actions
   * @param {object} [options]
   * @returns {Promise<any>}
   */
  async batch(tabId, actions, options = {}) {
    throw new UnsupportedOperationError('batch', this.name);
  }

  // ==========================================================================
  //  WAITING  (event-driven — never use arbitrary sleeps)
  // ==========================================================================

  /**
   * Wait for a browser condition to become true.
   *
   * Supported condition types:
   *   url_changed        - Page URL changes (or matches a pattern)
   *   text_appeared      - Specific text becomes visible in the DOM
   *   text_disappeared   - Text is removed from the DOM
   *   element_appeared   - An element matching a selector becomes present
   *   element_disappeared- An element is removed
   *   element_enabled    - A disabled element becomes enabled
   *   element_visible    - A hidden element becomes visible
   *   dom_stable         - DOM mutation rate drops to zero
   *   download_complete  - A download completes
   *   dialog_appeared    - An alert / confirm / prompt dialog appears
   *   navigation_complete- A page navigation fully completes
   *
   * @param {string} tabId
   * @param {WaitCondition} condition
   * @param {object}  [options]
   * @param {number}  [options.timeout=10000]
   * @returns {Promise<void>}
   *
   * @typedef {object} WaitCondition
   * @property {string}  type  - Condition type (see list above)
   * @property {string}  [value]  - Expected text, URL pattern, or CSS selector
   * @property {string}  [ref]    - Element ref for element-based conditions
   */
  async waitFor(tabId, condition, options = {}) {
    throw new UnsupportedOperationError('waitFor', this.name);
  }

  // ==========================================================================
  //  EXTRACTION
  // ==========================================================================

  /**
   * Extract structured information from the page without building a full
   * interactive observation. Designed for data retrieval tasks where the agent
   * needs content, not the ability to interact.
   *
   * Extraction types:
   *   text       - Main visible text content
   *   links      - All anchor elements (href, text, domain)
   *   table      - Table data as JSON rows (options.tableIndex selects which)
   *   form       - Form field names, types, values, labels
   *   structured - Best-effort structured page data (headings, sections)
   *
   * @param {string} tabId
   * @param {string} type          - 'text' | 'links' | 'table' | 'form' | 'structured'
   * @param {object} [options]
   * @param {string} [options.scope]        - CSS selector to narrow extraction
   * @param {number} [options.tableIndex=0] - Which table to extract (for type 'table')
   * @param {string} [options.tableSelector]- Explicit CSS selector for a table
   * @returns {Promise<ExtractionResult>}
   *
   * @typedef {object} ExtractionResult
   * @property {string}  type      - Extraction type
   * @property {*}       data      - Extracted content (format depends on type)
   * @property {number}  itemCount - Count of top-level items extracted
   */
  async extract(tabId, type, options = {}) {
    throw new UnsupportedOperationError('extract', this.name);
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
    throw new UnsupportedOperationError('handleDialog', this.name);
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
    throw new UnsupportedOperationError('setDialogMode', this.name);
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
    throw new UnsupportedOperationError('waitForDownload', this.name);
  }

  /**
   * Get all tracked downloads for a tab.
   *
   * @param {string} tabId
   * @returns {Array<object>}
   */
  getDownloads(tabId) {
    throw new UnsupportedOperationError('getDownloads', this.name);
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
   * @returns {Promise<import('./base-adapter.js').TabInfo>}
   */
  async waitForPopup(tabId, options = {}) {
    throw new UnsupportedOperationError('waitForPopup', this.name);
  }

  // ==========================================================================
  //  SCREENSHOT
  // ==========================================================================

  /**
   * Capture a screenshot of the viewport or a specific element.
   *
   * Screenshots are expensive tokens. Use only when:
   *   - DOM semantics are insufficient (canvas, video)
   *   - Visual layout verification is required
   *   - An action result cannot be confirmed via DOM state
   *
   * @param {string} tabId
   * @param {object} [options]
   * @param {string} [options.format='jpeg']  - 'jpeg' | 'png'
   * @param {number} [options.quality=75]     - JPEG quality (1–100)
   * @param {string} [options.ref]            - Element ref for element-scoped screenshot
   * @param {boolean} [options.fullPage=false] - Capture full scrollable height
   * @returns {Promise<string>} - Base64 data URI (e.g. 'data:image/jpeg;base64,...')
   */
  async screenshot(tabId, options = {}) {
    throw new UnsupportedOperationError('screenshot', this.name);
  }

  // ==========================================================================
  //  JAVASCRIPT EVALUATION  (escape hatch — prefer semantic actions)
  // ==========================================================================

  /**
   * Execute arbitrary JavaScript in the tab's page context.
   *
   * This is a powerful escape hatch for cases where semantic actions are
   * insufficient. It should NOT be the primary interaction mechanism.
   * Prefer inspect → act for standard workflows.
   *
   * @param {string} tabId
   * @param {string} script          - JavaScript expression or function body
   * @param {object} [options]
   * @param {string} [options.frameId] - Frame identifier for iframe evaluation
   * @returns {Promise<*>}           - Evaluated result (must be JSON-serialisable)
   */
  async evaluate(tabId, script, options = {}) {
    throw new UnsupportedOperationError('evaluate', this.name);
  }

  // ==========================================================================
  //  ADAPTER METADATA
  // ==========================================================================

  /**
   * Returns the adapter's name.
   * @returns {string}
   */
  getName() {
    return this.name;
  }

  /**
   * Returns a copy of the capabilities map.
   * @returns {object}
   */
  getCapabilities() {
    return { ...this.capabilities };
  }

  /**
   * Check whether this adapter supports a specific named capability.
   * @param {string} capability
   * @returns {boolean}
   */
  supports(capability) {
    return this.capabilities[capability] === true;
  }

  /**
   * Returns a compact human-readable summary for diagnostics.
   * @returns {string}
   */
  toString() {
    const supported = Object.entries(this.capabilities)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    return `[${this.name}] connected=${this.connected} caps=[${supported}]`;
  }
}
