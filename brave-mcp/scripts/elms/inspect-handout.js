import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager();
  const page = await brave.getActivePage();

  await page.goto('https://elms.sti.edu/student_lesson/show/5713354?lesson_id=26770261', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log("Lesson page loaded:", await page.title());

  // Look for sections in sidebar or main area
  const sections = await page.evaluate(() => {
    const list = [];
    const links = document.querySelectorAll('a');
    links.forEach(a => {
      const t = (a.innerText || '').trim();
      if (t.toLowerCase().includes('handout') || a.href.includes('section_id=')) {
        list.push({ text: t, href: a.href });
      }
    });
    return list;
  });

  console.log("Discovered Handout section links:");
  console.log(JSON.stringify(sections, null, 2));

  // If we find a handout section, let's go to it!
  const handoutSection = sections.find(s => s.text.toLowerCase().includes('handout'));
  if (handoutSection) {
    console.log(`\nNavigating to Handout section: ${handoutSection.text} (${handoutSection.href})`);
    await page.goto(handoutSection.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Inspect what's on the handout page (download buttons, links, embedded pdfs)
    const content = await page.evaluate(() => {
      const dlLinks = Array.from(document.querySelectorAll('a, button, iframe, embed, object'))
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          text: el.innerText ? el.innerText.trim() : '',
          href: el.href || el.src || '',
          download: el.getAttribute('download')
        }))
        .filter(el => el.href || el.download || el.text.toLowerCase().includes('download'));
      return dlLinks;
    });

    console.log("\nDownloadable items / embedded content on Handout page:");
    console.log(JSON.stringify(content, null, 2));
  }
}

main().catch(console.error);
