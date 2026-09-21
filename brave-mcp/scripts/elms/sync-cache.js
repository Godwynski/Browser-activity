import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../../');
const CACHE_FILE = path.join(ROOT, 'artifacts', 'elms_assignments_cache.json');

const INITIAL_ASSIGNMENTS = [
  {
    subject: 'IT Service Management',
    classId: '5713245',
    title: '03 Assignment 1: Evaluating DevOps-Centered Organizations',
    cleanName: '03_Assignment_1',
    url: 'https://elms.sti.edu/student_assignments/list/5713245',
    status: '⏳ Due / Pending Submission',
    needsAction: true,
    dueDate: 'Midterm Term'
  },
  {
    subject: 'IT Service Management',
    classId: '5713245',
    title: '03 Activity 1: IT Service Systems for Enterprises',
    cleanName: '03_Activity_1',
    url: 'https://elms.sti.edu/student_assignments/list/5713245',
    status: '⏳ Due / Pending Submission',
    needsAction: true,
    dueDate: 'Midterm Term'
  },
  {
    subject: 'IT Service Management',
    classId: '5713245',
    title: '04 Performance Task 1: Enterprise System Implementation',
    cleanName: '04_Performance_Task_1',
    url: 'https://elms.sti.edu/student_assignments/list/5713245',
    status: '⏳ Due / Pending Submission',
    needsAction: true,
    dueDate: 'Midterm Term'
  },
  {
    subject: 'Computer Graphics Programming',
    classId: '5713354',
    title: '03 Laboratory Exercise 1: 3D Wireframe Cube',
    cleanName: '03_Laboratory_Exercise_1',
    url: 'https://elms.sti.edu/student_assignments/list/5713354',
    status: '✅ Completed (Code in src/ & answer.md)',
    needsAction: false,
    dueDate: 'Midterm Term'
  }
];

function main() {
  console.log('🔄 Syncing ELMS assignments cache...');
  
  let existing = { assignments: [] };
  if (fs.existsSync(CACHE_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch (_) {}
  }

  const map = new Map((existing.assignments || []).map(a => [a.cleanName || a.title, a]));
  for (const item of INITIAL_ASSIGNMENTS) {
    if (!map.has(item.cleanName)) {
      map.set(item.cleanName, item);
    }
  }

  const updated = {
    lastChecked: new Date().toISOString(),
    summary: {
      total: map.size,
      pending: Array.from(map.values()).filter(a => a.needsAction).length
    },
    assignments: Array.from(map.values())
  };

  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(updated, null, 2), 'utf8');
  console.log(`✅ Synced ${map.size} assignment(s) to ${CACHE_FILE}`);
}

main();
