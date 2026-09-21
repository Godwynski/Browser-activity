import fs from 'fs';
import path from 'path';
import { BraveManager } from '../src/browser.js';

const ASSIGNMENTS = [
  {
    name: '03 Activity 1',
    url: 'https://elms.sti.edu/student_dropbox_assignment/show/58959503'
  },
  {
    name: '03 Assignment 1 - ARG',
    url: 'https://elms.sti.edu/student_dropbox_assignment/show/58959504'
  },
  {
    name: '04 Performance Task 1 - ARG',
    url: 'https://elms.sti.edu/student_dropbox_assignment/show/58959507'
  }
];

async function main() {
  const manager = new BraveManager();
  const page = await manager.getAgentPage();
  const results = [];

  for (const item of ASSIGNMENTS) {
    console.log(`\n==============================================`);
    console.log(`Fetching details for: ${item.name}`);
    console.log(`URL: ${item.url}`);
    console.log(`==============================================`);

    await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const details = await page.evaluate((targetName) => {
      const title = document.title;
      const fullText = document.body.innerText;

      // Find main container
      const centerEl = document.querySelector('#center, .center, #main, .content, .center_column') || document.body;

      // Find all links (especially files, docx, pdf)
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: (a.innerText || '').trim(),
        href: a.href
      })).filter(x => x.text && x.href && (
        x.href.includes('/files/') || 
        x.href.includes('/download') ||
        x.href.endsWith('.pdf') || 
        x.href.endsWith('.docx') ||
        x.text.toLowerCase().includes('.pdf') ||
        x.text.toLowerCase().includes('.docx') ||
        x.text.toLowerCase().includes('download')
      ));

      // Extract tables (e.g. rubrics, score criteria)
      const tables = Array.from(document.querySelectorAll('table')).map(t => t.innerText.trim());

      return {
        targetName,
        title,
        links,
        tables,
        centerText: centerEl.innerText
      };
    }, item.name);

    results.push(details);

    // If there are files to download, download them
    for (const link of details.links) {
      console.log(`Found file link in ${item.name}: ${link.text} -> ${link.href}`);
      try {
        const downloadDir = path.resolve(`artifacts/downloads/elms/assignments/${item.name}`);
        fs.mkdirSync(downloadDir, { recursive: true });
        
        // Use page to trigger or fetch
        const [ download ] = await Promise.all([
          page.waitForEvent('download', { timeout: 7000 }).catch(() => null),
          page.evaluate((href) => {
            const a = Array.from(document.querySelectorAll('a')).find(el => el.href === href);
            if (a) a.click();
          }, link.href)
        ]);

        if (download) {
          const suggested = download.suggestedFilename();
          const target = path.join(downloadDir, suggested);
          await download.saveAs(target);
          console.log(`Downloaded: ${target}`);
        }
      } catch (err) {
        console.warn(`Could not auto-download file: ${err.message}`);
      }
    }
  }

  const outPath = path.resolve('artifacts/temp/midterm_assignment_prompts.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nSuccessfully saved all assignment prompts to: ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
