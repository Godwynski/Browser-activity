import fs from 'fs';
import path from 'path';
import { BraveManager } from '../../src/browser.js';

async function main() {
  const manager = new BraveManager();
  console.log('Connecting to Brave...');
  const page = await manager.getAgentPage();

  const classId = '5713245'; // IT Service Management
  const classUrl = `https://elms.sti.edu/student_class/show/${classId}`;

  console.log(`Navigating to ${classUrl}...`);
  await page.goto(classUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if we are stuck on Microsoft login or ELMS login
  let currentUrl = page.url();
  if (currentUrl.includes('login.microsoftonline.com') || currentUrl.includes('/users/login') || currentUrl.includes('/login')) {
    console.log('⚠️ Authentication required! Currently at:', currentUrl);
    console.log('Waiting up to 60 seconds for user to sign in on the browser window...');
    
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000);
      currentUrl = page.url();
      if (!currentUrl.includes('login.microsoftonline.com') && !currentUrl.includes('/users/login') && !currentUrl.includes('/login')) {
        console.log('🎉 Login detected! Current URL:', currentUrl);
        break;
      }
    }
  }

  // If still on login page, exit with clear message
  if (page.url().includes('login.microsoftonline.com') || page.url().includes('/users/login') || page.url().includes('/login')) {
    console.log('❌ Still on login page. Please sign in to Microsoft/ELMS in the Brave window.');
    process.exit(2);
  }

  // Ensure we are on the ITSM class page
  if (!page.url().includes(`/student_class/show/${classId}`)) {
    await page.goto(classUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
  }

  console.log('Navigated to ITSM class page. Extracting tabs and assignments...');

  // Try finding the Assignments tab in the class navigation
  const assignmentsTabUrl = await page.evaluate((cId) => {
    const links = Array.from(document.querySelectorAll('a'));
    const a = links.find(el => {
      const text = (el.innerText || '').toLowerCase().trim();
      const href = el.href || '';
      return (text === 'assignments' || text === 'assessments' || text.includes('assignment')) && href.includes(cId);
    });
    return a ? a.href : null;
  }, classId);

  let assignmentList = [];

  if (assignmentsTabUrl) {
    console.log('Found Assignments tab:', assignmentsTabUrl);
    await page.goto(assignmentsTabUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    assignmentList = await page.evaluate(() => {
      const items = [];
      const rows = Array.from(document.querySelectorAll('tr, .item_row, .card, li.assignment'));
      rows.forEach(r => {
        const text = (r.innerText || '').replace(/\s+/g, ' ').trim();
        const a = r.querySelector('a');
        if (a && text) {
          items.push({
            title: (a.innerText || '').trim(),
            href: a.href,
            summary: text
          });
        }
      });
      return items;
    });
  }

  // Also check lessons sidebar/TOC for Midterm assignments
  console.log('Checking Lessons / TOC for Midterm sections...');
  const firstLessonUrl = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/student_lesson/show/"]');
    return a ? a.href : null;
  });

  if (firstLessonUrl) {
    await page.goto(firstLessonUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);

    // Expand all
    await page.evaluate(() => {
      const expandBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
        (el.innerText || '').toLowerCase().includes('expand all')
      );
      if (expandBtn) expandBtn.click();
    }).catch(() => {});
    await page.waitForTimeout(1000);

    const lessonItems = await page.evaluate(() => {
      const results = [];
      const links = Array.from(document.querySelectorAll('a[href*="section_id="], a[href*="/student_lesson/"], a[href*="/student_quiz_assignment/"]'));
      links.forEach(a => {
        const text = (a.innerText || '').trim();
        const href = a.href;
        if (text && href) {
          results.push({ text, href });
        }
      });
      return results;
    });

    console.log(`Found ${lessonItems.length} TOC items.`);
    
    // Filter for Midterm (03, 04) assignments/activities/tasks
    const midtermTasks = lessonItems.filter(item => {
      const lower = item.text.toLowerCase();
      const is03or04 = lower.includes('03') || lower.includes('04') || lower.includes('midterm');
      const isTask = lower.includes('assignment') || lower.includes('activity') || lower.includes('performance task') || lower.includes('quiz') || lower.includes('task');
      const isHandout = lower.includes('handout');
      return is03or04 && isTask && !isHandout;
    });

    console.log('Midterm tasks identified:', midtermTasks);
    
    // Inspect each task page to check status and extract questions
    const taskDetails = [];
    for (const task of midtermTasks) {
      console.log(`\nInspecting task: ${task.text} (${task.href})`);
      await page.goto(task.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);

      const detail = await page.evaluate((t) => {
        const bodyText = document.body.innerText;
        const mainContent = document.querySelector('#main, #content, .content, .center, .section_content, article') || document.body;
        
        // Check submission status
        const isSubmitted = bodyText.toLowerCase().includes('submitted') || bodyText.toLowerCase().includes('completed') || bodyText.toLowerCase().includes('view submission');
        const notStarted = bodyText.toLowerCase().includes('not submitted') || bodyText.toLowerCase().includes('not started') || bodyText.toLowerCase().includes('take quiz') || bodyText.toLowerCase().includes('prepare submission') || bodyText.toLowerCase().includes('submit assignment');

        // Look for downloadable assignment files
        const fileLinks = Array.from(mainContent.querySelectorAll('a')).filter(a => {
          const h = (a.href || '').toLowerCase();
          const txt = (a.innerText || '').toLowerCase();
          return h.includes('/files/') || h.endsWith('.pdf') || h.endsWith('.docx') || txt.endsWith('.pdf') || txt.endsWith('.docx');
        }).map(a => ({ text: a.innerText.trim(), href: a.href }));

        return {
          title: t.text,
          url: t.href,
          pageTitle: document.title,
          isSubmitted,
          notStarted,
          fileLinks,
          contentSnippet: mainContent.innerText.slice(0, 3000)
        };
      }, task);

      taskDetails.push(detail);
    }

    // Save scraped task details
    const outPath = path.resolve('artifacts/temp/itsm_midterm_tasks.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(taskDetails, null, 2), 'utf8');
    console.log(`\nSaved ${taskDetails.length} task details to ${outPath}`);
  }
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
