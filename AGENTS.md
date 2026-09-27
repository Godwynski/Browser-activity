# Agent Instructions & Developer Standards: Browser Activity (`brave-mcp`)

## 🌐 Workspace Overview & Purpose
This workspace is the dedicated developer repository for **Evidence-Grounded Brave Browser Agent (`brave-mcp`)**, the Chrome DevTools Protocol (CDP) bridge connecting AI agents (Antigravity / Gemini) directly to your running **Brave Browser**.

### ⚠️ Workspace Separation Notice: Where is Coursework?
> [!IMPORTANT]
> **Academic Coursework Decoupled**:
> All STI College coursework, subject folders, assignments, and academic skills have been separated into a dedicated workspace:
> 👉 **`C:\Users\Godwyn\Documents\Projects\STI-College`**
> 
> When working in this repository (`Browser activity`), the AI agent must **never** look for coursework or create assignment files. This repository is strictly for browser infrastructure and web automation engineering.

---

## 🏛️ Repository Architecture

```
Browser activity/
├── brave-mcp/                     # MCP Server & CDP Bridge Engine
│   ├── src/                       # Core engine: browser.js, observer.js, actions.js, verifier.js, index.js
│   ├── scripts/                   # Modular automation scripts (cdp, gdrive, social, scratch)
│   ├── test/                      # Comprehensive test batteries
│   └── run-mcp.cmd                # Launcher script called by global mcp_config.json
├── brave-launcher/                # Scripts to start Brave with CDP debugging flags
│   ├── launch-brave.cmd           # Batch launcher (double-click)
│   ├── launch-brave.ps1           # PowerShell launcher
│   └── create-connected-shortcut.ps1 # Permanent desktop shortcut generator
├── brave-extension/               # Browser extension companion & floating HUD
│   ├── manifest.json              # Manifest V3 extension
│   ├── background.js              # Service worker
│   ├── content/                   # Floating Mission Control HUD
│   └── popup/                     # Extension popup controls
├── artifacts/                     # Ephemeral runtime screenshots, receipts, test runs (gitignored)
└── .agents/skills/
    └── website-automator/         # Skill generator template for recurring browser tasks
```

---

## 🛡️ Critical Agent Directives (Zero Tolerance)

### 1. Targeted Reading & Zero Wandering (STRICT)
- **Do NOT read everything**: Never execute exploratory directory scans (`list_dir` on root, `.agents`, or parent folders) unless the user explicitly requests an inspection of project structure.
- **Targeted Reading Only**: Only read files that are directly referenced by the user or are strictly necessary for the immediate code edit.
- **Never Crawl External Folders**: Never attempt to find or crawl coursework folders from this repository.

### 2. Never Open Secondary Browser Instances
- The user's personal Brave browser is already running and connected via remote debugging port **9222**.
- **NEVER** launch an `AgentProfile` or spawn secondary browser windows.
- Always attach to the existing CDP session or use the registered `brave-control` MCP tools.

### 3. Scripts Organization Mandate
All scripts must be placed in their appropriate subdirectory under `brave-mcp/scripts/`:
- `brave-mcp/scripts/cdp/`: Port 9222 health checks and CDP diagnostics.
- `brave-mcp/scripts/gdrive/`: Google Drive automation and file management.
- `brave-mcp/scripts/social/`: Social media and interaction automations.
- `brave-mcp/scripts/scratch/`: One-off experimental scripts.
- **NEVER** dump ad-hoc `.js`, `.py`, `.sh`, or `.cmd` scripts into the root workspace folder.

### 4. Clean Git Standards
- Keep `node_modules/`, `__pycache__`, temporary logs, test receipts, and screenshots out of git.
- Check `git status --short` before concluding any development task.

---

## 🛠️ The 7 Core MCP Tools (`brave-control`)

Antigravity controls Brave via the following 7 MCP tools registered in `C:\Users\Godwyn\.gemini\config\mcp_config.json`:

| Tool | Primary Purpose | Key Parameters |
| :--- | :--- | :--- |
| `brave_tabs` | Manage and inspect open tabs | `action` (`list`, `switch`, `new`, `new_window`, `close`, `focus`), `index`, `url` |
| `brave_observe` | Extract hybrid spatial DOM/ARIA state with minimal token footprint | `target` (`agent` / `user`), `scope`, `filter`, `format` (`compact`/`json`), `includeScreenshot` |
| `brave_read` | Dedicated zero-DOM article and table extraction as clean Markdown | `target`, `scope`, `maxLength` (saves ~90% tokens on reading tasks) |
| `brave_act` | Perform browser actions with automatic compound observation | `action`, `ref` (ephemeral ID e.g. `e1`), `text`, `and_observe` (default `true`) |
| `brave_batch_act` | Execute multiple actions sequentially without LLM loops | `actions` (array of action objects), `and_observe` (default `true`), `target` |
| `brave_eval` | Execute direct in-page JavaScript for instant zero-token scraping | `script` (JS string), `target` |
| `brave_navigate` | Direct tab navigation | `url`, `action` (`goto`, `reload`, `back`, `forward`), `target` |

---

## 🧪 Testing & Verification Protocol

When modifying `brave-mcp`, always run the test battery to verify that protocol contracts, co-browsing isolation, and token optimizations remain intact:

```bash
cd brave-mcp
npm test               # Run live CDP diagnostic test
npm run test:battery   # 14-point critical guarantee test battery
npm run test:tokens    # Token reduction & batch action tests
npm run test:cobrowse  # Window isolation & co-browsing test
npm run test:all       # Run entire comprehensive test suite
```
