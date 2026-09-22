import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const info = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(e => e.innerText?.includes('Move “copy_5C4C38CF'));
    if (!el) return 'Not found';

    // Walk up to find container
    let container = el;
    while (container && container.parentElement && container.parentElement !== document.body) {
      if (container.parentElement.innerText.includes('Select a location to show the folder path')) {
        container = container.parentElement;
      } else {
        break;
      }
    }

    return {
      tag: container.tagName,
      role: container.getAttribute('role'),
      class: container.className,
      allText: container.innerText
    };
  });

  console.log('Dialog container:', info);
  process.exit(0);
}

main().catch(console.error);
