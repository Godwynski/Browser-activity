(() => {
  const WS_URL = `ws://${window.location.host}`;
  let socket = null;

  let currentCourses = [];
  let currentSummary = { total: 0, completed: 0, unfinished: 0, ignored: 0 };
  let activeFilter = 'all'; // 'all' | 'unfinished'
  let showIgnored = true;

  // DOM Elements
  const cdpDot = document.getElementById('cdp-dot');
  const wsDot = document.getElementById('ws-dot');
  const bannerSubject = document.getElementById('banner-subject');
  const bannerTitle = document.getElementById('banner-title');
  const bannerStep = document.getElementById('banner-step');
  const bannerPercent = document.getElementById('banner-percent');
  const bannerProgressFill = document.getElementById('banner-progress-fill');
  const bannerStatusText = document.getElementById('banner-status-text');
  const terminalLogs = document.getElementById('terminal-logs');
  const coursesList = document.getElementById('courses-list');

  const statUnfinished = document.getElementById('stat-unfinished');
  const statCompleted = document.getElementById('stat-completed');
  const statIgnored = document.getElementById('stat-ignored');
  const tabAll = document.getElementById('tab-all');
  const tabUnfinished = document.getElementById('tab-unfinished');
  const checkShowIgnored = document.getElementById('check-show-ignored');
  const btnAuditNow = document.getElementById('btn-audit-now');

  function appendTerminalLog(text, level = 'info', time = null) {
    const timeStr = time || new Date().toLocaleTimeString();
    const row = document.createElement('div');
    row.className = `log-row ${level}`;
    row.innerHTML = `<span class="time">${timeStr}</span>${escapeHtml(text)}`;
    terminalLogs.appendChild(row);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function updateMissionUI(task) {
    if (!task) return;
    bannerSubject.textContent = (task.subject || 'STANDBY').toUpperCase();
    bannerTitle.textContent = task.name || 'Idle — Waiting for Tasks';
    bannerStep.textContent = task.stepName || 'No script currently executing';
    const percent = task.progress || 0;
    bannerPercent.textContent = `${percent}%`;
    bannerProgressFill.style.width = `${percent}%`;

    if (task.status === 'RUNNING') {
      bannerStatusText.textContent = `Running (Step ${task.currentStep || 1} of ${task.totalSteps || 1})`;
      bannerSubject.style.color = '#f59e0b';
      bannerSubject.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    } else if (task.status === 'COMPLETED') {
      bannerStatusText.textContent = 'Completed';
      bannerSubject.style.color = '#10b981';
      bannerSubject.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    } else {
      bannerStatusText.textContent = 'Ready for automation';
      bannerSubject.style.color = '#38bdf8';
      bannerSubject.style.borderColor = 'rgba(56, 189, 248, 0.4)';
    }
  }

  // WebSocket Connection
  function initWebSocket() {
    try {
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        wsDot.className = 'status-indicator online';
        document.getElementById('ws-label').textContent = 'Live Telemetry Connected';
        appendTerminalLog('Connected to Antigravity Mission Control Telemetry Bus', 'success');
      };

      socket.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);
          if (type === 'STATE_SNAPSHOT') {
            updateMissionUI(data);
            if (data.logs && Array.isArray(data.logs)) {
              data.logs.slice(-30).forEach(l => appendTerminalLog(l.text, l.level, l.timestamp));
            }
          } else if (type === 'TASK_START' || type === 'STEP_UPDATE') {
            updateMissionUI(data);
          } else if (type === 'LOG') {
            appendTerminalLog(data.text, data.level, data.timestamp);
          } else if (type === 'TASK_COMPLETE') {
            updateMissionUI(data.task);
            appendTerminalLog(`✅ ${data.summary}`, 'success');
            loadCourses(); // Refresh courses list on task completion
          } else if (type === 'TASK_ERROR') {
            updateMissionUI(data.task);
            appendTerminalLog(`❌ ${data.error}`, 'error');
          }
        } catch (e) {
          console.error('[Dashboard] Parse error:', e);
        }
      };

      socket.onclose = () => {
        wsDot.className = 'status-indicator offline';
        document.getElementById('ws-label').textContent = 'Telemetry Reconnecting...';
        setTimeout(initWebSocket, 2500);
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch (e) {
      setTimeout(initWebSocket, 2500);
    }
  }

  // Load Courses Dynamically
  async function loadCourses() {
    try {
      const resp = await fetch('/api/courses');
      const data = await resp.json();
      currentCourses = data.courses || [];
      currentSummary = data.summary || { total: 0, completed: 0, unfinished: 0, ignored: 0 };
      updateSummaryUI();
      renderCourses();
    } catch (err) {
      coursesList.innerHTML = `<div class="loading-state">Failed to load courses: ${escapeHtml(err.message)}</div>`;
    }
  }

  function updateSummaryUI() {
    statUnfinished.textContent = `⏳ ${currentSummary.unfinished} Unfinished`;
    statCompleted.textContent = `✅ ${currentSummary.completed} Completed`;
    statIgnored.textContent = `👁️‍🗨️ ${currentSummary.ignored} Ignored`;

    if (currentSummary.unfinished > 0) {
      statUnfinished.style.animation = 'pulse-ring 2s infinite';
    } else {
      statUnfinished.style.animation = 'none';
    }
  }

  function renderCourses() {
    if (!currentCourses || currentCourses.length === 0) {
      coursesList.innerHTML = '<div class="loading-state">No courses found in <code>courses/</code>.</div>';
      return;
    }

    coursesList.innerHTML = '';
    let renderedAny = false;

    for (const course of currentCourses) {
      let filteredAssignments = (course.assignments || []).filter(a => {
        if (!showIgnored && a.isIgnored) return false;
        if (activeFilter === 'unfinished' && a.status !== 'UNFINISHED') return false;
        return true;
      });

      if (filteredAssignments.length === 0 && activeFilter === 'unfinished') {
        continue;
      }

      renderedAny = true;
      const card = document.createElement('div');
      card.className = 'course-card';

      let modulesHtml = '';
      if (filteredAssignments.length > 0) {
        modulesHtml = filteredAssignments.map(a => {
          let statusBadge = '';
          if (a.isIgnored) {
            statusBadge = '<span class="status-tag ignored">👁️‍🗨️ Ignored</span>';
          } else if (a.status === 'UNFINISHED') {
            statusBadge = `<span class="status-tag unfinished" title="Missing: ${escapeHtml(a.missing.join(', '))}">⏳ Pending: ${escapeHtml(a.missing.join(', '))}</span>`;
          } else {
            statusBadge = '<span class="status-tag completed">✅ Completed</span>';
          }

          return `
            <div class="module-item ${a.status === 'UNFINISHED' ? 'is-unfinished' : ''} ${a.isIgnored ? 'is-ignored' : ''}">
              <div class="module-info">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="module-title">${escapeHtml(a.name)}</span>
                  ${statusBadge}
                </div>
                <div class="module-files">
                  ${a.hasCode ? '<span class="file-chip">⚡ Code (src/)</span>' : ''}
                  ${a.hasMaterials ? '<span class="file-chip">📄 PDF (materials/)</span>' : ''}
                  ${a.hasAnswer ? '<span class="file-chip">✅ Deliverable (answer.md)</span>' : ''}
                  ${a.term ? `<span style="color: var(--text-dim);">[${escapeHtml(a.term)}]</span>` : ''}
                </div>
              </div>
              <div class="module-actions">
                ${a.hasCode ? `<button class="btn-sm btn-action-run-lab" data-course="${escapeHtml(course.name)}" data-assignment="${escapeHtml(a.name)}">▶ Run Code</button>` : ''}
                <button class="btn-ignore-toggle ${a.isIgnored ? 'ignored' : ''}" data-course="${escapeHtml(course.name)}" data-assignment="${escapeHtml(a.name)}" data-ignore="${!a.isIgnored}">
                  ${a.isIgnored ? '↩ Unignore' : '👁️‍🗨️ Ignore'}
                </button>
              </div>
            </div>
          `;
        }).join('');
      } else {
        modulesHtml = '<div style="font-size: 11px; color: var(--text-dim); padding: 4px 0;">No matching assignments in this view.</div>';
      }

      card.innerHTML = `
        <div class="course-header">
          <div class="course-name">${escapeHtml(course.displayName)}</div>
          <div class="course-tags">
            <span class="tag highlight">${filteredAssignments.length} Shown</span>
            <span class="tag">📁 ${escapeHtml(course.name)}</span>
          </div>
        </div>
        <div class="modules-list">
          ${modulesHtml}
        </div>
      `;

      coursesList.appendChild(card);
    }

    if (!renderedAny) {
      coursesList.innerHTML = `<div class="loading-state">✨ All caught up! No ${activeFilter === 'unfinished' ? 'unfinished' : ''} assignments found.</div>`;
    }
  }

  // Event delegation for module action buttons
  coursesList.addEventListener('click', (e) => {
    const runBtn = e.target.closest('.btn-action-run-lab');
    if (runBtn) {
      const course = runBtn.getAttribute('data-course');
      const assignment = runBtn.getAttribute('data-assignment');
      window.runLab(course, assignment);
      return;
    }
    const ignoreBtn = e.target.closest('.btn-ignore-toggle');
    if (ignoreBtn) {
      const course = ignoreBtn.getAttribute('data-course');
      const assignment = ignoreBtn.getAttribute('data-assignment');
      const shouldIgnore = ignoreBtn.getAttribute('data-ignore') === 'true';
      window.toggleIgnore(course, assignment, shouldIgnore);
      return;
    }
  });

  // Action: Toggle Ignore
  window.toggleIgnore = async function(courseName, assignmentName, shouldIgnore) {
    try {
      const resp = await fetch('/api/assignments/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseName, assignmentName, isIgnored: shouldIgnore })
      });
      const res = await resp.json();
      if (res.success) {
        appendTerminalLog(`Task ${assignmentName} ${shouldIgnore ? 'marked as Ignored' : 'Unignored'}`, 'info');
        loadCourses();
      }
    } catch (e) {
      appendTerminalLog(`Failed to update ignore state: ${e.message}`, 'error');
    }
  };

  // Action: Run Lab
  window.runLab = async function(courseName, assignmentName) {
    appendTerminalLog(`Executing code for ${courseName} / ${assignmentName}...`, 'step');
    try {
      const resp = await fetch('/api/actions/run-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseName, assignmentName })
      });
      const res = await resp.json();
      if (res.success) {
        appendTerminalLog('Process launched successfully!', 'success');
      } else {
        appendTerminalLog(`Failed: ${res.error}`, 'error');
      }
    } catch (e) {
      appendTerminalLog(`Error: ${e.message}`, 'error');
    }
  };

  // Filters & Tabs
  tabAll.addEventListener('click', () => {
    activeFilter = 'all';
    tabAll.className = 'filter-tab active';
    tabUnfinished.className = 'filter-tab';
    renderCourses();
  });

  tabUnfinished.addEventListener('click', () => {
    activeFilter = 'unfinished';
    tabUnfinished.className = 'filter-tab active';
    tabAll.className = 'filter-tab';
    renderCourses();
  });

  checkShowIgnored.addEventListener('change', (e) => {
    showIgnored = e.target.checked;
    renderCourses();
  });

  btnAuditNow.addEventListener('click', async () => {
    appendTerminalLog('Starting audit for unfinished assignments...', 'step');
    try {
      const resp = await fetch('/api/actions/check-unfinished', { method: 'POST' });
      const res = await resp.json();
      loadCourses();
    } catch (e) {
      appendTerminalLog(`Audit error: ${e.message}`, 'error');
    }
  });

  // Wire Toolbar Buttons
  document.getElementById('btn-refresh-courses').addEventListener('click', () => {
    appendTerminalLog('Refreshing course catalog from disk...', 'info');
    loadCourses();
  });

  document.getElementById('btn-run-demo').addEventListener('click', async () => {
    appendTerminalLog('Triggering live telemetry demo simulation...', 'step');
    try {
      await fetch('/api/actions/test-demo', { method: 'POST' });
    } catch (e) {
      appendTerminalLog(`Demo failed: ${e.message}`, 'error');
    }
  });

  document.getElementById('btn-action-cube').addEventListener('click', () => {
    window.runLab('Computer_Graphics_Programming', '03_Laboratory_Exercise_1');
  });

  document.getElementById('btn-action-handouts').addEventListener('click', async () => {
    appendTerminalLog('Dispatching STI ELMS handout synchronization...', 'step');
    try {
      const resp = await fetch('/api/actions/sync-handouts', { method: 'POST' });
      const res = await resp.json();
      appendTerminalLog(res.message || 'Handouts sync queued!', 'success');
    } catch (e) {
      appendTerminalLog(`Error: ${e.message}`, 'error');
    }
  });

  document.getElementById('btn-open-elms').addEventListener('click', () => {
    window.open('https://elms.sti.edu', '_blank');
  });

  document.getElementById('btn-open-courses-folder').addEventListener('click', () => {
    appendTerminalLog('Courses directory: c:\\Users\\Godwyn\\Documents\\Projects\\Browser activity\\courses', 'info');
  });

  document.getElementById('btn-clear-terminal').addEventListener('click', () => {
    terminalLogs.innerHTML = '';
  });

  // ELMS Discovered Assignments Section
  const elmsAssignmentsList = document.getElementById('elms-assignments-list');
  const btnScanElmsLive = document.getElementById('btn-scan-elms-live');

  async function loadElmsAssignments() {
    try {
      const resp = await fetch('/api/elms/assignments');
      const data = await resp.json();
      renderElmsAssignments(data.assignments || []);
    } catch (_) {}
  }

  function renderElmsAssignments(assignments) {
    if (!elmsAssignmentsList) return;
    if (!assignments || assignments.length === 0) {
      elmsAssignmentsList.innerHTML = '<div class="loading-state">Click "Check ELMS Live" to scan your enrolled courses on STI ELMS.</div>';
      return;
    }

    elmsAssignmentsList.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'course-card';

    const itemsHtml = assignments.map(a => {
      let statusClass = 'unfinished';
      let statusText = `ELMS: ${a.status || 'Pending'}`;
      if (a.status === 'Submitted') {
        statusClass = 'completed';
      }

      let localBadge = '';
      if (a.localCompleted) {
        localBadge = '<span class="tag highlight">✅ In Workspace</span>';
      } else if (a.localExists) {
        localBadge = '<span class="tag" style="color: var(--accent-amber);">⏳ Ingested (Unfinished)</span>';
      } else {
        localBadge = '<span class="tag" style="color: var(--accent-rose);">⚠️ Not in courses/</span>';
      }

      const subjName = a.subject || 'General';
      const folderName = a.courseFolder || subjName.replace(/ /g, '_');
      const taskTitle = a.cleanName || a.title;

      return `
        <div class="module-item ${a.needsAction ? 'is-unfinished' : ''} ${a.isIgnored ? 'is-ignored' : ''}">
          <div class="module-info">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="module-title">${escapeHtml(a.title)}</span>
              <span class="status-tag ${statusClass}">${escapeHtml(statusText)}</span>
              ${localBadge}
            </div>
            <div class="module-files">
              <span style="color: var(--accent-cyan);">📚 ${escapeHtml(subjName)}</span>
              ${a.url ? `<a href="${escapeHtml(a.url)}" target="_blank" style="color: var(--text-dim); text-decoration: none;">🔗 Open in ELMS</a>` : ''}
            </div>
          </div>
          <div class="module-actions">
            ${!a.localExists ? `<button class="btn-sm" onclick="ingestElmsTask('${escapeHtml(subjName)}', '${escapeHtml(taskTitle)}', '${escapeHtml(a.url || '')}')">⚡ Ingest to courses/</button>` : ''}
            <button class="btn-ignore-toggle ${a.isIgnored ? 'ignored' : ''}" onclick="toggleIgnore('${escapeHtml(folderName)}', '${escapeHtml(taskTitle)}', ${!a.isIgnored})">
              ${a.isIgnored ? '↩ Unignore' : '👁️‍🗨️ Ignore'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="course-header">
        <div class="course-name">Discovered Assignments (${assignments.length})</div>
        <div class="course-tags">
          <span class="tag highlight">${assignments.filter(a => a.needsAction).length} Pending</span>
        </div>
      </div>
      <div class="modules-list">
        ${itemsHtml}
      </div>
    `;

    elmsAssignmentsList.appendChild(card);
  }

  window.ingestElmsTask = async function(subject, title, url) {
    appendTerminalLog(`Ingesting ${title} into courses/${subject.replace(/ /g, '_')}/...`, 'step');
    try {
      const resp = await fetch('/api/elms/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, title, url })
      });
      const res = await resp.json();
      if (res.success) {
        appendTerminalLog(`Successfully created: ${res.path}`, 'success');
        loadCourses();
        loadElmsAssignments();
      }
    } catch (e) {
      appendTerminalLog(`Ingestion error: ${e.message}`, 'error');
    }
  };

  if (btnScanElmsLive) {
    btnScanElmsLive.addEventListener('click', async () => {
      appendTerminalLog('Connecting to Brave to scan STI ELMS classes for assignments...', 'step');
      try {
        const resp = await fetch('/api/elms/scan', { method: 'POST' });
        const res = await resp.json();
        appendTerminalLog(res.message || 'ELMS scan initiated in background!', 'success');
      } catch (e) {
        appendTerminalLog(`Failed to scan ELMS: ${e.message}`, 'error');
      }
    });
  }

  // Startup
  initWebSocket();
  loadCourses();
  loadElmsAssignments();
})();
