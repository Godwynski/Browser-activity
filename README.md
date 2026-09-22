# Evidence-Grounded Brave Browser Agent (`brave-mcp`)

Direct, unrestricted browser control bridge connecting **Antigravity / Gemini** to your personal **Brave Browser** via Playwright and the Chrome DevTools Protocol (CDP).

---

## 🌟 Features

- **Full Personal Profile**: Preserves all your existing logins, bookmarks, extensions, crypto wallets, and active cookies.
- **Parallel Co-Browsing (Zero Interruption)**: Operates in a dedicated, isolated Agent Window. You can browse, read, and type freely on your personal tabs while the AI navigates and automates in parallel without stealing focus.
- **Brave Shields**: Automatically blocks disruptive ads, cookie consent popups, and tracker redirects that confuse AI agents.
- **Tri-Source Observation**: Combines DOM attributes, clean ARIA accessibility tree, and viewport screenshots.
- **Ephemeral Element References (`e1`, `e2`, ...)**: Eliminates guessing minified CSS selectors. References are dynamically mapped and automatically invalidated upon page navigation to prevent misclicks.
- **Action Receipts & State Diffing**: Every action produces an evidence-grounded receipt comparing before/after state (URL change, title change, DOM mutations, and post-action screenshot).
- **Zero Confirmation Friction**: Direct autonomous execution across tabs, forms, navigation, and inputs.

---

## 🚀 Quick Start

### 1. Launch Brave with Remote Debugging
Before Antigravity can connect, Brave must be started with `--remote-debugging-port=9222`.

Run the batch launcher:
```cmd
brave-launcher\launch-brave.cmd
```
Or via PowerShell:
```powershell
.\brave-launcher\launch-brave.ps1
```
> **Tip**: If Brave is currently running, the launcher will offer to restart it with `--restore-last-session`, preserving all your open tabs and logins.

### 2. Antigravity Configuration
The MCP server is registered in your global Antigravity configuration:
`C:\Users\Godwyn\.gemini\config\mcp_config.json`

```json
{
  "mcpServers": {
    "brave-control": {
      "command": "node",
      "args": [
        "c:/Users/Godwyn/Documents/Projects/Browser activity/brave-mcp/src/index.js"
      ]
    }
  }
}
```

### 3. Verification Tests
Run the entire test battery (Protocol, 14-point Battery, Token Optimizations, Co-Browsing Isolation, Live CDP):
```bash
cd brave-mcp
npm run test:all
```

Or run individual test suites:
```bash
npm run test:battery   # 14-point critical guarantee test battery
npm run test:tokens    # Token reduction, compact format & batch actions
npm run test:cobrowse  # Window isolation & co-browsing verification
npm test               # Live CDP diagnostic test
```

---

## 🛠️ The 6 Core MCP Tools
 
### 1. `brave_tabs`
Manage and inspect open tabs in Brave, differentiating between your personal tabs and the Agent Window.
- `action`: `"list"` (default), `"switch"`, `"new"`, `"new_window"`, `"close"`, `"focus"`
- `index`: Tab index (0-based)
- `url`: Destination URL for new tabs or windows
- `bringToFront`: boolean (default `false` to avoid stealing user focus)

### 2. `brave_observe` (Token-Optimized)
Inspect the targeted Brave tab and extract structured ground truth with minimal token footprint.
- `target`: `"agent"` (default: isolated agent window) or `"user"` (user's active browsing tab)
- `tabIndex`: Optional specific tab index
- `format`: `"compact"` (default, dense 1-line syntax saving ~65% tokens) or `"json"`
- `scope`: CSS selector to restrict observation (e.g. `"main"`, `"#content"`, `"form"`)
- `filter`: `"interactive"` (default), `"inputs"`, `"buttons_links"`, `"all"`
- `includeScreenshot`: boolean (default `false` for fast reasoning)
- `maxElements`: integer (default `60`)
- **Returns**: `obs_id`, page title, URL, viewport dimensions, interactive elements, and base64 screenshot.

### 3. `brave_act`
Execute an autonomous, browser-native action against the targeted tab.
- `action`: `"click"`, `"type"`, `"press"`, `"scroll"`, `"hover"`, `"select_option"`, `"upload_file"`
- `target`: `"agent"` (default) or `"user"`
- `tabIndex`: Optional specific tab index
- `ref`: Ephemeral element ID from `brave_observe` (e.g. `"e1"`)
- `text`: Text to type into an input
- `pressEnter`: Press Enter after typing (useful for searches)
- `key`: Key name (`"Enter"`, `"Tab"`, `"Escape"`, `"ArrowDown"`)
- `direction`: `"down"`, `"up"`, `"top"`, `"bottom"`
- `amount`: Scroll pixels (default `500`)
- **Returns**: An **Action Receipt** with before/after state diff and post-action screenshot.

### 4. `brave_batch_act` (Multi-Action Fast Execution)
Executes a sequence of browser actions in a single tool call without multi-turn LLM reasoning loops.
- `actions`: Array of action objects (same schema as `brave_act`)
- `target`: `"agent"` (default) or `"user"`
- **Returns**: Array of step receipts verifying all actions executed sequentially.

### 5. `brave_eval` (Direct In-Page JavaScript)
Directly evaluates JavaScript in the targeted tab and returns the result. Ideal for high-speed scraping or bulk actions with zero token observation overhead.
- `script`: JavaScript code string (e.g. `"document.title"` or `"Array.from(document.querySelectorAll('a')).map(a => a.href)"`)
- `target`: `"agent"` (default) or `"user"`

### 6. `brave_navigate`
Navigate the targeted Brave tab directly.
- `url`: Target web address (e.g. `"https://github.com"`)
- `target`: `"agent"` (default) or `"user"`
- `tabIndex`: Optional specific tab index
- `action`: `"goto"` (default), `"reload"`, `"back"`, `"forward"`

---

## ⚡ Zero-Token Antigravity Skills (`.agents/skills/`)

For recurring tasks, Antigravity executes deterministic background scripts with **zero LLM tool calling loops** (slashing token usage from ~35,000 tokens to ~200 tokens):

1. **STI ELMS Skill** (`.agents/skills/sti-elms/`):
   - List classes: `node .agents/skills/sti-elms/scripts/elms-cli.js --list`
   - Download subject: `node .agents/skills/sti-elms/scripts/elms-cli.js --subject "Game Development"`
   - Download all: `node .agents/skills/sti-elms/scripts/elms-cli.js --all`
2. **Website Automator** (`.agents/skills/website-automator/`):
   - Playbook and template for scaffolding new zero-token skills for Canvas, GitHub, portals, and LMS platforms.

---

## 📁 Project Architecture

```
c:/Users/Godwyn/Documents/Projects/Browser activity/
├── .agents/skills/
│   ├── sti-elms/                  # STI ELMS fast automation skill & CLI
│   └── website-automator/         # Skill generator template for any website
├── artifacts/                     # [GITIGNORED] Non-code runtime assets & downloads
│   ├── downloads/
│   │   ├── elms/                  # Organized ELMS course downloads (handouts & syllabi)
│   │   └── raw/                   # Default directory for unprompted browser downloads
│   ├── test-runs/                 # Automated test logs & execution outputs
│   ├── screenshots/               # Visual observation screenshots & action receipts
│   └── temp/                      # Ephemeral scratch fixtures (cleaned up per run)
├── brave-extension/
│   ├── manifest.json              # Chrome/Brave Manifest V3 extension definition
│   ├── background.js              # Service worker hot-reloader
│   ├── popup/                     # Mission Control popup UI & trigger actions
│   ├── content/                   # Floating in-page Mission Control HUD & auto-assignment scanner
│   └── elms-antigravity-hud.user.js # Standalone Tampermonkey/Violentmonkey script bundle
├── brave-launcher/
│   ├── launch-brave.ps1           # Starts Brave with CDP port 9222 and user profile
│   ├── launch-brave.cmd           # Double-click batch launcher
│   └── create-connected-shortcut.ps1 # Permanent desktop shortcut generator
├── brave-mcp/
│   ├── package.json               # Dependencies: @modelcontextprotocol/sdk, playwright-core, ws
│   ├── run-mcp.cmd                # Wrapper used by Antigravity MCP config to launch the server
│   ├── scripts/
│   │   ├── cdp/                   # CDP diagnostic & status inspection scripts
│   │   ├── elms/                  # ELMS automation, sync, and download-handouts.js
│   │   ├── gdrive/                # Google Drive organization & batch move automation
│   │   └── social/                # Social media automation scripts
│   ├── src/
│   │   ├── paths.js               # Centralized workspace path resolver & directory isolation
│   │   ├── browser.js             # Playwright CDP connection manager & download enforcement
│   │   ├── observer.js            # Tri-source observer (Compact text + Scoping + Filters)
│   │   ├── actions.js             # Direct action engine & multi-tier locators
│   │   ├── verifier.js            # State diffing & Action Receipt generator
│   │   ├── elms-checker.js        # Background assignment scraper & local status tracker
│   │   ├── telemetry-server.js    # Mission Control WebSocket & HTTP daemon
│   │   ├── telemetry.js           # Lightweight telemetry logging client
│   │   └── index.js               # MCP stdio server (6 core tools)
│   └── test/
│       ├── test-connection.js     # Live CDP diagnostic test
│       ├── test-mcp-protocol.js   # MCP stdio protocol test (6 tools verified)
│       ├── test-co-browsing.js    # Window isolation & co-browsing verification
│       ├── test-token-optimizations.js # Token savings, compact format, eval, batch test
│       └── test-battery.js        # 14-point automated test suite
├── .gitignore                     # Enforces separation of code vs runtime artifacts
└── README.md                      # Documentation
```

