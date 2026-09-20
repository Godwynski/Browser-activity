import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import { PATHS, ensureArtifactDirs } from './paths.js';

export class BraveManager {
  constructor(cdpUrl = 'http://127.0.0.1:9222') {
    this.cdpUrl = cdpUrl;
    this.browser = null;
    this.context = null;
    this.agentPage = null;
    ensureArtifactDirs();
  }

  /**
   * Enforces browser-level CDP download routing directly to the dedicated artifacts directory.
   */
  async _enforceBrowserDownloadBehavior(browserInstance) {
    if (!browserInstance) return;
    try {
      ensureArtifactDirs();
      const session = await browserInstance.newBrowserCDPSession();
      await session.send('Browser.setDownloadBehavior', {
        behavior: 'allowAndName',
        downloadPath: PATHS.downloadsRaw,
        eventsEnabled: true
      });
    } catch (err) {
      // Browser-level CDP session might not be supported on all versions; ignore if gracefully bypassed
    }
  }

  /**
   * Attaches page-level download isolation to route all downloads strictly into the artifacts directory.
   */
  async _setupPageDownloads(page, downloadDir = PATHS.downloadsRaw) {
    if (!page || page.isClosed()) return;
    try {
      ensureArtifactDirs();
      // CDP Page level routing
      const client = await page.context().newCDPSession(page);
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadDir
      }).catch(() => {});
    } catch (e) {}

    page.on('download', async (download) => {
      try {
        ensureArtifactDirs();
        const filename = download.suggestedFilename() || `download-${Date.now()}`;
        const targetPath = path.join(downloadDir, filename);
        await download.saveAs(targetPath);
      } catch (err) {
        console.warn(`[BraveManager] Page download capture error: ${err.message}`);
      }
    });
  }

  /**
   * Ensures connection to Brave over CDP or auto-launches Brave with persistent context.
   */
  async ensureConnected() {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }
    this.browser = null;

    if (this.context) {
      try {
        const b = this.context.browser();
        if (b && b.isConnected()) {
          return this.context;
        }
      } catch (e) {}
      this.context = null;
      this.agentPage = null;
    }

    // 1. Try connecting to already running Brave over CDP
    try {
      this.browser = await chromium.connectOverCDP(this.cdpUrl, { timeout: 2500 });
      await this._enforceBrowserDownloadBehavior(this.browser);
      return this.browser;
    } catch (e) {
      // CDP not listening yet, proceed to auto-launch
    }

    // 2. Auto-launch Brave with user profile
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    let braveExe = path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');
    if (!fs.existsSync(braveExe)) {
      const alt1 = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
      const alt2 = 'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
      if (fs.existsSync(alt1)) braveExe = alt1;
      else if (fs.existsSync(alt2)) braveExe = alt2;
    }
    const userData = path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data');

    try {
      this.context = await chromium.launchPersistentContext(userData, {
        executablePath: braveExe,
        headless: false,
        downloadsPath: PATHS.downloadsRaw,
        acceptDownloads: true,
        args: ['--remote-debugging-port=9222', '--remote-allow-origins=*']
      });
      return this.context;
    } catch (err) {
      // If primary profile is locked, fall back to AgentProfile
      const agentUserData = path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'AgentProfile');
      try {
        this.context = await chromium.launchPersistentContext(agentUserData, {
          executablePath: braveExe,
          headless: false,
          downloadsPath: PATHS.downloadsRaw,
          acceptDownloads: true,
          args: ['--remote-debugging-port=9222', '--remote-allow-origins=*']
        });
        return this.context;
      } catch (err2) {
        throw new Error(
          `Could not connect to or auto-launch Brave on ${this.cdpUrl}.\n` +
          `Ensure Brave is running with '--remote-debugging-port=9222'.\n` +
          `You can start it with: brave-launcher\\launch-brave.cmd\n` +
          `Details: ${err.message}`
        );
      }
    }
  }

  /**
   * Returns all available browser pages across contexts.
   */
  async getPages() {
    await this.ensureConnected();

    if (this.context) {
      try {
        let pages = this.context.pages().filter(p => !p.isClosed());
        if (pages.length === 0) {
          const p = await this.context.newPage();
          pages = [p];
        }
        return pages;
      } catch (err) {
        this.context = null;
        this.agentPage = null;
        await this.ensureConnected();
      }
    }

    if (!this.browser || !this.browser.isConnected()) {
      this.browser = null;
      await this.ensureConnected();
    }

    const contexts = this.browser ? this.browser.contexts() : [];
    const pages = [];
    for (const ctx of contexts) {
      for (const page of ctx.pages()) {
        if (!page.isClosed()) {
          pages.push(page);
        }
      }
    }
    return pages;
  }

  /**
   * Sets up event listeners on the agent page to track closures cleanly.
   */
  _setupAgentPageListeners(page) {
    if (!page) return;
    page.once('close', () => {
      if (this.agentPage === page) {
        this.agentPage = null;
      }
    });
  }

  /**
   * Spawns or binds to a dedicated, separate Agent Window in Brave.
   * This guarantees that AI actions never collide with the user's tabs or steal focus.
   */
  async createAgentWindow(initialUrl = null) {
    await this.ensureConnected();

    const marker = `about:blank#agent-${Date.now()}`;
    let newPage = null;

    if (this.browser) {
      try {
        const session = await this.browser.newBrowserCDPSession();
        await session.send('Target.createTarget', {
          url: marker,
          newWindow: true
        });

        // Wait for new page with marker URL to appear in Playwright context
        for (let i = 0; i < 25; i++) {
          await new Promise(r => setTimeout(r, 200));
          const pages = await this.getPages();
          newPage = pages.find(p => !p.isClosed() && p.url() === marker);
          if (newPage) break;
        }
      } catch (err) {
        console.warn("CDP window creation fallback:", err.message);
      }
    }

    if (!newPage) {
      // Fallback: create page in current context
      const ctx = this.context || (this.browser.contexts()[0] || await this.browser.newContext());
      newPage = await ctx.newPage();
    }

    this.agentPage = newPage;
    this._setupAgentPageListeners(this.agentPage);
    await this._setupPageDownloads(this.agentPage);

    // Persist agent window identity across all navigations
    await this.agentPage.addInitScript(() => {
      window.__ANTIGRAVITY_AGENT_WINDOW__ = true;
    }).catch(() => {});
    await this.agentPage.evaluate(() => {
      window.__ANTIGRAVITY_AGENT_WINDOW__ = true;
    }).catch(() => {});

    if (initialUrl && initialUrl !== 'about:blank') {
      await this.agentPage.goto(initialUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    } else {
      await this.agentPage.evaluate(() => {
        document.title = '🤖 Agent Workspace';
        document.body.innerHTML = `
          <div style="font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;color:#334155;text-align:center;">
            <div style="font-size:52px;margin-bottom:12px;">🤖</div>
            <h2 style="margin:0 0 8px 0;color:#0f172a;font-weight:700;">Antigravity Agent Window</h2>
            <p style="margin:0;color:#64748b;max-width:460px;line-height:1.5;">
              This window is reserved for autonomous AI browser tasks. 
              Your main browser window remains completely uninterrupted.
            </p>
          </div>
        `;
      }).catch(() => {});
    }

    return this.agentPage;
  }

  /**
   * Evaluates if a page belongs to the dedicated Agent Window.
   */
  async isAgentPage(page) {
    if (!page || page.isClosed()) return false;
    if (page === this.agentPage) return true;
    try {
      const url = page.url();
      if (url.includes('#agent-')) return true;
      const title = await page.title().catch(() => '');
      if (title.includes('Agent Workspace') || title.includes('[🤖 Agent')) return true;
      const isTagged = await page.evaluate(() => !!window.__ANTIGRAVITY_AGENT_WINDOW__).catch(() => false);
      if (isTagged) return true;
    } catch (e) {}
    return false;
  }

  /**
   * Retrieves the dedicated agent page (in the separate agent window).
   * Automatically creates the agent window if it doesn't already exist.
   */
  async getAgentPage({ autoCreate = true } = {}) {
    if (this.agentPage && !this.agentPage.isClosed()) {
      return this.agentPage;
    }

    // Check if an existing page is already marked as the agent window
    const pages = await this.getPages();
    for (const p of pages) {
      if (await this.isAgentPage(p)) {
        this.agentPage = p;
        this._setupAgentPageListeners(p);
        await this._setupPageDownloads(p);
        return p;
      }
    }

    if (autoCreate) {
      return await this.createAgentWindow();
    }

    return null;
  }

  /**
   * Resolves target page:
   * - 'agent' (default): Dedicated Agent Window (zero user interference)
   * - 'user' / 'active': User's primary active window/tab
   * - index (number): Specific tab index
   */
  async getTargetPage(target = 'agent', index = null) {
    const pages = await this.getPages();
    if (pages.length === 0) {
      throw new Error("No open tabs found in Brave.");
    }

    // Specific numerical index requested
    if (index !== null && index !== undefined) {
      if (index < 0 || index >= pages.length) {
        throw new Error(`Tab index ${index} out of range (0 to ${pages.length - 1}).`);
      }
      return pages[index];
    }

    // User's active page requested
    if (target === 'user' || target === 'active') {
      const userPages = [];
      for (const p of pages) {
        if (!(await this.isAgentPage(p))) {
          userPages.push(p);
        }
      }
      if (userPages.length > 0) {
        // Prioritize the tab currently visible in user's browser window
        for (const up of userPages) {
          try {
            const isVisible = await up.evaluate(() => document.visibilityState === 'visible').catch(() => false);
            if (isVisible) return up;
          } catch (e) {}
        }
        return userPages[0];
      }
      return pages[0];
    }

    // Default: Dedicated Agent Window page
    return await this.getAgentPage({ autoCreate: true });
  }

  /**
   * Gets active page (defaults to agent page for isolation, or falls back to first page).
   */
  async getActivePage() {
    return await this.getTargetPage('agent');
  }

  /**
   * Sets the active tab by index, with optional focus stealing.
   */
  async setActivePage(index, { bringToFront = false } = {}) {
    const pages = await this.getPages();
    if (index < 0 || index >= pages.length) {
      throw new Error(`Tab index ${index} out of range (0 to ${pages.length - 1}).`);
    }
    const page = pages[index];
    if (bringToFront) {
      await page.bringToFront().catch(() => {});
    }
    return page;
  }

  /**
   * Opens a new tab with the given URL.
   */
  async newTab(url = 'about:blank') {
    await this.ensureConnected();

    const ctx = this.context || (this.browser.contexts()[0] || await this.browser.newContext());
    const page = await ctx.newPage();
    if (url && url !== 'about:blank') {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    }
    return page;
  }

  /**
   * Closes a tab by index.
   */
  async closeTab(index) {
    const pages = await this.getPages();
    if (index < 0 || index >= pages.length) {
      throw new Error(`Tab index ${index} out of range.`);
    }
    const page = pages[index];
    if (page === this.agentPage) {
      this.agentPage = null;
    }
    await page.close();
  }


  /**
   * Returns list of open tabs with metadata, clearly showing User vs Agent windows.
   */
  async listTabs() {
    const pages = await this.getPages();
    const tabs = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      let title = 'Untitled';
      let url = 'about:blank';
      try {
        title = await p.title();
        url = p.url();
      } catch (e) {}

      const isAgent = await this.isAgentPage(p);

      tabs.push({
        index: i,
        title,
        url,
        role: isAgent ? 'Agent Workspace (Isolated Window)' : 'User Personal Window',
        isAgentWindow: isAgent,
        isActive: isAgent
      });
    }
    return tabs;
  }
}

