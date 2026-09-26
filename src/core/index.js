/**
 * Universal Browser Control Runtime — Core Package Exports
 *
 * Import the runtime and error types from this file:
 *
 *   import { BrowserRuntime, BaseBrowserAdapter, ConnectionError } from './src/core/index.js';
 */

export { BaseBrowserAdapter } from './base-adapter.js';
export { BrowserRuntime } from './browser-runtime.js';
export {
  BrowserControlError,
  ConnectionError,
  NavigationError,
  TabNotFoundError,
  ElementNotFoundError,
  StaleRefError,
  AmbiguousTargetError,
  ActionFailedError,
  TimeoutError,
  UnsupportedOperationError,
  NoAdapterError,
  UnhandledDialogError
} from './errors.js';
