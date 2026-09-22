(() => {
  if (document.getElementById('antigravity-hud-root')) return;

  const WS_URL = 'ws://localhost:8765';
  let socket = null;
  let isConnected = false;
  let isExpanded = localStorage.getItem('ag_hud_expanded') === 'true';
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // Create root container
  const root = document.createElement('div');
  root.id = 'antigravity-hud-root';

  // Restore saved position
  const savedPos = JSON.parse(localStorage.getItem('ag_hud_pos') || 'null');
  if (savedPos && savedPos.x !== undefined && savedPos.y !== undefined) {
    root.style.left = `${savedPos.x}px`;
    root.style.top = `${savedPos.y}px`;
  } else {
    root.style.right = '24px';
    root.style.bottom = '24px';
  }

  // HTML Template
  root.innerHTML = `
    <!-- Collapsed Floating Pill -->
    <div id="antigravity-pill" style="${isExpanded ? 'display: none;' : 'display: flex;'}">
      <div class="ag-pulse-dot offline" id="ag-pill-dot"></div>
      <span class="ag-pill-logo">⚡ ANTIGRAVITY</span>
      <span class="ag-pill-status" id="ag-pill-status">Connecting...</span>
    </div>

    <!-- Expanded Mission Control Window -->
    <div id="antigravity-window" style="${isExpanded ? 'display: flex;' : 'display: none;'}">
      <div class="ag-header" id="ag-drag-handle">
        <div class="ag-header-left">
          <span class="ag-header-title">⚡ ANTIGRAVITY MISSION CONTROL</span>
          <span class="ag-conn-badge offline" id="ag-conn-badge">Connecting</span>
        </div>
        <div class="ag-header-actions">
          <button class="ag-icon-btn" id="ag-btn-reset-pos" title="Reset Position">↺</button>
          <button class="ag-icon-btn" id="ag-btn-minimize" title="Minimize">—</button>
        </div>
      </div>

      <!-- Detected Due Assignment on Current Page -->
      <div id="ag-detected-container"></div>

      <div class="ag-task-card">
        <div class="ag-task-subject" id="ag-task-subject">GENERAL</div>
        <div class="ag-task-name" id="ag-task-name">Idle — Ready for Tasks</div>
        <div class="ag-task-step">
          <span id="ag-task-step-name">No task currently running</span>
          <span id="ag-task-percent">0%</span>
        </div>
        <div class="ag-progress-bar">
          <div class="ag-progress-fill" id="ag-progress-fill" style="width: 0%;"></div>
        </div>
      </div>

      <div class="ag-console-header">
        <span>LIVE TELEMETRY LOGS</span>
        <button class="ag-icon-btn" id="ag-btn-clear-logs" style="font-size: 10px;">Clear</button>
      </div>
      <div class="ag-console-box" id="ag-console-box">
        <div class="ag-log-line"><span class="ag-log-time">${new Date().toLocaleTimeString()}</span>Waiting for Antigravity connection...</div>
      </div>

      <div class="ag-toolbar" style="grid-template-columns: repeat(4, 1fr);">
        <button class="ag-btn ag-btn-primary" id="ag-action-scan-elms" title="Scan this page and classes on ELMS for assignments">🎓 Scan ELMS</button>
        <button class="ag-btn" id="ag-action-check-unfinished" title="Audit workspace for unfinished tasks">🔍 Audit</button>
        <button class="ag-btn" id="ag-action-handouts" title="Scrape handouts for this course">📚 Handouts</button>
        <button class="ag-btn" id="ag-action-run-code" title="Execute Python/lab code">▶ Run</button>
      </div>

      <!-- AI Directive Command Bar -->
      <div class="ag-directive-container">
        <input type="text" class="ag-directive-input" id="ag-directive-input" placeholder="Type AI directive (e.g. 'Extract all assignment links')..." />
        <button class="ag-directive-btn" id="ag-btn-send-directive" title="Send Directive to Antigravity">➤</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // DOM References
  const pill = document.getElementById('antigravity-pill');
  const windowEl = document.getElementById('antigravity-window');
  const dragHandle = document.getElementById('ag-drag-handle');
  const pillDot = document.getElementById('ag-pill-dot');
  const pillStatus = document.getElementById('ag-pill-status');
  const connBadge = document.getElementById('ag-conn-badge');
  const taskSubject = document.getElementById('ag-task-subject');
  const taskName = document.getElementById('ag-task-name');
  const taskStepName = document.getElementById('ag-task-step-name');
  const taskPercent = document.getElementById('ag-task-percent');
  const progressFill = document.getElementById('ag-progress-fill');
  const consoleBox = document.getElementById('ag-console-box');
  const directiveInput = document.getElementById('ag-directive-input');
  const sendDirectiveBtn = document.getElementById('ag-btn-send-directive');

  // Submit AI Directive
  async function submitDirective() {
    const text = (directiveInput.value || '').trim();
    if (!text) return;
    directiveInput.value = '';
    appendLog(`User Directive: "${text}"`, 'step');

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'DIRECTIVE_SUBMIT',
        payload: {
          prompt: text,
          url: window.location.href,
          title: document.title
        }
      }));
    } else {
      fetch('http://localhost:8765/api/directives/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, url: window.location.href, title: document.title })
      }).catch(err => appendLog(`Directive error: ${err.message}`, 'error'));
    }
  }

  sendDirectiveBtn?.addEventListener('click', submitDirective);
  directiveInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitDirective();
  });

  // Toggle Window / Pill
  function setExpanded(expand) {
    isExpanded = expand;
    localStorage.setItem('ag_hud_expanded', expand);
    if (expand) {
      pill.style.display = 'none';
      windowEl.style.display = 'flex';
    } else {
      windowEl.style.display = 'none';
      pill.style.display = 'flex';
    }
  }

  pill.addEventListener('click', () => setExpanded(true));
  document.getElementById('ag-btn-minimize').addEventListener('click', () => setExpanded(false));

  document.getElementById('ag-btn-reset-pos').addEventListener('click', () => {
    localStorage.removeItem('ag_hud_pos');
    root.style.left = '';
    root.style.top = '';
    root.style.right = '24px';
    root.style.bottom = '24px';
  });

  document.getElementById('ag-btn-clear-logs').addEventListener('click', () => {
    consoleBox.innerHTML = '';
  });

  // Dragging Implementation
  function onMouseDown(e) {
    if (e.target.closest('.ag-icon-btn')) return;
    isDragging = true;
    const rect = root.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;

    // Viewport bounds
    const maxX = window.innerWidth - root.offsetWidth - 10;
    const maxY = window.innerHeight - root.offsetHeight - 10;
    newX = Math.max(10, Math.min(newX, maxX));
    newY = Math.max(10, Math.min(newY, maxY));

    root.style.left = `${newX}px`;
    root.style.top = `${newY}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function onMouseUp() {
    if (isDragging) {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const rect = root.getBoundingClientRect();
      localStorage.setItem('ag_hud_pos', JSON.stringify({ x: rect.left, y: rect.top }));
    }
  }

  dragHandle.addEventListener('mousedown', onMouseDown);
  pill.addEventListener('mousedown', (e) => {
    // Enable dragging pill too if mouse moved
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    function movePill(me) {
      if (Math.abs(me.clientX - startX) > 4 || Math.abs(me.clientY - startY) > 4) {
        moved = true;
        onMouseDown(e);
        document.removeEventListener('mousemove', movePill);
      }
    }
    document.addEventListener('mousemove', movePill);
    document.addEventListener('mouseup', () => {
      document.removeEventListener('mousemove', movePill);
    }, { once: true });
  });

  // Log Appending
  function appendLog(text, level = 'info', time = null) {
    const timeStr = time || new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `ag-log-line ${level}`;
    line.innerHTML = `<span class="ag-log-time">${timeStr}</span>${escapeHtml(text)}`;
    consoleBox.appendChild(line);
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  // Update State UI
  function updateTaskState(task) {
    if (!task) return;
    taskSubject.innerText = (task.subject || 'GENERAL').toUpperCase();
    taskName.innerText = task.name || 'Idle';
    taskStepName.innerText = task.stepName || 'Standby';
    const percent = task.progress || 0;
    taskPercent.innerText = `${percent}%`;
    progressFill.style.width = `${percent}%`;

    pillStatus.innerText = task.status === 'RUNNING' 
      ? `[${percent}%] ${task.name}` 
      : (task.status === 'COMPLETED' ? 'Done' : 'Idle');

    if (task.status === 'RUNNING') {
      pillDot.className = 'ag-pulse-dot running';
      connBadge.innerText = 'Running';
    } else if (isConnected) {
      pillDot.className = 'ag-pulse-dot';
      connBadge.innerText = 'Connected';
    }
  }

  // WebSocket Telemetry Connection
  function connectWebSocket() {
    try {
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        isConnected = true;
        connBadge.className = 'ag-conn-badge';
        connBadge.innerText = 'Connected';
        pillDot.className = 'ag-pulse-dot';
        pillStatus.innerText = 'Idle';
        appendLog('Connected to Antigravity Telemetry Engine', 'success');
      };

      socket.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);
          if (type === 'STATE_SNAPSHOT') {
            updateTaskState(data);
            if (data.logs && Array.isArray(data.logs)) {
              data.logs.slice(-20).forEach(l => appendLog(l.text, l.level, l.timestamp));
            }
          } else if (type === 'TASK_START' || type === 'STEP_UPDATE') {
            updateTaskState(data);
          } else if (type === 'LOG') {
            appendLog(data.text, data.level, data.timestamp);
          } else if (type === 'TASK_COMPLETE') {
            updateTaskState(data.task);
            appendLog(`✅ ${data.summary}`, 'success');
          } else if (type === 'TASK_ERROR') {
            updateTaskState(data.task);
            appendLog(`❌ ${data.error}`, 'error');
          }
        } catch (e) {
          console.error('[AG-HUD] Parse error:', e);
        }
      };

      socket.onclose = () => {
        isConnected = false;
        connBadge.className = 'ag-conn-badge offline';
        connBadge.innerText = 'Offline';
        pillDot.className = 'ag-pulse-dot offline';
        pillStatus.innerText = 'Offline (ws://8765)';
        setTimeout(connectWebSocket, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch (e) {
      setTimeout(connectWebSocket, 3000);
    }
  }

  connectWebSocket();

  // Action Buttons Handlers
  document.getElementById('ag-action-scan-elms').addEventListener('click', () => {
    appendLog('Scanning current ELMS page for assignments...', 'step');
    
    // Extract assignment links and cards from active page DOM
    const links = Array.from(document.querySelectorAll('a'));
    const discovered = [];
    const seen = new Set();

    links.forEach(a => {
      const href = a.href || '';
      const text = (a.innerText || a.getAttribute('title') || '').trim();
      const lower = text.toLowerCase();
      const isTask = href.includes('/student_dropbox_assignment/') || 
                     href.includes('/student_assignment/') || 
                     href.includes('/student_quiz/') ||
                     lower.includes('activity') || lower.includes('laboratory') || 
                     lower.includes('assignment') || lower.includes('performance task');

      if (isTask && text.length > 3 && !seen.has(href) && !lower.includes('expand all') && !lower.includes('handout')) {
        seen.add(href);
        const parent = a.closest('tr, li, .item, .card, div') || a.parentElement;
        const parentText = parent ? parent.innerText : '';
        let status = 'Not submitted';
        if (parentText.includes('Submitted') || parentText.includes('Completed')) {
          status = 'Submitted';
        } else if (parentText.includes('Due') || parentText.includes('due')) {
          status = 'Pending / Due';
        }

        discovered.push({
          title: text.replace(/\s+/g, ' '),
          url: href,
          status,
          pageTitle: document.title
        });
      }
    });

    if (discovered.length > 0) {
      appendLog(`Found ${discovered.length} assignment(s) on this ELMS page:`, 'success');
      discovered.forEach(d => {
        const isSub = d.status === 'Submitted';
        appendLog(`• ${d.title} [${d.status}]`, isSub ? 'info' : 'step');
      });

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'SYNC_ELMS_DOM_ASSIGNMENTS',
          payload: { assignments: discovered }
        }));
      }
    } else {
      appendLog('No direct assignment links on this view. Launching full course crawl...', 'info');
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'TRIGGER_TASK', payload: { action: 'scan_elms' } }));
      } else {
        fetch('http://localhost:8765/api/elms/scan', { method: 'POST' }).catch(() => {});
      }
    }
  });

  document.getElementById('ag-action-check-unfinished').addEventListener('click', () => {
    appendLog('Auditing unfinished assignments across courses...', 'step');
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'TRIGGER_TASK', payload: { action: 'check_unfinished' } }));
    } else {
      fetch('http://localhost:8765/api/actions/check-unfinished', { method: 'POST' }).catch(() => {});
    }
  });

  document.getElementById('ag-action-handouts').addEventListener('click', () => {
    appendLog('Triggering handout sync...', 'step');
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'TRIGGER_TASK', payload: { action: 'download_handouts' } }));
      appendLog('Handout task requested!', 'success');
    }
  });

  // Class ID to Subject mapping
  const CLASS_MAP = {
    '5713354': 'Computer Graphics Programming',
    '5713245': 'IT Service Management',
    '5712641': 'Game Development',
    '5713238': 'Information Assurance and Security',
    '5713247': 'IT Capstone Project 2',
    '5713246': 'Network Technology 2',
    '5713244': 'Euthenics 2'
  };

  // Inspect the active ELMS page for due assignments / tasks
  function inspectCurrentPage() {
    const detectedContainer = document.getElementById('ag-detected-container');
    if (!detectedContainer) return;

    const url = window.location.href;
    const path = window.location.pathname;

    // Determine subject name
    let subjectName = 'General';
    for (const [cid, sname] of Object.entries(CLASS_MAP)) {
      if (url.includes(cid)) {
        subjectName = sname;
        break;
      }
    }
    if (subjectName === 'General') {
      const bc = document.querySelector('.breadcrumbs, .nav_class_title, .class_title, #page_title');
      if (bc) {
        const text = bc.innerText || '';
        for (const sname of Object.values(CLASS_MAP)) {
          if (text.includes(sname)) {
            subjectName = sname;
            break;
          }
        }
      }
    }

    // Detect academic term dynamically
    let detectedTerm = 'midterm';
    const bcText = (document.querySelector('.breadcrumbs, .nav_class_title, .class_title, #page_title')?.innerText || document.title || '').toLowerCase();
    if (bcText.includes('prelim')) detectedTerm = 'prelim';
    else if (bcText.includes('final') && !bcText.includes('prefinal') && !bcText.includes('semi-final')) detectedTerm = 'final';
    else if (bcText.includes('prefinal') || bcText.includes('semi-final')) detectedTerm = 'prefinal';

    const isDropbox = path.includes('/student_dropbox_assignment/show/');
    const isAssignment = path.includes('/student_assignment/show/');
    const isQuiz = path.includes('/student_quiz/show/');
    const isSingleTask = isDropbox || isAssignment || isQuiz;

    // 1. Single Task View
    if (isSingleTask) {
      const hTitle = document.querySelector('.page_title, #center h1, #center h2, .main_content h1, h1, h2');
      const detectedTitle = hTitle ? hTitle.innerText.trim() : document.title.replace(/\|.*$/, '').trim();
      const pageText = document.body.innerText;

      let detectedStatus = '⏳ Due (Not Submitted)';
      let statusType = 'pending';
      if (/submitted on|submission status:\s*submitted|graded|view submission/i.test(pageText)) {
        detectedStatus = '✅ Submitted';
        statusType = 'submitted';
      } else if (/overdue|past due|missing/i.test(pageText)) {
        detectedStatus = '🚨 Overdue';
        statusType = 'overdue';
      }

      let detectedDue = '';
      const dueMatch = pageText.match(/Due:?\s*([A-Za-z]{3}\s+\d{1,2},?\s+\d{4}(?:\s+at\s+\d{1,2}:\d{2}\s*[APMapm]{2})?|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (dueMatch) detectedDue = dueMatch[0];

      if (detectedTitle && detectedTitle.length > 2 && !detectedTitle.toLowerCase().includes('expand all') && !detectedTitle.toLowerCase().includes('handout')) {
        const cleanTitle = detectedTitle.replace(/[/\\?%*:|"<>]/g, '_');
        detectedContainer.innerHTML = `
          <div class="ag-detected-box">
            <div class="ag-detected-header">
              <div class="ag-detected-label">🎯 ACTIVE ASSIGNMENT</div>
              <span class="ag-status-pill ${statusType}">${escapeHtml(detectedStatus)}</span>
            </div>
            <div class="ag-assignment-title" style="font-size: 13px;">${escapeHtml(detectedTitle)}</div>
            <div class="ag-assignment-due">${escapeHtml(subjectName)} • ${escapeHtml(detectedTerm.toUpperCase())} ${detectedDue ? `• ${escapeHtml(detectedDue)}` : ''}</div>
            <div class="ag-assignment-actions" style="margin-top: 6px;">
              <button class="ag-mini-btn primary" id="ag-btn-ingest-single">⚡ Ingest to courses/</button>
              <button class="ag-mini-btn" id="ag-btn-ignore-single">👁️‍🗨️ Ignore</button>
            </div>
          </div>
        `;

        pillStatus.innerText = `🎯 [Due: ${detectedTitle}]`;
        if (statusType !== 'submitted') pillDot.className = 'ag-pulse-dot running';

        document.getElementById('ag-btn-ingest-single')?.addEventListener('click', async () => {
          appendLog(`Ingesting ${detectedTitle} into courses/${subjectName}/assignments/${detectedTerm}/...`, 'step');
          try {
            const resp = await fetch('http://localhost:8765/api/elms/ingest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subject: subjectName, title: detectedTitle, url, term: detectedTerm })
            });
            const res = await resp.json();
            if (res.success) appendLog(`Scaffolded: ${res.path}`, 'success');
          } catch (e) {
            appendLog(`Ingest error: ${e.message}`, 'error');
          }
        });

        document.getElementById('ag-btn-ignore-single')?.addEventListener('click', async () => {
          appendLog(`Marking ${detectedTitle} as ignored...`, 'step');
          try {
            await fetch('http://localhost:8765/api/assignments/ignore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ courseName: subjectName.replace(/ /g, '_'), assignmentName: cleanTitle, isIgnored: true })
            });
            appendLog(`Task ignored.`, 'info');
            detectedContainer.innerHTML = '';
          } catch (e) {
            appendLog(`Ignore error: ${e.message}`, 'error');
          }
        });

        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'SYNC_ELMS_DOM_ASSIGNMENTS',
            payload: {
              assignments: [{
                subject: subjectName,
                title: detectedTitle,
                cleanName: cleanTitle,
                url,
                status: detectedStatus,
                dueDate: detectedDue,
                needsAction: statusType !== 'submitted'
              }]
            }
          }));
        }
      }
      return;
    }

    // 2. Multi-Assignment List / Table View (e.g. /student_assignments/list/:id or /due/:id)
    const detected = [];
    const seenUrls = new Set();

    // Scan table rows and list items
    const rows = Array.from(document.querySelectorAll('table tr, .assignment_row, .item_row, li.assignment, .item'));
    for (const row of rows) {
      if (row.querySelector('th') && !row.querySelector('td')) continue; // Skip header row

      const link = row.querySelector('a[href*="/student_dropbox_assignment/"], a[href*="/student_assignment/"], a[href*="/student_quiz/"], a[href*="/student_quiz_assignment/"], a[href*="/student_survey/"], a[href*="/student_discussion/"], a[href*="/assignment"]');
      if (!link) continue;

      const title = (link.innerText || link.getAttribute('title') || '').trim();
      const href = link.href || '';
      const lower = title.toLowerCase();

      if (!title || lower === 'assignment' || lower === 'title' || lower === 'name' || lower.includes('expand all') || lower.includes('handout') || lower.includes('internet explorer') || lower.includes('unsupported browser') || title.length < 3) {
        continue;
      }
      if (seenUrls.has(href)) continue;
      seenUrls.add(href);

      const rowText = row.innerText || '';
      let status = '⏳ Due (Not Submitted)';
      let statusType = 'pending';
      if (/submitted|graded|completed|turned in/i.test(rowText)) {
        status = '✅ Submitted';
        statusType = 'submitted';
      } else if (/overdue|missing|past due|late/i.test(rowText)) {
        status = '🚨 Overdue';
        statusType = 'overdue';
      }

      let dueDate = '';
      const dateMatch = rowText.match(/(?:Due:?\s*)?([A-Za-z]{3}\s+\d{1,2},?\s+\d{4}(?:\s+at\s+\d{1,2}:\d{2}\s*[APMapm]{2})?|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (dateMatch) dueDate = dateMatch[0];

      detected.push({
        subject: subjectName,
        title,
        cleanName: title.replace(/[/\\?%*:|"<>]/g, '_'),
        url: href,
        status,
        statusType,
        dueDate,
        needsAction: statusType !== 'submitted'
      });
    }

    // Fallback: If table rows didn't match, scan all valid assignment links in main content
    if (detected.length === 0) {
      const links = Array.from(document.querySelectorAll('#center a, #main a, .content a, table a'));
      for (const a of links) {
        const href = a.href || '';
        const title = (a.innerText || a.getAttribute('title') || '').trim();
        const lower = title.toLowerCase();

        const isTaskLink = href.includes('/student_dropbox_assignment/show/') ||
                           href.includes('/student_assignment/show/') ||
                           href.includes('/student_quiz/show/') ||
                           href.includes('/student_quiz_assignment/show/') ||
                           lower.includes('activity') || lower.includes('laboratory') ||
                           lower.includes('performance task') || lower.includes('assignment');

        if (isTaskLink && title.length > 3 && !seenUrls.has(href) && !lower.includes('expand all') && !lower.includes('handout') && !lower.includes('internet explorer') && !lower.includes('unsupported browser')) {
          seenUrls.add(href);
          const parent = a.closest('tr, li, .item, .card, div') || a.parentElement;
          const parentText = parent ? parent.innerText : '';

          let status = '⏳ Due (Not Submitted)';
          let statusType = 'pending';
          if (/submitted|graded|completed/i.test(parentText)) {
            status = '✅ Submitted';
            statusType = 'submitted';
          } else if (/overdue|missing/i.test(parentText)) {
            status = '🚨 Overdue';
            statusType = 'overdue';
          }

          let dueDate = '';
          const dMatch = parentText.match(/(?:Due:?\s*)?([A-Za-z]{3}\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
          if (dMatch) dueDate = dMatch[0];

          detected.push({
            subject: subjectName,
            title,
            cleanName: title.replace(/[/\\?%*:|"<>]/g, '_'),
            url: href,
            status,
            statusType,
            dueDate,
            needsAction: statusType !== 'submitted'
          });
        }
      }
    }

    if (detected.length > 0) {
      const pendingItems = detected.filter(d => d.needsAction);
      const pendingCount = pendingItems.length;

      let listHtml = '';
      detected.forEach((item, idx) => {
        listHtml += `
          <div class="ag-assignment-card" data-idx="${idx}">
            <div class="ag-assignment-top">
              <span class="ag-assignment-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
              <span class="ag-status-pill ${item.statusType}">${escapeHtml(item.status)}</span>
            </div>
            <div class="ag-assignment-bottom">
              <span class="ag-assignment-due">${escapeHtml(item.dueDate || 'No due date set')}</span>
              <div class="ag-assignment-actions">
                <button class="ag-mini-btn primary ag-btn-item-ingest" data-idx="${idx}">⚡ Ingest</button>
                <button class="ag-mini-btn ag-btn-item-ignore" data-idx="${idx}">👁️‍🗨️</button>
              </div>
            </div>
          </div>
        `;
      });

      let batchHtml = '';
      if (pendingCount > 0) {
        batchHtml = `
          <div class="ag-detected-batch">
            <button class="ag-btn ag-btn-primary" id="ag-btn-ingest-all" style="width: 100%; font-size: 11px;">
              ⚡ Ingest All ${pendingCount} Pending to courses/
            </button>
          </div>
        `;
      }

      detectedContainer.innerHTML = `
        <div class="ag-detected-box">
          <div class="ag-detected-header">
            <div class="ag-detected-label">📋 ${detected.length} ASSIGNMENT(S) — ${escapeHtml(subjectName.toUpperCase())}</div>
            <span class="ag-detected-badge">${pendingCount} Pending</span>
          </div>
          <div class="ag-detected-list">
            ${listHtml}
          </div>
          ${batchHtml}
        </div>
      `;

      pillStatus.innerText = pendingCount > 0 ? `🎯 [${pendingCount} Pending: ${subjectName}]` : `✅ [All Submitted]`;
      if (pendingCount > 0) pillDot.className = 'ag-pulse-dot running';

      // Attach individual ingest listeners
      detectedContainer.querySelectorAll('.ag-btn-item-ingest').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'), 10);
          const item = detected[idx];
          if (!item) return;
          appendLog(`Ingesting ${item.title}...`, 'step');
          try {
            const resp = await fetch('http://localhost:8765/api/elms/ingest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subject: item.subject, title: item.title, url: item.url })
            });
            const res = await resp.json();
            if (res.success) appendLog(`Scaffolded: ${res.path}`, 'success');
          } catch (err) {
            appendLog(`Ingest error: ${err.message}`, 'error');
          }
        });
      });

      // Attach individual ignore listeners
      detectedContainer.querySelectorAll('.ag-btn-item-ignore').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'), 10);
          const item = detected[idx];
          if (!item) return;
          appendLog(`Ignoring ${item.title}...`, 'step');
          try {
            await fetch('http://localhost:8765/api/assignments/ignore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ courseName: item.subject.replace(/ /g, '_'), assignmentName: item.cleanName, isIgnored: true })
            });
            appendLog(`Marked as ignored.`, 'info');
            btn.closest('.ag-assignment-card').style.opacity = '0.4';
          } catch (err) {
            appendLog(`Ignore error: ${err.message}`, 'error');
          }
        });
      });

      // Attach Batch Ingest All listener
      document.getElementById('ag-btn-ingest-all')?.addEventListener('click', async () => {
        appendLog(`Batch ingesting all ${pendingCount} pending assignment(s)...`, 'step');
        for (const item of pendingItems) {
          try {
            appendLog(`Scaffolding ${item.title}...`, 'info');
            await fetch('http://localhost:8765/api/elms/ingest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subject: item.subject, title: item.title, url: item.url })
            });
          } catch (err) {
            appendLog(`Error ingesting ${item.title}: ${err.message}`, 'error');
          }
        }
        appendLog(`Batch ingest completed for ${subjectName}!`, 'success');
      });

      // Sync with telemetry server
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'SYNC_ELMS_DOM_ASSIGNMENTS',
          payload: { assignments: detected }
        }));
      }
    }
  }

  // Run initial inspection after page load
  setTimeout(inspectCurrentPage, 1000);

  // Re-inspect if single-page navigation or DOM changes happen
  let lastHref = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      setTimeout(inspectCurrentPage, 800);
    }
  }, 1500);

  console.log('⚡ Antigravity STI ELMS Mission Control HUD loaded.');
})();
