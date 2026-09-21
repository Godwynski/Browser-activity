import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const chips = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, div[role="button"], [data-tooltip], [aria-haspopup]'));
    return all.map(el => ({
      tag: el.tagName,
      text: el.innerText?.replace(/\n/g, ' ').trim(),
      aria: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
      id: el.id
    })).filter(x => x.text || x.aria);
  });

  console.log('UI elements on page:', JSON.stringify(chips.filter(c => 
    (c.text && (c.text.includes('Type') || c.text.includes('Filter') || c.text.includes('Modified') || c.text.includes('People'))) ||
    (c.aria && (c.aria.includes('Type') || c.aria.includes('Filter') || c.aria.includes('Sort')))
  ), null, 2));

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_ye_ui.png' });
  console.log('Saved artifacts/screenshots/gdrive_ye_ui.png');
  process.exit(0);
}

main().catch(console.error);
