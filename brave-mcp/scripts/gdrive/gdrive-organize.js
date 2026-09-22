import { BraveManager } from '../../src/browser.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Connecting to Brave and opening dedicated Agent Window...');
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const agentPage = await brave.getAgentPage({ autoCreate: true });
  console.log('✅ Agent Window ready. Navigating to Google Drive folder...');

  const gdriveUrl = 'https://drive.google.com/drive/u/0/folders/1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await agentPage.goto(gdriveUrl, { waitUntil: 'networkidle', timeout: 45000 }).catch(async () => {
    await agentPage.goto(gdriveUrl, { waitUntil: 'domcontentloaded' });
  });

  await agentPage.waitForTimeout(4000);

  // Ensure artifacts/screenshots exists
  const screenshotsDir = path.resolve('artifacts', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const screenshotPath = path.join(screenshotsDir, 'gdrive_initial.png');
  await agentPage.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 Captured screenshot to: ${screenshotPath}`);

  // Inspect page details
  const pageDetails = await agentPage.evaluate(() => {
    const title = document.title;
    const url = window.location.href;
    const textSnippet = document.body.innerText.slice(0, 800);

    // Look for file/folder items in DOM
    const items = [];
    const elements = document.querySelectorAll('[role="row"], [role="listitem"], [data-target="item"], [data-id]');
    elements.forEach(el => {
      const name = el.innerText?.split('\n')[0] || el.getAttribute('aria-label') || '';
      if (name && name.length > 2 && !items.includes(name)) {
        items.push(name);
      }
    });

    return {
      title,
      url,
      textSnippet,
      sampleItems: items.slice(0, 30)
    };
  });

  console.log('Page Details:', JSON.stringify(pageDetails, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
