import { BraveManager } from '../src/browser.js';

async function moveSelected(page, targetFolderName) {
  // Wait for selection to settle
  await page.waitForTimeout(500);

  // Click Move button on toolbar
  const moveBtn = await page.$('div[aria-label*="Move" i], div[data-tooltip*="Move" i]');
  if (!moveBtn) {
    console.warn('Move button not found on toolbar!');
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
    // Find text node matching name
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
  const moveResult = await pickerFrame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Move');
    if (btn && !btn.disabled) {
      btn.click();
      return { ok: true };
    }
    return { ok: false, reason: btn ? 'disabled' : 'not found' };
  });

  console.log(`Clicked Move button in picker:`, moveResult);
  await page.waitForTimeout(3500);
  return moveResult.ok;
}

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  let page = pages.find(p => p.url().includes('drive.google.com'));
  if (!page) {
    page = pages[0];
  }

  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Get items categorized
  const items = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('div[role="gridcell"]'));
    return cells.map(el => {
      const text = el.innerText?.split('\n')[0]?.trim() || '';
      const aria = el.getAttribute('aria-label') || '';
      const dataId = el.getAttribute('data-id') || '';
      return { text, aria, dataId };
    });
  });

  console.log(`Found ${items.length} total items in ye.`);

  const photoExts = ['.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif'];
  const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.3gp'];
  const metaExts = ['.json', '.txt', '.html'];

  // Categorize
  const photos = [];
  const videos = [];
  const metadata = [];

  for (const item of items) {
    if (['backup', 'Metadata', 'Photos', 'Videos'].includes(item.text)) continue;
    const lower = item.text.toLowerCase();
    if (lower.endsWith('.json')) {
      metadata.push(item);
    } else if (photoExts.some(ext => lower.endsWith(ext))) {
      photos.push(item);
    } else if (videoExts.some(ext => lower.endsWith(ext))) {
      videos.push(item);
    } else {
      console.log('Unrecognized item:', item.text);
    }
  }

  console.log(`Photos (${photos.length}):`, photos.map(p => p.text));
  console.log(`Videos (${videos.length}):`, videos.map(v => v.text));
  console.log(`Metadata (${metadata.length}):`, metadata.map(m => m.text));

  // Function to select a list of items using Ctrl+Click
  async function selectAndMove(itemList, targetName) {
    if (itemList.length === 0) return;
    console.log(`\nMoving ${itemList.length} items to "${targetName}"...`);

    // Click background or press Escape to clear any current selection
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Select items
    for (let i = 0; i < itemList.length; i++) {
      const it = itemList[i];
      const selector = `div[data-id="${it.dataId}"]`;
      const cell = await page.$(selector);
      if (cell) {
        // First item normal click, subsequent items Ctrl+click
        if (i === 0) {
          await cell.click();
        } else {
          await cell.click({ modifiers: ['Control'] });
        }
        await page.waitForTimeout(100);
      } else {
        console.warn(`Could not find cell for ${it.text}`);
      }
    }

    await moveSelected(page, targetName);
  }

  // 1. Move Photos
  if (photos.length > 0) {
    await selectAndMove(photos, 'Photos');
    await page.waitForTimeout(2000);
  }

  // 2. Move Videos
  if (videos.length > 0) {
    await selectAndMove(videos, 'Videos');
    await page.waitForTimeout(2000);
  }

  // 3. Move Metadata
  if (metadata.length > 0) {
    await selectAndMove(metadata, 'Metadata');
    await page.waitForTimeout(2000);
  }

  // Final check of ye
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const remaining = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div[role="gridcell"]')).map(el => el.innerText?.split('\n')[0]?.trim());
  });

  console.log('\nFinal contents of ye root:', remaining);
  await page.screenshot({ path: 'artifacts/screenshots/gdrive_ye_cleaned.png' });

  process.exit(0);
}

main().catch(console.error);
