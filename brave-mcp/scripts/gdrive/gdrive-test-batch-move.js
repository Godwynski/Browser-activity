import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const photos2024Id = '15RdNmuAKfKtduV2BqVfPgde3-KExjnGt';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${photos2024Id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // 1. Click Type chip
  console.log('Clicking Type chip...');
  const typeChip = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button, div, span')).find(el => el.innerText?.trim() === 'Type');
  });
  if (typeChip) await typeChip.click();
  await page.waitForTimeout(800);

  // 2. Click 'Photos & images'
  console.log('Selecting "Photos & images"...');
  await page.evaluate(() => {
    const opt = Array.from(document.querySelectorAll('*')).find(el => el.innerText?.trim() === 'Photos & images' && el.children.length === 0);
    if (opt) opt.click();
  });
  await page.waitForTimeout(2000);

  // 3. Select all items with Ctrl+A
  console.log('Selecting all photos with Ctrl+A...');
  await page.keyboard.press('Control+KeyA');
  await page.waitForTimeout(1000);

  // Take screenshot of selected photos
  await page.screenshot({ path: 'artifacts/screenshots/gdrive_photos_selected.png' });
  console.log('Screenshot saved: artifacts/screenshots/gdrive_photos_selected.png');

  // 4. Click Move button in toolbar
  const moveBtn = await page.$(`[role="button"][data-tooltip*="Move" i], [role="button"][aria-label*="Move" i], div[data-tooltip*="Move" i]`);
  if (moveBtn) {
    console.log('Clicking Move button...');
    await moveBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'artifacts/screenshots/gdrive_move_to_photos.png' });
    console.log('Screenshot of Move picker saved: artifacts/screenshots/gdrive_move_to_photos.png');

    // In Move picker, look for 'ye' or 'All locations'
    const locations = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="dialog"] [role="treeitem"], [role="dialog"] [role="option"], [role="dialog"] [data-target="item"], [role="dialog"] div'))
        .map(e => ({ text: e.innerText?.trim()?.split('\n')[0], aria: e.getAttribute('aria-label') }))
        .filter(e => e.text && ['ye', 'Photos', 'Suggested', 'All locations'].includes(e.text));
      return items;
    });
    console.log('Locations in dialog:', locations);
  }

  process.exit(0);
}

main().catch(console.error);
