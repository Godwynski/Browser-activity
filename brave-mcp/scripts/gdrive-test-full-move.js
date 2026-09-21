import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const photos2024Id = '15RdNmuAKfKtduV2BqVfPgde3-KExjnGt';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${photos2024Id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Click Type chip
  console.log('1. Clicking Type filter...');
  const typeChip = await page.$('button:has-text("Type"), div:has-text("Type")');
  if (typeChip) await typeChip.click();
  await page.waitForTimeout(800);

  // Click Photos & images in menu
  console.log('2. Selecting "Photos & images"...');
  const photosOption = await page.$('[role="menuitem"]:has-text("Photos & images"), [role="option"]:has-text("Photos & images"), div:has-text("Photos & images")');
  if (photosOption) await photosOption.click();
  await page.waitForTimeout(2500);

  // Select first file, then Ctrl+A
  console.log('3. Selecting all filtered items...');
  const firstItem = await page.$('[data-target="item"], [role="row"], [role="listitem"]');
  if (firstItem) {
    await firstItem.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+KeyA');
    await page.waitForTimeout(800);

    // Press Ctrl+Alt+M to open Move dialog
    console.log('4. Opening Move dialog (Ctrl+Alt+M)...');
    await page.keyboard.press('Control+Alt+KeyM');
    await page.waitForTimeout(2500);

    await page.screenshot({ path: 'artifacts/screenshots/gdrive_picker_open.png' });
    console.log('Screenshot of picker saved');

    // In picker, find 'ye'
    console.log('5. Clicking on "ye" in picker...');
    const clickedYe = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="dialog"] *'));
      const yeEl = items.find(e => e.innerText?.trim() === 'ye' && e.children.length === 0);
      if (yeEl) {
        yeEl.click();
        return true;
      }
      return false;
    });
    console.log('Clicked "ye":', clickedYe);
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'artifacts/screenshots/gdrive_picker_inside_ye.png' });

    // In ye, click Photos
    console.log('6. Clicking on "Photos" folder...');
    const clickedPhotos = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="dialog"] *'));
      const photosEl = items.find(e => e.innerText?.trim() === 'Photos' && e.children.length === 0);
      if (photosEl) {
        photosEl.click();
        return true;
      }
      return false;
    });
    console.log('Clicked "Photos":', clickedPhotos);
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'artifacts/screenshots/gdrive_picker_inside_photos.png' });

    // Click Move button in dialog
    console.log('7. Clicking Move button in dialog...');
    const clickedMove = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => b.innerText?.trim() === 'Move');
      if (btn && !btn.disabled) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked Move:', clickedMove);
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'artifacts/screenshots/gdrive_after_move.png' });
    console.log('Move complete!');
  }

  process.exit(0);
}

main().catch(console.error);
