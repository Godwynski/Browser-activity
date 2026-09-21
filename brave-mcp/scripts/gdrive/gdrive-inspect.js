import { BraveManager } from '../src/browser.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Connecting to Brave...');
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com/drive/u/0/folders/1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn')) || pages[0];

  console.log(`📄 Using tab: "${await page.title()}" (${page.url()})`);

  // Ensure artifacts/screenshots directory
  const screenshotsDir = path.resolve('artifacts', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const screenshotPath = path.join(screenshotsDir, 'gdrive_ye_folder.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`📸 Saved screenshot to: ${screenshotPath}`);

  // Inspect the items in Google Drive DOM
  const folderInfo = await page.evaluate(() => {
    // Find all item elements in Google Drive grid or list view
    const items = [];
    // Google drive file items often have data-id, or role="row" / role="listitem" / role="option"
    const nodes = document.querySelectorAll('[role="row"], [role="listitem"], [data-target="item"], [data-id]');
    
    nodes.forEach(node => {
      const text = node.innerText?.trim();
      const ariaLabel = node.getAttribute('aria-label') || '';
      const dataId = node.getAttribute('data-id') || '';
      if (text || ariaLabel) {
        items.push({
          ariaLabel,
          text: text ? text.split('\n') : [],
          dataId
        });
      }
    });

    // Also get all text in the main view
    const allText = document.body.innerText.slice(0, 1500);

    return {
      title: document.title,
      url: window.location.href,
      itemsCount: items.length,
      sampleItems: items.slice(0, 25),
      allText
    };
  });

  console.log('Folder Info:', JSON.stringify(folderInfo, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
