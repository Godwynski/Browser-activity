import fs from 'fs';
import path from 'path';
import { BraveManager } from '../src/browser.js';

const URL = 'https://elms.sti.edu/files/3056044/03_Laboratory_Exercise_1(27).pdf?lmsauth=93bfd9fef6f7f7179cbd3dd4066ee94811e8cacc';
const OUT_DIR = path.resolve('../CGP_Midterm_Assignments/03_Laboratory_Exercise_1');
const OUT_FILE = path.join(OUT_DIR, '03_Laboratory_Exercise_1.pdf');

async function main() {
  const manager = new BraveManager();
  const conn = await manager.ensureConnected();
  const pages = conn.contexts ? conn.contexts().flatMap(c => c.pages()) : conn.pages();
  console.log(`Found ${pages.length} pages in browser`);
  
  const page = pages.find(p => p.url().includes('elms.sti.edu')) || pages[0];
  if (!page) {
    throw new Error('No page found in Brave');
  }

  console.log(`Using page: ${page.url()}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Downloading PDF from ${URL}...`);
  const base64Data = await page.evaluate(async (fileUrl) => {
    const resp = await fetch(fileUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, URL);

  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(OUT_FILE, buffer);
  console.log(`Successfully saved PDF to ${OUT_FILE} (${buffer.length} bytes)`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
