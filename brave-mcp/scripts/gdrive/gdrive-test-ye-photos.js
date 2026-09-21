import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // 1. Filter Type -> Photos & images
  console.log('Filtering Photos & images...');
  const typeChip = await page.$('button:has-text("Type"), div:has-text("Type")');
  if (typeChip) await typeChip.click();
  await page.waitForTimeout(800);

  const photosOption = await page.$('[role="menuitem"]:has-text("Photos & images"), [role="option"]:has-text("Photos & images")');
  if (photosOption) await photosOption.click();
  await page.waitForTimeout(2000);

  // 2. Select first file, Ctrl+A
  console.log('Selecting all filtered photos...');
  const firstItem = await page.$('div[role="gridcell"]');
  if (firstItem) {
    await firstItem.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+KeyA');
    await page.waitForTimeout(800);

    // 3. Click Move
    console.log('Clicking Move button...');
    const moveBtn = await page.$('div[aria-label*="Move" i], div[data-tooltip*="Move" i]');
    if (moveBtn) await moveBtn.click();
    await page.waitForTimeout(2000);

    // Find picker frame
    const pickerFrame = page.frames().find(f => f.url().includes('picker/minpick'));
    if (pickerFrame) {
      console.log('Picker frame found! Inspecting items inside picker...');
      const items = await pickerFrame.evaluate(() => {
        return Array.from(document.querySelectorAll('*'))
          .filter(e => ['Photos', 'Videos', 'Metadata', 'ye'].includes(e.innerText?.trim()))
          .map(e => ({ tag: e.tagName, text: e.innerText?.trim(), role: e.getAttribute('role'), class: e.className }));
      });
      console.log('Picker items:', items);

      // Click on Photos
      console.log('Clicking on Photos...');
      await pickerFrame.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.innerText?.trim() === 'Photos' && e.children.length === 0);
        if (el) el.click();
      });
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'artifacts/screenshots/gdrive_photos_highlighted.png' });

      // Click Move button in picker
      console.log('Clicking Move button in picker...');
      const res = await pickerFrame.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Move');
        if (btn && !btn.disabled) {
          btn.click();
          return { clicked: true };
        }
        return { disabled: btn ? btn.disabled : 'not found' };
      });
      console.log('Move button result:', res);
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'artifacts/screenshots/gdrive_photos_moved.png' });
    }
  }

  process.exit(0);
}

main().catch(console.error);
