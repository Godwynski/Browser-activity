# Universal Browser Control Runtime — Architecture

## Overview

This document describes the target architecture for the Universal Browser Control Runtime.
The goal is to provide an extensible, browser-agnostic layer that allows AI agents (Gemini CLI / Antigravity)
to control any supported browser and interact with arbitrary websites through a small, efficient, reliable interface.

The system must NOT be designed around any specific website.

---

## System Layers

```
┌─────────────────────────────────────────────────┐
│           Gemini CLI / Antigravity              │
│          (consumer — calls MCP tools)           │
└──────────────────┬──────────────────────────────┘
                   │ MCP (stdio / JSON-RPC)
                   ▼
┌─────────────────────────────────────────────────┐
│          Universal Browser MCP Server           │
│   src/mcp/server.js  —  5 coherent tools:       │
│   browser · inspect · act · extract · evaluate  │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│            Browser Runtime Core                 │
│         src/core/browser-runtime.js             │
│   Stateless orchestration; delegates to adapter │
└────┬────────────────┬───────────────────────────┘
     │                │
     ▼                ▼
┌──────────┐   ┌──────────────┐   ┌───────────────┐
│Chromium  │   │ WebDriver    │   │  Extension    │
│Adapter   │   │ BiDi Adapter │   │  Adapter      │
│(CDP/PW)  │   │ (Firefox)    │   │ (bridge)      │
└────┬─────┘   └──────────────┘   └───────────────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│           Browser Runtime Subsystems            │
│                                                 │
│  Observation   Actions    Extraction            │
│  (observer)    (actions)  (extractor)           │
│       │            │          │                 │
│       └────────────┼──────────┘                 │
│                    ▼                            │
│            Element Ref Registry                 │
│         (server-side ID → candidate map)        │
│                    │                            │
│                    ▼                            │
│           Verification Layer                    │
│         (receipts + state diff)                 │
└─────────────────────────────────────────────────┘
```

---

## Core Principle

The AI agent thinks in terms of browser primitives, not websites:

```
✅ AI → browser → tab → element ref → action → receipt
❌ AI → "find the Google Drive upload button"
```

The runtime understands:
- `button`, `link`, `textbox`, `checkbox`, `radio`, `combobox`, `dialog`, `table`
- `tab`, `window`, `iframe`, `shadow root`
- `navigate`, `click`, `type`, `scroll`, `hover`, `select`, `upload`, `download`

It does NOT understand:
- Facebook login buttons
- Google Drive selectors
- STI ELMS assignments
- Any website-specific element

---

## Directory Structure

```
Browser-activity/
│
├── src/
│   ├── core/
│   │   ├── base-adapter.js     ← Abstract adapter interface (Phase 1)
│   │   ├── browser-runtime.js  ← Orchestration layer (Phase 1)
│   │   ├── errors.js           ← Standardized error types (Phase 1)
│   │   └── index.js            ← Core barrel export (Phase 1)
│   │
│   ├── adapters/
│   │   ├── index.js            ← Adapters barrel (Phase 1 stub)
│   │   ├── chromium.js         ← Chromium CDP adapter (Phase 2)
│   │   ├── bidi.js             ← WebDriver BiDi adapter (Phase 6)
│   │   └── extension.js        ← Extension bridge adapter (Phase 7)
│   │
│   ├── observation/            ← Progressive observation engine (Phase 3)
│   ├── actions/                ← Action executor + wait system (Phase 4)
│   ├── extraction/             ← Structured data extractors (Phase 5)
│   ├── dialogs/                ← Dialog handlers (Phase 5)
│   ├── downloads/              ← Download tracking (Phase 5)
│   ├── screenshots/            ← Screenshot utilities (Phase 3/5)
│   ├── verification/           ← State diff + action receipts (Phase 4)
│   └── mcp/                    ← Universal MCP server (Phase 8)
│
├── brave-mcp/                  ← PRESERVED: existing Brave MCP (Phase 0–7)
│   ├── src/                    ← Existing source (do not break)
│   └── test/                   ← Existing tests (must keep passing)
│
├── examples/                   ← Website-specific workflows (not core)
│   ├── google-drive/
│   ├── elms/
│   └── social/
│
├── tests/
│   ├── core/                   ← Interface contract tests (Phase 1)
│   ├── adapters/               ← Adapter protocol tests (Phase 2+)
│   ├── observation/            ← Observation engine tests (Phase 3)
│   ├── actions/                ← Action engine tests (Phase 4)
│   └── extraction/             ← Extraction tests (Phase 5)
│
├── test-sites/                 ← Deterministic local test pages
│   ├── basic/                  ← All-in-one test fixture (Phase 1)
│   ├── forms/                  ← Form-specific scenarios (Phase 3+)
│   ├── dynamic/                ← SPA mutation scenarios
│   ├── spa/                    ← Full SPA simulation
│   ├── iframe/                 ← Same/cross-origin iframe tests
│   ├── shadow-dom/             ← Open/nested shadow roots
│   ├── modal/                  ← Overlay and dialog tests
│   ├── dropdown/               ← Custom dropdown components
│   ├── table/                  ← Large, dynamic table tests
│   ├── upload/                 ← File input tests
│   ├── download/               ← Download trigger tests
│   ├── popup/                  ← window.open / target=_blank
│   ├── contenteditable/        ← Rich text editor tests
│   ├── infinite-scroll/        ← Lazy-loading lists
│   ├── lazy-load/              ← Intersection-observer content
│   └── canvas/                 ← Canvas / non-semantic elements
│
├── benchmarks/                 ← Token measurement benchmarks (Phase 9)
├── cli/                        ← CLI entrypoint (Phase 8)
├── docs/                       ← Architecture & integration docs
├── skills/                     ← Gemini / Antigravity skill files (Phase 8)
│
├── brave-launcher/             ← Browser launchers (preserved)
├── brave-extension/            ← Companion extension (refactored Phase 7)
│
├── AGENTS.md                   ← Developer rules & anti-wandering constraints
├── PROJECT_STATE.json          ← Phase tracking & test status
├── package.json                ← Root workspace scripts
└── README.md                   ← Project documentation
```

---

## Adapter Interface

All adapters extend `BaseBrowserAdapter` from `src/core/base-adapter.js`.

### Contract Methods

| Category | Method | Description |
| :--- | :--- | :--- |
| **Connection** | `connect(config)` | Attach or launch the browser |
| | `disconnect()` | Release all resources |
| | `isConnected()` | Connection state check |
| **Tabs** | `listTabs()` | List all open tabs |
| | `getTab(id)` | Get a specific tab |
| | `createTab(url)` | Open a new tab |
| | `closeTab(id)` | Close a tab |
| | `activateTab(id)` | Focus a tab |
| **Navigation** | `navigate(tabId, url)` | Go to URL |
| | `goBack(tabId)` | Browser history back |
| | `goForward(tabId)` | Browser history forward |
| | `reload(tabId)` | Reload current page |
| **Observation** | `inspect(tabId, options)` | Progressive page inspection |
| **Actions** | `click(tabId, ref)` | Click an element |
| | `type(tabId, ref, text)` | Type into an element |
| | `press(tabId, key)` | Press a keyboard key |
| | `scroll(tabId, options)` | Scroll page or element |
| | `hover(tabId, ref)` | Hover over an element |
| | `select(tabId, ref, value)` | Select a dropdown option |
| | `upload(tabId, ref, filePaths)` | Set file input files |
| **Waiting** | `waitFor(tabId, condition)` | Event-driven condition wait |
| **Extraction** | `extract(tabId, type)` | Structured data extraction |
| **Screenshot** | `screenshot(tabId, options)` | Viewport / element capture |
| **Evaluation** | `evaluate(tabId, script)` | JavaScript execution (escape hatch) |

### Capability Flags

Each adapter declares what it supports via the `capabilities` object in its constructor:

```js
super('chromium', {
  attachMode:         true,
  managedMode:        true,
  iframes:            true,
  shadowDom:          true,
  popups:             true,
  downloads:          true,
  uploads:            true,
  dialogs:            true
});
```

Unsupported operations throw `UnsupportedOperationError`. They never silently fail.

---

## MCP Interface (Phase 8 Target)

Five coherent, composable tools:

### `browser`
Browser and session-level operations.
- `action`: `list_tabs` | `create_tab` | `close_tab` | `activate_tab` | `navigate` | `back` | `forward` | `reload` | `status`
- `tabId`: Target tab identifier
- `url`: Navigation URL

### `inspect`
Page observation at any progressive level.
- `tabId`: Target tab
- `level`: `0` (status) | `1` (compact, default) | `2` (targeted) | `3` (full) | `4` (screenshot)
- `scope`: CSS selector to narrow observation
- `query`: Text/semantic search (level 2)
- `filter`: `interactive` | `inputs` | `buttons_links` | `all`

### `act`
Browser actions. Supports batching.
```json
{
  "tabId": "t1",
  "actions": [
    { "type": "click",  "ref": "e2" },
    { "type": "type",   "ref": "e5", "text": "hello" },
    { "type": "press",  "key": "Enter" }
  ]
}
```

### `extract`
Structured page data extraction.
- `tabId`: Target tab
- `type`: `text` | `links` | `table` | `form` | `structured`
- `scope`: CSS selector

### `evaluate`
JavaScript evaluation escape hatch.
- `tabId`: Target tab
- `script`: JavaScript expression

> **Backward compatibility**: The existing 6 `brave_*` tools will be preserved as
> aliases during the Phase 8 migration. No existing Antigravity workflows will break.

---

## Progressive Observation Levels

The observation system minimizes token cost by returning the smallest useful amount of context.

| Level | Name | Returns | Token Cost |
| :--- | :--- | :--- | :--- |
| 0 | Minimal State | `url`, `title`, `readyState`, `viewport`, `scroll` | Lowest |
| 1 | Compact Interactive | Compact 1-line element refs (default) | Low |
| 2 | Targeted | Elements matching a query | Medium |
| 3 | Full | All elements including off-screen | High |
| 4 | Screenshot | Visual viewport capture | Highest |

Level 1 example output:
```
[e1] button "Search"
[e2] textbox "Search" value="query"
[e3] link "Settings"
[e4] combobox "Language"
```

---

## Element References

The runtime maintains a server-side element registry. When `inspect()` is called:

1. Elements are discovered from the ARIA tree and DOM.
2. Each element is assigned an ephemeral ref (`e1`, `e2`, ...).
3. The registry stores candidate fingerprints (role, name, placeholder, ID, nameAttr, bounding box).
4. The AI receives only the compact ref list.
5. When an action uses a ref, the registry resolves it to a Playwright locator.

### Stale Reference Recovery

When a ref is stale (page mutated, navigation occurred):

1. Attempt semantic recovery using stored candidates:
   - role + accessible name
   - label text
   - placeholder
   - stable DOM ID
   - name attribute
   - visible text content
   - spatial / contextual relationship

2. If **exactly one** candidate matches: auto-recover silently.
3. If **multiple** candidates match: return `AMBIGUOUS_TARGET` error.
4. If **zero** candidates match: return `STALE_REF` error.

---

## Error Format

All errors follow a machine-readable, actionable format:

```
ACTION_FAILED
ref=e4
reason=element_not_found
suggestion=inspect
```

```
STALE_REF
ref=e4
recovery=failed
suggestion=inspect
```

```
AMBIGUOUS_TARGET
query=Submit
matches=3
suggestion=inspect
```

Errors must guide the AI toward a corrective action. Stack traces are stored internally
and available on request; they are never dumped into the AI context by default.

---

## Connection Modes

### Mode A — Attach
Connect to an existing browser with `--remote-debugging-port` exposed.
```js
await runtime.connect({ mode: 'attach', port: 9222 });
```
Used when: the user runs Brave/Chrome with CDP enabled (existing workflow).

### Mode B — Managed
Launch a browser with a dedicated automation profile.
```js
await runtime.connect({
  mode: 'managed',
  executablePath: '/path/to/chrome',
  headless: true
});
```
Used when: deterministic test execution, isolated sessions.

### Mode C — Extension Bridge
A browser extension bridges page-level controls to a local native message host.
Used when: remote debugging port cannot be opened (restricted environments).
Limitation: cannot perform browser-level operations (download interception, dialog handling).

---

## Security Principles

- All control endpoints bind to `127.0.0.1` only (never `0.0.0.0`).
- Session tokens use ephemeral `crypto.randomBytes(24)` keys stored in `artifacts/`.
- Cookies, authentication tokens, and passwords are never logged.
- Sensitive page content is not stored unless explicitly requested.
- The `read-only` mode (Phase 8) restricts all write actions (`click`, `type`, etc.).

---

## Token Budget Guidelines

| Operation | Approximate Token Cost |
| :--- | :--- |
| Level 0 inspect (status only) | ~10 tokens |
| Level 1 inspect (compact, 30 elements) | ~150–300 tokens |
| Level 2 inspect (targeted query) | ~30–100 tokens |
| extract text | ~100–500 tokens (content dependent) |
| extract table (10 rows × 4 cols) | ~200 tokens |
| Level 4 inspect (screenshot, 1280×800) | ~3,000–6,000 tokens |

**Default**: Level 1. Screenshots must be explicitly requested.

---

## Phase Status

| Phase | Name | Status |
| :--- | :--- | :--- |
| Phase 0 | Repository Audit | ✅ Complete |
| Phase 1 | Architecture Foundation | 🔄 In Progress |
| Phase 2 | Chromium Adapter | ⏳ Pending |
| Phase 3 | Observation Engine | ⏳ Pending |
| Phase 4 | Action Engine | ⏳ Pending |
| Phase 5 | Extraction & Advanced Features | ⏳ Pending |
| Phase 6 | Firefox / BiDi Adapter | ⏳ Pending |
| Phase 7 | Extension Bridge | ⏳ Pending |
| Phase 8 | Universal MCP & CLI | ⏳ Pending |
| Phase 9 | Token Optimization | ⏳ Pending |
| Phase 10 | Adversarial Testing | ⏳ Pending |
| Phase 11 | Final Audit & Release | ⏳ Pending |
