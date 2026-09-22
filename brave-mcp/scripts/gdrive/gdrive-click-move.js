import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  // The dialog is already open on the page!
  console.log('1. Clicking on "Videos" in Move dialog...');
  const videosRow = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return 'No dialog';
    const all = Array.from(dialog.querySelectorAll('*'));
    const target = all.find(e => e.innerText?.trim() === 'Videos' || (e.innerText?.includes('Videos') && e.children.length <= 2));
    if (target) {
      target.click();
      return { tag: target.tagName, text: target.innerText, clicked: true };
    }
    return 'Not found';
  });

  console.log('Videos target:', videosRow);
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_videos_clicked.png' });
  console.log('Screenshot saved: artifacts/screenshots/gdrive_videos_clicked.png');

  // Click Move button
  console.log('2. Clicking Move button...');
  const moveBtn = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return false;
    const btn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Move');
    if (btn) {
      const disabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
      if (!disabled) {
        btn.click();
        return { clicked: true };
      }
      return { disabled: true };
    }
    return { notFound: true };
  });

  console.log('Move button status:', moveBtn);
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_after_move_success.png' });
  console.log('Screenshot saved: artifacts/screenshots/gdrive_after_move_success.png');

  process.exit(0);
}

main().catch(console.error);
