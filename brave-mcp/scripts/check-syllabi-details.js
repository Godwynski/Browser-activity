import { BraveManager } from '../src/browser.js';

const CLASSES = [
  { name: 'Computer Graphics Programming', classId: '5713354' },
  { name: 'Euthenics 2', classId: '5713244' },
  { name: 'Game Development', classId: '5712641' },
  { name: 'Information Assurance and Security', classId: '5713238' },
  { name: 'IT Capstone Project 2', classId: '5713247' },
  { name: 'IT Service Management', classId: '5713245' },
  { name: 'Network Technology 2', classId: '5713246' }
];

async function run() {
  const brave = new BraveManager();
  const page = await brave.getActivePage();

  for (const c of CLASSES) {
    console.log(`\n========================================`);
    console.log(`Course: ${c.name} (${c.classId})`);
    console.log(`========================================`);
    await page.goto(`https://elms.sti.edu/student_class/show/${c.classId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Get all lessons text & href
    const lessons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/student_lesson/show/"]')).map(a => ({
        text: (a.innerText || '').trim().replace(/\s+/g, ' '),
        href: a.href
      }));
    });

    console.log(`Found ${lessons.length} lesson links:`);
    lessons.forEach((l, idx) => console.log(`  [${idx}] ${l.text} -> ${l.href}`));

    // Find syllabus lesson
    const syl = lessons.find(l => /syllabus|outline/i.test(l.text));
    if (syl) {
      console.log(`\nInspecting syllabus: ${syl.text}`);
      await page.goto(syl.href, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const sylData = await page.evaluate(() => {
        const allText = document.body.innerText;
        const links = Array.from(document.querySelectorAll('a, iframe, embed')).map(x => ({
          tag: x.tagName,
          text: (x.innerText || '').trim(),
          src: x.src || x.href || ''
        })).filter(x => x.src && !x.src.startsWith('javascript:'));

        return {
          textSample: allText.slice(0, 3000),
          links
        };
      });

      console.log(`Syllabus Links:`, JSON.stringify(sylData.links, null, 2));
      const matches = sylData.textSample.split('\n').filter(line => /prelim|midterm|pre-final|prefinal|final|module|week/i.test(line));
      console.log(`Syllabus Matching lines:`, matches.slice(0, 20));
    }
  }
}

run().catch(console.error);
