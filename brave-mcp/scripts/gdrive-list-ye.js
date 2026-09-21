import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const gridcells = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div[role="gridcell"]')).map(el => ({
      text: el.innerText?.split('\n')[0]?.trim(),
      aria: el.getAttribute('aria-label'),
      dataId: el.getAttribute('data-id')
    }));
  });

  console.log('Gridcells in ye:', JSON.stringify(gridcells, null, 2));

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_ye_overview.png' });
  console.log('Saved ye overview screenshot');
  process.exit(0);
}

main().catch(console.error);
