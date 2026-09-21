import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../../');
const CACHE_FILE = path.join(ROOT, 'artifacts', 'elms_assignments_cache.json');
const IGNORED_FILE = path.join(ROOT, 'courses', 'ignored_assignments.json');

function main() {
  console.log('\n📋 ── STI ELMS ASSIGNMENTS (LIVE CACHE) ──\n');

  let ignoredSet = new Set();
  try {
    if (fs.existsSync(IGNORED_FILE)) {
      const data = JSON.parse(fs.readFileSync(IGNORED_FILE, 'utf8'));
      ignoredSet = new Set(data.ignored || []);
    }
  } catch (_) {}

  if (!fs.existsSync(CACHE_FILE)) {
    console.log('No cache found. Open an STI ELMS assignment list page or run sync to populate.');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const items = data.assignments || [];

    if (items.length === 0) {
      console.log('No assignments recorded in cache.');
      return;
    }

    const bySubject = {};
    items.forEach(it => {
      const s = it.subject || 'General';
      if (!bySubject[s]) bySubject[s] = [];
      bySubject[s].push(it);
    });

    for (const [subj, list] of Object.entries(bySubject)) {
      console.log(`📌 Subject: ${subj} (${list.length} item(s))`);
      list.forEach(item => {
        const key = `${subj.replace(/ /g, '_')}:${item.cleanName || item.title}`;
        const isIgnored = ignoredSet.has(key);
        const status = isIgnored ? '👁️‍🗨️ Ignored' : (item.status || 'Due');
        console.log(`   • ${item.title}`);
        console.log(`     Status: ${status} | Due: ${item.dueDate || 'N/A'}`);
        console.log(`     URL: ${item.url || 'N/A'}`);
      });
      console.log('');
    }
  } catch (err) {
    console.error('Error reading cache:', err.message);
  }
}

main();
