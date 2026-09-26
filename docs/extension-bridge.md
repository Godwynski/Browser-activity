# Mode C: Extension Bridge Architecture & Limitations

## 1. Overview & Purpose

The **Extension Bridge (`ExtensionAdapter`)** is the third supported connection mode (Mode C) in the **Universal Browser Control Runtime**.

While **Mode A (Attach CDP)** and **Mode B (Managed Playwright)** communicate directly with browser engine debugging interfaces via the Chrome DevTools Protocol or WebDriver BiDi, **Mode C** mediates browser automation entirely through a lightweight companion browser extension and a local WebSocket bridge.

```
┌─────────────────────────────────┐
│     AI Agent / Antigravity      │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│         BrowserRuntime          │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  ExtensionAdapter (Mode C)      │
└────────────────┬────────────────┘
                 │  JSON-RPC 2.0
                 ▼  ws://127.0.0.1:8766
┌─────────────────────────────────┐
│    ExtensionBridgeServer        │
└────────────────┬────────────────┘
                 │  Local WebSocket
                 ▼
┌─────────────────────────────────┐
│  Browser Extension Background   │
│  (Service Worker / Manifest V3) │
└────────────────┬────────────────┘
                 │  chrome.tabs.sendMessage
                 ▼
┌─────────────────────────────────┐
│    In-Page Content Script       │
│  (DOM Observe, Act, Extract)    │
└─────────────────────────────────┘
```

---

## 2. When to Use Mode C

* **No Remote Debugging Port**: The user's browser is running normally without the `--remote-debugging-port=9222` flag.
* **Corporate / Enterprise Security**: Browser policies strictly prohibit opening open TCP debugging ports.
* **Co-Browsing & HUD**: The user wants visual Mission Control HUD integration directly inside their existing browser tabs without launching a separate profile.

---

## 3. Comparative Capability Matrix

| Feature / Capability | Mode A: Attach (CDP) | Mode B: Managed | Mode C: Extension Bridge |
| :--- | :--- | :--- | :--- |
| **Connection Mechanism** | Port 9222 WebSocket | Dedicated Subprocess | Local WebSocket Bridge (Port 8766) |
| **Browser Support** | Chromium, Brave, Edge | Chrome, Edge, Brave, Firefox | Any Chromium / Firefox browser with extension loaded |
| **DOM Tree Walking** | Full CDP DOM tree | Playwright Engine | Content Script DOM traversal |
| **Shadow DOM Piercing** | Open & Nested Piercing | Open & Nested Piercing | Open Shadow DOM only |
| **Same-Origin Iframes** | Supported | Supported | Supported |
| **Cross-Origin Iframes** | Full CDP piercing | Full Frame Piercing | **Unsupported** (blocked by SOP) |
| **Programmatic File Upload** | Full file input support | Full file input support | **Unsupported** (browser security sandbox) |
| **Native File Downloads** | Full lifecycle tracking | Full lifecycle tracking | **Unsupported** (no native interception) |
| **JavaScript Modal Dialogs** | Auto accept / dismiss | Auto accept / dismiss | **Unsupported** (dialog freezes JS thread) |
| **Browser Chrome Control** | Viewport, window, cookies | Full window management | **Unsupported** (confined to page tab) |
| **Token Efficiency** | Compact 1-line representation | Compact 1-line representation | Compact 1-line representation |

---

## 4. Explicit Technical Limitations (Documented)

### 4.1. No Programmatic File Uploads
* **Reason**: Browser extensions operate under strict security sandboxing. The HTML `<input type="file">` `.files` list cannot be populated programmatically with local file paths from a content script without triggering native OS file picker prompts.
* **Recommendation**: For automated file uploads, use `ChromiumAdapter` or `BiDiAdapter`.

### 4.2. No Native File Download Interception
* **Reason**: Content scripts do not receive low-level browser download events. While the extension can trigger downloads via simulated clicks on download links or the `chrome.downloads` API, it cannot safely track filesystem writes or inspect file sizes without elevated host permissions.
* **Recommendation**: Use `ChromiumAdapter` for verified download automation.

### 4.3. JavaScript Modal Dialogs Freeze Content Scripts
* **Reason**: Standard web modal dialogs (`alert()`, `confirm()`, `prompt()`) freeze the JavaScript execution thread in the target tab. Content scripts cannot intercept or programmatically dismiss them once they are active.
* **Recommendation**: Use `ChromiumAdapter` with `DialogManager` to automate dialogs via CDP.

### 4.4. Cross-Origin / Sandboxed Iframes
* **Reason**: In content script context, the Same-Origin Policy (SOP) strictly prevents scripts from accessing DOM trees inside `<iframe>` elements hosted on third-party origins or declared with `sandbox="allow-scripts"`.
* **Recommendation**: Use `ChromiumAdapter` (CDP bypasses cross-origin restrictions cleanly).

### 4.5. Confined to Web Page Tabs
* **Reason**: The extension bridge can only execute actions within tabs that allow content script injection. It cannot automate browser internal pages (`chrome://*`, `brave://*`, `about:blank`, extension stores).

---

## 5. Protocol Specification

Communication between `ExtensionAdapter` and the browser extension occurs over localhost via **JSON-RPC 2.0**:

### Request Example
```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "dom.click",
  "params": {
    "tabId": "tab_1",
    "ref": "e3"
  }
}
```

### Response Example
```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "result": {
    "ok": true,
    "action": "click",
    "ref": "e3",
    "elapsedMs": 42
  }
}
```

---

## 6. Security Considerations

1. **Localhost Only**: The bridge server binds strictly to `127.0.0.1` and never opens external interfaces.
2. **Explicit User Authorization**: Actions in Mode C occur within the user's active session, and can be visually monitored via the extension HUD.
3. **Graceful Degeneration**: When an unsupported operation is requested (e.g. `upload` or `handleDialog`), `ExtensionAdapter` immediately throws an actionable `UnsupportedOperationError` detailing why the operation cannot proceed in extension mode.
