/**
 * Universal Browser Control Runtime — Action Executor
 *
 * Executes browser actions (click, type, press, scroll, hover, select, upload)
 * against resolved element locators.
 *
 * Automatically verifies action outcomes using StateVerifier to produce ActionReceipts.
 */

import { ActionFailedError } from '../core/errors.js';
import { StateVerifier } from '../verification/verifier.js';
import { WaitSystem } from './wait.js';

export class ActionExecutor {
  /**
   * @param {object} options
   * @param {import('../observation/observer.js').ObservationEngine} options.observationEngine
   * @param {StateVerifier} [options.verifier]
   * @param {WaitSystem} [options.waitSystem]
   */
  constructor(options = {}) {
    this.observationEngine = options.observationEngine;
    this.verifier = options.verifier || new StateVerifier();
    this.waitSystem = options.waitSystem || new WaitSystem();
  }

  /**
   * Resolves a ref on a tab to a live Playwright locator.
   */
  async resolveLocator(tabId, page, ref, options = {}) {
    if (!this.observationEngine) {
      throw new Error('ObservationEngine is required to resolve element refs');
    }
    const resolved = await this.observationEngine.resolveRef(tabId, ref, { page, ...options });
    return resolved.locator;
  }

  /**
   * Click an element.
   *
   * @param {string} tabId
   * @param {import('playwright-core').Page} page
   * @param {string} ref
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async click(tabId, page, ref, options = {}) {
    const timeout = options.timeout || 6000;
    const locator = await this.resolveLocator(tabId, page, ref, options);

    const before = await this.verifier.captureBeforeState(page);
    try {
      await locator.click({
        timeout,
        force: options.force || false
      });
    } catch (err) {
      throw new ActionFailedError(ref, err.message, {
        action: 'click',
        reason: err.message,
        suggestion: 'inspect'
      });
    }
    const after = await this.verifier.captureAfterState(page, before, options);

    return this.verifier.createReceipt('click', before, after, {
      ref,
      detail: `Clicked element [${ref}]`
    });
  }

  /**
   * Type text into an element.
   *
   * @param {string} tabId
   * @param {import('playwright-core').Page} page
   * @param {string} ref
   * @param {string} text
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async type(tabId, page, ref, text, options = {}) {
    const timeout = options.timeout || 6000;
    const locator = await this.resolveLocator(tabId, page, ref, options);

    const before = await this.verifier.captureBeforeState(page);
    try {
      if (options.append) {
        await locator.focus({ timeout });
        await page.keyboard.type(text);
      } else {
        await locator.fill(text, { timeout });
      }

      if (options.pressEnter) {
        await locator.press('Enter');
      }
    } catch (err) {
      throw new ActionFailedError(ref, err.message, {
        action: 'type',
        reason: err.message,
        suggestion: 'inspect'
      });
    }
    const after = await this.verifier.captureAfterState(page, before, options);

    return this.verifier.createReceipt('type', before, after, {
      ref,
      detail: `Typed "${text}" into [${ref}]`
    });
  }

  /**
   * Press a keyboard key.
   *
   * @param {string} tabId
   * @param {import('playwright-core').Page} page
   * @param {string} key
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async press(tabId, page, key, options = {}) {
    const before = await this.verifier.captureBeforeState(page);
    try {
      if (options.ref) {
        const locator = await this.resolveLocator(tabId, page, options.ref, options);
        await locator.press(key, { timeout: options.timeout || 5000 });
      } else {
        await page.keyboard.press(key);
      }
    } catch (err) {
      throw new ActionFailedError(options.ref || 'keyboard', err.message, {
        action: 'press',
        key,
        reason: err.message,
        suggestion: 'inspect'
      });
    }
    const after = await this.verifier.captureAfterState(page, before, options);

    return this.verifier.createReceipt('press', before, after, {
      ref: options.ref,
      detail: `Pressed key '${key}'`
    });
  }

  /**
   * Scroll page or specific element.
   *
   * @param {string} tabId
   * @param {import('playwright-core').Page} page
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async scroll(tabId, page, options = {}) {
    const direction = options.direction || 'down';
    const amount = options.amount || 500;

    const before = await this.verifier.captureBeforeState(page);
    try {
      if (options.ref) {
        const locator = await this.resolveLocator(tabId, page, options.ref, options);
        await locator.evaluate((el, { dir, px }) => {
          if (dir === 'down') el.scrollTop += px;
          else if (dir === 'up') el.scrollTop -= px;
          else if (dir === 'right') el.scrollLeft += px;
          else if (dir === 'left') el.scrollLeft -= px;
          else if (dir === 'top') el.scrollTop = 0;
          else if (dir === 'bottom') el.scrollTop = el.scrollHeight;
        }, { dir: direction, px: amount });
      } else {
        await page.evaluate(({ dir, px }) => {
          if (dir === 'down') window.scrollBy(0, px);
          else if (dir === 'up') window.scrollBy(0, -px);
          else if (dir === 'right') window.scrollBy(px, 0);
          else if (dir === 'left') window.scrollBy(-px, 0);
          else if (dir === 'top') window.scrollTo(0, 0);
          else if (dir === 'bottom') window.scrollTo(0, document.body.scrollHeight);
        }, { dir: direction, px: amount });
      }
    } catch (err) {
      throw new ActionFailedError(options.ref || 'viewport', err.message, {
        action: 'scroll',
        reason: err.message
      });
    }
    const after = await this.verifier.captureAfterState(page, before, options);

    return this.verifier.createReceipt('scroll', before, after, {
      ref: options.ref,
      detail: `Scrolled ${direction} by ${amount}px`
    });
  }

  /**
   * Hover over an element.
   *
   * @param {string} tabId
   * @param {import('playwright-core').Page} page
   * @param {string} ref
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async hover(tabId, page, ref, options = {}) {
    const timeout = options.timeout || 5000;
    const locator = await this.resolveLocator(tabId, page, ref, options);

    const before = await this.verifier.captureBeforeState(page);
    try {
      await locator.hover({ timeout });
    } catch (err) {
      throw new ActionFailedError(ref, err.message, {
        action: 'hover',
        reason: err.message,
        suggestion: 'inspect'
      });
    }
    const after = await this.verifier.captureAfterState(page, before, options);

    return this.verifier.createReceipt('hover', before, after, {
      ref,
      detail: `Hovered over element [${ref}]`
    });
  }

  /**
   * Select a dropdown option.
   *
   * @param {string} tabId
   * @param {import('playwright-core').Page} page
   * @param {string} ref
   * @param {string} value
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async select(tabId, page, ref, value, options = {}) {
    const timeout = options.timeout || 6000;
    const locator = await this.resolveLocator(tabId, page, ref, options);

    const before = await this.verifier.captureBeforeState(page);
    try {
      // First try standard HTML select
      await locator.selectOption(value, { timeout }).catch(async () => {
        // Fallback for custom select: click select, then select option
        await locator.click({ timeout });
        await page.getByText(value, { exact: true }).first().click({ timeout });
      });
    } catch (err) {
      throw new ActionFailedError(ref, err.message, {
        action: 'select',
        value,
        reason: err.message,
        suggestion: 'inspect'
      });
    }
    const after = await this.verifier.captureAfterState(page, before, options);

    return this.verifier.createReceipt('select', before, after, {
      ref,
      detail: `Selected option "${value}" on [${ref}]`
    });
  }

  /**
   * Set files on a file input.
   *
   * @param {string} tabId
   * @param {import('playwright-core').Page} page
   * @param {string} ref
   * @param {string[]} filePaths
   * @param {object} [options]
   * @returns {Promise<import('../core/base-adapter.js').ActionReceipt>}
   */
  async upload(tabId, page, ref, filePaths, options = {}) {
    const timeout = options.timeout || 6000;
    const locator = await this.resolveLocator(tabId, page, ref, options);

    const before = await this.verifier.captureBeforeState(page);
    try {
      await locator.setInputFiles(filePaths, { timeout });
    } catch (err) {
      throw new ActionFailedError(ref, err.message, {
        action: 'upload',
        reason: err.message,
        suggestion: 'inspect'
      });
    }
    const after = await this.verifier.captureAfterState(page, before, options);

    return this.verifier.createReceipt('upload', before, after, {
      ref,
      detail: `Uploaded ${filePaths.length} file(s) into [${ref}]`
    });
  }

  /**
   * Wait for a browser condition.
   *
   * @param {string} tabId
   * @param {import('playwright-core').Page} page
   * @param {object} condition
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async waitFor(tabId, page, condition, options = {}) {
    return await this.waitSystem.waitFor(page, condition, {
      ...options,
      resolveLocator: async (ref) => this.resolveLocator(tabId, page, ref, options)
    });
  }
}
