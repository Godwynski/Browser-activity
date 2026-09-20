import fs from 'fs';
import path from 'path';
import { BraveManager } from '../src/browser.js';
import { PATHS, ensureArtifactDirs } from '../src/paths.js';

const SYLLABI = [
  {
    course: 'Game Development',
    url: 'https://elms.sti.edu/files/3056044/IT2012_Syllabus_and_Course_Outline.pdf?lmsauth=0c2a002c9c4c8a74b114379ad2802775aaef50a7',
    file: 'GameDev_Syllabus.pdf'
  },
  {
    course: 'Information Assurance and Security',
    url: 'https://elms.sti.edu/files/8981488/IT2511_Syllabus_and_Course_Outline(4).pdf?lmsauth=f3efa2e6491486b5fa79dc51f830477354b5a292',
    file: 'IAS_Syllabus.pdf'
  },
  {
    course: 'Network Technology 2',
    url: 'https://elms.sti.edu/files/3056044/IT2607_Syllabus_and_Course_Outline(2).pdf?lmsauth=8ac5344f23047f49e14c6769df55e7ba3359a401',
    file: 'NetTech2_Syllabus.pdf'
  }
];

async function main() {
  const brave = new BraveManager();
  const page = await brave.getActivePage();

  ensureArtifactDirs();
  const outDir = PATHS.elmsSyllabi;

  for (const s of SYLLABI) {
    console.log(`Downloading syllabus for ${s.course}...`);
    const res = await page.evaluate(async (url) => {
      const resp = await fetch(url);
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }, s.url);

    const buf = Buffer.from(res, 'base64');
    const outPath = path.join(outDir, s.file);
    fs.writeFileSync(outPath, buf);
    console.log(`Saved ${s.file} (${buf.length} bytes)`);
  }
}

main().catch(console.error);
