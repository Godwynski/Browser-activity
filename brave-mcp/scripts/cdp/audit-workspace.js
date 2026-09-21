import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../../');
const COURSES_DIR = path.join(ROOT, 'courses');
const IGNORED_FILE = path.join(COURSES_DIR, 'ignored_assignments.json');
const CACHE_FILE = path.join(ROOT, 'artifacts', 'elms_assignments_cache.json');

function main() {
  console.log('\n📊 ── ANTIGRAVITY WORKSPACE ACADEMIC AUDIT ──');
  
  let ignoredSet = new Set();
  try {
    if (fs.existsSync(IGNORED_FILE)) {
      const data = JSON.parse(fs.readFileSync(IGNORED_FILE, 'utf8'));
      ignoredSet = new Set(data.ignored || []);
    }
  } catch (_) {}

  const courses = fs.readdirSync(COURSES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);

  let total = 0;
  let complete = 0;
  let pending = 0;
  let ignored = 0;

  for (const course of courses) {
    const coursePath = path.join(COURSES_DIR, course);
    const midtermPath = path.join(coursePath, 'assignments', 'midterm');
    if (!fs.existsSync(midtermPath)) continue;

    const modules = fs.readdirSync(midtermPath, { withFileTypes: true })
      .filter(d => d.isDirectory());

    console.log(`\n📚 ${course.replace(/_/g, ' ')}:`);

    for (const mod of modules) {
      total++;
      const modDir = path.join(midtermPath, mod.name);
      const answerFile = path.join(modDir, 'answer.md');
      const hasAnswer = fs.existsSync(answerFile) && fs.statSync(answerFile).size > 50;
      const key = `${course}:${mod.name}`;

      if (ignoredSet.has(key)) {
        ignored++;
        console.log(`  👁️‍🗨️  ${mod.name} (Ignored)`);
      } else if (hasAnswer) {
        complete++;
        console.log(`  ✅  ${mod.name} — Completed`);
      } else {
        pending++;
        console.log(`  ⏳  ${mod.name} — Pending Deliverable`);
      }
    }
  }

  // Check ELMS live cache
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const elmsPending = (cache.assignments || []).filter(a => a.needsAction && !ignoredSet.has(`${(a.subject||'').replace(/ /g,'_')}:${a.cleanName||a.title}`));
      if (elmsPending.length > 0) {
        console.log(`\n🌐 Active on STI ELMS (${elmsPending.length} detected):`);
        elmsPending.forEach(p => {
          console.log(`  📌 [${p.subject}] ${p.title} (${p.status || 'Due Soon'})`);
        });
      }
    } catch (_) {}
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`Summary: ${complete}/${total} Completed | ${pending} Pending | ${ignored} Ignored\n`);
}

main();
