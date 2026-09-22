import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Right click on backup folder
  const backupEl = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('[data-target="item"], [role="row"], [role="listitem"]'))
      .find(el => el.innerText?.split('\n')[0]?.trim() === 'backup');
  });

  if (backupEl) {
    console.log('Right clicking backup...');
    await backupEl.click({ button: 'right' });
    await page.waitForTimeout(1000);

    // Click 'Search within backup'
    const clicked = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const searchItem = items.find(i => i.innerText?.includes('Search within'));
      if (searchItem) {
        searchItem.click();
        return true;
      }
      return false;
    });

    console.log('Clicked "Search within backup":', clicked);
    await page.waitForTimeout(2000);

    const searchUrl = page.url();
    console.log('Search URL:', searchUrl);

    await page.screenshot({ path: 'artifacts/screenshots/gdrive_search_within.png' });
    console.log('Captured screenshot of search within');
  }

  process.exit(0);
}

main().catch(console.error);
