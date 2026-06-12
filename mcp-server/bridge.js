import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const WS_PORT = 7717;
const TIMEOUT_MS = 30000;

let extensionSocket = null;
const pending = new Map();

export function startBridge() {
  const wss = new WebSocketServer({ host: 'localhost', port: WS_PORT });

  wss.on('connection', (ws) => {
    extensionSocket = ws;
    process.stderr.write('[browser-pilot] Extension connected\n');

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return; // ignore malformed messages
      }
      const handler = pending.get(msg.id);
      if (!handler) return;
      clearTimeout(handler.timer);
      pending.delete(msg.id);
      if (msg.success) {
        if (msg.data && typeof msg.data === 'object' && msg.data.__error) {
          handler.reject(new Error(msg.data.__error));
        } else {
          handler.resolve(msg.data);
        }
      } else {
        handler.reject(new Error(msg.error));
      }
    });

    ws.on('close', () => {
      extensionSocket = null;
      process.stderr.write('[browser-pilot] Extension disconnected\n');
      for (const [id, handler] of pending) {
        clearTimeout(handler.timer);
        pending.delete(id);
        handler.reject(new Error('Extension disconnected'));
      }
    });

    ws.on('error', (err) => {
      process.stderr.write(`[browser-pilot] Socket error: ${err.message}\n`);
    });
  });

  wss.on('error', (err) => {
    process.stderr.write(`[browser-pilot] WebSocket server error: ${err.message}\n`);
  });
}

export function sendCommand(tool, params) {
  return new Promise((resolve, reject) => {
    if (!extensionSocket || extensionSocket.readyState !== 1) {
      return reject(new Error('Browser extension not connected. Load the extension in Chrome/Arc/Firefox.'));
    }
    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Command "${tool}" timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    extensionSocket.send(JSON.stringify({ id, tool, params }));
  });
}
