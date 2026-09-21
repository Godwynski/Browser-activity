import { BraveManager } from '../src/browser.js';

async function main() {
  const m = new BraveManager();
  const pages = await m.getPages();
  const page = pages[0];
  
  console.log('Page URL:', page.url());
  const info = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      name: i.name,
      id: i.id,
      type: i.type,
      placeholder: i.placeholder,
      value: i.value
    }));
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a')).map(b => ({
      text: (b.innerText || b.value || '').trim(),
      id: b.id
    })).filter(x => x.text);

    return { inputs, buttons };
  });

  console.log('Info:', JSON.stringify(info, null, 2));
}

main().catch(console.error);
