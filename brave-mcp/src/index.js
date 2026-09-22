import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { BraveManager } from './browser.js';
import { BrowserObserver } from './observer.js';
import { StateVerifier } from './verifier.js';
import { ActionEngine } from './actions.js';
import { globalTelemetry } from './telemetry-server.js';

const brave = new BraveManager();
const observer = new BrowserObserver();
const verifier = new StateVerifier(observer);
const actionEngine = new ActionEngine(observer, verifier);

const server = new Server(
  {
    name: 'brave-control',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register list of available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'brave_tabs',
        description:
          'List, switch, create, close, or focus tabs in your running Brave Browser.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['list', 'switch', 'new', 'close', 'focus'],
              description: 'Tab action to perform (default is "list"). "new" opens a new tab in your existing browser window.',
              default: 'list'
            },
            index: {
              type: 'integer',
              description: 'Tab index to switch to, focus, or close (0-based index)'
            },
            url: {
              type: 'string',
              description: 'URL to navigate to when creating a new tab'
            },
            bringToFront: {
              type: 'boolean',
              description: 'Whether to bring the tab visually to the front (default false)',
              default: false
            }
          }
        }
      },
      {
        name: 'brave_observe',
        description:
          'Tri-source observation of a Brave tab (DOM state + ARIA semantic roles + optional Viewport Screenshot). ' +
          'By default targets the isolated Agent Workspace window, keeping the user\'s personal window undisturbed. ' +
          'Defaults to compact token-dense notation ("format": "compact") to minimize token usage.',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              enum: ['agent', 'user'],
              description: 'Target window: "agent" (default: isolated agent window) or "user" (user\'s active personal window)',
              default: 'agent'
            },
            tabIndex: {
              type: 'integer',
              description: 'Optional specific tab index to observe'
            },
            format: {
              type: 'string',
              enum: ['compact', 'json'],
              description: 'Output format: "compact" (dense 1-line syntax saving ~65% tokens) or "json" (full object tree)',
              default: 'compact'
            },
            scope: {
              type: 'string',
              description: 'Optional CSS selector to scope observation to a specific container (e.g. "main", "#content", "form")'
            },
            filter: {
              type: 'string',
              enum: ['interactive', 'inputs', 'buttons_links', 'all'],
              description: 'Filter element categories (default "interactive")',
              default: 'interactive'
            },
            includeScreenshot: {
              type: 'boolean',
              description: 'Whether to capture and return a base64 viewport screenshot (default false for fast token-efficient reasoning)',
              default: false
            },
            maxElements: {
              type: 'integer',
              description: 'Maximum number of interactive elements to index (default 60)',
              default: 60
            }
          }
        }
      },
      {
        name: 'brave_act',
        description:
          'Executes an autonomous, browser-native action against the targeted Brave tab. ' +
          'By default runs safely inside the isolated Agent Workspace window without stealing user focus or interrupting your typing. ' +
          'Supports clicking, typing, pressing keys, scrolling, selecting dropdowns, and uploading files.',
        inputSchema: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              enum: ['click', 'type', 'press', 'scroll', 'hover', 'select_option', 'upload_file'],
              description: 'The browser action to execute'
            },
            target: {
              type: 'string',
              enum: ['agent', 'user'],
              description: 'Target window: "agent" (default: isolated agent window) or "user" (user\'s active personal window)',
              default: 'agent'
            },
            tabIndex: {
              type: 'integer',
              description: 'Optional specific tab index to act on'
            },
            ref: {
              type: 'string',
              description: "The ephemeral element reference from brave_observe (e.g. 'e1', 'e2'). Required for click, type, hover, select_option, upload_file."
            },
            obs_id: {
              type: 'string',
              description: "The observation ID from brave_observe (e.g. 'obs_1710928...'). Recommended to prevent stale element misclicks."
            },
            text: {
              type: 'string',
              description: "Text to type into input or textarea (required for action 'type')"
            },
            pressEnter: {
              type: 'boolean',
              description: "Whether to press Enter immediately after typing (useful for search inputs)",
              default: false
            },
            key: {
              type: 'string',
              description: "Keyboard key to press for action 'press' (e.g. 'Enter', 'Tab', 'Escape', 'ArrowDown')"
            },
            direction: {
              type: 'string',
              enum: ['down', 'up', 'top', 'bottom'],
              description: "Scroll direction for action 'scroll' (default 'down')",
              default: 'down'
            },
            amount: {
              type: 'integer',
              description: "Scroll amount in pixels (default 500)",
              default: 500
            },
            value: {
              type: 'string',
              description: "Option value to select for action 'select_option'"
            },
            filePaths: {
              type: 'array',
              items: { type: 'string' },
              description: "Array of absolute local file paths for action 'upload_file'"
            },
            includeScreenshot: {
              type: 'boolean',
              description: "Whether to include post-action screenshot in receipt (default true)",
              default: true
            }
          }
        }
      },
      {
        name: 'brave_batch_act',
        description:
          'Executes an array of sequential browser actions in a single tool call without multi-turn LLM loops. ' +
          'Saves significant conversation context tokens and eliminates round-trip latency.',
        inputSchema: {
          type: 'object',
          required: ['actions'],
          properties: {
            actions: {
              type: 'array',
              items: { type: 'object' },
              description: 'List of action objects (same parameters as brave_act: action, ref, obs_id, text, etc.)'
            },
            target: {
              type: 'string',
              enum: ['agent', 'user'],
              description: 'Target window (default: "agent")',
              default: 'agent'
            },
            tabIndex: {
              type: 'integer',
              description: 'Optional specific tab index'
            },
            includeScreenshot: {
              type: 'boolean',
              description: 'Whether to include final post-action screenshot (default false)',
              default: false
            }
          }
        }
      },
      {
        name: 'brave_eval',
        description:
          'Executes JavaScript expression in the targeted Brave tab and returns the evaluated result directly. ' +
          'Ideal for high-speed scraping, bulk extractions, or direct DOM manipulation with zero token observation overhead.',
        inputSchema: {
          type: 'object',
          required: ['script'],
          properties: {
            script: {
              type: 'string',
              description: 'JavaScript code or expression to evaluate (e.g. "document.title" or "Array.from(document.querySelectorAll(\'a\')).map(a => a.href)")'
            },
            target: {
              type: 'string',
              enum: ['agent', 'user'],
              description: 'Target window (default: "agent")',
              default: 'agent'
            },
            tabIndex: {
              type: 'integer',
              description: 'Optional specific tab index'
            }
          }
        }
      },
      {
        name: 'brave_navigate',
        description:
          'Navigates the targeted Brave tab to a new URL, reloads, or navigates back/forward. ' +
          'By default navigates inside the isolated Agent Workspace window, completely preserving the user\'s personal browsing tabs.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: "Destination URL (e.g. 'https://github.com'). Required for action 'goto'."
            },
            target: {
              type: 'string',
              enum: ['agent', 'user'],
              description: 'Target window: "agent" (default: isolated agent window) or "user" (user\'s personal window)',
              default: 'agent'
            },
            tabIndex: {
              type: 'integer',
              description: 'Optional specific tab index to navigate'
            },
            action: {
              type: 'string',
              enum: ['goto', 'reload', 'back', 'forward'],
              description: "Navigation action (default 'goto')",
              default: 'goto'
            },
            timeout: {
              type: 'integer',
              description: 'Navigation timeout in milliseconds (default 15000)',
              default: 15000
            }
          }
        }
      }

    ]
  };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'brave_tabs': {
        const action = args?.action || 'list';

        if (action === 'list') {
          const tabs = await brave.listTabs();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ tabs, count: tabs.length }, null, 2)
              }
            ]
          };
        }

        if (action === 'switch') {
          if (args.index === undefined) {
            throw new Error("Parameter 'index' is required for action 'switch'.");
          }
          const page = await brave.setActivePage(args.index, { bringToFront: args.bringToFront ?? false });
          const title = await page.title().catch(() => '');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, activeTabIndex: args.index, title, url: page.url() }, null, 2)
              }
            ]
          };
        }

        if (action === 'new') {
          const page = await brave.newTab(args.url || 'about:blank');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, url: page.url() }, null, 2)
              }
            ]
          };
        }

        if (action === 'focus') {
          const targetIndex = args.index !== undefined ? args.index : null;
          const page = await brave.getTargetPage('active', targetIndex);
          await page.bringToFront().catch(() => {});
          const title = await page.title().catch(() => '');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, message: 'Tab brought to front', title, url: page.url() }, null, 2)
              }
            ]
          };
        }

        if (action === 'close') {
          if (args.index === undefined) {
            throw new Error("Parameter 'index' is required for action 'close'.");
          }
          await brave.closeTab(args.index);
          const tabs = await brave.listTabs();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, closedIndex: args.index, remainingTabs: tabs }, null, 2)
              }
            ]
          };
        }

        throw new Error(`Unknown tabs action '${action}'.`);
      }

      case 'brave_observe': {
        const page = await brave.getTargetPage(args?.target || 'agent', args?.tabIndex);
        const observation = await observer.observe(page, {
          includeScreenshot: args?.includeScreenshot ?? false,
          maxElements: args?.maxElements ?? 60,
          format: args?.format || 'compact',
          scope: args?.scope || null,
          filter: args?.filter || 'interactive'
        });

        const content = [
          {
            type: 'text',
            text: JSON.stringify(
              {
                obs_id: observation.obs_id,
                target: args?.target || 'agent',
                tab: observation.tab,
                page: observation.page,
                format: observation.format,
                element_count: observation.element_count,
                elements: (observation.format === 'compact') ? observation.elements_compact : observation.elements
              },

              null,
              2
            )
          }
        ];

        if (observation.screenshot) {
          content.push({
            type: 'text',
            text: `[Screenshot attached: ${observation.screenshot.slice(0, 100)}... (${observation.screenshot.length} chars)]`
          });
        }

        return { content };
      }

      case 'brave_eval': {
        if (!args?.script) {
          throw new Error("Parameter 'script' is required for action 'brave_eval'.");
        }
        const page = await brave.getTargetPage(args?.target || 'agent', args?.tabIndex);
        const result = await page.evaluate(args.script);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'Evaluated',
                  target: args?.target || 'agent',
                  result
                },
                null,
                2
              )
            }
          ]
        };
      }

      case 'brave_batch_act': {
        if (!args?.actions || !Array.isArray(args.actions) || args.actions.length === 0) {
          throw new Error("Parameter 'actions' (non-empty array of action objects) is required for 'brave_batch_act'.");
        }
        const page = await brave.getTargetPage(args?.target || 'agent', args?.tabIndex);
        const receipts = [];

        for (let i = 0; i < args.actions.length; i++) {
          const isLast = i === args.actions.length - 1;
          const actionArgs = {
            ...args.actions[i],
            includeScreenshot: isLast ? (args.includeScreenshot ?? false) : false
          };
          const receipt = await actionEngine.execute(page, actionArgs, { suppressInvalidate: !isLast });
          receipts.push({
            step: i + 1,
            action: receipt.action,
            executed: receipt.executed,
            changes: receipt.changes
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'Batch Executed',
                  target: args?.target || 'agent',
                  steps_completed: receipts.length,
                  receipts
                },
                null,
                2
              )
            }
          ]
        };
      }

      case 'brave_act': {
        const page = await brave.getTargetPage(args?.target || 'agent', args?.tabIndex);
        const receipt = await actionEngine.execute(page, args);

        const content = [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'Action Executed',
                target: args?.target || 'agent',
                receipt: {
                  action: receipt.action,
                  executed: receipt.executed,
                  before: receipt.before,
                  after: receipt.after,
                  changes: receipt.changes
                }
              },
              null,
              2
            )
          }
        ];

        if (receipt.screenshot) {
          content.push({
            type: 'text',
            text: `[Post-action screenshot: ${receipt.screenshot.slice(0, 100)}... (${receipt.screenshot.length} chars)]`
          });
        }

        return { content };
      }

      case 'brave_navigate': {

        const page = await brave.getTargetPage(args?.target || 'agent', args?.tabIndex);
        const action = args?.action || 'goto';
        const timeout = args?.timeout || 15000;

        let beforeUrl = page.url();
        let status = 'navigated';

        if (action === 'goto') {
          if (!args.url) throw new Error("Parameter 'url' is required for action 'goto'.");
          let targetUrl = args.url;
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('about:')) {
            targetUrl = `https://${targetUrl}`;
          }
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
        } else if (action === 'reload') {
          await page.reload({ waitUntil: 'domcontentloaded', timeout });
        } else if (action === 'back') {
          await page.goBack({ waitUntil: 'domcontentloaded', timeout });
        } else if (action === 'forward') {
          await page.goForward({ waitUntil: 'domcontentloaded', timeout });
        }

        observer.invalidate();
        const afterUrl = page.url();
        const title = await page.title().catch(() => '');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  target: args?.target || 'agent',
                  action,
                  status,
                  beforeUrl,
                  afterUrl,
                  title
                },
                null,
                2
              )
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${err.message}`
        }
      ]
    };
  }
});

// Start stdio transport
async function main() {
  await globalTelemetry.start();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in brave-mcp server:", error);
  process.exit(1);
});
