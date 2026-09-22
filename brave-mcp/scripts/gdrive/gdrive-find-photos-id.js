import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Find Photos data-id
  const photosId = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[data-target="item"], [role="row"], [role="listitem"]'))
      .find(e => e.innerText?.split('\n')[0]?.trim() === 'Photos');
    return el?.getAttribute('data-id');
  });

  console.log('Photos folder ID:', photosId);

  if (photosId) {
    await page.goto(`https://drive.google.com/drive/u/0/folders/${photosId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'artifacts/screenshots/gdrive_inside_photos.png' });
    console.log('Saved screenshot: artifacts/screenshots/gdrive_inside_photos.png');
  }

  process.exit(0);
}

main().catch(console.error);
