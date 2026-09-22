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

  // Click on the first video card (copy_5C4C38CF-...mov)
  console.log('1. Clicking on first video card...');
  const firstVideo = await page.$('div[role="gridcell"]');
  if (!firstVideo) throw new Error('No gridcell found');
  await firstVideo.click();
  await page.waitForTimeout(800);

  // Click Move toolbar button
  console.log('2. Clicking Move button on toolbar...');
  const moveBtn = await page.$('div[aria-label*="Move" i], div[data-tooltip*="Move" i]');
  if (!moveBtn) throw new Error('Move toolbar button not found');
  await moveBtn.click();
  await page.waitForTimeout(2000);

  // In the Move dialog, click "Videos"
  console.log('3. Selecting "Videos" in Move dialog...');
  const selectedVideos = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return false;
    const items = Array.from(dialog.querySelectorAll('*'));
    const videosEl = items.find(e => e.innerText?.trim() === 'Videos' && e.children.length === 0);
    if (videosEl) {
      videosEl.click();
      return true;
    }
    return false;
  });
  console.log('Selected "Videos" in dialog:', selectedVideos);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_videos_selected_in_dialog.png' });

  // Click Move button in dialog
  console.log('4. Clicking Move button in dialog...');
  const clickedMove = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return false;
    const btn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Move');
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Move in dialog:', clickedMove);
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_after_single_move.png' });
  console.log('Screenshot saved: artifacts/screenshots/gdrive_after_single_move.png');

  process.exit(0);
}

main().catch(console.error);
