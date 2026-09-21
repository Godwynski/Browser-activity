import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  console.log('Clicking Move toolbar button...');
  const moveBtn = await page.$('div[aria-label*="Move" i], div[data-tooltip*="Move" i]');
  if (moveBtn) {
    await moveBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'artifacts/screenshots/gdrive_move_dialog_opened.png' });
    console.log('Move dialog opened and screenshot saved!');
  } else {
    console.log('Move button not found on toolbar');
  }

  process.exit(0);
}

main().catch(console.error);
