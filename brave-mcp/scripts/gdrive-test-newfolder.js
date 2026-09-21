import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  // Navigate to ye root folder
  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  if (!page.url().includes(yeFolderId)) {
    await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  // Click the + New button
  console.log('Clicking + New button...');
  await page.click('button.Ss7qXc');
  await page.waitForTimeout(1000);

  const menuItems = await page.evaluate(() => {
    const items = [];
    const elements = document.querySelectorAll('[role="menuitem"], [role="menu"] div, [role="menu"] span');
    elements.forEach(el => {
      const text = el.innerText?.trim();
      if (text && !items.includes(text)) {
        items.push(text);
      }
    });
    return items;
  });

  console.log('Menu items found:', menuItems);

  // Look for 'New folder'
  const clickedNewFolder = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[role="menuitem"]')).find(e => e.innerText?.includes('New folder'));
    if (el) {
      el.click();
      return true;
    }
    return false;
  });

  console.log('Clicked "New folder":', clickedNewFolder);
  await page.waitForTimeout(1500);

  const dialog = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const input = d.querySelector('input');
    const buttons = Array.from(d.querySelectorAll('button')).map(b => b.innerText?.trim());
    return {
      title: d.innerText?.split('\n')[0],
      inputValue: input?.value,
      buttons
    };
  });

  console.log('Dialog:', dialog);

  if (dialog) {
    // Press Escape to cancel for now
    await page.keyboard.press('Escape');
  }

  process.exit(0);
}

main().catch(console.error);
