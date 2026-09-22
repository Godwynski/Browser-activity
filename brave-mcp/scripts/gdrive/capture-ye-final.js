import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_ye_final_result.png' });
  console.log('Saved artifacts/screenshots/gdrive_ye_final_result.png');
  process.exit(0);
}

main().catch(console.error);
