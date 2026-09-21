// ==UserScript==
// @name         Antigravity Mission Control (STI ELMS HUD)
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  Real-time task telemetry, script log streaming, ELMS auto-due-assignment detector, and ignore controls
// @author       Antigravity
// @match        https://elms.sti.edu/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';
  const style = document.createElement('style');
  style.id = 'antigravity-hud-styles';
  style.textContent = "/* Antigravity Mission Control - Floating HUD Styles */\n\n:root {\n  --ag-bg: rgba(15, 23, 42, 0.92);\n  --ag-card: rgba(30, 41, 59, 0.75);\n  --ag-border: rgba(56, 189, 248, 0.25);\n  --ag-border-glow: rgba(56, 189, 248, 0.45);\n  --ag-accent: #38bdf8;\n  --ag-accent-gradient: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);\n  --ag-text-primary: #f8fafc;\n  --ag-text-muted: #94a3b8;\n  --ag-success: #10b981;\n  --ag-warning: #f59e0b;\n  --ag-error: #ef4444;\n}\n\n#antigravity-hud-root {\n  position: fixed;\n  z-index: 2147483647;\n  font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;\n  user-select: none;\n  transition: opacity 0.2s ease, transform 0.2s ease;\n}\n\n/* Collapsed Pill State */\n#antigravity-pill {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 8px 16px;\n  background: var(--ag-bg);\n  backdrop-filter: blur(16px);\n  -webkit-backdrop-filter: blur(16px);\n  border: 1px solid var(--ag-border);\n  border-radius: 9999px;\n  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 16px rgba(56, 189, 248, 0.2);\n  cursor: pointer;\n  color: var(--ag-text-primary);\n  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);\n}\n\n#antigravity-pill:hover {\n  border-color: var(--ag-border-glow);\n  transform: translateY(-2px);\n  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 24px rgba(56, 189, 248, 0.35);\n}\n\n.ag-pulse-dot {\n  width: 10px;\n  height: 10px;\n  border-radius: 50%;\n  background: var(--ag-success);\n  box-shadow: 0 0 8px var(--ag-success);\n  animation: ag-pulse 2s infinite ease-in-out;\n}\n\n.ag-pulse-dot.running {\n  background: var(--ag-warning);\n  box-shadow: 0 0 8px var(--ag-warning);\n}\n\n.ag-pulse-dot.offline {\n  background: #64748b;\n  box-shadow: none;\n  animation: none;\n}\n\n@keyframes ag-pulse {\n  0%, 100% { transform: scale(1); opacity: 1; }\n  50% { transform: scale(1.3); opacity: 0.7; }\n}\n\n.ag-pill-logo {\n  font-weight: 700;\n  font-size: 13px;\n  letter-spacing: 0.5px;\n  background: var(--ag-accent-gradient);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n}\n\n.ag-pill-status {\n  font-size: 12px;\n  color: var(--ag-text-muted);\n  max-width: 140px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* Expanded Window State */\n#antigravity-window {\n  width: 440px;\n  background: var(--ag-bg);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);\n  border: 1px solid var(--ag-border);\n  border-radius: 16px;\n  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.15);\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n}\n\n.ag-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 12px 16px;\n  background: rgba(15, 23, 42, 0.85);\n  border-bottom: 1px solid rgba(255, 255, 255, 0.08);\n  cursor: grab;\n}\n\n.ag-header:active {\n  cursor: grabbing;\n}\n\n.ag-header-left {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.ag-header-title {\n  font-size: 13px;\n  font-weight: 700;\n  background: var(--ag-accent-gradient);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  letter-spacing: 0.5px;\n}\n\n.ag-conn-badge {\n  font-size: 10px;\n  padding: 2px 6px;\n  border-radius: 4px;\n  background: rgba(16, 185, 129, 0.15);\n  color: var(--ag-success);\n  border: 1px solid rgba(16, 185, 129, 0.3);\n}\n\n.ag-conn-badge.offline {\n  background: rgba(239, 68, 68, 0.15);\n  color: var(--ag-error);\n  border-color: rgba(239, 68, 68, 0.3);\n}\n\n.ag-header-actions {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ag-icon-btn {\n  background: transparent;\n  border: none;\n  color: var(--ag-text-muted);\n  cursor: pointer;\n  padding: 4px 6px;\n  border-radius: 4px;\n  font-size: 12px;\n  transition: all 0.15s ease;\n}\n\n.ag-icon-btn:hover {\n  background: rgba(255, 255, 255, 0.1);\n  color: var(--ag-text-primary);\n}\n\n/* Task Card */\n.ag-task-card {\n  padding: 14px 16px;\n  background: var(--ag-card);\n  margin: 12px 16px 8px 16px;\n  border-radius: 10px;\n  border: 1px solid rgba(255, 255, 255, 0.06);\n}\n\n.ag-task-subject {\n  font-size: 11px;\n  text-transform: uppercase;\n  letter-spacing: 0.5px;\n  color: var(--ag-accent);\n  font-weight: 600;\n  margin-bottom: 4px;\n}\n\n.ag-task-name {\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--ag-text-primary);\n  margin-bottom: 8px;\n}\n\n.ag-task-step {\n  display: flex;\n  justify-content: space-between;\n  font-size: 11px;\n  color: var(--ag-text-muted);\n  margin-bottom: 6px;\n}\n\n.ag-progress-bar {\n  height: 6px;\n  background: rgba(255, 255, 255, 0.1);\n  border-radius: 9999px;\n  overflow: hidden;\n  position: relative;\n}\n\n.ag-progress-fill {\n  height: 100%;\n  background: var(--ag-accent-gradient);\n  border-radius: 9999px;\n  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n  box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);\n}\n\n/* Console Logs */\n.ag-console-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 6px 16px 2px 16px;\n  font-size: 11px;\n  color: var(--ag-text-muted);\n}\n\n.ag-console-box {\n  margin: 4px 16px 10px 16px;\n  background: rgba(10, 15, 29, 0.85);\n  border: 1px solid rgba(255, 255, 255, 0.05);\n  border-radius: 8px;\n  height: 130px;\n  overflow-y: auto;\n  padding: 8px 10px;\n  font-family: \"Cascadia Code\", \"Fira Code\", Consolas, monospace;\n  font-size: 11px;\n  line-height: 1.5;\n  color: #cbd5e1;\n  user-select: text;\n}\n\n.ag-console-box::-webkit-scrollbar {\n  width: 5px;\n}\n\n.ag-console-box::-webkit-scrollbar-thumb {\n  background: rgba(255, 255, 255, 0.15);\n  border-radius: 3px;\n}\n\n.ag-log-line {\n  margin-bottom: 3px;\n  word-break: break-all;\n}\n\n.ag-log-line.step { color: #38bdf8; font-weight: 600; }\n.ag-log-line.success { color: #34d399; font-weight: 600; }\n.ag-log-line.error { color: #f87171; font-weight: 600; }\n.ag-log-time { color: #64748b; margin-right: 6px; font-size: 10px; }\n\n/* Action Toolbar */\n.ag-toolbar {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 8px;\n  padding: 8px 16px 14px 16px;\n}\n\n.ag-btn {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  padding: 8px 10px;\n  border-radius: 8px;\n  font-size: 11px;\n  font-weight: 600;\n  cursor: pointer;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  background: rgba(30, 41, 59, 0.8);\n  color: var(--ag-text-primary);\n  transition: all 0.2s ease;\n}\n\n.ag-btn:hover {\n  background: rgba(56, 189, 248, 0.15);\n  border-color: rgba(56, 189, 248, 0.4);\n  color: #38bdf8;\n  transform: translateY(-1px);\n}\n\n.ag-btn-primary {\n  background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(129, 140, 248, 0.2) 100%);\n  border-color: rgba(56, 189, 248, 0.4);\n}\n\n.ag-btn-primary:hover {\n  background: linear-gradient(135deg, rgba(56, 189, 248, 0.35) 0%, rgba(129, 140, 248, 0.35) 100%);\n  border-color: rgba(56, 189, 248, 0.7);\n  box-shadow: 0 0 12px rgba(56, 189, 248, 0.25);\n}\n\n/* Detected Due Assignment Banner */\n.ag-detected-box {\n  margin: 10px 16px 4px 16px;\n  padding: 12px 14px;\n  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(56, 189, 248, 0.12) 100%);\n  border: 1px solid rgba(245, 158, 11, 0.4);\n  border-radius: 10px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);\n}\n\n.ag-detected-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}\n\n.ag-detected-label {\n  font-size: 10px;\n  font-weight: 800;\n  letter-spacing: 0.8px;\n  color: var(--ag-warning);\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ag-detected-badge {\n  font-size: 10px;\n  padding: 2px 6px;\n  border-radius: 4px;\n  background: rgba(245, 158, 11, 0.2);\n  color: #fbbf24;\n  border: 1px solid rgba(245, 158, 11, 0.35);\n  font-weight: 700;\n}\n\n.ag-detected-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  max-height: 180px;\n  overflow-y: auto;\n  padding-right: 4px;\n}\n\n.ag-detected-list::-webkit-scrollbar {\n  width: 4px;\n}\n\n.ag-detected-list::-webkit-scrollbar-thumb {\n  background: rgba(245, 158, 11, 0.3);\n  border-radius: 2px;\n}\n\n.ag-assignment-card {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  padding: 8px 10px;\n  background: rgba(15, 23, 42, 0.6);\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 8px;\n  transition: all 0.15s ease;\n}\n\n.ag-assignment-card:hover {\n  border-color: rgba(56, 189, 248, 0.35);\n  background: rgba(15, 23, 42, 0.85);\n}\n\n.ag-assignment-top {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 6px;\n}\n\n.ag-assignment-title {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--ag-text-primary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  max-width: 250px;\n}\n\n.ag-status-pill {\n  font-size: 9px;\n  font-weight: 700;\n  padding: 2px 5px;\n  border-radius: 3px;\n  white-space: nowrap;\n}\n\n.ag-status-pill.pending {\n  background: rgba(245, 158, 11, 0.2);\n  color: #fbbf24;\n  border: 1px solid rgba(245, 158, 11, 0.3);\n}\n\n.ag-status-pill.overdue {\n  background: rgba(239, 68, 68, 0.2);\n  color: #f87171;\n  border: 1px solid rgba(239, 68, 68, 0.3);\n}\n\n.ag-status-pill.submitted {\n  background: rgba(16, 185, 129, 0.2);\n  color: #34d399;\n  border: 1px solid rgba(16, 185, 129, 0.3);\n}\n\n.ag-assignment-bottom {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}\n\n.ag-assignment-due {\n  font-size: 10px;\n  color: var(--ag-text-muted);\n}\n\n.ag-assignment-actions {\n  display: flex;\n  gap: 4px;\n}\n\n.ag-mini-btn {\n  padding: 3px 7px;\n  font-size: 10px;\n  font-weight: 600;\n  border-radius: 4px;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  background: rgba(30, 41, 59, 0.8);\n  color: var(--ag-text-primary);\n  cursor: pointer;\n  transition: all 0.15s ease;\n}\n\n.ag-mini-btn:hover {\n  background: rgba(56, 189, 248, 0.2);\n  border-color: rgba(56, 189, 248, 0.5);\n  color: #38bdf8;\n}\n\n.ag-mini-btn.primary {\n  background: rgba(56, 189, 248, 0.25);\n  border-color: rgba(56, 189, 248, 0.5);\n  color: #38bdf8;\n}\n\n.ag-mini-btn.primary:hover {\n  background: rgba(56, 189, 248, 0.4);\n  box-shadow: 0 0 8px rgba(56, 189, 248, 0.3);\n}\n\n.ag-detected-batch {\n  display: flex;\n  gap: 8px;\n  padding-top: 4px;\n  border-top: 1px solid rgba(255, 255, 255, 0.08);\n}\n\n";
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
            <div class="ag-assignment-due">${escapeHtml(subjectName)} ${detectedDue ? `• ${escapeHtml(detectedDue)}` : ''}</div>
            <div class="ag-assignment-actions" style="margin-top: 6px;">
              <button class="ag-mini-btn primary" id="ag-btn-ingest-single">⚡ Ingest to courses/</button>
              <button class="ag-mini-btn" id="ag-btn-ignore-single">👁️‍🗨️ Ignore</button>
            </div>
          </div>
        `;

        pillStatus.innerText = `🎯 [Due: ${detectedTitle}]`;
        if (statusType !== 'submitted') pillDot.className = 'ag-pulse-dot running';

        document.getElementById('ag-btn-ingest-single')?.addEventListener('click', async () => {
          appendLog(`Ingesting ${detectedTitle} into courses/${subjectName}/...`, 'step');
          try {
            const resp = await fetch('http://localhost:8765/api/elms/ingest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subject: subjectName, title: detectedTitle, url })
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

      if (!title || lower === 'assignment' || lower === 'title' || lower === 'name' || lower.includes('expand all') || lower.includes('handout') || title.length < 3) {
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

        if (isTaskLink && title.length > 3 && !seenUrls.has(href) && !lower.includes('expand all') && !lower.includes('handout')) {
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

})();
