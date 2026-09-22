import { BaseAdapter } from './base-adapter.js';

/**
 * GoogleDriveAdapter: Streamlines Google Drive inspection, bulk file listing,
 * and organization using deterministic in-page evaluation (0 tokens).
 */
export class GoogleDriveAdapter extends BaseAdapter {
  constructor() {
    super('GoogleDrive', ['drive.google.com']);
  }

  /**
   * Inspects the current Drive view and extracts all visible files and folders.
   */
  async inspect(page) {
    if (!this.canHandle(page.url())) {
      throw new Error(`Current page (${page.url()}) is not a Google Drive URL.`);
    }

    return await page.evaluate(() => {
      const items = [];
      // Query Google Drive file/folder rows and grid cards
      const rows = Array.from(document.querySelectorAll('[data-id], [role="row"], [role="gridcell"]'));

      for (const row of rows) {
        const nameEl = row.querySelector('[aria-label], [data-tooltip], span, div');
        const name = (nameEl?.getAttribute('aria-label') || nameEl?.innerText || '').trim();
        const dataId = row.getAttribute('data-id') || row.getAttribute('data-target-id');

        if (name && name.length > 1 && !items.some(i => i.name === name)) {
          const isFolder = row.innerHTML.includes('folder') || row.getAttribute('aria-label')?.includes('Folder');
          items.push({
            name,
            id: dataId || undefined,
            type: isFolder ? 'folder' : 'file'
          });
        }
      }

      return {
        url: window.location.href,
        title: document.title,
        itemCount: items.length,
        items: items.slice(0, 50)
      };
    });
  }

  /**
   * Searches Google Drive for files matching the given query string.
   */
  async search(page, query) {
    if (!query) throw new Error("Search query is required.");
    const searchInput = page.locator('input[aria-label*="Search"], input[placeholder*="Search in Drive"]').first();
    await searchInput.fill(query);
    await searchInput.press('Enter');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    return await this.inspect(page);
  }
}

export const gdriveAdapter = new GoogleDriveAdapter();
