/**
 * Universal Browser Control Runtime — Event-Driven Wait System
 *
 * Implements condition waiting without arbitrary long sleeps.
 *
 * Supported conditions:
 *   - url_changed: URL changes or matches string / RegExp pattern
 *   - text_appeared: Text content becomes visible in DOM
 *   - text_disappeared: Text content is removed or hidden
 *   - element_appeared: Element matching selector or ref appears
 *   - element_disappeared: Element matching selector or ref disappears
 *   - element_enabled: Disabled element becomes enabled
 *   - element_visible: Hidden element becomes visible
 *   - dom_stable: DOM mutation rate settles to 0
 *   - navigation_complete: Page finishes loading (domcontentloaded | load | networkidle)
 *   - dialog_appeared: Browser dialog appears
 */

import { TimeoutError } from '../core/errors.js';

export class WaitSystem {
  /**
   * Waits for a condition to be met on a live Playwright page.
   *
   * @param {import('playwright-core').Page} page
   * @param {object} condition
   * @param {string} condition.type
   * @param {string} [condition.value]
   * @param {string} [condition.ref]
   * @param {object} [options]
   * @param {number} [options.timeout=10000]
   * @param {Function} [options.resolveLocator] - Locator resolver for ref-based conditions
   * @returns {Promise<{ ok: boolean, condition: string, elapsedMs: number }>}
   */
  async waitFor(page, condition, options = {}) {
    const timeout = options.timeout !== undefined ? options.timeout : 10000;
    const type = condition.type;
    const value = condition.value;
    const start = Date.now();

    try {
      switch (type) {
        case 'url_changed': {
          const initialUrl = page.url();
          if (value) {
            await page.waitForURL(value, { timeout });
          } else {
            await page.waitForFunction(
              (prev) => window.location.href !== prev,
              initialUrl,
              { timeout }
            );
          }
          break;
        }

        case 'text_appeared': {
          if (!value) throw new Error("Condition 'text_appeared' requires 'value' (text string)");
          const locator = page.getByText(value).first();
          await locator.waitFor({ state: 'visible', timeout });
          break;
        }

        case 'text_disappeared': {
          if (!value) throw new Error("Condition 'text_disappeared' requires 'value' (text string)");
          const locator = page.getByText(value).first();
          await locator.waitFor({ state: 'hidden', timeout });
          break;
        }

        case 'element_appeared': {
          let locator = null;
          if (condition.ref && options.resolveLocator) {
            locator = await options.resolveLocator(condition.ref);
          } else if (value) {
            locator = page.locator(value).first();
          } else {
            throw new Error("Condition 'element_appeared' requires 'value' (CSS selector) or 'ref'");
          }
          await locator.waitFor({ state: 'attached', timeout });
          break;
        }

        case 'element_disappeared': {
          let locator = null;
          if (condition.ref && options.resolveLocator) {
            locator = await options.resolveLocator(condition.ref);
          } else if (value) {
            locator = page.locator(value).first();
          } else {
            throw new Error("Condition 'element_disappeared' requires 'value' (CSS selector) or 'ref'");
          }
          await locator.waitFor({ state: 'detached', timeout });
          break;
        }

        case 'element_visible': {
          let locator = null;
          if (condition.ref && options.resolveLocator) {
            locator = await options.resolveLocator(condition.ref);
          } else if (value) {
            locator = page.locator(value).first();
          } else {
            throw new Error("Condition 'element_visible' requires 'value' (CSS selector) or 'ref'");
          }
          await locator.waitFor({ state: 'visible', timeout });
          break;
        }

        case 'element_enabled': {
          if (!value && !condition.ref) {
            throw new Error("Condition 'element_enabled' requires 'value' (selector) or 'ref'");
          }

          if (condition.ref && options.resolveLocator) {
            const locator = await options.resolveLocator(condition.ref);
            await locator.waitFor({ state: 'visible', timeout });
            await page.waitForFunction(
              (loc) => !loc.disabled,
              await locator.elementHandle(),
              { timeout }
            );
          } else {
            await page.waitForFunction(
              (sel) => {
                const el = document.querySelector(sel);
                return el && !el.disabled;
              },
              value,
              { timeout }
            );
          }
          break;
        }

        case 'dom_stable': {
          // Event-driven check: wait until no DOM mutations occur for quietMs (default: 80ms)
          const quietMs = options.quietMs || 80;
          await page.evaluate((quietDuration) => {
            return new Promise((resolve) => {
              let timer = null;
              const observer = new MutationObserver(() => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                  observer.disconnect();
                  resolve();
                }, quietDuration);
              });

              observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
              });

              // Initial trigger in case DOM is already stable
              timer = setTimeout(() => {
                observer.disconnect();
                resolve();
              }, quietDuration);
            });
          }, quietMs);
          break;
        }

        case 'navigation_complete': {
          const state = value || 'domcontentloaded';
          await page.waitForLoadState(state, { timeout });
          break;
        }

        case 'dialog_appeared': {
          if (options.dialogManager) {
            await options.dialogManager.waitForDialog(options.tabId, { timeout });
          } else {
            await page.waitForEvent('dialog', { timeout });
          }
          break;
        }

        case 'download_complete': {
          if (options.downloadManager) {
            await options.downloadManager.waitForDownload(options.tabId, page, null, { timeout });
          } else {
            await page.waitForEvent('download', { timeout });
          }
          break;
        }

        case 'popup_opened': {
          await page.waitForEvent('popup', { timeout });
          break;
        }

        default:
          throw new Error(`Unsupported wait condition type: '${type}'`);
      }

      return {
        ok: true,
        condition: type,
        elapsedMs: Date.now() - start
      };
    } catch (err) {
      if (err.name === 'TimeoutError' || err.message?.includes('Timeout') || err.message?.includes('timed out')) {
        throw new TimeoutError(type, timeout, {
          value,
          ref: condition.ref,
          elapsedMs: Date.now() - start
        });
      }
      throw err;
    }
  }
}
