import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BraveManager } from '../src/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_HANDOUTS_DIR = path.resolve(__dirname, '../../Handouts');

const TARGET_SUBJECTS = [
  { name: 'Computer Graphics Programming', classId: '5713354' },
  { name: 'Euthenics 2', classId: '5713244' },
  { name: 'Game Development', classId: '5712641' },
  { name: 'Information Assurance and Security', classId: '5713238' },
  { name: 'IT Capstone Project 2', classId: '5713247' },
  { name: 'IT Service Management', classId: '5713245' },
  { name: 'Network Technology 2', classId: '5713246' }
];

async function inspectSubjectTerms(page, subject) {
  console.log(`\n==========================================================`);
  console.log(`🔍 Inspecting Term Structure for: ${subject.name}`);
  console.log(`==========================================================`);

  const classUrl = `https://elms.sti.edu/student_class/show/${subject.classId}`;
  await page.goto(classUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);

  // 1. First lesson URL
  const firstLessonUrl = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/student_lesson/show/"]');
    return a ? a.href : null;
  });

  if (!firstLessonUrl) {
    console.log(`No lessons found for ${subject.name}`);
    return [];
  }

  await page.goto(firstLessonUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);

  // Expand all
  await page.evaluate(() => {
    const expandBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
      (el.innerText || '').toLowerCase().includes('expand all')
    );
    if (expandBtn) expandBtn.click();
  }).catch(() => {});
  await page.waitForTimeout(800);

  // Inspect modules & their sections
  const moduleData = await page.evaluate(() => {
    const results = [];

    // In Cypher Learning NEO LMS, the sidebar lessons have headers/containers
    // Let's inspect all lesson items and sections in order
    const menuItems = Array.from(document.querySelectorAll('#left_menu li, #toc li, .toc_item, [class*="toc"], .menu_item, .sub_menu'));
    
    // Also inspect all headers / links in sidebar
    const allLinks = Array.from(document.querySelectorAll('#left_menu a, #toc a, .toc a, nav a, .left a'));
    
    let currentModule = 'General';
    let currentTerm = 'Unknown';

    allLinks.forEach(a => {
      const text = (a.innerText || '').trim();
      const lower = text.toLowerCase();
      
      // Check if this link represents a module header (often has numbers like 1., 2., or term in parentheses)
      if (lower.includes('(prelim') || lower.includes('prelim)') || lower.includes('preliminary')) {
        currentTerm = 'Prelim';
      } else if (lower.includes('(midterm') || lower.includes('midterm)')) {
        currentTerm = 'Midterm';
      } else if (lower.includes('(pre-final') || lower.includes('pre-final)') || lower.includes('(prefinal') || lower.includes('prefinal)')) {
        currentTerm = 'Pre-finals';
      } else if (lower.includes('(final') || lower.includes('final)')) {
        currentTerm = 'Finals';
      }

      if (text.includes('Handout') || lower.includes('handout')) {
        const isActivity = lower.includes('activity') || lower.includes('lab') || lower.includes('exercise') || lower.includes('quiz');
        if (!isActivity) {
          results.push({
            sectionText: text.replace(/\n+/g, ' '),
            term: currentTerm,
            href: a.href
          });
        }
      }
    });

    return results;
  });

  console.log(`Discovered Handout mappings for ${subject.name}:`);
  console.log(JSON.stringify(moduleData, null, 2));

  return moduleData;
}

async function main() {
  const brave = new BraveManager();
  const page = await brave.getActivePage();

  const allMappings = {};
  for (const subject of TARGET_SUBJECTS) {
    try {
      allMappings[subject.name] = await inspectSubjectTerms(page, subject);
    } catch (e) {
      console.error(`Error on ${subject.name}: ${e.message}`);
      allMappings[subject.name] = [];
    }
  }

  console.log("\n==========================================================");
  console.log("TERM MAPPING DATA SUMMARY");
  console.log("==========================================================");
  console.log(JSON.stringify(allMappings, null, 2));
}

main().catch(console.error);
