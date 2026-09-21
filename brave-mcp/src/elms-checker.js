import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BraveManager } from './browser.js';
import { globalTelemetry } from './telemetry-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../');
const COURSES_DIR = path.join(WORKSPACE_ROOT, 'courses');
const CACHE_FILE = path.join(WORKSPACE_ROOT, 'artifacts', 'elms_assignments_cache.json');

export const ENROLLED_SUBJECTS = [
  { name: 'Computer Graphics Programming', classId: '5713354' },
  { name: 'IT Service Management', classId: '5713245' },
  { name: 'Game Development', classId: '5712641' },
  { name: 'Information Assurance and Security', classId: '5713238' },
  { name: 'IT Capstone Project 2', classId: '5713247' },
  { name: 'Network Technology 2', classId: '5713246' },
  { name: 'Euthenics 2', classId: '5713244' }
];

export class ElmsChecker {
  constructor() {
    this.brave = new BraveManager();
  }

  getCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      }
    } catch (_) {}
    return { lastChecked: null, assignments: [] };
  }

  saveCache(data) {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[ElmsChecker] Failed to save cache:', err);
    }
  }

  async scanElmsAssignments() {
    globalTelemetry.startTask('elms-assignment-scan', 'Scan STI ELMS for Assignments', 'Academic Audit', ENROLLED_SUBJECTS.length + 1);
    globalTelemetry.step(1, ENROLLED_SUBJECTS.length + 1, 'Connecting to Brave Agent Window...');
    globalTelemetry.log('Initiating parallel co-browsing connection to STI ELMS...', 'info');

    let page = null;
    try {
      page = await this.brave.getAgentPage({ autoCreate: true });
    } catch (err) {
      globalTelemetry.error(`Failed to connect to Brave: ${err.message}. Ensure Brave is open on port 9222.`);
      throw err;
    }

    const allAssignments = [];
    const ignoredSet = globalTelemetry.getIgnoredList();

    // Check dashboard first
    try {
      await page.goto('https://elms.sti.edu/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000);

      const dashboardItems = await page.evaluate(() => {
        const todoItems = [];
        // Look for To-Do widget or upcoming assignment cards
        const cards = Array.from(document.querySelectorAll('.todo_item, .assignment_item, [class*="todo"], [class*="upcoming"] a'));
        cards.forEach(c => {
          const text = (c.innerText || '').trim();
          const href = c.href || (c.querySelector('a') ? c.querySelector('a').href : null);
          if (text && href && (href.includes('assignment') || href.includes('dropbox') || href.includes('quiz'))) {
            todoItems.push({ text: text.replace(/\s+/g, ' '), href });
          }
        });
        return todoItems;
      });

      if (dashboardItems.length > 0) {
        globalTelemetry.log(`Found ${dashboardItems.length} active To-Do item(s) on dashboard.`, 'info');
      }
    } catch (e) {
      globalTelemetry.log('Dashboard overview skipped, checking individual course rosters.', 'info');
    }

    // Iterate through enrolled subjects
    for (let i = 0; i < ENROLLED_SUBJECTS.length; i++) {
      const subject = ENROLLED_SUBJECTS[i];
      globalTelemetry.step(i + 2, ENROLLED_SUBJECTS.length + 1, `Scanning [${subject.name}]...`);
      globalTelemetry.log(`Checking assignments in ${subject.name} (Class ID: ${subject.classId})`, 'info');

      try {
        // 1. Direct check: Full list of assignments for this subject
        const listUrl = `https://elms.sti.edu/student_assignments/list/${subject.classId}`;
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1200);

        const currentUrl = page.url();
        const items = [];

        // Check if redirected to a single assignment
        if (currentUrl.includes('/student_dropbox_assignment/show/') || 
            currentUrl.includes('/student_assignment/show/') || 
            currentUrl.includes('/student_quiz/show/')) {
          const singleItem = await page.evaluate((subjName, url) => {
            const h = document.querySelector('.page_title, #center h1, #center h2, h1, h2');
            const title = h ? (h.innerText || '').trim() : document.title.replace(/\|.*$/, '').trim();
            const text = document.body.innerText;
            let status = 'Pending / Due';
            if (text.includes('Submitted on') || text.includes('Submission status: Submitted') || text.includes('Graded')) {
              status = 'Submitted';
            } else {
              status = '⏳ Due (Not Submitted)';
            }
            return { subject: subjName, title: title.replace(/\s+/g, ' '), url, status };
          }, subject.name, currentUrl);

          if (singleItem.title && singleItem.title.length > 2) {
            items.push(singleItem);
          }
        }

        // Parse all table rows and assignment cards from the list
        const listItems = await page.evaluate((subjName) => {
          const found = [];
          const rows = Array.from(document.querySelectorAll('table tr, .assignment_row, .item_row, li.assignment, .item'));
          
          rows.forEach(r => {
            if (r.querySelector('th') && !r.querySelector('td')) return;
            const a = r.querySelector('a[href*="/student_dropbox_assignment/"], a[href*="/student_assignment/"], a[href*="/student_quiz/"], a[href*="/student_quiz_assignment/"], a[href*="/student_survey/"], a[href*="/assignment"]');
            if (a) {
              const text = (a.innerText || a.getAttribute('title') || '').trim();
              const lower = text.toLowerCase();
              if (text.length > 2 && lower !== 'assignment' && lower !== 'title' && !lower.includes('expand all') && !lower.includes('handout')) {
                const rText = r.innerText || '';
                let status = '⏳ Due (Not Submitted)';
                if (/submitted|graded|completed|turned in/i.test(rText)) {
                  status = 'Submitted';
                } else if (/overdue|missing/i.test(rText)) {
                  status = 'Overdue';
                }
                found.push({ subject: subjName, title: text.replace(/\s+/g, ' '), url: a.href, status });
              }
            }
          });
          return found;
        }, subject.name);
        items.push(...listItems);

        // Also check due endpoint if list returned 0
        if (items.length === 0) {
          const dueUrl = `https://elms.sti.edu/student_assignments/due/${subject.classId}?redirect_if_one=true`;
          await page.goto(dueUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(1000);
        }

        // 2. Also check standard class page if no due items found
        if (items.length === 0) {
          const classUrl = `https://elms.sti.edu/student_class/show/${subject.classId}`;
          await page.goto(classUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(800);
        }

        // Collect any additional lesson or dropbox links
        const classItems = await page.evaluate((subjName) => {
          const list = [];
          const links = Array.from(document.querySelectorAll('a'));

          links.forEach(a => {
            const href = a.href || '';
            const text = (a.innerText || a.getAttribute('title') || '').trim();
            const lower = text.toLowerCase();

            const isAssignmentLink = 
              href.includes('/student_dropbox_assignment/show/') ||
              href.includes('/student_assignment/show/') ||
              href.includes('/student_quiz/show/') ||
              lower.includes('activity') ||
              lower.includes('laboratory') ||
              lower.includes('assignment') ||
              lower.includes('performance task');

            if (isAssignmentLink && text.length > 3 && !lower.includes('expand all') && !lower.includes('handout')) {
              // Try to find status or parent text
              const parentText = a.parentElement ? a.parentElement.innerText : '';
              let status = 'Unknown';
              if (parentText.includes('Submitted') || parentText.includes('Completed')) {
                status = 'Submitted';
              } else if (parentText.includes('Not submitted') || parentText.includes('Not started')) {
                status = 'Not Submitted';
              } else if (parentText.includes('Due') || parentText.includes('due')) {
                status = 'Pending / Due';
              }

              list.push({
                subject: subjName,
                title: text.replace(/\s+/g, ' '),
                url: href,
                status
              });
            }
          });

          // Deduplicate
          const seen = new Set();
          return list.filter(item => {
            if (seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
          });
        items.push(...classItems);

        // Deduplicate all discovered items for this subject
        const uniqueItems = [];
        const seenUrls = new Set();
        for (const it of items) {
          if (!seenUrls.has(it.url)) {
            seenUrls.add(it.url);
            uniqueItems.push(it);
          }
        }

        // Check each discovered item against local workspace & ignored list
        for (const item of uniqueItems) {
          const courseFolder = subject.name.replace(/\s+/g, '_');
          const cleanName = item.title.replace(/[/\\?%*:|"<>]/g, '_').trim();
          const itemKey = `${courseFolder}:${cleanName}`;
          const isIgnored = ignoredSet.has(itemKey);

          // Check if local folder exists in courses/<Subject>/assignments/midterm/
          const localMidtermDir = path.join(COURSES_DIR, courseFolder, 'assignments', 'midterm', cleanName);
          const localExists = fs.existsSync(localMidtermDir);
          let localCompleted = false;

          if (localExists) {
            const answerPath = path.join(localMidtermDir, 'answer.md');
            if (fs.existsSync(answerPath) && fs.statSync(answerPath).size > 50) {
              localCompleted = true;
            }
          }

          const assignmentEntry = {
            ...item,
            key: itemKey,
            cleanName,
            courseFolder,
            isIgnored,
            localExists,
            localCompleted,
            needsAction: !localCompleted && !isIgnored
          };

          allAssignments.push(assignmentEntry);

          if (assignmentEntry.needsAction) {
            globalTelemetry.log(`⏳ [${subject.name}] ${cleanName} — Unfinished!`, 'step');
          } else if (isIgnored) {
            globalTelemetry.log(`👁️‍🗨️ [${subject.name}] ${cleanName} — (Ignored)`, 'info');
          }
        }

      } catch (err) {
        globalTelemetry.log(`⚠️ Could not check ${subject.name}: ${err.message}`, 'warn');
      }
    }

    const unfinishedCount = allAssignments.filter(a => a.needsAction).length;
    const summaryMsg = `Scan Complete: Found ${allAssignments.length} assignments on ELMS (${unfinishedCount} unfinished / require action).`;
    globalTelemetry.complete(summaryMsg);

    const cacheData = {
      lastChecked: new Date().toISOString(),
      summary: {
        total: allAssignments.length,
        unfinished: unfinishedCount,
        ignored: allAssignments.filter(a => a.isIgnored).length
      },
      assignments: allAssignments
    };

    this.saveCache(cacheData);
    return cacheData;
  }
}

export const elmsChecker = new ElmsChecker();
