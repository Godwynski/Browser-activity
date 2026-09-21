(() => {
  const WS_URL = 'ws://localhost:8765';
  const DASHBOARD_URL = 'http://localhost:8765';
  let socket = null;

  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const taskSubject = document.getElementById('task-subject');
  const taskTitle = document.getElementById('task-title');
  const taskStep = document.getElementById('task-step');
  const taskPercent = document.getElementById('task-percent');
  const progressBar = document.getElementById('progress-bar');
  const consoleBox = document.getElementById('console-box');

  function appendLog(text, level = 'info', time = null) {
    const timeStr = time || new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.innerHTML = `<span class="log-time">${timeStr}</span>${escapeHtml(text)}`;
    consoleBox.appendChild(entry);
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function updateTaskUI(task) {
    if (!task) return;
    taskSubject.textContent = (task.subject || 'STANDBY').toUpperCase();
    taskTitle.textContent = task.name || 'Ready for Automation';
    taskStep.textContent = task.stepName || 'No script currently running';
    const percent = task.progress || 0;
    taskPercent.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;

    if (task.status === 'RUNNING') {
      statusDot.className = 'status-dot running';
      statusText.textContent = 'Running';
    } else if (socket && socket.readyState === WebSocket.OPEN) {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Connected';
    }
  }

  function connect() {
    try {
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Connected';
        appendLog('Connected to Antigravity Mission Control', 'success');
      };

      socket.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);
          if (type === 'STATE_SNAPSHOT') {
            updateTaskUI(data);
            if (data.logs && Array.isArray(data.logs)) {
              consoleBox.innerHTML = '';
              data.logs.slice(-25).forEach(l => appendLog(l.text, l.level, l.timestamp));
            }
          } else if (type === 'TASK_START' || type === 'STEP_UPDATE') {
            updateTaskUI(data);
          } else if (type === 'LOG') {
            appendLog(data.text, data.level, data.timestamp);
          } else if (type === 'TASK_COMPLETE') {
            updateTaskUI(data.task);
            appendLog(`✅ ${data.summary}`, 'success');
          } else if (type === 'TASK_ERROR') {
            updateTaskUI(data.task);
            appendLog(`❌ ${data.error}`, 'error');
          }
        } catch (err) {
          console.error('[Popup] Parse error:', err);
        }
      };

      socket.onclose = () => {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Offline';
        setTimeout(connect, 2500);
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch (e) {
      setTimeout(connect, 2500);
    }
  }

  connect();

  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    consoleBox.innerHTML = '';
  });

  // Action Buttons
  document.getElementById('btn-run-cube').addEventListener('click', async () => {
    appendLog('Executing wireframe_cube.py via Python OpenGL...', 'step');
    try {
      const resp = await fetch('http://localhost:8765/api/actions/run-lab', { method: 'POST' });
      const res = await resp.json();
      if (res.success) {
        appendLog('Wireframe cube window launched successfully!', 'success');
      } else {
        appendLog(`Failed to launch cube: ${res.error}`, 'error');
      }
    } catch (e) {
      appendLog(`Error: ${e.message}`, 'error');
    }
  });

  document.getElementById('btn-check-pending').addEventListener('click', async () => {
    appendLog('Auditing unfinished assignments across courses...', 'step');
    try {
      const resp = await fetch('http://localhost:8765/api/actions/check-unfinished', { method: 'POST' });
      const res = await resp.json();
      if (res.unfinished && res.unfinished.length === 0) {
        appendLog('All tracked assignments are 100% completed!', 'success');
      } else if (res.unfinished) {
        res.unfinished.forEach(u => {
          appendLog(`[${u.course}] ${u.name}: Missing ${u.missing}`, 'step');
        });
      }
    } catch (e) {
      appendLog(`Error: ${e.message}`, 'error');
    }
  });

  document.getElementById('btn-sync-handouts').addEventListener('click', async () => {
    appendLog('Triggering STI ELMS handout sync...', 'step');
    try {
      const resp = await fetch('http://localhost:8765/api/actions/sync-handouts', { method: 'POST' });
      const res = await resp.json();
      appendLog(res.message || 'Sync initiated!', 'success');
    } catch (e) {
      appendLog(`Error: ${e.message}`, 'error');
    }
  });

  document.getElementById('btn-test-sim').addEventListener('click', async () => {
    appendLog('Triggering live telemetry simulation...', 'step');
    try {
      await fetch('http://localhost:8765/api/actions/test-demo', { method: 'POST' });
    } catch (e) {
      appendLog(`Error: ${e.message}`, 'error');
    }
  });

  document.getElementById('btn-open-dashboard').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: DASHBOARD_URL });
    } else {
      window.open(DASHBOARD_URL, '_blank');
    }
  });
})();
