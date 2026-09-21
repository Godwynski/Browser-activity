import fs from 'fs';
import path from 'path';
import { PATHS, ensureArtifactDirs } from '../src/paths.js';

ensureArtifactDirs();
const BASE_DIR = PATHS.elmsHandouts;

const ORGANIZATION = {
  'Computer Graphics Programming': {
    'Prelim': ['01_Handout_1.pdf', '02_Handout_1.pdf'],
    'Midterm': ['03_Handout_1.pdf', '04_Handout_1.pdf'],
    'Pre-finals': ['05_Handout_1.pdf'],
    'Finals': ['06_Handout_1.pdf']
  },
  'Euthenics 2': {
    'Prelim': ['01_Handout_1A.pdf'],
    'Midterm': ['02_Handout_1A.pdf'],
    'Pre-finals': ['03_Handout_1A.pdf'],
    'Finals': ['04_Handout_1.pdf']
  },
  'Game Development': {
    'Prelim': ['01_Handout_1.pdf', '02_Handout_1.pdf'],
    'Midterm': ['03_Handout_1.pdf', '04_Handout_1.pdf'],
    'Pre-finals': ['05_Handout_1.pdf', '06_Handout_1.pdf'],
    'Finals': []
  },
  'Information Assurance and Security': {
    'Prelim': ['01 Handout 1.pdf', '02 Handout 1.pdf'],
    'Midterm': ['03 Handout 1.pdf', '04 Handout 1.pdf'],
    'Pre-finals': ['05 Handout 1.pdf'],
    'Finals': ['06 Handout 1.pdf']
  },
  'IT Capstone Project 2': {
    'Prelim': [],
    'Midterm': [],
    'Pre-finals': [],
    'Finals': []
  },
  'IT Service Management': {
    'Prelim': ['01 Handout 1.pdf', '02 Handout 1.pdf'],
    'Midterm': ['03 Handout 1.pdf', '04 Handout 1.pdf'],
    'Pre-finals': ['05 Handout 1.pdf', '06 Handout 1.pdf'],
    'Finals': ['07 Handout 1.pdf', '08 Handout 1.pdf']
  },
  'Network Technology 2': {
    'Prelim': ['01_Handout_1.pdf', '02_Handout_1.pdf', '03_Handout_1.pdf'],
    'Midterm': ['04_Handout_1.pdf', '05_Handout_1.pdf'],
    'Pre-finals': [],
    'Finals': []
  }
};

function main() {
  console.log('Organizing handouts into term folders (Prelim, Midterm, Pre-finals, Finals)...');

  for (const [subject, terms] of Object.entries(ORGANIZATION)) {
    const subjectDir = path.join(BASE_DIR, subject);
    if (!fs.existsSync(subjectDir)) {
      fs.mkdirSync(subjectDir, { recursive: true });
    }

    console.log(`\n📁 Subject: ${subject}`);

    for (const [term, fileList] of Object.entries(terms)) {
      const termDir = path.join(subjectDir, term);
      if (!fs.existsSync(termDir)) {
        fs.mkdirSync(termDir, { recursive: true });
      }

      for (const fileName of fileList) {
        const srcPath = path.join(subjectDir, fileName);
        const destPath = path.join(termDir, fileName);

        if (fs.existsSync(srcPath)) {
          fs.renameSync(srcPath, destPath);
          console.log(`  ✓ Moved [${fileName}] -> ${term}/`);
        } else if (fs.existsSync(destPath)) {
          console.log(`  ✓ Already in place: ${term}/${fileName}`);
        } else {
          console.warn(`  ⚠️ Warning: Source file not found: ${srcPath}`);
        }
      }
    }
  }

  console.log('\n✅ Handouts successfully organized by academic term!');
}

main();
