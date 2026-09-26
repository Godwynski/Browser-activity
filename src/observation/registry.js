/**
 * Universal Browser Control Runtime — Server-Side Element Registry & Stale-Ref Recovery
 *
 * Maintains ephemeral element references (e1, e2, ...) across observations.
 * Stores candidate fingerprints (role, accessible name, placeholder, ID, name attribute,
 * tag, frame index, bounding box, selector) to enable robust semantic recovery when
 * page mutations cause element references to become stale.
 *
 * Recovery algorithm:
 *   1. Check if ref is present in active observation and still attached to live DOM.
 *   2. If stale or from older observation, query live DOM using candidate fingerprints.
 *   3. If exactly 1 candidate matches with high confidence: recover automatically.
 *   4. If multiple candidates match: throw AmbiguousTargetError (AI must re-inspect).
 *   5. If zero candidates match: throw StaleRefError (recovery=failed).
 */

import {
  ElementNotFoundError,
  StaleRefError,
  AmbiguousTargetError
} from '../core/errors.js';

export class ElementRegistry {
  constructor(options = {}) {
    this.maxHistoryPerTab = options.maxHistoryPerTab || 5;

    /** @type {Map<string, ObservationSession[]>} tabId -> sessions history */
    this._tabSessions = new Map();
  }

  /**
   * Registers a new observation session for a given tab.
   *
   * @param {string} tabId
   * @param {object} session
   * @param {string} session.obsId
   * @param {number} session.level
   * @param {object} session.pageState
   * @param {Array<object>} session.elements
   * @returns {string} obsId
   */
  registerObservation(tabId, session) {
    if (!this._tabSessions.has(tabId)) {
      this._tabSessions.set(tabId, []);
    }

    const history = this._tabSessions.get(tabId);

    const refMap = new Map();
    for (const el of session.elements) {
      if (el.ref) {
        refMap.set(el.ref, el);
      }
    }

    const record = {
      obsId: session.obsId,
      level: session.level,
      timestamp: Date.now(),
      pageState: session.pageState,
      elements: session.elements,
      refMap
    };

    history.unshift(record);

    // Prune history
    if (history.length > this.maxHistoryPerTab) {
      history.pop();
    }

    return session.obsId;
  }

  /**
   * Retrieves the latest observation record for a tab.
   *
   * @param {string} tabId
   * @returns {object | null}
   */
  getLatestObservation(tabId) {
    const history = this._tabSessions.get(tabId);
    if (!history || history.length === 0) return null;
    return history[0];
  }

  /**
   * Looks up an element candidate by ref in the tab's observation history.
   *
   * @param {string} tabId
   * @param {string} ref
   * @returns {object | null}
   */
  findElementCandidate(tabId, ref) {
    const history = this._tabSessions.get(tabId);
    if (!history) return null;

    for (const session of history) {
      if (session.refMap.has(ref)) {
        return session.refMap.get(ref);
      }
    }
    return null;
  }

  /**
   * Resolves an element ref on a live Playwright page.
   * If the ref is missing or stale, attempts semantic recovery.
   *
   * @param {string} tabId
   * @param {string} ref
   * @param {object} context
   * @param {import('playwright-core').Page} context.page
   * @param {boolean} [context.autoRecover=true]
   * @returns {Promise<{ ref: string, candidate: object, recovered: boolean, locator: import('playwright-core').Locator }>}
   */
  async resolveRef(tabId, ref, { page, autoRecover = true } = {}) {
    const candidate = this.findElementCandidate(tabId, ref);
    if (!candidate) {
      throw new ElementNotFoundError(ref, {
        tabId,
        suggestion: 'inspect'
      });
    }

    if (!page || page.isClosed()) {
      throw new Error(`Cannot resolve ref '${ref}'; page is closed or not provided`);
    }

    // Attempt 1: Direct resolution via candidate selector or frame
    const targetFrame = (candidate.frameIndex !== null && candidate.frameIndex !== undefined)
      ? page.frames()[candidate.frameIndex] || page.mainFrame()
      : page.mainFrame();

    let directLocator = null;
    let isAttached = false;

    if (candidate.domMeta?.id) {
      directLocator = targetFrame.locator(`#${candidate.domMeta.id}`);
      try {
        isAttached = (await directLocator.count()) === 1;
      } catch {
        isAttached = false;
      }
    } else if (candidate.role && candidate.name) {
      try {
        directLocator = targetFrame.getByRole(candidate.role, { name: candidate.name, exact: true });
        isAttached = (await directLocator.count()) === 1;
      } catch {
        isAttached = false;
      }
    }

    if (isAttached && directLocator) {
      return {
        ref,
        candidate,
        recovered: false,
        locator: directLocator
      };
    }

    // If direct resolution fails and autoRecover is false, fail as stale
    if (!autoRecover) {
      throw new StaleRefError(ref, {
        recovery: 'failed',
        reason: 'direct_lookup_failed_auto_recovery_disabled'
      });
    }

    // Attempt 2: Semantic Recovery via Fingerprint Candidates
    const recovered = await this._attemptSemanticRecovery(page, candidate);
    if (recovered.status === 'success') {
      return {
        ref,
        candidate: recovered.candidate,
        recovered: true,
        recoveryMethod: recovered.method,
        locator: recovered.locator
      };
    } else if (recovered.status === 'ambiguous') {
      throw new AmbiguousTargetError(ref, recovered.matches, {
        ref,
        reason: 'multiple_semantic_candidates_matched',
        suggestion: 'inspect'
      });
    } else {
      throw new StaleRefError(ref, {
        recovery: 'failed',
        reason: 'zero_candidates_matched',
        suggestion: 'inspect'
      });
    }
  }

  /**
   * Internal semantic recovery engine.
   *
   * @param {import('playwright-core').Page} page
   * @param {object} originalCandidate
   * @returns {Promise<{ status: 'success' | 'ambiguous' | 'failed', matches?: number, locator?: any, candidate?: any, method?: string }>}
   */
  async _attemptSemanticRecovery(page, originalCandidate) {
    const { role, name, domMeta } = originalCandidate;
    const targetId = domMeta?.id;
    const targetNameAttr = domMeta?.nameAttr;
    const targetPlaceholder = domMeta?.placeholder;

    // Strategy 1: Match by stable DOM ID across all frames
    if (targetId) {
      for (const frame of page.frames()) {
        try {
          const loc = frame.locator(`#${targetId}`);
          const count = await loc.count();
          if (count === 1) {
            return { status: 'success', locator: loc, candidate: originalCandidate, method: 'stable_dom_id' };
          } else if (count > 1) {
            return { status: 'ambiguous', matches: count };
          }
        } catch {}
      }
    }

    // Strategy 2: Match by Role + Exact Accessible Name
    if (role && name) {
      for (const frame of page.frames()) {
        try {
          const loc = frame.getByRole(role, { name, exact: true });
          const count = await loc.count();
          if (count === 1) {
            return { status: 'success', locator: loc, candidate: originalCandidate, method: 'role_and_exact_name' };
          } else if (count > 1) {
            return { status: 'ambiguous', matches: count };
          }
        } catch {}
      }
    }

    // Strategy 3: Match by Name attribute + tag
    if (targetNameAttr && domMeta?.tag) {
      for (const frame of page.frames()) {
        try {
          const loc = frame.locator(`${domMeta.tag}[name="${targetNameAttr}"]`);
          const count = await loc.count();
          if (count === 1) {
            return { status: 'success', locator: loc, candidate: originalCandidate, method: 'name_attribute' };
          } else if (count > 1) {
            return { status: 'ambiguous', matches: count };
          }
        } catch {}
      }
    }

    // Strategy 4: Match by Placeholder text (inputs / textboxes)
    if (targetPlaceholder) {
      for (const frame of page.frames()) {
        try {
          const loc = frame.getByPlaceholder(targetPlaceholder, { exact: true });
          const count = await loc.count();
          if (count === 1) {
            return { status: 'success', locator: loc, candidate: originalCandidate, method: 'placeholder' };
          } else if (count > 1) {
            return { status: 'ambiguous', matches: count };
          }
        } catch {}
      }
    }

    // Strategy 5: Match by Text content
    if (name && name.length > 2) {
      for (const frame of page.frames()) {
        try {
          const loc = frame.getByText(name, { exact: true });
          const count = await loc.count();
          if (count === 1) {
            return { status: 'success', locator: loc, candidate: originalCandidate, method: 'text_content' };
          } else if (count > 1) {
            return { status: 'ambiguous', matches: count };
          }
        } catch {}
      }
    }

    return { status: 'failed', matches: 0 };
  }

  /**
   * Clears observation history for a tab or all tabs.
   * @param {string} [tabId]
   */
  clear(tabId) {
    if (tabId) {
      this._tabSessions.delete(tabId);
    } else {
      this._tabSessions.clear();
    }
  }
}
