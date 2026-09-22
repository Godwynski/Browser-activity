import { BraveManager } from '../../src/browser.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const folder6 = '1ghsqGUnUE4hfEIJwAuhN_79R0C0kU2Is';
  const url = `https://drive.google.com/drive/u/0/folders/${folder6}`;
  console.log(`Navigating to takeout-6: ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Take screenshot
  const screenshotsDir = path.resolve('artifacts', 'screenshots');
  const screenshotPath = path.join(screenshotsDir, 'gdrive_takeout_4.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`📸 Saved screenshot to: ${screenshotPath}`);

  // Inspect items inside
  const info = await page.evaluate(() => {
    const items = [];
    const elements = document.querySelectorAll('[role="row"], [role="listitem"], [data-target="item"], [data-id]');
    elements.forEach(el => {
      const label = el.getAttribute('aria-label') || '';
      const text = el.innerText?.trim() || '';
      const dataId = el.getAttribute('data-id') || '';
      if (label || text) {
        items.push({ label, text: text.split('\n'), dataId });
      }
    });

    return {
      title: document.title,
      url: window.location.href,
      items
    };
  });

  const seen = new Set();
  const uniqueItems = [];
  info.items.forEach(it => {
    const name = it.label || it.text[0] || '';
    if (name && !seen.has(name) && it.dataId && it.dataId.length > 5) {
      seen.add(name);
      uniqueItems.push({ name, dataId: it.dataId, label: it.label });
    }
  });

  console.log('Unique items inside takeout-4:', uniqueItems.length);
  console.log(JSON.stringify(uniqueItems, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
