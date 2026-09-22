import { BraveManager } from '../../src/browser.js';

async function moveItems(page, targetFolderName) {
  // Check if any gridcell exists
  const firstCell = await page.$('div[role="gridcell"]');
  if (!firstCell) {
    console.log(`No items to move to "${targetFolderName}".`);
    return false;
  }

  // Click first cell, then select all
  await firstCell.click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+KeyA');
  await page.waitForTimeout(800);

  // Click Move button on toolbar
  const moveBtn = await page.$('div[aria-label*="Move" i], div[data-tooltip*="Move" i]');
  if (!moveBtn) {
    console.warn('Move toolbar button not found.');
    return false;
  }
  await moveBtn.click();
  await page.waitForTimeout(2000);

  // Find picker frame
  let pickerFrame = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    pickerFrame = page.frames().find(f => f.url().includes('picker/minpick'));
    if (pickerFrame) break;
    await page.waitForTimeout(500);
  }

  if (!pickerFrame) {
    console.warn('Picker frame not found, pressing Escape...');
    await page.keyboard.press('Escape');
    return false;
  }

  // Click target folder inside picker frame
  console.log(`Selecting "${targetFolderName}" in Move picker...`);
  const selected = await pickerFrame.evaluate((name) => {
    const all = Array.from(document.querySelectorAll('*'));
    const target = all.find(e => e.innerText?.trim() === name && e.children.length === 0);
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, targetFolderName);

  if (!selected) {
    console.warn(`Could not find "${targetFolderName}" in picker! Pressing Escape...`);
    await page.keyboard.press('Escape');
    return false;
  }

  await page.waitForTimeout(1000);

  // Click Move in picker frame
  const moved = await pickerFrame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Move');
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  });

  console.log(`Moved batch to "${targetFolderName}":`, moved);
  await page.waitForTimeout(3500);
  return moved;
}

async function organizeFolder(page, folderId, folderName) {
  console.log(`\n========================================`);
  console.log(`📂 Organizing folder: ${folderName} (${folderId})`);
  console.log(`========================================`);

  await page.goto(`https://drive.google.com/drive/u/0/folders/${folderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Close any stray modals
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // --- Step 1: Filter & Move Photos ---
  console.log('--- Step 1: Photos & Images ---');
  let typeChip = await page.$('button:has-text("Type"), div:has-text("Type")');
  if (typeChip) {
    await typeChip.click();
    await page.waitForTimeout(800);
    const photosOption = await page.$('[role="menuitem"]:has-text("Photos & images"), [role="option"]:has-text("Photos & images"), div:has-text("Photos & images")');
    if (photosOption) {
      await photosOption.click();
      await page.waitForTimeout(2000);
      await moveItems(page, 'Photos');
    }
  }

  // --- Step 2: Filter & Move Videos ---
  console.log('--- Step 2: Videos ---');
  await page.goto(`https://drive.google.com/drive/u/0/folders/${folderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  typeChip = await page.$('button:has-text("Type"), div:has-text("Type")');
  if (typeChip) {
    await typeChip.click();
    await page.waitForTimeout(800);
    const videosOption = await page.$('[role="menuitem"]:has-text("Videos"), [role="option"]:has-text("Videos"), div:has-text("Videos")');
    if (videosOption) {
      await videosOption.click();
      await page.waitForTimeout(2000);
      await moveItems(page, 'Videos');
    }
  }

  // --- Step 3: Move Remaining Metadata (.json) ---
  console.log('--- Step 3: Remaining Metadata ---');
  await page.goto(`https://drive.google.com/drive/u/0/folders/${folderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await moveItems(page, 'Metadata');

  console.log(`✅ Finished organizing: ${folderName}`);
}

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  // Test on Photos from 2024
  await organizeFolder(page, '15RdNmuAKfKtduV2BqVfPgde3-KExjnGt', 'Photos from 2024');

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_2024_organized.png' });
  console.log('📸 Screenshot saved: artifacts/screenshots/gdrive_2024_organized.png');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
