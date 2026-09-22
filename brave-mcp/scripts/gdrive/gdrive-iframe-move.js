import { BraveManager } from '../../src/browser.js';

async function main() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('drive.google.com')) || pages[0];

  const pickerFrame = page.frames().find(f => f.url().includes('picker/minpick'));
  if (!pickerFrame) {
    console.error('Picker frame not found!');
    process.exit(1);
  }

  console.log('✅ Found picker frame:', pickerFrame.url().slice(0, 100));

  // Inspect elements inside picker frame
  const items = await pickerFrame.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .map(e => e.innerText?.trim())
      .filter(t => t && ['ye', 'Videos', 'Photos', 'Metadata'].includes(t));
  });

  console.log('Found folders in picker:', items);

  // Click on "Videos" inside the picker frame
  console.log('Clicking "Videos" in picker frame...');
  const clickedVideos = await pickerFrame.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(e => e.innerText?.trim() === 'Videos' && e.children.length === 0);
    if (el) {
      el.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Videos:', clickedVideos);
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_picker_frame_videos.png' });

  // Click Move button inside picker frame
  console.log('Clicking Move button in picker frame...');
  const clickedMove = await pickerFrame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Move');
    if (btn && !btn.disabled) {
      btn.click();
      return { clicked: true };
    }
    return { disabled: btn ? btn.disabled : 'not found' };
  });

  console.log('Clicked Move status:', clickedMove);
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'artifacts/screenshots/gdrive_moved_successfully.png' });
  console.log('📸 Screenshot saved: artifacts/screenshots/gdrive_moved_successfully.png');

  process.exit(0);
}

main().catch(console.error);
