/**
 * Universal Browser Control Runtime — Universal MCP Server
 *
 * Implements the Model Context Protocol (MCP) server for AI-driven browser control.
 *
 * Exposes a small, cohesive set of 5 core universal tools:
 *   1. `browser`   - Tab lifecycle, windowing, and page navigation
 *   2. `inspect`   - Progressive DOM & ARIA observation (levels 0–4)
 *   3. `act`       - Semantic browser actions, batching, and event-driven waiting
 *   4. `extract`   - Structured content extraction (tables, text, links, forms, metadata)
 *   5. `evaluate`  - In-page JavaScript execution escape hatch
 *
 * Also provides backward-compatible aliases for legacy brave_* tool callers:
 *   - `brave_tabs`       → browser
 *   - `brave_observe`    → inspect
 *   - `brave_act`        → act
 *   - `brave_batch_act`  → act (batch)
 *   - `brave_eval`       → evaluate
 *   - `brave_navigate`   → browser (navigate)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { BrowserRuntime } from '../core/browser-runtime.js';
import { ChromiumAdapter } from '../adapters/chromium.js';
import { globalConfig } from '../core/config.js';
import { BrowserControlError } from '../core/errors.js';

export class UniversalMcpServer {
  /**
   * @param {object} [options]
   * @param {BrowserRuntime} [options.runtime]
   * @param {boolean} [options.includeLegacyAliases=true]
   */
  constructor(options = {}) {
    this.runtime = options.runtime || new BrowserRuntime(new ChromiumAdapter());
    this.includeLegacyAliases = options.includeLegacyAliases !== false;

    this.server = new Server(
      {
        name: 'browser-control',
        version: '3.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this._registerHandlers();
  }

  /**
   * Ensure runtime is connected before dispatching tool calls.
   */
  async _ensureConnected() {
    if (!this.runtime.isConnected()) {
      const mode = globalConfig.get('defaultMode', 'attach');
      const port = globalConfig.get('cdpPort', 9222);
      const browser = globalConfig.get('defaultBrowser', 'brave');
      try {
        if (mode === 'attach') {
          await this.runtime.connect({ mode: 'attach', port });
        } else {
          await this.runtime.connect({ mode: 'managed', browser, headless: globalConfig.get('headless', true) });
        }
      } catch (err) {
        // Fallback to managed chrome if attach port not open
        if (mode === 'attach') {
          try {
            await this.runtime.connect({ mode: 'managed', browser: 'chrome', headless: true });
          } catch (mErr) {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }
  }

  _registerHandlers() {
    // List Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        {
          name: 'browser',
          description: 'Manage browser tabs and navigation (list, new, close, activate, navigate, reload, back, forward).',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['list', 'new', 'close', 'activate', 'navigate', 'reload', 'back', 'forward'],
                description: 'The browser/tab operation to perform (default: "list")',
                default: 'list'
              },
              tabId: {
                type: 'string',
                description: 'Tab identifier or index to target'
              },
              url: {
                type: 'string',
                description: 'URL to navigate to or load in a new tab'
              },
              waitUntil: {
                type: 'string',
                enum: ['domcontentloaded', 'load', 'networkidle'],
                description: 'Page load waiting condition (default: domcontentloaded)',
                default: 'domcontentloaded'
              }
            }
          }
        },
        {
          name: 'inspect',
          description: 'Extract token-optimized semantic observation (ARIA roles, DOM state, level 0-4 progressive disclosure).',
          inputSchema: {
            type: 'object',
            properties: {
              tabId: {
                type: 'string',
                description: 'Tab ID or index to inspect (default: active tab)'
              },
              level: {
                type: 'integer',
                minimum: 0,
                maximum: 4,
                description: 'Progressive inspection level (0=summary, 1=interactive compact, 2=targeted query, 3=full container, 4=screenshot)',
                default: 1
              },
              format: {
                type: 'string',
                enum: ['compact', 'json'],
                description: 'Output format: "compact" (1-line syntax saving ~70% tokens) or "json"',
                default: 'compact'
              },
              scope: {
                type: 'string',
                description: 'CSS selector to isolate inspection to a specific container (e.g. "main", "#cart", "form")'
              },
              filter: {
                type: 'string',
                enum: ['interactive', 'inputs', 'buttons', 'all'],
                description: 'Filter element types (default: interactive)',
                default: 'interactive'
              },
              query: {
                type: 'string',
                description: 'Semantic text/role search query (used with level 2 targeted inspection)'
              }
            }
          }
        },
        {
          name: 'act',
          description: 'Execute semantic actions (click, type, press, scroll, hover, select, upload, wait, batch).',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['click', 'type', 'press', 'scroll', 'hover', 'select', 'upload', 'wait', 'batch'],
                description: 'Action primitive to execute'
              },
              tabId: {
                type: 'string',
                description: 'Target tab ID or index'
              },
              ref: {
                type: 'string',
                description: 'Element ref from observation (e.g. "e1", "e2")'
              },
              text: {
                type: 'string',
                description: 'Text to type into input'
              },
              key: {
                type: 'string',
                description: 'Key name to press (e.g. "Enter", "Tab", "Escape")'
              },
              value: {
                type: 'string',
                description: 'Value to select in dropdown or combobox'
              },
              direction: {
                type: 'string',
                enum: ['up', 'down', 'left', 'right', 'top', 'bottom'],
                description: 'Scroll direction (default: down)',
                default: 'down'
              },
              filePaths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of absolute file paths to upload'
              },
              condition: {
                type: 'object',
                description: 'Wait condition object (type: text_appeared, url_changed, dom_stable, etc.)'
              },
              actions: {
                type: 'array',
                description: 'Array of sequential action objects for batch execution'
              }
            },
            required: ['action']
          }
        },
        {
          name: 'extract',
          description: 'Extract structured information from page without full observation overhead (text, tables, links, forms, metadata).',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['text', 'table', 'tables', 'links', 'form', 'forms', 'metadata', 'structured'],
                description: 'Type of structured data to extract'
              },
              tabId: {
                type: 'string',
                description: 'Target tab ID or index'
              },
              scope: {
                type: 'string',
                description: 'CSS selector to scope extraction'
              },
              selector: {
                type: 'string',
                description: 'Explicit selector for target table or container'
              },
              format: {
                type: 'string',
                description: 'Output format ("plain", "markdown", "json", "both")'
              }
            },
            required: ['type']
          }
        },
        {
          name: 'evaluate',
          description: 'Execute arbitrary JavaScript expression in the page context (escape hatch).',
          inputSchema: {
            type: 'object',
            properties: {
              script: {
                type: 'string',
                description: 'JavaScript code to evaluate'
              },
              tabId: {
                type: 'string',
                description: 'Target tab ID or index'
              },
              frameId: {
                type: 'string',
                description: 'Optional iframe name or selector to evaluate within'
              }
            },
            required: ['script']
          }
        }
      ];

      // Add legacy backward-compatible aliases if requested
      if (this.includeLegacyAliases) {
        tools.push(
          {
            name: 'brave_tabs',
            description: '[Legacy Alias] List, switch, create, close, or focus tabs.',
            inputSchema: {
              type: 'object',
              properties: {
                action: { type: 'string', default: 'list' },
                index: { type: 'integer' },
                url: { type: 'string' },
                bringToFront: { type: 'boolean', default: false }
              }
            }
          },
          {
            name: 'brave_observe',
            description: '[Legacy Alias] Tri-source observation of a browser tab.',
            inputSchema: {
              type: 'object',
              properties: {
                target: { type: 'string', default: 'agent' },
                tabIndex: { type: 'integer' },
                format: { type: 'string', default: 'compact' },
                scope: { type: 'string' },
                filter: { type: 'string', default: 'interactive' },
                includeScreenshot: { type: 'boolean', default: false }
              }
            }
          },
          {
            name: 'brave_act',
            description: '[Legacy Alias] Execute browser-native action.',
            inputSchema: {
              type: 'object',
              properties: {
                action: { type: 'string' },
                ref: { type: 'string' },
                text: { type: 'string' },
                key: { type: 'string' },
                direction: { type: 'string' },
                value: { type: 'string' }
              },
              required: ['action']
            }
          },
          {
            name: 'brave_batch_act',
            description: '[Legacy Alias] Execute sequential actions in batch.',
            inputSchema: {
              type: 'object',
              properties: {
                actions: { type: 'array' }
              },
              required: ['actions']
            }
          },
          {
            name: 'brave_eval',
            description: '[Legacy Alias] In-page JavaScript evaluation.',
            inputSchema: {
              type: 'object',
              properties: {
                script: { type: 'string' },
                tabIndex: { type: 'integer' }
              },
              required: ['script']
            }
          },
          {
            name: 'brave_navigate',
            description: '[Legacy Alias] Navigate browser tab.',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                action: { type: 'string', default: 'goto' },
                tabIndex: { type: 'integer' }
              }
            }
          }
        );
      }

      return { tools };
    });

    // Call Tool Dispatcher
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        await this._ensureConnected();
        const tabs = await this.runtime.listTabs();
        const activeTab = tabs.find(t => t.active) || (tabs.length > 0 ? tabs[tabs.length - 1] : null);
        const defaultTabId = activeTab ? activeTab.id : 'tab_1';

        switch (name) {
          // --- Universal Tool: browser ---
          case 'browser': {
            const action = args.action || 'list';
            const targetId = args.tabId || defaultTabId;

            switch (action) {
              case 'list': {
                const list = await this.runtime.listTabs();
                return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
              }
              case 'new': {
                const created = await this.runtime.createTab(args.url || 'about:blank');
                return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }] };
              }
              case 'close': {
                await this.runtime.closeTab(targetId);
                return { content: [{ type: 'text', text: `Tab ${targetId} closed successfully.` }] };
              }
              case 'activate': {
                const activated = await this.runtime.activateTab(targetId);
                return { content: [{ type: 'text', text: JSON.stringify(activated, null, 2) }] };
              }
              case 'navigate': {
                if (!args.url) throw new Error('navigate action requires url parameter');
                const nav = await this.runtime.navigate(targetId, args.url, { waitUntil: args.waitUntil });
                return { content: [{ type: 'text', text: JSON.stringify(nav, null, 2) }] };
              }
              case 'reload': {
                const rel = await this.runtime.reload(targetId, { waitUntil: args.waitUntil });
                return { content: [{ type: 'text', text: JSON.stringify(rel, null, 2) }] };
              }
              case 'back': {
                const b = await this.runtime.goBack(targetId);
                return { content: [{ type: 'text', text: JSON.stringify(b, null, 2) }] };
              }
              case 'forward': {
                const f = await this.runtime.goForward(targetId);
                return { content: [{ type: 'text', text: JSON.stringify(f, null, 2) }] };
              }
              default:
                throw new Error(`Unknown browser action: ${action}`);
            }
          }

          // --- Universal Tool: inspect ---
          case 'inspect': {
            const targetId = args.tabId || defaultTabId;
            const obs = await this.runtime.inspect(targetId, args);
            const text = args.format === 'json' ? JSON.stringify(obs, null, 2) : (obs.compact || JSON.stringify(obs));
            return { content: [{ type: 'text', text }] };
          }

          // --- Universal Tool: act ---
          case 'act': {
            const action = args.action;
            const targetId = args.tabId || defaultTabId;

            switch (action) {
              case 'click': {
                const res = await this.runtime.click(targetId, args.ref, args);
                return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
              }
              case 'type': {
                const res = await this.runtime.type(targetId, args.ref, args.text || '', args);
                return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
              }
              case 'press': {
                const res = await this.runtime.press(targetId, args.key, args);
                return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
              }
              case 'scroll': {
                const res = await this.runtime.scroll(targetId, args);
                return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
              }
              case 'hover': {
                const res = await this.runtime.hover(targetId, args.ref, args);
                return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
              }
              case 'select': {
                const res = await this.runtime.select(targetId, args.ref, args.value, args);
                return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
              }
              case 'upload': {
                const res = await this.runtime.upload(targetId, args.ref, args.filePaths || [], args);
                return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
              }
              case 'wait': {
                const res = await this.runtime.waitFor(targetId, args.condition || {}, args);
                return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
              }
              case 'batch': {
                const res = await this.runtime.batch(targetId, args.actions || [], args);
                return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
              }
              default:
                throw new Error(`Unknown action: ${action}`);
            }
          }

          // --- Universal Tool: extract ---
          case 'extract': {
            const targetId = args.tabId || defaultTabId;
            const res = await this.runtime.extract(targetId, args.type, args);
            return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
          }

          // --- Universal Tool: evaluate ---
          case 'evaluate': {
            const targetId = args.tabId || defaultTabId;
            const res = await this.runtime.evaluate(targetId, args.script, args);
            return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
          }

          // --- Legacy Backward-Compatible Aliases ---
          case 'brave_tabs': {
            const action = args.action || 'list';
            if (action === 'list') {
              const list = await this.runtime.listTabs();
              return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
            } else if (action === 'new') {
              const created = await this.runtime.createTab(args.url || 'about:blank');
              return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }] };
            } else if (action === 'close') {
              const target = args.index !== undefined ? String(args.index) : defaultTabId;
              await this.runtime.closeTab(target);
              return { content: [{ type: 'text', text: `Tab closed.` }] };
            } else if (action === 'switch' || action === 'focus') {
              const target = args.index !== undefined ? String(args.index) : defaultTabId;
              const res = await this.runtime.activateTab(target);
              return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
            }
            return { content: [{ type: 'text', text: 'OK' }] };
          }

          case 'brave_observe': {
            const target = args.tabIndex !== undefined ? String(args.tabIndex) : defaultTabId;
            const obs = await this.runtime.inspect(target, args);
            const text = args.format === 'json' ? JSON.stringify(obs, null, 2) : (obs.compact || JSON.stringify(obs));
            return { content: [{ type: 'text', text }] };
          }

          case 'brave_act': {
            const target = defaultTabId;
            const action = args.action;
            let res;
            if (action === 'click') res = await this.runtime.click(target, args.ref, args);
            else if (action === 'type') res = await this.runtime.type(target, args.ref, args.text || '', args);
            else if (action === 'press') res = await this.runtime.press(target, args.key, args);
            else if (action === 'scroll') res = await this.runtime.scroll(target, args);
            else if (action === 'hover') res = await this.runtime.hover(target, args.ref, args);
            else if (action === 'select') res = await this.runtime.select(target, args.ref, args.value, args);
            return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
          }

          case 'brave_batch_act': {
            const target = defaultTabId;
            const res = await this.runtime.batch(target, args.actions || [], args);
            return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
          }

          case 'brave_eval': {
            const target = args.tabIndex !== undefined ? String(args.tabIndex) : defaultTabId;
            const res = await this.runtime.evaluate(target, args.script);
            return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
          }

          case 'brave_navigate': {
            const target = args.tabIndex !== undefined ? String(args.tabIndex) : defaultTabId;
            const action = args.action || 'goto';
            if (action === 'reload') {
              const res = await this.runtime.reload(target);
              return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
            } else if (action === 'back') {
              const res = await this.runtime.goBack(target);
              return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
            } else if (action === 'forward') {
              const res = await this.runtime.goForward(target);
              return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
            } else {
              const res = await this.runtime.navigate(target, args.url);
              return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
            }
          }

          default:
            throw new Error(`Tool not found: ${name}`);
        }
      } catch (err) {
        const errorText = err instanceof BrowserControlError
          ? err.format()
          : `ERROR: ${err.message}`;
        return {
          content: [{ type: 'text', text: errorText }],
          isError: true
        };
      }
    });
  }

  /**
   * Connect to stdio transport and begin serving requests.
   */
  async startStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
