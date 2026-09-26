/**
 * Universal Browser Control Runtime — Adapters Package
 *
 * This directory holds all concrete browser adapter implementations.
 *
 * Adapters:
 *   base.js       → Re-export of BaseBrowserAdapter (starting point for new adapters)
 *   chromium.js   → Phase 2: CDP-based Chromium family adapter
 *   bidi.js       → Phase 6: WebDriver BiDi adapter (Firefox)
 *   extension.js  → Phase 7: Browser extension bridge adapter
 *
 * How to implement a new adapter:
 *
 *   1. Create adapters/my-adapter.js
 *   2. import { BaseBrowserAdapter } from '../core/base-adapter.js';
 *   3. export class MyAdapter extends BaseBrowserAdapter { ... }
 *   4. Override every method your adapter supports.
 *   5. Declare supported capabilities in the constructor:
 *        super('my-adapter', { attachMode: true, iframes: true, shadowDom: true });
 *   6. Set this.connected = true after a successful connect().
 *   7. Do NOT import browser-specific modules in any file outside adapters/.
 */

// Re-export the base interface for convenience.
export { BaseBrowserAdapter as BaseAdapter } from '../core/base-adapter.js';
export { ChromiumAdapter } from './chromium.js';
export { BiDiAdapter } from './bidi.js';
export { ExtensionAdapter } from './extension.js';


