import { BraveManager } from '../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  // Navigate to root folder 'ye'
  const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';
  await page.goto(`https://drive.google.com/drive/u/0/folders/${yeFolderId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Inspect page context and global objects
  const context = await page.evaluate(() => {
    // Check for access tokens or gapi
    const gapiAuth = window.gapi?.auth2 || window.gapi?.client;
    
    // Check for Drive internal tokens in scripts or cookies
    const cookies = document.cookie.split('; ').map(s => s.split('=')[0]);

    // Check UI buttons
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .map(b => ({
        text: b.innerText?.trim() || '',
        ariaLabel: b.getAttribute('aria-label') || '',
        id: b.id || ''
      }))
      .filter(b => b.text || b.ariaLabel);

    return {
      title: document.title,
      url: window.location.href,
      cookiesCount: cookies.length,
      sampleButtons: buttons.slice(0, 20)
    };
  });

  console.log('Page Context:', JSON.stringify(context, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
