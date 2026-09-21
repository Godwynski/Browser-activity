// Antigravity Hot-Reload Service Worker for Brave Extension
const WS_URL = 'ws://localhost:8765';
let socket = null;

function connectReloader() {
  try {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('⚡ [Antigravity] Background hot-reloader connected.');
    };

    socket.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        if (type === 'HOT_RELOAD_EXTENSION') {
          console.log('⚡ [Antigravity] File change detected! Auto-reloading extension...', data);
          chrome.runtime.reload();
        }
      } catch (_) {}
    };

    socket.onclose = () => {
      setTimeout(connectReloader, 3000);
    };

    socket.onerror = () => {
      socket.close();
    };
  } catch (_) {
    setTimeout(connectReloader, 3000);
  }
}

connectReloader();
