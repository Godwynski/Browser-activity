// ==UserScript==
// @name         Antigravity Mission Control (STI ELMS HUD)
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Real-time task telemetry, script log streaming, ELMS assignment checker, and ignore controls
// @author       Antigravity
// @match        https://elms.sti.edu/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';
  const style = document.createElement('style');
  style.id = 'antigravity-hud-styles';
  style.textContent = "/* Antigravity Mission Control - Floating HUD Styles */\n\n:root {\n  --ag-bg: rgba(15, 23, 42, 0.92);\n  --ag-card: rgba(30, 41, 59, 0.75);\n  --ag-border: rgba(56, 189, 248, 0.25);\n  --ag-border-glow: rgba(56, 189, 248, 0.45);\n  --ag-accent: #38bdf8;\n  --ag-accent-gradient: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);\n  --ag-text-primary: #f8fafc;\n  --ag-text-muted: #94a3b8;\n  --ag-success: #10b981;\n  --ag-warning: #f59e0b;\n  --ag-error: #ef4444;\n}\n\n#antigravity-hud-root {\n  position: fixed;\n  z-index: 2147483647;\n  font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;\n  user-select: none;\n  transition: opacity 0.2s ease, transform 0.2s ease;\n}\n\n/* Collapsed Pill State */\n#antigravity-pill {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 8px 16px;\n  background: var(--ag-bg);\n  backdrop-filter: blur(16px);\n  -webkit-backdrop-filter: blur(16px);\n  border: 1px solid var(--ag-border);\n  border-radius: 9999px;\n  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 16px rgba(56, 189, 248, 0.2);\n  cursor: pointer;\n  color: var(--ag-text-primary);\n  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);\n}\n\n#antigravity-pill:hover {\n  border-color: var(--ag-border-glow);\n  transform: translateY(-2px);\n  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 24px rgba(56, 189, 248, 0.35);\n}\n\n.ag-pulse-dot {\n  width: 10px;\n  height: 10px;\n  border-radius: 50%;\n  background: var(--ag-success);\n  box-shadow: 0 0 8px var(--ag-success);\n  animation: ag-pulse 2s infinite ease-in-out;\n}\n\n.ag-pulse-dot.running {\n  background: var(--ag-warning);\n  box-shadow: 0 0 8px var(--ag-warning);\n}\n\n.ag-pulse-dot.offline {\n  background: #64748b;\n  box-shadow: none;\n  animation: none;\n}\n\n@keyframes ag-pulse {\n  0%, 100% { transform: scale(1); opacity: 1; }\n  50% { transform: scale(1.3); opacity: 0.7; }\n}\n\n.ag-pill-logo {\n  font-weight: 700;\n  font-size: 13px;\n  letter-spacing: 0.5px;\n  background: var(--ag-accent-gradient);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n}\n\n.ag-pill-status {\n  font-size: 12px;\n  color: var(--ag-text-muted);\n  max-width: 140px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* Expanded Window State */\n#antigravity-window {\n  width: 440px;\n  background: var(--ag-bg);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);\n  border: 1px solid var(--ag-border);\n  border-radius: 16px;\n  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.15);\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n}\n\n.ag-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 12px 16px;\n  background: rgba(15, 23, 42, 0.85);\n  border-bottom: 1px solid rgba(255, 255, 255, 0.08);\n  cursor: grab;\n}\n\n.ag-header:active {\n  cursor: grabbing;\n}\n\n.ag-header-left {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.ag-header-title {\n  font-size: 13px;\n  font-weight: 700;\n  background: var(--ag-accent-gradient);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  letter-spacing: 0.5px;\n}\n\n.ag-conn-badge {\n  font-size: 10px;\n  padding: 2px 6px;\n  border-radius: 4px;\n  background: rgba(16, 185, 129, 0.15);\n  color: var(--ag-success);\n  border: 1px solid rgba(16, 185, 129, 0.3);\n}\n\n.ag-conn-badge.offline {\n  background: rgba(239, 68, 68, 0.15);\n  color: var(--ag-error);\n  border-color: rgba(239, 68, 68, 0.3);\n}\n\n.ag-header-actions {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ag-icon-btn {\n  background: transparent;\n  border: none;\n  color: var(--ag-text-muted);\n  cursor: pointer;\n  padding: 4px 6px;\n  border-radius: 4px;\n  font-size: 12px;\n  transition: all 0.15s ease;\n}\n\n.ag-icon-btn:hover {\n  background: rgba(255, 255, 255, 0.1);\n  color: var(--ag-text-primary);\n}\n\n/* Task Card */\n.ag-task-card {\n  padding: 14px 16px;\n  background: var(--ag-card);\n  margin: 12px 16px 8px 16px;\n  border-radius: 10px;\n  border: 1px solid rgba(255, 255, 255, 0.06);\n}\n\n.ag-task-subject {\n  font-size: 11px;\n  text-transform: uppercase;\n  letter-spacing: 0.5px;\n  color: var(--ag-accent);\n  font-weight: 600;\n  margin-bottom: 4px;\n}\n\n.ag-task-name {\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--ag-text-primary);\n  margin-bottom: 8px;\n}\n\n.ag-task-step {\n  display: flex;\n  justify-content: space-between;\n  font-size: 11px;\n  color: var(--ag-text-muted);\n  margin-bottom: 6px;\n}\n\n.ag-progress-bar {\n  height: 6px;\n  background: rgba(255, 255, 255, 0.1);\n  border-radius: 9999px;\n  overflow: hidden;\n  position: relative;\n}\n\n.ag-progress-fill {\n  height: 100%;\n  background: var(--ag-accent-gradient);\n  border-radius: 9999px;\n  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n  box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);\n}\n\n/* Console Logs */\n.ag-console-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 6px 16px 2px 16px;\n  font-size: 11px;\n  color: var(--ag-text-muted);\n}\n\n.ag-console-box {\n  margin: 4px 16px 10px 16px;\n  background: rgba(10, 15, 29, 0.85);\n  border: 1px solid rgba(255, 255, 255, 0.05);\n  border-radius: 8px;\n  height: 130px;\n  overflow-y: auto;\n  padding: 8px 10px;\n  font-family: \"Cascadia Code\", \"Fira Code\", Consolas, monospace;\n  font-size: 11px;\n  line-height: 1.5;\n  color: #cbd5e1;\n  user-select: text;\n}\n\n.ag-console-box::-webkit-scrollbar {\n  width: 5px;\n}\n\n.ag-console-box::-webkit-scrollbar-thumb {\n  background: rgba(255, 255, 255, 0.15);\n  border-radius: 3px;\n}\n\n.ag-log-line {\n  margin-bottom: 3px;\n  word-break: break-all;\n}\n\n.ag-log-line.step { color: #38bdf8; font-weight: 600; }\n.ag-log-line.success { color: #34d399; font-weight: 600; }\n.ag-log-line.error { color: #f87171; font-weight: 600; }\n.ag-log-time { color: #64748b; margin-right: 6px; font-size: 10px; }\n\n/* Action Toolbar */\n.ag-toolbar {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 8px;\n  padding: 8px 16px 14px 16px;\n}\n\n.ag-btn {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  padding: 8px 10px;\n  border-radius: 8px;\n  font-size: 11px;\n  font-weight: 600;\n  cursor: pointer;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  background: rgba(30, 41, 59, 0.8);\n  color: var(--ag-text-primary);\n  transition: all 0.2s ease;\n}\n\n.ag-btn:hover {\n  background: rgba(56, 189, 248, 0.15);\n  border-color: rgba(56, 189, 248, 0.4);\n  color: #38bdf8;\n  transform: translateY(-1px);\n}\n\n.ag-btn-primary {\n  background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(129, 140, 248, 0.2) 100%);\n  border-color: rgba(56, 189, 248, 0.4);\n}\n\n.ag-btn-primary:hover {\n  background: linear-gradient(135deg, rgba(56, 189, 248, 0.35) 0%, rgba(129, 140, 248, 0.35) 100%);\n  border-color: rgba(56, 189, 248, 0.7);\n  box-shadow: 0 0 12px rgba(56, 189, 248, 0.25);\n}\n";
  document.head.appendChild(style);

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

  document.getElementById('ag-action-run-code').addEventListener('click', () => {
    appendLog('Triggering local lab code run...', 'step');
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'TRIGGER_TASK', payload: { action: 'run_code' } }));
    }
  });

  console.log('⚡ Antigravity STI ELMS Mission Control HUD loaded.');
})();

})();
