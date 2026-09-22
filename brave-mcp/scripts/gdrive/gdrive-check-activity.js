import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  // Navigate to ye
  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Click Activity tab
  console.log('Clicking Activity tab...');
  const clickedActivity = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"], button, div'));
    const act = tabs.find(t => t.innerText?.trim() === 'Activity');
    if (act) {
      act.click();
      return true;
    }
    return false;
  });

  console.log('Clicked Activity:', clickedActivity);
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_activity_view.png' });
  console.log('Screenshot of Activity saved');

  const activities = await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('*'))
      .map(e => e.innerText?.trim())
      .filter(t => t && (t.includes('moved') || t.includes('created') || t.includes('item')));
    return Array.from(new Set(lines)).slice(0, 20);
  });

  console.log('Activities:', JSON.stringify(activities, null, 2));

  process.exit(0);
}

main().catch(console.error);
