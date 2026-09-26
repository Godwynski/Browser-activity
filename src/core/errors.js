/**
 * Universal Browser Control Runtime — Standard Error Types
 *
 * All errors produced by the runtime follow a machine-readable, actionable format:
 *
 *   ERROR_CODE
 *   key=value
 *   key=value
 *   suggestion=inspect
 *
 * Errors are designed to guide the AI agent toward a corrective action
 * rather than dumping raw stack traces into the context window.
 */

// ---------------------------------------------------------------------------
// Base Error
// ---------------------------------------------------------------------------

export class BrowserControlError extends Error {
  /**
   * @param {string} code   - Machine-readable error code (ALL_CAPS_SNAKE)
   * @param {string} message - Human-readable description
   * @param {object} details - Key/value pairs included in formatted output
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'BrowserControlError';
    this.code = code;
    this.details = details;
  }

  /**
   * Returns the compact, agent-readable error string.
   * @returns {string}
   */
  format() {
    const lines = [this.code];
    for (const [key, value] of Object.entries(this.details)) {
      if (value !== undefined && value !== null) {
        lines.push(`${key}=${value}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Returns a JSON-serialisable representation.
   * @returns {object}
   */
  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...this.details
    };
  }
}

// ---------------------------------------------------------------------------
// Connection Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a browser cannot be reached or a connection drops.
 *
 * Example output:
 *   CONNECTION_ERROR
 *   reason=econnrefused
 *   endpoint=http://127.0.0.1:9222
 *   suggestion=ensure browser is running with remote debugging enabled
 */
export class ConnectionError extends BrowserControlError {
  constructor(message, details = {}) {
    super('CONNECTION_ERROR', message, {
      suggestion: 'ensure browser is running with remote debugging enabled',
      ...details
    });
    this.name = 'ConnectionError';
  }
}

// ---------------------------------------------------------------------------
// Navigation Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a navigation action fails (timeout, blocked, redirect loop, etc.).
 *
 * Example output:
 *   NAVIGATION_ERROR
 *   url=https://example.com
 *   reason=timeout
 *   suggestion=retry or increase timeout
 */
export class NavigationError extends BrowserControlError {
  constructor(message, details = {}) {
    super('NAVIGATION_ERROR', message, {
      suggestion: 'retry or increase timeout',
      ...details
    });
    this.name = 'NavigationError';
  }
}

// ---------------------------------------------------------------------------
// Tab Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a tab ID cannot be resolved to an open browser page.
 *
 * Example output:
 *   TAB_NOT_FOUND
 *   tabId=tab_99
 *   suggestion=call listTabs to get current open tab IDs
 */
export class TabNotFoundError extends BrowserControlError {
  constructor(tabId, details = {}) {
    super('TAB_NOT_FOUND', `Tab '${tabId}' not found or is closed`, {
      tabId,
      suggestion: 'call listTabs to get current open tab IDs',
      ...details
    });
    this.name = 'TabNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Element Reference Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a ref (e.g. 'e4') is not found in the current observation.
 *
 * Example output:
 *   ELEMENT_NOT_FOUND
 *   ref=e4
 *   suggestion=inspect
 */
export class ElementNotFoundError extends BrowserControlError {
  constructor(ref, details = {}) {
    super('ELEMENT_NOT_FOUND', `Element reference '${ref}' not found in current observation`, {
      ref,
      suggestion: 'inspect',
      ...details
    });
    this.name = 'ElementNotFoundError';
  }
}

/**
 * Thrown when a ref is found in the registry but the DOM element it pointed
 * to is no longer present or has changed identity after a page mutation.
 *
 * Recovery may have been attempted — if so, recovery=failed is included.
 *
 * Example output:
 *   STALE_REF
 *   ref=e4
 *   recovery=failed
 *   suggestion=inspect
 */
export class StaleRefError extends BrowserControlError {
  constructor(ref, details = {}) {
    super('STALE_REF', `Element reference '${ref}' is stale; the page may have changed`, {
      ref,
      recovery: 'failed',
      suggestion: 'inspect',
      ...details
    });
    this.name = 'StaleRefError';
  }
}

/**
 * Thrown when a semantic query matches more than one element and the runtime
 * cannot confidently pick one.
 *
 * The agent must refine the query (e.g. via scoped inspection) before retrying.
 *
 * Example output:
 *   AMBIGUOUS_TARGET
 *   query=Submit
 *   matches=3
 *   suggestion=inspect
 */
export class AmbiguousTargetError extends BrowserControlError {
  constructor(query, matchCount, details = {}) {
    super('AMBIGUOUS_TARGET', `Query '${query}' matched ${matchCount} candidates; cannot select one safely`, {
      query,
      matches: matchCount,
      suggestion: 'inspect',
      ...details
    });
    this.name = 'AmbiguousTargetError';
  }
}

// ---------------------------------------------------------------------------
// Action Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a browser action (click, type, etc.) fails at the execution layer.
 *
 * Example output:
 *   ACTION_FAILED
 *   ref=e4
 *   reason=element_not_interactable
 *   suggestion=inspect
 */
export class ActionFailedError extends BrowserControlError {
  constructor(ref, reason, details = {}) {
    super('ACTION_FAILED', `Action failed on '${ref}': ${reason}`, {
      ref,
      reason,
      suggestion: 'inspect',
      ...details
    });
    this.name = 'ActionFailedError';
  }
}

// ---------------------------------------------------------------------------
// Wait / Timeout Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a waitFor() condition is not satisfied within the timeout period.
 *
 * Example output:
 *   TIMEOUT
 *   condition=text_appeared
 *   value=Welcome
 *   timeoutMs=5000
 *   suggestion=retry or increase timeout
 */
export class TimeoutError extends BrowserControlError {
  constructor(condition, timeoutMs, details = {}) {
    super('TIMEOUT', `Timed out after ${timeoutMs}ms waiting for condition: ${condition}`, {
      condition,
      timeoutMs,
      suggestion: 'retry or increase timeout',
      ...details
    });
    this.name = 'TimeoutError';
  }
}

// ---------------------------------------------------------------------------
// Adapter / Capability Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when an operation is called on an adapter that does not support it.
 * Not all adapters support all capabilities (e.g. managed launch, BiDi, extension).
 *
 * Example output:
 *   UNSUPPORTED_OPERATION
 *   operation=upload
 *   adapter=extension
 *   suggestion=use a chromium or bidi adapter for this capability
 */
export class UnsupportedOperationError extends BrowserControlError {
  constructor(operation, adapterName, details = {}) {
    super(
      'UNSUPPORTED_OPERATION',
      `'${operation}' is not supported by the '${adapterName}' adapter`,
      {
        operation,
        adapter: adapterName,
        suggestion: 'use a chromium or bidi adapter for this capability',
        ...details
      }
    );
    this.name = 'UnsupportedOperationError';
  }
}

/**
 * Thrown when no adapter has been configured on BrowserRuntime.
 */
export class NoAdapterError extends BrowserControlError {
  constructor() {
    super('NO_ADAPTER', 'No browser adapter is configured', {
      suggestion: 'call runtime.setAdapter() before performing any browser operation'
    });
    this.name = 'NoAdapterError';
  }
}

// ---------------------------------------------------------------------------
// Dialog / Popup Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when an unexpected browser dialog blocks execution and no auto-handler
 * is configured.
 */
export class UnhandledDialogError extends BrowserControlError {
  constructor(dialogType, message, details = {}) {
    super('UNHANDLED_DIALOG', `Unhandled ${dialogType} dialog: "${message}"`, {
      dialogType,
      dialogMessage: message,
      suggestion: 'use waitFor dialog_appeared or configure a dialog handler',
      ...details
    });
    this.name = 'UnhandledDialogError';
  }
}

// ---------------------------------------------------------------------------
// Validation & Execution Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when an input argument, selector, or extraction configuration is invalid.
 */
export class ValidationError extends BrowserControlError {
  constructor(message, details = {}) {
    super('VALIDATION_ERROR', message, {
      suggestion: 'check provided parameters and selectors',
      ...details
    });
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when an execution or internal command fails.
 */
export class ExecutionError extends BrowserControlError {
  constructor(message, details = {}) {
    super('EXECUTION_ERROR', message, {
      suggestion: 'check execution state or underlying browser logs',
      ...details
    });
    this.name = 'ExecutionError';
  }
}

