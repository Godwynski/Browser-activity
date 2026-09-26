/**
 * Universal Browser Control Runtime — Batch Action Executor
 *
 * Executes an array of browser actions sequentially.
 * Distinguishes safe sequential actions from actions that require intermediate checks.
 * Stops and returns detailed progress if an error occurs.
 */

export class BatchExecutor {
  /**
   * @param {import('./executor.js').ActionExecutor} actionExecutor
   */
  constructor(actionExecutor) {
    this.actionExecutor = actionExecutor;
  }

  /**
   * Executes a list of action objects sequentially.
   *
   * Example actions array:
   *   [
   *     { type: 'click', ref: 'e2' },
   *     { type: 'type', ref: 'e3', text: 'Godwyn' },
   *     { type: 'press', key: 'Enter' }
   *   ]
   *
   * @param {string} tabId
   * @param {import('playwright-core').Page} page
   * @param {Array<object>} actions
   * @param {object} [options]
   * @returns {Promise<{ ok: boolean, completed: number, total: number, receipts: Array<object>, error?: string }>}
   */
  async executeBatch(tabId, page, actions, options = {}) {
    if (!Array.isArray(actions) || actions.length === 0) {
      throw new Error("Batch execution requires a non-empty array of action objects");
    }

    const receipts = [];
    let completed = 0;

    for (let i = 0; i < actions.length; i++) {
      const item = actions[i];
      const actionType = item.type || item.action;

      try {
        let receipt;
        switch (actionType) {
          case 'click':
            receipt = await this.actionExecutor.click(tabId, page, item.ref, { ...options, ...item });
            break;
          case 'type':
            receipt = await this.actionExecutor.type(tabId, page, item.ref, item.text, { ...options, ...item });
            break;
          case 'press':
            receipt = await this.actionExecutor.press(tabId, page, item.key, { ...options, ...item });
            break;
          case 'scroll':
            receipt = await this.actionExecutor.scroll(tabId, page, { ...options, ...item });
            break;
          case 'hover':
            receipt = await this.actionExecutor.hover(tabId, page, item.ref, { ...options, ...item });
            break;
          case 'select':
            receipt = await this.actionExecutor.select(tabId, page, item.ref, item.value, { ...options, ...item });
            break;
          case 'upload':
            receipt = await this.actionExecutor.upload(tabId, page, item.ref, item.filePaths, { ...options, ...item });
            break;
          case 'wait':
            receipt = await this.actionExecutor.waitFor(tabId, page, item.condition || item, { ...options, ...item });
            break;
          default:
            throw new Error(`Unsupported batch action type '${actionType}' at step ${i + 1}`);
        }

        receipts.push(receipt);
        completed++;
      } catch (err) {
        return {
          ok: false,
          completed,
          total: actions.length,
          failedStep: i + 1,
          receipts,
          error: err.message
        };
      }
    }

    return {
      ok: true,
      completed,
      total: actions.length,
      receipts
    };
  }
}
