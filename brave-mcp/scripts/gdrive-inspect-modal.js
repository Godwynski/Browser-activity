import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  // Click + New
  await page.click('button.Ss7qXc');
  await page.waitForTimeout(800);

  // Click New folder
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[role="menuitem"]')).find(e => e.innerText?.includes('New folder'));
    if (el) el.click();
  });
  await page.waitForTimeout(1500);

  // Screenshot the new folder modal
  await page.screenshot({ path: 'artifacts/screenshots/gdrive_new_folder_modal.png' });
  console.log('Saved screenshot of New Folder modal');

  // Find all inputs on the page that are visible
  const inputs = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('input'));
    return all.map(i => {
      const rect = i.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(i).visibility !== 'hidden';
      return {
        value: i.value,
        placeholder: i.placeholder,
        ariaLabel: i.getAttribute('aria-label'),
        visible,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      };
    });
  });

  console.log('Inputs on page:', JSON.stringify(inputs, null, 2));

  // Cancel modal
  await page.keyboard.press('Escape');
  process.exit(0);
}

main().catch(console.error);
