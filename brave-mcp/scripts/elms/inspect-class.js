import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager();
  const page = await brave.getActivePage();

  await page.goto('https://elms.sti.edu/student_class/show/5713354', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log("Class page loaded:", await page.title());

  // Check lessons, modules, and handouts
  const lessonData = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(a => ({
      text: (a.innerText || '').trim(),
      href: a.href,
      classes: a.className
    })).filter(l => l.text && (
      l.href.includes('/student_lesson') || 
      l.href.includes('/file/') || 
      l.href.includes('/download') ||
      l.text.toLowerCase().includes('handout') ||
      l.text.toLowerCase().includes('module') ||
      l.text.toLowerCase().includes('outline')
    ));
  });

  console.log("Discovered Lessons / Handouts in Computer Graphics Programming:");
  console.log(JSON.stringify(lessonData, null, 2));
}

main().catch(console.error);
