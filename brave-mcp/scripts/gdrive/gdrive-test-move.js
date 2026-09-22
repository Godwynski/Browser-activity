import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  // Backup folder
  const backupFolderId = '1k---k7gCYoHtFtUX73uldWHVp0l5zemB';
  if (!page.url().includes(backupFolderId)) {
    await page.goto(`https://drive.google.com/drive/u/0/folders/${backupFolderId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  // Select item
  const item = await page.$('[data-id="1yNNQggBdVuM2VuWxqiR2ZmjuGwAUVLpX"]');
  if (item) {
    await item.click();
    await page.waitForTimeout(1000);

    const moveBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
      const found = btns.find(b => {
        const a = (b.getAttribute('aria-label') || '').toLowerCase();
        const t = (b.getAttribute('data-tooltip') || '').toLowerCase();
        return a.includes('move') || t.includes('move');
      });
      if (!found) return null;
      return {
        tag: found.tagName,
        aria: found.getAttribute('aria-label'),
        tooltip: found.getAttribute('data-tooltip'),
        class: found.className
      };
    });

    console.log('Found Move button:', moveBtn);

    if (moveBtn) {
      // Click the Move button
      console.log('Clicking Move button...');
      await page.click(`button[data-tooltip*="Move" i], button[aria-label*="Move" i], [role="button"][data-tooltip*="Move" i], [role="button"][aria-label*="Move" i]`);
      await page.waitForTimeout(2000);

      // Screenshot Move picker
      await page.screenshot({ path: 'artifacts/screenshots/gdrive_move_picker.png' });
      console.log('Captured Move picker screenshot!');

      const pickerDetails = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return 'No dialog found';
        return {
          title: dialog.innerText.slice(0, 300),
          tabs: Array.from(dialog.querySelectorAll('[role="tab"]')).map(t => t.innerText),
          buttons: Array.from(dialog.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean)
        };
      });
      console.log('Picker details:', pickerDetails);
    }
  }

  process.exit(0);
}

main().catch(console.error);
