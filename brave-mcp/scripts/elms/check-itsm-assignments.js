import { BraveManager } from '../src/browser.js';

async function main() {
  const manager = new BraveManager();
  console.log('Connecting to Brave...');
  const page = await manager.getAgentPage();
  
  const classId = '5713245'; // IT Service Management
  const classUrl = `https://elms.sti.edu/student_class/show/${classId}`;
  
  console.log(`Navigating to ${classUrl}...`);
  await page.goto(classUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Get class title and tabs/navigation
  const pageInfo = await page.evaluate(() => {
    const title = document.title;
    const links = Array.from(document.querySelectorAll('a')).map(a => ({
      text: (a.innerText || '').trim(),
      href: a.href
    })).filter(x => x.text && x.href);
    return { title, links: links.slice(0, 50) };
  });

  console.log('Page title:', pageInfo.title);
  
  // Look for Assignments tab or link
  const assignmentLink = pageInfo.links.find(l => l.text.toLowerCase().includes('assignment') || l.href.includes('assignment'));
  console.log('Assignment link found:', assignmentLink);

  let targetUrl = assignmentLink ? assignmentLink.href : classUrl;
  if (assignmentLink) {
    await page.goto(assignmentLink.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
  }

  // Scrape assignments list
  const assignments = await page.evaluate(() => {
    // In NEO LMS, assignments are often in a table or list with status (e.g. Not submitted, Not started, Due date, etc.)
    const rows = Array.from(document.querySelectorAll('tr, .item, .card, li, .assignment'));
    const items = [];
    
    // Also look for specific tables
    const tableRows = Array.from(document.querySelectorAll('table tr'));
    if (tableRows.length > 0) {
      tableRows.forEach(tr => {
        const text = tr.innerText.trim();
        const a = tr.querySelector('a');
        if (text && a) {
          items.push({
            text: text.replace(/\s+/g, ' '),
            href: a.href,
            title: a.innerText.trim()
          });
        }
      });
    }

    return {
      bodyTextSnippet: document.body.innerText.slice(0, 1500),
      items
    };
  });

  console.log('Assignments check results:');
  console.log('Snippet:', assignments.bodyTextSnippet);
  console.log('Items found:', assignments.items);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
