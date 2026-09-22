import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const WORKSPACE_ROOT = path.resolve(__dirname, '../../');
const COURSES_DIR = path.join(WORKSPACE_ROOT, 'courses');
const IGNORED_FILE = path.join(COURSES_DIR, 'ignored_assignments.json');
const SESSION_TOKEN_PATH = path.join(WORKSPACE_ROOT, 'artifacts', 'session_token.key');

export class TelemetryServer {
  constructor(port = 8765) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.tasks = new Map();
    this.directives = [];
    this.currentTask = {
      id: null,
      name: 'Idle',
      subject: 'None',
      status: 'IDLE', // IDLE | RUNNING | COMPLETED | ERROR
      currentStep: 0,
      totalSteps: 0,
      stepName: '',
      progress: 0,
      logs: []
    };
    this.actionHandlers = new Map();

    // Ephemeral localhost session token for authenticated operations
    try {
      const artifactsDir = path.join(WORKSPACE_ROOT, 'artifacts');
      if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
      if (!fs.existsSync(SESSION_TOKEN_PATH)) {
        const token = crypto.randomBytes(24).toString('hex');
        fs.writeFileSync(SESSION_TOKEN_PATH, token, 'utf8');
      }
      this.sessionToken = fs.readFileSync(SESSION_TOKEN_PATH, 'utf8').trim();
    } catch (_) {
      this.sessionToken = 'ag_local_dev_token';
    }
  }

  getIgnoredList() {
    try {
      if (fs.existsSync(IGNORED_FILE)) {
        const raw = fs.readFileSync(IGNORED_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return new Set(parsed.ignored || []);
      }
    } catch (_) {}
    return new Set();
  }

  saveIgnoredList(set) {
    try {
      if (!fs.existsSync(COURSES_DIR)) fs.mkdirSync(COURSES_DIR, { recursive: true });
      const data = { ignored: Array.from(set) };
      fs.writeFileSync(IGNORED_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Telemetry] Failed to save ignored list:', err);
    }
  }

  toggleIgnore(courseName, assignmentName, shouldIgnore) {
    const key = `${courseName}:${assignmentName}`;
    const set = this.getIgnoredList();
    if (shouldIgnore) {
      set.add(key);
    } else {
      set.delete(key);
    }
    this.saveIgnoredList(set);
    return set.has(key);
  }

  scanCourses() {
    if (!fs.existsSync(COURSES_DIR)) {
      return { courses: [], summary: { total: 0, completed: 0, unfinished: 0, ignored: 0 } };
    }

    const ignoredSet = this.getIgnoredList();
    const courseFolders = fs.readdirSync(COURSES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    let totalTasks = 0;
    let completedTasks = 0;
    let unfinishedTasks = 0;
    let ignoredTasks = 0;
    const courses = [];

    for (const folder of courseFolders) {
      const coursePath = path.join(COURSES_DIR, folder);
      const assignments = [];
      const termsDir = path.join(coursePath, 'assignments');

      if (fs.existsSync(termsDir)) {
        const terms = fs.readdirSync(termsDir, { withFileTypes: true }).filter(d => d.isDirectory());
        for (const term of terms) {
          const termPath = path.join(termsDir, term.name);
          const items = fs.readdirSync(termPath, { withFileTypes: true });

          for (const item of items) {
            const rawName = item.name.replace(/\.md$/, '');
            const itemDir = path.join(termPath, item.name);
            const key = `${folder}:${rawName}`;
            const isIgnored = ignoredSet.has(key);

            let hasCode = false;
            let hasMaterials = false;
            let hasAnswer = false;
            const missing = [];

            if (item.isDirectory()) {
              const srcDir = path.join(itemDir, 'src');
              const matDir = path.join(itemDir, 'materials');
              hasCode = fs.existsSync(srcDir) && fs.readdirSync(srcDir).length > 0;
              hasMaterials = fs.existsSync(matDir) && fs.readdirSync(matDir).length > 0;

              const answerMd = path.join(itemDir, 'answer.md');
              const legacyMd = path.join(itemDir, `${item.name}.md`);
              if (fs.existsSync(answerMd) && fs.statSync(answerMd).size > 50) {
                hasAnswer = true;
              } else if (fs.existsSync(legacyMd) && fs.statSync(legacyMd).size > 50) {
                hasAnswer = true;
              }
            } else if (item.isFile() && item.name.endsWith('.md')) {
              hasAnswer = fs.statSync(itemDir).size > 50;
            }

            const isCodeExpected = folder.includes('Graphics') || folder.includes('Game') || rawName.toLowerCase().includes('lab');

            if (!hasAnswer) {
              missing.push('Deliverable Report (answer.md)');
            }
            if (isCodeExpected && !hasCode) {
              missing.push('Executable Code (src/)');
            }

            let status = 'COMPLETED';
            if (isIgnored) {
              status = 'IGNORED';
              ignoredTasks++;
            } else if (missing.length > 0) {
              status = 'UNFINISHED';
              unfinishedTasks++;
            } else {
              status = 'COMPLETED';
              completedTasks++;
            }
            totalTasks++;

            assignments.push({
              name: rawName,
              term: term.name,
              key,
              hasCode,
              hasMaterials,
              hasAnswer,
              isCodeExpected,
              isIgnored,
              status,
              missing
            });
          }
        }
      }

      courses.push({
        name: folder,
        displayName: folder.replace(/_/g, ' '),
        assignments
      });
    }

    return {
      courses,
      summary: {
        total: totalTasks,
        completed: completedTasks,
        unfinished: unfinishedTasks,
        ignored: ignoredTasks
      }
    };
  }

  start() {
    if (this.server) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url, `http://localhost:${this.port}`);

        // 1. Health API
        if (url.pathname === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', task: this.currentTask }));
          return;
        }

        // 1b. Directives API (from In-HUD Prompt Bar)
        if (url.pathname === '/api/directives/submit' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { prompt, url: pageUrl, title } = JSON.parse(body);
              if (!prompt) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Prompt is required' }));
                return;
              }
              const directiveId = `dir_${Date.now()}`;
              const entry = { id: directiveId, prompt, url: pageUrl, title, timestamp: new Date().toISOString() };
              this.directives.push(entry);
              this.log(`📩 [HUD Directive] "${prompt}"`, 'step');
              this.broadcast('DIRECTIVE_RECEIVED', entry);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, id: directiveId, message: 'Directive queued for Antigravity' }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 2. Courses & Assignment Status API
        if (url.pathname === '/api/courses' && req.method === 'GET') {
          try {
            const data = this.scanCourses();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 2b. ELMS Scanned Assignments API
        if (url.pathname === '/api/elms/assignments' && req.method === 'GET') {
          import('./elms-checker.js').then(({ elmsChecker }) => {
            const cache = elmsChecker.getCache();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(cache));
          }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });
          return;
        }

        // 2c. Action: Scan STI ELMS for Assignments via Brave
        if (url.pathname === '/api/elms/scan' && req.method === 'POST') {
          import('./elms-checker.js').then(({ elmsChecker }) => {
            elmsChecker.scanElmsAssignments().catch(err => {
              console.error('[Telemetry] ELMS scan error:', err.message);
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'ELMS scan started in background agent window' }));
          }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });
          return;
        }

        // 2d. Action: Ingest Discovered ELMS Assignment
        if (url.pathname === '/api/elms/ingest' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { subject, title, url: targetUrl, term = 'midterm' } = JSON.parse(body);
              if (!subject || !title || /internet explorer|unsupported browser/i.test(title)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid or ignored assignment title' }));
                return;
              }
              const courseFolder = path.basename(subject.replace(/\s+/g, '_'));
              const cleanTitle = path.basename(title.replace(/[/\\?%*:|"<>]/g, '_').trim());
              const cleanTerm = path.basename(term.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'midterm');
              const subjDir = path.join(COURSES_DIR, courseFolder, 'assignments', cleanTerm, cleanTitle);

              if (!path.resolve(subjDir).startsWith(path.resolve(COURSES_DIR))) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Forbidden path' }));
                return;
              }
              
              fs.mkdirSync(path.join(subjDir, 'materials'), { recursive: true });
              fs.mkdirSync(path.join(subjDir, 'src'), { recursive: true });
              fs.mkdirSync(path.join(subjDir, '.tmp'), { recursive: true });

              const answerFile = path.join(subjDir, 'answer.md');
              if (!fs.existsSync(answerFile)) {
                fs.writeFileSync(answerFile, `# ${title}\n\n**Course**: ${subject}\n**Term**: ${cleanTerm}\n**Status**: In Progress\n**Source URL**: ${targetUrl || 'STI ELMS'}\n\n## Deliverable Content\n\n*(Work in progress)*\n`, 'utf8');
              }

              this.log(`Ingested ${title} into courses/${courseFolder}/assignments/${cleanTerm}/${cleanTitle}`, 'success');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, path: subjDir, term: cleanTerm }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 3. Toggle Ignore API
        if (url.pathname === '/api/assignments/ignore' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { courseName, assignmentName, isIgnored } = JSON.parse(body);
              const nowIgnored = this.toggleIgnore(courseName, assignmentName, isIgnored);
              const updatedData = this.scanCourses();
              
              const label = isIgnored ? 'Ignored' : 'Unignored';
              this.log(`Task ${assignmentName} marked as ${label}`, 'info');

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, isIgnored: nowIgnored, summary: updatedData.summary }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 4. Action: Check Unfinished Assignments
        if (url.pathname === '/api/actions/check-unfinished' && req.method === 'POST') {
          const scan = this.scanCourses();
          const ignoredSet = this.getIgnoredList();
          const unfinished = [];

          for (const c of scan.courses) {
            for (const a of c.assignments) {
              if (a.status === 'UNFINISHED') {
                unfinished.push({ course: c.displayName, name: a.name, missing: a.missing.join(', ') });
              }
            }
          }

          // Also check ELMS live cached assignments
          const elmsCacheFile = path.join(WORKSPACE_ROOT, 'artifacts', 'elms_assignments_cache.json');
          if (fs.existsSync(elmsCacheFile)) {
            try {
              const elmsData = JSON.parse(fs.readFileSync(elmsCacheFile, 'utf8'));
              const list = Array.isArray(elmsData.assignments) ? elmsData.assignments : [];
              for (const item of list) {
                const courseFolder = (item.subject || 'General').replace(/\s+/g, '_');
                const cleanName = (item.cleanName || item.title || '').replace(/[/\\?%*:|"<>]/g, '_').trim();
                const itemKey = `${courseFolder}:${cleanName}`;

                if (ignoredSet.has(itemKey)) continue;

                // Check if already covered by local courses scan
                const alreadyTracked = unfinished.some(u => u.name === cleanName || u.name === item.title);
                if (alreadyTracked) continue;

                // Check local deliverable across any term
                let isLocalDone = false;
                const assignDir = path.join(COURSES_DIR, courseFolder, 'assignments');
                if (fs.existsSync(assignDir)) {
                  for (const t of fs.readdirSync(assignDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
                    const ans = path.join(assignDir, t.name, cleanName, 'answer.md');
                    if (fs.existsSync(ans) && fs.statSync(ans).size > 50) {
                      isLocalDone = true;
                      break;
                    }
                  }
                }

                const isSubmittedOnElms = /submitted|graded|completed/i.test(item.status || '');

                if (!isLocalDone && !isSubmittedOnElms) {
                  unfinished.push({
                    course: item.subject || 'General',
                    name: item.title,
                    missing: `Pending on ELMS (${item.status || 'Due'})`
                  });
                }
              }
            } catch (_) {}
          }

          this.startTask('audit-unfinished', 'Check Unfinished Tasks', 'Academic Audit', 3);
          this.step(1, 3, 'Scanning course directories & ELMS cache...');
          this.log(`Audited local workspace & ELMS assignments.`, 'info');

          setTimeout(() => {
            this.step(2, 3, `Analyzing completeness (${unfinished.length} pending, ${ignoredSet.size} ignored)...`);
            if (unfinished.length === 0) {
              this.log('🎉 Outstanding! All tracked assignments are fully completed.', 'success');
            } else {
              unfinished.forEach(u => {
                this.log(`⏳ [${u.course}] ${u.name} — ${u.missing}`, 'step');
              });
            }

            setTimeout(() => {
              this.step(3, 3, 'Generating audit summary');
              const msg = unfinished.length === 0
                ? 'All assignments complete!'
                : `Audit Complete: ${unfinished.length} unfinished assignment(s) require action.`;
              this.complete(msg);
            }, 600);
          }, 600);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, unfinished, summary: { ...scan.summary, unfinished: unfinished.length } }));
          return;
        }

        // 5. Telemetry Log API
        if (url.pathname === '/api/telemetry/log' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              this.log(data.text, data.level || 'info');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 6. Action: Run Lab Code
        if (url.pathname === '/api/actions/run-lab' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            let courseName = 'Computer_Graphics_Programming';
            let assignmentName = '03_Laboratory_Exercise_1';
            try {
              if (body) {
                const parsed = JSON.parse(body);
                if (parsed.courseName) courseName = path.basename(parsed.courseName);
                if (parsed.assignmentName) assignmentName = path.basename(parsed.assignmentName);
              }
            } catch (_) {}

            const srcDir = path.join(COURSES_DIR, courseName, 'assignments', 'midterm', assignmentName, 'src');
            if (!path.resolve(srcDir).startsWith(path.resolve(COURSES_DIR))) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Forbidden path' }));
              return;
            }

            let pyScript = path.join(srcDir, 'wireframe_cube.py');
            if (!fs.existsSync(pyScript) && fs.existsSync(srcDir)) {
              const pyFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.py'));
              if (pyFiles.length > 0) {
                pyScript = path.join(srcDir, pyFiles[0]);
              }
            }

            if (!fs.existsSync(pyScript)) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: `Script not found in: ${srcDir}` }));
              return;
            }

            this.startTask('run-pygame', `Run ${assignmentName}`, courseName.replace(/_/g, ' '), 2);
            this.step(1, 2, 'Spawning Python Pygame & OpenGL process...');
            this.log(`Launching: ${pyScript}`, 'info');

            const child = spawn('python', [pyScript], {
              cwd: path.dirname(pyScript),
              detached: false
            });

            child.stdout?.on('data', (d) => {
              this.log(`[Pygame stdout] ${d.toString().trim()}`, 'info');
            });

            child.stderr?.on('data', (d) => {
              this.log(`[Pygame stderr] ${d.toString().trim()}`, 'error');
            });

            child.on('error', (err) => {
              this.error(`Pygame failed to start: ${err.message}`);
            });

            child.on('close', (code) => {
              if (code !== 0 && code !== null) {
                this.error(`Pygame process exited with code ${code}`);
              }
            });

            this.step(2, 2, 'Interactive window active on desktop');
            this.log('Pygame window opened on desktop with live telemetry streaming', 'success');
            this.complete('Pygame process launched successfully');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Process started with live streaming' }));
          });
          return;
        }

        // 7. Action: Test Demo Simulation
        if (url.pathname === '/api/actions/test-demo' && req.method === 'POST') {
          this.runDemoSimulation();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Demo simulation started' }));
          return;
        }

        // 8. Action: Sync Handouts
        if (url.pathname === '/api/actions/sync-handouts' && req.method === 'POST') {
          const cliScript = path.join(WORKSPACE_ROOT, '.agents/skills/sti-elms/scripts/elms-cli.js');
          this.startTask('sync-handouts', 'Sync ELMS Handouts', 'Academic Sync', 3);
          this.step(1, 3, 'Spawning ELMS Handout Sync CLI...');
          this.log('Connecting to Brave Agent Window to download handouts...', 'info');

          const child = spawn('node', [cliScript, '--all'], {
            cwd: WORKSPACE_ROOT,
            detached: false
          });

          child.stdout?.on('data', (d) => {
            const lines = d.toString().split('\n').map(l => l.trim()).filter(Boolean);
            lines.forEach(l => this.log(l, 'step'));
          });

          child.stderr?.on('data', (d) => {
            this.log(d.toString().trim(), 'error');
          });

          child.on('error', (err) => {
            this.error(`Failed to launch Handout CLI: ${err.message}`);
          });

          child.on('close', (code) => {
            if (code === 0) {
              this.complete('ELMS Handouts synced successfully into artifacts/downloads/elms/!');
            } else {
              this.error(`Handout sync process finished with code ${code}`);
            }
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'ELMS handout sync dispatched with live streaming' }));
          return;
        }

        // 9. Static Dashboard Files Serving
        const cleanPath = (url.pathname === '/' || url.pathname === '/dashboard') ? 'index.html' : url.pathname.replace(/^\/+/, '');
        const filePath = path.resolve(PUBLIC_DIR, cleanPath);

        // Path traversal protection: ensure file path remains strictly within PUBLIC_DIR
        if (!filePath.startsWith(path.resolve(PUBLIC_DIR))) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.json': 'application/json'
          };
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        res.writeHead(404);
        res.end('Not Found');
      });

      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port already in use; handled gracefully in this.server.on('error')
        } else {
          console.error('[Telemetry] WebSocket server error:', err.message);
        }
      });

      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        ws.send(JSON.stringify({ type: 'STATE_SNAPSHOT', data: this.currentTask }));

        ws.on('message', (message) => {
          try {
            const msg = JSON.parse(message.toString());
            this.handleClientMessage(msg, ws);
          } catch (err) {
            console.error('[Telemetry] Invalid message:', err.message);
          }
        });

        ws.on('close', () => {
          this.clients.delete(ws);
        });

        ws.on('error', () => {
          this.clients.delete(ws);
        });
      });

      this.server.listen(this.port, () => {
        console.error(`📡 [Telemetry] Real-time HUD server listening on ws://localhost:${this.port}`);

        // Auto-hot-reload file watcher for extension files
        const extDir = path.join(WORKSPACE_ROOT, 'brave-extension');
        if (fs.existsSync(extDir)) {
          let reloadTimer = null;
          try {
            fs.watch(extDir, { recursive: true }, (eventType, filename) => {
              if (filename && !filename.includes('node_modules') && !filename.endsWith('.tmp')) {
                if (reloadTimer) clearTimeout(reloadTimer);
                reloadTimer = setTimeout(() => {
                  console.error(`⚡ [Telemetry] Change detected in brave-extension/${filename}. Broadcasting hot-reload...`);
                  this.broadcast('HOT_RELOAD_EXTENSION', { file: filename });
                }, 300);
              }
            });
          } catch (e) {
            console.error('[Telemetry] Could not start extension file watcher:', e.message);
          }
        }

        resolve();
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`📡 [Telemetry] Port ${this.port} in use, attaching to existing...`);
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }

  runDemoSimulation() {
    this.startTask('demo-lab1', 'Solve Lab 1: Wireframe Cube', 'Computer Graphics Programming', 4);
    setTimeout(() => {
      this.step(1, 4, 'Analyzing Handout & 3D Geometry');
      this.log('Parsed 8 vertices from 03_Laboratory_Exercise_1.pdf', 'info');
      this.log('Verified 12 wireframe edge topologies', 'info');

      setTimeout(() => {
        this.step(2, 4, 'Writing Python OpenGL Source Code');
        this.log('Created wireframe_cube.py in src/', 'step');
        this.log('Implemented glRotatef real-time rotation loop', 'info');

        setTimeout(() => {
          this.step(3, 4, 'Testing OpenGL 3D Render Window');
          this.log('Display surface 800x600 initialized', 'info');
          this.log('Rendering 60 FPS rotation check: PASSED', 'success');

          setTimeout(() => {
            this.step(4, 4, 'Formatting Submission Report');
            this.log('Saved final deliverable to answer.md', 'step');
            this.log('Scratch files isolated in .tmp/', 'info');
            this.complete('03 Laboratory Exercise 1 completed successfully!');
          }, 1200);
        }, 1200);
      }, 1200);
    }, 800);
  }

  handleClientMessage(msg, ws) {
    const { type, payload } = msg;
    console.error(`📡 [Telemetry] Received client action: ${type}`, payload);

    if (type === 'TRIGGER_TASK') {
      if (payload && payload.action === 'run_code') {
        fetch(`http://localhost:${this.port}/api/actions/run-lab`, { method: 'POST' }).catch(() => {});
      } else if (payload && payload.action === 'download_handouts') {
        fetch(`http://localhost:${this.port}/api/actions/sync-handouts`, { method: 'POST' }).catch(() => {});
      } else if (payload && payload.action === 'check_unfinished') {
        fetch(`http://localhost:${this.port}/api/actions/check-unfinished`, { method: 'POST' }).catch(() => {});
      } else if (payload && payload.action === 'scan_elms') {
        fetch(`http://localhost:${this.port}/api/elms/scan`, { method: 'POST' }).catch(() => {});
      }
    }

    if (type === 'DIRECTIVE_SUBMIT' && payload) {
      const { prompt, url, title } = payload;
      const dirId = `dir_${Date.now()}`;
      const entry = { id: dirId, prompt, url, title, timestamp: new Date().toISOString() };
      this.directives.push(entry);
      this.log(`📩 [HUD Directive] "${prompt}"`, 'step');
      this.broadcast('DIRECTIVE_RECEIVED', entry);
    }

    if (type === 'SYNC_ELMS_DOM_ASSIGNMENTS' && payload && Array.isArray(payload.assignments)) {
      import('./elms-checker.js').then(({ elmsChecker }) => {
        const cache = elmsChecker.getCache();
        const existingMap = new Map((cache.assignments || []).map(a => [a.url || a.title, a]));
        for (const item of payload.assignments) {
          existingMap.set(item.url || item.title, item);
        }
        const updated = {
          lastChecked: new Date().toISOString(),
          assignments: Array.from(existingMap.values())
        };
        elmsChecker.saveCache(updated);
        this.log(`Received ${payload.assignments.length} assignment(s) scraped from your active ELMS tab!`, 'success');
        this.broadcast('ELMS_ASSIGNMENTS_UPDATED', updated);
      }).catch(err => {
        console.error('[Telemetry] Error syncing DOM assignments:', err);
      });
    }
  }

  broadcast(type, data) {
    const payload = JSON.stringify({ type, data });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  startTask(id, name, subject = 'General', totalSteps = 1) {
    this.currentTask = {
      id,
      name,
      subject,
      status: 'RUNNING',
      currentStep: 1,
      totalSteps,
      stepName: 'Starting task...',
      progress: Math.round((1 / totalSteps) * 100),
      logs: []
    };
    this.broadcast('TASK_START', this.currentTask);
    this.log(`🚀 Task Started: ${name} [${subject}]`, 'info');
  }

  step(currentStep, totalSteps, stepName) {
    this.currentTask.currentStep = currentStep;
    this.currentTask.totalSteps = totalSteps;
    this.currentTask.stepName = stepName;
    this.currentTask.progress = Math.min(100, Math.round((currentStep / totalSteps) * 100));
    this.broadcast('STEP_UPDATE', this.currentTask);
    this.log(`📌 [${currentStep}/${totalSteps}] ${stepName}`, 'step');
  }

  log(text, level = 'info') {
    const entry = {
      text,
      level,
      timestamp: new Date().toLocaleTimeString()
    };
    this.currentTask.logs.push(entry);
    if (this.currentTask.logs.length > 200) {
      this.currentTask.logs.shift();
    }
    this.broadcast('LOG', entry);
  }

  complete(summary = 'Task completed successfully') {
    this.currentTask.status = 'COMPLETED';
    this.currentTask.progress = 100;
    this.currentTask.stepName = 'Completed';
    this.broadcast('TASK_COMPLETE', { summary, task: this.currentTask });
    this.log(`✅ ${summary}`, 'success');
  }

  error(errMsg = 'Task encountered an error') {
    this.currentTask.status = 'ERROR';
    this.broadcast('TASK_ERROR', { error: errMsg, task: this.currentTask });
    this.log(`❌ Error: ${errMsg}`, 'error');
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

export const globalTelemetry = new TelemetryServer(8765);
