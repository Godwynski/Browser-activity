import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  // Cancel any open modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Monitor network calls for 'move' or 'file' or 'v2internal'
  const moveRequests = [];
  page.on('request', req => {
    const u = req.url();
    if (u.includes('drive') && (req.method() === 'POST' || req.method() === 'PATCH' || req.method() === 'PUT')) {
      moveRequests.push({
        url: u,
        method: req.method(),
        postData: req.postData()?.slice(0, 300)
      });
    }
  });

  // Navigate to ye
  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('Listening for requests... Ready to inspect API.');
  process.exit(0);
}

main().catch(console.error);
