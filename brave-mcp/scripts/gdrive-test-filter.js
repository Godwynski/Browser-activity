import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  // Click the 'Type' filter chip
  const typeChip = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button, div, span')).find(el => el.innerText?.trim() === 'Type');
  });

  if (typeChip) {
    console.log('Clicking Type chip...');
    await typeChip.click();
    await page.waitForTimeout(1000);

    const typeOptions = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], [role="menu"] div, [role="listbox"] div'));
      return items.map(e => e.innerText?.trim()).filter(Boolean);
    });
    console.log('Type options:', typeOptions);

    await page.screenshot({ path: 'artifacts/screenshots/gdrive_type_filter.png' });
  }

  process.exit(0);
}

main().catch(console.error);
