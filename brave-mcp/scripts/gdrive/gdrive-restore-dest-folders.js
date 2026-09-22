import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const photos2024Id = '15RdNmuAKfKtduV2BqVfPgde3-KExjnGt';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${photos2024Id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Close any modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Click first folder card, Ctrl+A to select Videos, Metadata, Photos
  console.log('Selecting folders in Photos from 2024...');
  const firstCard = await page.$('div[role="gridcell"]');
  if (firstCard) {
    await firstCard.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+KeyA');
    await page.waitForTimeout(800);

    // Click Move button on toolbar
    console.log('Clicking Move toolbar button...');
    const moveBtn = await page.$('div[aria-label*="Move" i], div[data-tooltip*="Move" i]');
    if (moveBtn) await moveBtn.click();
    await page.waitForTimeout(2000);

    // In Move picker frame, click 'ye'
    const pickerFrame = page.frames().find(f => f.url().includes('picker/minpick'));
    if (pickerFrame) {
      console.log('Selecting "ye" in picker frame...');
      await pickerFrame.evaluate(() => {
        const items = Array.from(document.querySelectorAll('*'));
        const yeEl = items.find(e => e.innerText?.trim() === 'ye' && e.children.length === 0);
        if (yeEl) yeEl.click();
      });
      await page.waitForTimeout(1000);

      // Click Move
      console.log('Clicking Move in picker frame...');
      const res = await pickerFrame.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Move');
        if (btn && !btn.disabled) {
          btn.click();
          return { clicked: true };
        }
        return { disabled: btn ? btn.disabled : 'not found' };
      });
      console.log('Moved back to ye:', res);
      await page.waitForTimeout(3000);
    }
  }

  // Navigate back to ye and verify
  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_ye_restored.png' });
  console.log('📸 Screenshot saved: artifacts/screenshots/gdrive_ye_restored.png');

  process.exit(0);
}

main().catch(console.error);
