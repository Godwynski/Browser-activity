---
name: website-automator
description: Playbook and scaffolding tool for creating ultra-fast, zero-token website skills for recurring browser tasks (Canvas, GitHub, portals, learning management systems).
---

# Website Automator Skill: Fast Zero-Token Skill Scaffolding

Use this skill when you want to automate recurring tasks on any website (e.g. Canvas, Jira, Google Classroom, arXiv, portals) with **maximum speed and near-zero token consumption**.

---

## 🚀 The Zero-Token Philosophy

Instead of asking an AI to visually read the page with `brave_observe` on every run (burning thousands of tokens):
1. **Analyze the website once**: Capture the URL patterns, auth cookies (from your existing Brave session), and DOM selectors.
2. **Package into a reusable script**: Place a Playwright script inside `.agents/skills/<site-name>/scripts/`.
3. **Register the Skill**: Document the trigger prompts in `.agents/skills/<site-name>/SKILL.md`.

---

## 🛠️ Step-by-Step: Creating a New Website Skill

### Step 1: Create the Skill Directory Structure
```
.agents/skills/<site-name>/
├── SKILL.md
└── scripts/
    └── <action>-cli.js
```

### Step 2: Write the Template Script (`scripts/<action>-cli.js`)
Use `BraveManager` from `brave-mcp` to ensure parallel co-browsing and login reuse:

```javascript
import { BraveManager } from '../../../../brave-mcp/src/browser.js';

async function run() {
  const brave = new BraveManager();
  // Automatically works in the separate Agent Window
  const page = await brave.getAgentPage({ autoCreate: true });

  await page.goto('https://target-website.com/dashboard', { waitUntil: 'domcontentloaded' });

  // Example: Extract data using in-page evaluation (0 tokens)
  const data = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.item')).map(el => el.innerText);
  });

  console.log("Results:", data);
}

run().catch(console.error);
```

### Step 3: Write `SKILL.md`
Define the YAML frontmatter and document trigger commands:
```markdown
---
name: <site-name>
description: Fast automated assistant for <site-name>. Handles <list of tasks> with 0 token overhead.
---

# <site-name> Automation

Run the CLI command:
\`\`\`bash
node .agents/skills/<site-name>/scripts/<action>-cli.js
\`\`\`
```

---

## 💡 Best Practices
- **Always use `brave.getAgentPage()`**: Guarantees your personal browsing window remains uninterrupted.
- **Use `page.evaluate()` for bulk extraction**: Scraping 100 items via `page.evaluate()` takes 200ms and costs 0 tokens.
- **Cache local files**: Check if files already exist before re-downloading to save bandwidth.
