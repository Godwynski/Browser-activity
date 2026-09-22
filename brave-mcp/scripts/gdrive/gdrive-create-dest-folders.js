import { BraveManager } from '../../src/browser.js';

async function createFolder(page, name) {
  console.log(`Creating folder "${name}"...`);
  await page.click('button.Ss7qXc');
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[role="menuitem"]')).find(e => e.innerText?.includes('New folder'));
    if (el) el.click();
  });

  await page.waitForTimeout(1200);
  await page.keyboard.type(name);
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  console.log(`✅ Created folder "${name}"`);
}

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  for (const name of ['Videos', 'Metadata']) {
    await createFolder(page, name);
  }

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_all_dest_folders.png' });
  console.log('📸 Captured screenshot: artifacts/screenshots/gdrive_all_dest_folders.png');
  process.exit(0);
}

main().catch(console.error);
