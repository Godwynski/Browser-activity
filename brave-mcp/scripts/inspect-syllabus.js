import { BraveManager } from '../src/browser.js';

const SUBJECTS_TO_CHECK = [
  { name: 'Computer Graphics Programming', classId: '5713354' },
  { name: 'Euthenics 2', classId: '5713244' },
  { name: 'Game Development', classId: '5712641' },
  { name: 'Information Assurance and Security', classId: '5713238' },
  { name: 'Network Technology 2', classId: '5713246' }
];

async function main() {
  const brave = new BraveManager();
  const page = await brave.getActivePage();

  for (const s of SUBJECTS_TO_CHECK) {
    console.log(`\n==========================================================`);
    console.log(`📋 Inspecting Syllabus / Lessons for: ${s.name}`);
    console.log(`==========================================================`);

    const classUrl = `https://elms.sti.edu/student_class/show/${s.classId}`;
    await page.goto(classUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(800);

    // Get all lesson titles and their order
    const lessons = await page.evaluate(() => {
      const list = [];
      const links = document.querySelectorAll('a[href*="/student_lesson/show/"]');
      links.forEach(a => {
        const text = (a.innerText || '').trim();
        if (text && !list.some(x => x.text === text)) {
          list.push({ text, href: a.href });
        }
      });
      return list;
    });

    console.log(`Lessons in ${s.name}:`);
    lessons.forEach(l => console.log(`   • ${l.text.replace(/\n+/g, ' ')}`));

    // Also find Syllabus link
    const syllabusLink = lessons.find(l => l.text.toLowerCase().includes('syllabus') || l.text.toLowerCase().includes('course outline'));
    if (syllabusLink) {
      console.log(`\n   Visiting Syllabus: ${syllabusLink.text}`);
      await page.goto(syllabusLink.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);

      const outlineText = await page.evaluate(() => {
        const center = document.querySelector('#center, .center, #content, .content') || document.body;
        return center.innerText;
      });

      // Find lines mentioning Prelim, Midterm, Pre-final, Final
      const lines = outlineText.split('\n')
        .map(l => l.trim())
        .filter(l => /prelim|midterm|pre-final|prefinal|final|week|module/i.test(l));
      
      console.log(`   Syllabus key lines:`);
      lines.slice(0, 30).forEach(l => console.log(`     - ${l}`));
    }
  }
}

main().catch(console.error);
