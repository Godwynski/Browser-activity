import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager();
  const page = await brave.getActivePage();

  const courses = await page.evaluate(() => {
    const list = [];
    // Find all links to student_lessons
    const links = document.querySelectorAll('a[href*="/student_lessons/list/"]');
    links.forEach(a => {
      // Find card title
      let card = a.closest('.card, .portal-course-card, .course_box, .dashboard-card, tr, li, div[class*="course"]');
      let title = '';
      if (card) {
        const h = card.querySelector('h1, h2, h3, h4, h5, .title, a[class*="title"]');
        if (h) title = h.innerText.trim();
      }
      if (!title) {
        title = (a.innerText || a.getAttribute('title') || '').trim();
      }
      list.push({ title, url: a.href });
    });
    return list;
  });

  console.log("Found courses:", JSON.stringify(courses, null, 2));
}

main().catch(console.error);
