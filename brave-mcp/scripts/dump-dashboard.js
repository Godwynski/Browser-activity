import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager();
  const page = await brave.getActivePage();

  const courses = await page.evaluate(() => {
    const map = new Map();
    const links = Array.from(document.querySelectorAll('a[href*="/student_class/show/"]'));
    
    links.forEach(a => {
      const href = a.href;
      const text = (a.innerText || a.getAttribute('title') || '').trim();
      if (text && !map.has(href)) {
        map.set(href, text);
      }
    });

    return Array.from(map.entries()).map(([url, title]) => ({ url, title }));
  });

  console.log("=== ENROLLED COURSES MATCHED ===");
  courses.forEach(c => console.log(`• ${c.title} -> ${c.url}`));
}

main().catch(console.error);
