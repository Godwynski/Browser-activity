import { BraveManager } from '../../src/browser.js';

async function moveCurrentFiltered(page, targetFolderName) {
  // Wait a bit
  await page.waitForTimeout(1000);

  // Check if any items are in the view
  const firstCell = await page.$('div[role="gridcell"]');
  if (!firstCell) {
    console.log(`No items found to move to ${targetFolderName}`);
    return false;
  }

  // Click first cell
  await firstCell.click();
  await page.waitForTimeout(500);

  // Ctrl+A to select all
  await page.keyboard.press('Control+KeyA');
  await page.waitForTimeout(800);

  // Click Move button on toolbar
  const moveBtn = await page.$('div[aria-label*="Move" i], div[data-tooltip*="Move" i]');
  if (!moveBtn) {
    console.warn('Move button not found on toolbar');
    return false;
  }
  await moveBtn.click();
  console.log('Clicked Move toolbar button, waiting for picker iframe...');

  // Wait for picker iframe
  let pickerFrame = null;
  for (let i = 0; i < 15; i++) {
    pickerFrame = page.frames().find(f => f.url().includes('picker/minpick'));
    if (pickerFrame) break;
    await page.waitForTimeout(500);
  }

  if (!pickerFrame) {
    console.warn('Picker iframe not found!');
    await page.keyboard.press('Escape');
    return false;
  }

  console.log('Found picker iframe!');
  await page.waitForTimeout(1500);

  // Select targetFolderName inside picker
  console.log(`Selecting folder "${targetFolderName}" inside picker...`);
  const selected = await pickerFrame.evaluate((name) => {
    const all = Array.from(document.querySelectorAll('*'));
    const el = all.find(e => e.innerText?.trim() === name && e.children.length === 0);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, targetFolderName);

  console.log(`Selected "${targetFolderName}":`, selected);
  if (!selected) {
    await page.screenshot({ path: `artifacts/screenshots/picker_error_${targetFolderName}.png` });
    await page.keyboard.press('Escape');
    return false;
  }

  await page.waitForTimeout(1000);

  // Click Move button in picker
  const moved = await pickerFrame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Move');
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  });

  console.log(`Clicked Move button in picker:`, moved);
  await page.waitForTimeout(4000);
  return moved;
}

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';

  // 1. Move Photos in ye
  console.log('\n--- Filtering & Moving Photos in ye ---');
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const typeBtn = await page.$('button:has-text("Type"), div:has-text("Type")');
  if (typeBtn) {
    await typeBtn.click();
    await page.waitForTimeout(800);
    const photosOpt = await page.$('[role="menuitem"]:has-text("Photos & images"), [role="option"]:has-text("Photos & images")');
    if (photosOpt) {
      await photosOpt.click();
      await page.waitForTimeout(2000);
      await moveCurrentFiltered(page, 'Photos');
    }
  }

  // 2. Move Videos in ye
  console.log('\n--- Filtering & Moving Videos in ye ---');
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const typeBtn2 = await page.$('button:has-text("Type"), div:has-text("Type")');
  if (typeBtn2) {
    await typeBtn2.click();
    await page.waitForTimeout(800);
    const videosOpt = await page.$('[role="menuitem"]:has-text("Videos"), [role="option"]:has-text("Videos")');
    if (videosOpt) {
      await videosOpt.click();
      await page.waitForTimeout(2000);
      await moveCurrentFiltered(page, 'Videos');
    }
  }

  // 3. Check what remains in ye
  console.log('\n--- Checking remaining items in ye ---');
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const remaining = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div[role="gridcell"]')).map(el => ({
      text: el.innerText?.split('\n')[0]?.trim(),
      aria: el.getAttribute('aria-label'),
      dataId: el.getAttribute('data-id')
    }));
  });

  console.log('Remaining in ye:', JSON.stringify(remaining, null, 2));

  process.exit(0);
}

main().catch(console.error);
