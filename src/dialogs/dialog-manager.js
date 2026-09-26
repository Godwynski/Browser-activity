/**
 * Universal Browser Control Runtime — Dialog Manager
 *
 * Handles JavaScript web page dialogs:
 *   - alert()
 *   - confirm()
 *   - prompt()
 *   - beforeunload
 *
 * Note: Clearly distinguishes between web page dialogs (handled via CDP/BiDi)
 * and browser chrome dialogs (native OS dialogs like print/auth, which cannot
 * be automated via standard in-page DOM listeners).
 */

import { EventEmitter } from 'node:events';
import { TimeoutError, ValidationError } from '../core/errors.js';

export class DialogManager extends EventEmitter {
  constructor(options = {}) {
    super();
    /**
     * Default policy: 'auto_accept' | 'auto_dismiss' | 'manual'
     */
    this.defaultMode = options.defaultMode || 'auto_accept';
    this.defaultPromptResponse = options.defaultPromptResponse || '';

    // Policies keyed by tabId
    this._tabPolicies = new Map();

    // Pending dialogs keyed by tabId: Array<{ dialog, record, resolve, reject }>
    this._pending = new Map();

    // Dialog history keyed by tabId: Array<DialogRecord>
    this._history = new Map();

    // Monotonic ID counter
    this._counter = 1;
  }

  /**
   * Set handling policy for a specific tab.
   *
   * @param {string} tabId
   * @param {object} policy
   * @param {'auto_accept' | 'auto_dismiss' | 'manual'} [policy.mode]
   * @param {string} [policy.defaultPromptResponse]
   */
  setPolicy(tabId, policy = {}) {
    const existing = this._tabPolicies.get(tabId) || {
      mode: this.defaultMode,
      defaultPromptResponse: this.defaultPromptResponse
    };
    this._tabPolicies.set(tabId, { ...existing, ...policy });
  }

  /**
   * Attach dialog listener to a Playwright page instance.
   *
   * @param {import('playwright-core').Page} page
   * @param {string} tabId
   */
  attach(page, tabId) {
    if (!page || typeof page.on !== 'function') return;

    if (!this._history.has(tabId)) {
      this._history.set(tabId, []);
    }
    if (!this._pending.has(tabId)) {
      this._pending.set(tabId, []);
    }

    page.on('dialog', async (dialog) => {
      const dialogId = `dlg_${this._counter++}`;
      const policy = this._tabPolicies.get(tabId) || {
        mode: this.defaultMode,
        defaultPromptResponse: this.defaultPromptResponse
      };

      const record = {
        id: dialogId,
        tabId,
        type: dialog.type(), // 'alert', 'confirm', 'prompt', 'beforeunload'
        message: dialog.message(),
        defaultValue: dialog.defaultValue(),
        timestamp: Date.now(),
        status: 'pending',
        actionTaken: null,
        promptText: null
      };

      this.emit('dialog', record);

      if (policy.mode === 'auto_accept') {
        try {
          const promptText = dialog.type() === 'prompt' ? policy.defaultPromptResponse : undefined;
          await dialog.accept(promptText);
          record.status = 'handled';
          record.actionTaken = 'accept';
          record.promptText = promptText;
        } catch (err) {
          record.status = 'error';
          record.error = err.message;
        }
        this._recordHistory(tabId, record);
        this.emit('dialog_handled', record);
      } else if (policy.mode === 'auto_dismiss') {
        try {
          await dialog.dismiss();
          record.status = 'handled';
          record.actionTaken = 'dismiss';
        } catch (err) {
          record.status = 'error';
          record.error = err.message;
        }
        this._recordHistory(tabId, record);
        this.emit('dialog_handled', record);
      } else {
        // Manual mode — enqueue pending dialog
        const queue = this._pending.get(tabId) || [];
        queue.push({ dialog, record });
        this._pending.set(tabId, queue);
      }
    });
  }

  /**
   * Handle the oldest pending dialog for a tab.
   *
   * @param {string} tabId
   * @param {object} options
   * @param {'accept' | 'dismiss'} [options.action='accept']
   * @param {string} [options.promptText]
   * @returns {Promise<DialogRecord>}
   */
  async handleDialog(tabId, options = {}) {
    const queue = this._pending.get(tabId) || [];
    if (queue.length === 0) {
      throw new ValidationError(`No pending dialog found for tab "${tabId}"`, { tabId });
    }

    const { dialog, record } = queue.shift();
    const action = options.action === 'dismiss' ? 'dismiss' : 'accept';
    const promptText = options.promptText !== undefined ? options.promptText : '';

    if (action === 'accept') {
      await dialog.accept(dialog.type() === 'prompt' ? promptText : undefined);
    } else {
      await dialog.dismiss();
    }

    record.status = 'handled';
    record.actionTaken = action;
    record.promptText = promptText;

    this._recordHistory(tabId, record);
    this.emit('dialog_handled', record);
    return record;
  }

  /**
   * Get dialog history for a tab.
   *
   * @param {string} tabId
   * @returns {DialogRecord[]}
   */
  getHistory(tabId) {
    return [...(this._history.get(tabId) || [])];
  }

  /**
   * Get current pending dialog for a tab.
   *
   * @param {string} tabId
   * @returns {DialogRecord | null}
   */
  getPendingDialog(tabId) {
    const queue = this._pending.get(tabId) || [];
    return queue.length > 0 ? { ...queue[0].record } : null;
  }

  /**
   * Wait for a dialog to appear on a tab.
   *
   * @param {string} tabId
   * @param {object} [options]
   * @param {number} [options.timeout=5000]
   * @returns {Promise<DialogRecord>}
   */
  async waitForDialog(tabId, options = {}) {
    const timeout = options.timeout || 5000;

    // Check if one is already pending
    const pending = this.getPendingDialog(tabId);
    if (pending) {
      return pending;
    }

    return new Promise((resolve, reject) => {
      let timer = null;

      const handler = (record) => {
        if (record.tabId === tabId) {
          clearTimeout(timer);
          this.off('dialog', handler);
          resolve(record);
        }
      };

      timer = setTimeout(() => {
        this.off('dialog', handler);
        reject(
          new TimeoutError(`Timed out after ${timeout}ms waiting for dialog on tab "${tabId}"`, {
            tabId,
            timeout
          })
        );
      }, timeout);

      this.on('dialog', handler);
    });
  }

  _recordHistory(tabId, record) {
    const hist = this._history.get(tabId) || [];
    hist.push(record);
    if (hist.length > 50) {
      hist.shift();
    }
    this._history.set(tabId, hist);
  }
}
