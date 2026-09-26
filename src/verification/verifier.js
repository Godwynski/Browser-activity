/**
 * Universal Browser Control Runtime — State Verifier & Action Receipt Generator
 *
 * Captures before/after state snapshots around actions to produce machine-readable,
 * evidence-grounded action receipts.
 *
 * Uses event-driven stabilization (requestAnimationFrame) instead of arbitrary sleeps.
 */

export class StateVerifier {
  /**
   * Captures lightweight page state snapshot before executing an action.
   *
   * @param {import('playwright-core').Page} page
   * @returns {Promise<object>}
   */
  async captureBeforeState(page) {
    const url = page.url();
    const title = await page.title().catch(() => '');
    const readyState = await page.evaluate(() => document.readyState).catch(() => 'complete');

    // Lightweight structural fingerprint (interactive count + top element tags)
    const fingerprint = await page.evaluate(() => {
      const els = document.querySelectorAll('button, a[href], input, select, textarea');
      let hash = `${els.length}:`;
      for (let i = 0; i < Math.min(20, els.length); i++) {
        hash += `${els[i].tagName}:${els[i].id || els[i].name || ''}|`;
      }
      return hash;
    }).catch(() => '');

    return {
      url,
      title,
      readyState,
      fingerprint,
      timestamp: Date.now()
    };
  }

  /**
   * Stabilizes page and captures post-action state snapshot.
   *
   * @param {import('playwright-core').Page} page
   * @param {object} beforeState
   * @param {object} [options]
   * @param {boolean} [options.screenshot=false]
   * @returns {Promise<object>}
   */
  async captureAfterState(page, beforeState, options = {}) {
    // Event-driven microtask & paint stabilization via double requestAnimationFrame
    await page.evaluate(() => {
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    }).catch(() => {});

    const url = page.url();
    const title = await page.title().catch(() => '');
    const readyState = await page.evaluate(() => document.readyState).catch(() => 'complete');

    const fingerprint = await page.evaluate(() => {
      const els = document.querySelectorAll('button, a[href], input, select, textarea');
      let hash = `${els.length}:`;
      for (let i = 0; i < Math.min(20, els.length); i++) {
        hash += `${els[i].tagName}:${els[i].id || els[i].name || ''}|`;
      }
      return hash;
    }).catch(() => '');

    let screenshot = null;
    if (options.screenshot) {
      try {
        const format = options.screenshotFormat === 'png' ? 'png' : 'jpeg';
        const buffer = await page.screenshot({
          type: format,
          quality: format === 'jpeg' ? 65 : undefined,
          timeout: 4000
        });
        screenshot = `data:image/${format};base64,${buffer.toString('base64')}`;
      } catch {
        screenshot = null;
      }
    }

    return {
      url,
      title,
      readyState,
      fingerprint,
      timestamp: Date.now(),
      screenshot
    };
  }

  /**
   * Compares before and after states and returns an ActionReceipt.
   *
   * @param {string} actionType
   * @param {object} beforeState
   * @param {object} afterState
   * @param {object} [extra]
   * @returns {import('../core/base-adapter.js').ActionReceipt}
   */
  createReceipt(actionType, beforeState, afterState, extra = {}) {
    const changes = [];

    if (beforeState.url !== afterState.url) {
      changes.push(`URL navigated from ${beforeState.url} to ${afterState.url}`);
    }

    if (beforeState.title !== afterState.title) {
      changes.push(`Page title changed from "${beforeState.title}" to "${afterState.title}"`);
    }

    if (extra.detail) {
      changes.push(extra.detail);
    }

    if (beforeState.fingerprint && afterState.fingerprint && beforeState.fingerprint !== afterState.fingerprint) {
      changes.push('DOM structure mutated (dynamic element or content update)');
    }

    if (changes.length === 0) {
      changes.push('Action executed; state remained stable');
    }

    return {
      ok: true,
      action: actionType,
      ref: extra.ref,
      changes,
      before: {
        url: beforeState.url,
        title: beforeState.title
      },
      after: {
        url: afterState.url,
        title: afterState.title
      },
      screenshot: afterState.screenshot || null
    };
  }
}
