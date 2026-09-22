import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const info = await page.evaluate(() => {
    const target = Array.from(document.querySelectorAll('*')).find(e => e.innerText?.includes('IMG_7341.JPG') && e.children.length === 0);
    if (!target) return 'Not found';

    let curr = target;
    const hierarchy = [];
    while (curr && curr !== document.body) {
      hierarchy.push({
        tag: curr.tagName,
        class: curr.className,
        role: curr.getAttribute('role'),
        dataId: curr.getAttribute('data-id'),
        aria: curr.getAttribute('aria-label')
      });
      curr = curr.parentElement;
    }
    return hierarchy.slice(0, 7);
  });

  console.log('Hierarchy:', JSON.stringify(info, null, 2));
  process.exit(0);
}

main().catch(console.error);
