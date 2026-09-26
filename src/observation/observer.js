/**
 * Universal Browser Control Runtime — Progressive Observation Engine
 *
 * Implements 5 progressive observation levels designed to strictly minimize token footprint:
 *   Level 0: Minimal state (URL, title, readyState, viewport, scroll) — ~10 tokens
 *   Level 1: Compact interactive state (visible, actionable elements) — ~150-300 tokens
 *   Level 2: Targeted inspection (semantic query / scoped matching) — ~30-100 tokens
 *   Level 3: Full inspection (all elements including non-interactive & off-screen) — ~500-1500 tokens
 *   Level 4: Screenshot capture (visual verification / canvas content) — highest token cost
 *
 * Full support for:
 *   - Same-origin and cross-origin iframes
 *   - Open Shadow DOM roots & nested Shadow DOM traversal
 *   - Ephemeral server-side references (e1, e2, ...)
 *   - Ephemeral observation IDs (obs_*)
 *   - Automatic registry recording for stale-ref recovery
 */

import { ElementRegistry } from './registry.js';

export const ProgressiveLevel = {
  MINIMAL: 0,
  COMPACT: 1,
  TARGETED: 2,
  FULL: 3,
  SCREENSHOT: 4
};

export class ObservationEngine {
  /**
   * @param {object} [options]
   * @param {ElementRegistry} [options.registry]
   */
  constructor(options = {}) {
    this.registry = options.registry || new ElementRegistry();
  }

  /**
   * Formats structured elements into a compact 1-line token-dense string.
   *
   * @param {Array<object>} elements
   * @returns {string}
   */
  formatCompact(elements) {
    if (!elements || elements.length === 0) {
      return '(No interactive elements found)';
    }

    return elements.map(e => {
      let line = `[${e.ref}] ${e.role || e.tag || 'element'}`;
      if (e.name) line += ` "${e.name}"`;
      if (e.value) line += ` value="${e.value}"`;
      if (e.checked) line += ` [checked]`;
      if (e.disabled) line += ` [disabled]`;
      if (e.domMeta?.id) line += ` #${e.domMeta.id}`;
      if (e.isShadow) line += ` (shadow)`;
      if (e.frameIndex !== null && e.frameIndex !== undefined && e.frameIndex > 0) {
        line += ` (iframe ${e.frameIndex})`;
      }
      if (e.inViewport === false) line += ` [off-screen]`;
      return line;
    }).join('\n');
  }

  /**
   * Performs progressive observation of a Playwright page.
   *
   * @param {import('playwright-core').Page} page
   * @param {object} [options]
   * @param {number} [options.level=1]             - 0 | 1 | 2 | 3 | 4
   * @param {string} [options.tabId='default']     - Tab identifier for registry storage
   * @param {string} [options.scope]               - CSS selector to scope inspection
   * @param {string} [options.query]               - Semantic search query (level 2)
   * @param {string} [options.filter='interactive']- 'interactive' | 'inputs' | 'buttons_links' | 'all'
   * @param {number} [options.maxElements=60]      - Maximum number of elements
   * @returns {Promise<import('../core/base-adapter.js').ObservationResult>}
   */
  async observe(page, options = {}) {
    const level = options.level !== undefined ? Number(options.level) : ProgressiveLevel.COMPACT;
    const tabId = options.tabId || 'default';
    const obsId = `obs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const url = page.url();
    const title = await page.title().catch(() => 'Untitled');

    // Extract minimal page state
    const pageState = await page.evaluate(() => {
      return {
        readyState: document.readyState,
        scroll: {
          x: window.scrollX,
          y: window.scrollY,
          documentHeight: document.documentElement.scrollHeight
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    }).catch(() => ({
      readyState: 'complete',
      scroll: { x: 0, y: 0, documentHeight: 800 },
      viewport: { width: 1280, height: 800 }
    }));

    const result = {
      obsId,
      level,
      page: {
        url,
        title,
        loading: pageState.readyState !== 'complete',
        viewport: pageState.viewport,
        scroll: pageState.scroll
      },
      compact: '',
      elements: [],
      elementCount: 0,
      screenshot: null
    };

    // LEVEL 0: Minimal state — zero element scanning
    if (level === ProgressiveLevel.MINIMAL) {
      this.registry.registerObservation(tabId, {
        obsId,
        level,
        pageState: result.page,
        elements: []
      });
      return result;
    }

    // LEVEL 1, 2, 3, 4: Element discovery with progressive scoping
    const elements = await this._discoverElements(page, {
      level,
      scope: options.scope,
      query: options.query,
      filter: options.filter || 'interactive',
      maxElements: level === ProgressiveLevel.FULL ? (options.maxElements || 200) : (options.maxElements || 60)
    });

    result.elements = elements;
    result.elementCount = elements.length;
    result.compact = this.formatCompact(elements);

    // Token Budget Enforcement & Dynamic Compaction
    const maxTokens = options.maxTokens !== undefined ? Number(options.maxTokens) : null;
    if (maxTokens && maxTokens > 0) {
      const estTokens = Math.ceil(result.compact.length / 4);
      if (estTokens > maxTokens && result.elements.length > 0) {
        const kept = [...result.elements];
        while (kept.length > 0 && Math.ceil(this.formatCompact(kept).length / 4) > maxTokens) {
          kept.pop();
        }
        const truncatedCount = result.elements.length - kept.length;
        result.elements = kept;
        result.elementCount = kept.length;
        result.compact = (kept.length > 0 ? this.formatCompact(kept) + '\n' : '') +
          `[... truncated ${truncatedCount} elements to meet token budget of ${maxTokens} tokens]`;
        result.truncated = true;
        result.tokenBudget = {
          maxTokens,
          originalElements: elements.length,
          retainedElements: kept.length,
          estimatedTokens: Math.ceil(result.compact.length / 4)
        };
      }
    }

    // LEVEL 4: Screenshot capture
    if (level === ProgressiveLevel.SCREENSHOT || options.includeScreenshot) {
      const format = options.screenshotFormat === 'png' ? 'png' : 'jpeg';
      const quality = format === 'jpeg' ? (options.screenshotQuality || 70) : undefined;
      const buffer = await page.screenshot({ type: format, quality, fullPage: options.fullPage || false });
      result.screenshot = `data:image/${format};base64,${buffer.toString('base64')}`;
    }

    // Register with Server-Side Element Registry
    this.registry.registerObservation(tabId, {
      obsId,
      level,
      pageState: result.page,
      elements
    });

    return result;
  }

  /**
   * Resolves a ref on a tab using the registry.
   */
  async resolveRef(tabId, ref, { page, autoRecover = true } = {}) {
    return await this.registry.resolveRef(tabId, ref, { page, autoRecover });
  }

  // ==========================================================================
  //  INTERNAL ELEMENT DISCOVERY
  // ==========================================================================

  async _discoverElements(page, { level, scope, query, filter, maxElements }) {
    const frames = page.frames();
    const discovered = [];
    let refCounter = 1;

    for (let fIdx = 0; fIdx < frames.length; fIdx++) {
      if (discovered.length >= maxElements) break;
      const frame = frames[fIdx];

      // Handle iframe scoping: if parent scope is specified, check if this iframe is inside scope
      let effectiveScope = scope;
      if (fIdx > 0 && scope) {
        try {
          const frameEl = await frame.frameElement();
          if (frameEl) {
            const isInside = await frameEl.evaluate((el, selector) => {
              const container = document.querySelector(selector);
              return !!(container && container.contains(el));
            }, scope).catch(() => false);

            if (isInside) {
              effectiveScope = null; // Entire iframe document is inside scope
            } else {
              continue; // Iframe is outside requested scope
            }
          }
        } catch {
          // Fallback if cross-origin boundary prevents frameElement access
        }
      }

      try {
        const frameItems = await frame.evaluate(
          ({ scopeSelector, filterMode, fullMode }) => {
            let root = document;
            if (scopeSelector) {
              try {
                root = document.querySelector(scopeSelector);
                if (!root) return [];
              } catch {
                return [];
              }
            }

            let selector = 'button, a[href], input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="combobox"], [role="menuitem"], [role="tab"], [tabindex="0"]';
            if (filterMode === 'inputs') {
              selector = 'input, textarea, select, [role="textbox"], [role="combobox"], [role="checkbox"], [role="radio"]';
            } else if (filterMode === 'buttons_links') {
              selector = 'button, a[href], [role="button"], [role="link"], [role="tab"]';
            } else if (filterMode === 'all' || fullMode) {
              selector = 'button, a[href], input, textarea, select, [role], [tabindex], h1, h2, h3, table, form';
            }

            function queryDeep(container, isShadowParent = false) {
              let matches = Array.from(container.querySelectorAll(selector)).map(el => ({
                el,
                isShadow: isShadowParent
              }));

              try {
                const allNodes = container.querySelectorAll('*');
                for (const node of allNodes) {
                  if (node.shadowRoot) {
                    matches = matches.concat(queryDeep(node.shadowRoot, true));
                  }
                }
              } catch {}

              return matches;
            }

            const items = [];
            const deepMatches = queryDeep(root);
            const vWidth = window.innerWidth || 1280;
            const vHeight = window.innerHeight || 800;

            for (const { el, isShadow } of deepMatches) {
              const rect = el.getBoundingClientRect();
              const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';

              // In non-full mode, only visible elements are considered
              if (!fullMode && !isVisible) continue;

              const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.value || '').trim();
              const inViewport = (rect.top >= 0 && rect.top <= vHeight && rect.left >= 0 && rect.left <= vWidth);

              let role = el.getAttribute('role') || el.tagName.toLowerCase();
              const tag = el.tagName.toLowerCase();
              if (tag === 'textarea') {
                role = 'textbox';
              } else if (tag === 'select') {
                role = 'combobox';
              } else if (tag === 'a') {
                role = 'link';
              } else if (tag === 'input') {
                const type = (el.getAttribute('type') || 'text').toLowerCase();
                if (type === 'checkbox') role = 'checkbox';
                else if (type === 'radio') role = 'radio';
                else if (type === 'submit' || type === 'button') role = 'button';
                else role = 'textbox';
              }

              items.push({
                tag: el.tagName.toLowerCase(),
                role,
                name: text.slice(0, 120),
                value: (el.value || '').slice(0, 100),
                type: el.getAttribute('type') || undefined,
                placeholder: el.getAttribute('placeholder') || undefined,
                id: el.id || undefined,
                nameAttr: el.name || undefined,
                checked: el.checked || undefined,
                disabled: el.disabled || undefined,
                inViewport,
                isShadow,
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              });
            }

            // Viewport-Priority Sorting
            items.sort((a, b) => {
              if (a.inViewport && !b.inViewport) return -1;
              if (!a.inViewport && b.inViewport) return 1;
              return a.top - b.top;
            });

            return items;
          },
          {
            scopeSelector: effectiveScope,
            filterMode: filter,
            fullMode: level === ProgressiveLevel.FULL
          }
        );

        for (const raw of frameItems) {
          if (discovered.length >= maxElements) break;

          // LEVEL 2 Targeted Inspection filter
          if (level === ProgressiveLevel.TARGETED && query) {
            const q = query.toLowerCase().trim();
            const matchesQuery =
              (raw.name && raw.name.toLowerCase().includes(q)) ||
              (raw.role && raw.role.toLowerCase().includes(q)) ||
              (raw.id && raw.id.toLowerCase().includes(q)) ||
              (raw.nameAttr && raw.nameAttr.toLowerCase().includes(q)) ||
              (raw.placeholder && raw.placeholder.toLowerCase().includes(q));

            if (!matchesQuery) continue;
          }

          const ref = `e${refCounter++}`;
          discovered.push({
            ref,
            role: raw.role,
            name: raw.name || undefined,
            value: raw.value || undefined,
            checked: raw.checked,
            disabled: raw.disabled,
            isShadow: raw.isShadow,
            frameIndex: fIdx,
            inViewport: raw.inViewport,
            domMeta: {
              tag: raw.tag,
              id: raw.id,
              nameAttr: raw.nameAttr,
              placeholder: raw.placeholder,
              type: raw.type,
              boundingBox: {
                top: raw.top,
                left: raw.left,
                width: raw.width,
                height: raw.height
              }
            }
          });
        }
      } catch {
        // Skip inaccessible frame
      }
    }

    return discovered;
  }
}
