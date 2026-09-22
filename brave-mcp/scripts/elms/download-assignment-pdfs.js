import fs from 'fs';
import path from 'path';
import { BraveManager } from '../../src/browser.js';

const FILES = [
  {
    name: '03_Activity_1.pdf',
    url: 'https://elms.sti.edu/files/8981488/03_Activity_1(9).pdf?lmsauth=a307a807293b1d6ef5e3212af8af09860bf68b68',
    outDir: 'artifacts/downloads/elms/assignments/03 Activity 1'
  },
  {
    name: '03_Assignment_1.pdf',
    url: 'https://elms.sti.edu/files/8981488/03_Assignment_1(6).pdf?lmsauth=8329537bfa044b6ad736f1fc0d7ec371b510fad3',
    outDir: 'artifacts/downloads/elms/assignments/03 Assignment 1 - ARG'
  },
  {
    name: '04_Performance_Task_1.pdf',
    url: 'https://elms.sti.edu/files/8981488/04_Performance_Task_1(5).pdf?lmsauth=6f095d7ab270ec258725a53ffeb7f452460e229e',
    outDir: 'artifacts/downloads/elms/assignments/04 Performance Task 1 - ARG'
  }
];

async function main() {
  const manager = new BraveManager();
  const page = await manager.getAgentPage();

  for (const item of FILES) {
    console.log(`Downloading ${item.name}...`);
    fs.mkdirSync(path.resolve(item.outDir), { recursive: true });
    const targetFile = path.resolve(item.outDir, item.name);

    // Fetch via browser context using evaluate
    const base64Data = await page.evaluate(async (fileUrl) => {
      const resp = await fetch(fileUrl);
      const blob = await resp.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result;
          resolve(res.split(',')[1]); // remove data:application/pdf;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }, item.url);

    fs.writeFileSync(targetFile, Buffer.from(base64Data, 'base64'));
    console.log(`Saved: ${targetFile} (${fs.statSync(targetFile).size} bytes)`);
  }

  console.log('All 3 assignment PDFs downloaded successfully!');
}

main().catch(err => {
  console.error('Download error:', err);
  process.exit(1);
});
