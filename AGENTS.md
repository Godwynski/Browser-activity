# Agent Instructions & Developer Standards (Browser Activity)

## 🌐 Project Purpose
This repository is the developer workspace for **Evidence-Grounded Brave Browser Agent (`brave-mcp`)**, the Chrome DevTools Protocol (CDP) bridge, Brave launcher scripts, and browser companion extensions.

---

## 🛡️ Critical Rules for all AI Coding Agents:

### 1. Targeted Reading & Zero Wandering (STRICT)
- **Do NOT read everything**: Never run exploratory directory listings (`list_dir` on root, `.agents`, or config directories) unless explicitly requested by the user.
- **Targeted Reading Only**: Only view the specific file(s) the user referenced or has currently open. Do not proactively inspect skills, rules, or unrelated files.

### 2. Never Open Secondary Browser Instances
- The user's Brave browser is already running and connected via remote debugging port 9222.
- Never launch `AgentProfile` or spawn secondary browser windows. Always attach to the existing connected session.

### 3. Scripts Organization
- Scripts must be categorized under `brave-mcp/scripts/{cdp, gdrive, social, scratch}`.
- Never dump ad-hoc `.js` or `.py` scripts into the root folder.

### 4. Clean Git Status
- Keep `node_modules/`, `__pycache__`, and temporary test artifacts out of git tracking.
