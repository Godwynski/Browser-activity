import { BraveManager } from '../src/browser.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Connecting to Brave...');
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  // Let's inspect the two Takeout Google Photos folders
  // Folder 4 Takeout > Google Photos: 1bq9Zg1fwuCYsUWKm7u2W8UhrerhufvNN
  // Let's find folder 6 Takeout > Google Photos as well
  console.log('Inspecting Takeout-6 Drive folder...');
  const driveId = '1jdZaAF1sMi73w63dUIu0E2tALBTChKlU';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${driveId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const t6Children = await page.evaluate(() => {
    const items = [];
    const elements = document.querySelectorAll('[role="row"], [role="listitem"], [data-target="item"], [data-id]');
    elements.forEach(el => {
      const dataId = el.getAttribute('data-id');
      const label = el.getAttribute('aria-label') || el.innerText?.split('\n')[0] || '';
      if (dataId && dataId.length > 10) {
        items.push({ label, dataId });
      }
    });
    return items;
  });

  console.log('Takeout-6 children:', JSON.stringify(t6Children, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
