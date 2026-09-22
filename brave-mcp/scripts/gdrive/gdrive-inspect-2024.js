import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const photos2024Id = '15RdNmuAKfKtduV2BqVfPgde3-KExjnGt';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${photos2024Id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  // Take screenshot
  await page.screenshot({ path: 'artifacts/screenshots/gdrive_photos_2024.png' });
  console.log('Saved screenshot of Photos from 2024');

  const items = await page.evaluate(() => {
    const list = [];
    document.querySelectorAll('[data-target="item"], [role="row"], [role="listitem"]').forEach(el => {
      const name = el.innerText?.split('\n')[0]?.trim();
      const aria = el.getAttribute('aria-label') || '';
      const id = el.getAttribute('data-id') || '';
      if (name && id && id.length > 10 && !list.some(x => x.name === name)) {
        list.push({ name, aria, id });
      }
    });
    return list;
  });

  console.log(`Found ${items.length} items in Photos from 2024:`);
  console.log(JSON.stringify(items.slice(0, 25), null, 2));

  process.exit(0);
}

main().catch(console.error);
