/**
 * Universal Browser Control Runtime — Extension Bridge Server
 *
 * Provides a lightweight, local WebSocket communication channel connecting
 * the agent runtime with the browser extension.
 *
 * Protocol: JSON-RPC 2.0 over WebSocket (localhost only).
 */

import { EventEmitter } from 'node:events';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { TimeoutError, ConnectionError } from '../core/errors.js';

export class ExtensionBridgeServer extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {number} [options.port=8766]
   * @param {string} [options.host='127.0.0.1']
   */
  constructor(options = {}) {
    super();
    this.port = options.port || 8766;
    this.host = options.host || '127.0.0.1';

    /** @type {http.Server | null} */
    this.httpServer = null;

    /** @type {WebSocketServer | null} */
    this.wss = null;

    /** @type {WebSocket | null} - Active extension client connection */
    this.client = null;

    /** @type {Map<string|number, { resolve: Function, reject: Function, timer: NodeJS.Timeout }>} */
    this._pendingRequests = new Map();

    this._requestId = 1;
    this.running = false;
  }

  /**
   * Start the bridge WebSocket server.
   *
   * @returns {Promise<{ port: number, host: string }>}
   */
  async start() {
    if (this.running) {
      return { port: this.port, host: this.host };
    }

    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        // Simple health endpoint
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', clientConnected: this.isClientConnected() }));
          return;
        }
        res.writeHead(404);
        res.end();
      });

      this.wss = new WebSocketServer({ server: this.httpServer });

      this.wss.on('connection', (ws, req) => {
        // Bind primary extension client
        this.client = ws;
        this.emit('client_connected', { remoteAddress: req.socket.remoteAddress });

        ws.on('message', (data) => {
          this._handleMessage(data);
        });

        ws.on('close', () => {
          if (this.client === ws) {
            this.client = null;
          }
          this.emit('client_disconnected');
        });

        ws.on('error', (err) => {
          this.emit('client_error', err);
        });
      });

      this.httpServer.on('error', (err) => {
        reject(new ConnectionError(`Extension bridge failed to start on ${this.host}:${this.port}: ${err.message}`, {
          port: this.port,
          host: this.host,
          reason: err.message
        }));
      });

      this.httpServer.listen(this.port, this.host, () => {
        this.running = true;
        resolve({ port: this.port, host: this.host });
      });
    });
  }

  /**
   * Whether an extension client is currently connected.
   * @returns {boolean}
   */
  isClientConnected() {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  /**
   * Wait for an extension client to establish connection.
   *
   * @param {number} [timeout=10000]
   * @returns {Promise<void>}
   */
  async waitForClient(timeout = 10000) {
    if (this.isClientConnected()) return;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off('client_connected', onConnected);
        reject(new TimeoutError('client_connected', timeout, {
          port: this.port,
          host: this.host,
          suggestion: 'Ensure the Antigravity browser extension is installed, active, and configured to connect to localhost:' + this.port
        }));
      }, timeout);

      const onConnected = () => {
        clearTimeout(timer);
        resolve();
      };

      this.once('client_connected', onConnected);
    });
  }

  /**
   * Send a JSON-RPC request to the connected extension and wait for response.
   *
   * @param {string} method
   * @param {object} [params={}]
   * @param {number} [timeout=15000]
   * @returns {Promise<*>}
   */
  async sendRequest(method, params = {}, timeout = 15000) {
    if (!this.isClientConnected()) {
      throw new ConnectionError('No browser extension client connected to bridge', {
        port: this.port,
        suggestion: 'Verify extension is installed and loaded in the target browser'
      });
    }

    const id = ++this._requestId;
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingRequests.delete(id);
        reject(new TimeoutError(`Extension RPC '${method}'`, timeout, { method, id }));
      }, timeout);

      this._pendingRequests.set(id, { resolve, reject, timer });

      try {
        this.client.send(payload);
      } catch (err) {
        clearTimeout(timer);
        this._pendingRequests.delete(id);
        reject(new ConnectionError(`Failed to dispatch message to extension: ${err.message}`, { method }));
      }
    });
  }

  _handleMessage(rawData) {
    try {
      const msg = JSON.parse(rawData.toString());

      // If response to a pending request
      if (msg.id !== undefined && this._pendingRequests.has(msg.id)) {
        const { resolve, reject, timer } = this._pendingRequests.get(msg.id);
        clearTimeout(timer);
        this._pendingRequests.delete(msg.id);

        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
        return;
      }

      // If notification/event from extension
      if (msg.method) {
        this.emit('notification', msg);
        if (msg.method === 'event') {
          this.emit(msg.params?.type || 'event', msg.params?.data);
        }
      }
    } catch (err) {
      this.emit('parse_error', err);
    }
  }

  /**
   * Stop the bridge server and release resources.
   *
   * @returns {Promise<void>}
   */
  async stop() {
    // Reject all pending requests
    for (const [id, req] of this._pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(new ConnectionError('Extension bridge server stopped', { id }));
    }
    this._pendingRequests.clear();

    if (this.client) {
      try {
        this.client.close();
      } catch {}
      this.client = null;
    }

    if (this.wss) {
      try {
        this.wss.close();
      } catch {}
      this.wss = null;
    }

    if (this.httpServer) {
      await new Promise((res) => {
        this.httpServer.close(() => res());
      });
      this.httpServer = null;
    }

    this.running = false;
  }
}
