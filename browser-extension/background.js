const WS_URL = 'ws://localhost:7717';
const RECONNECT_MS = 3000;
const NAVIGATE_TIMEOUT_MS = 30000;
let ws = null;

function connect() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => console.log('[browser-pilot] Connected to MCP server');

  ws.onmessage = async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return; // ignore malformed messages
    }
    const socket = ws; // capture before any await
    try {
      const data = await handleCommand(msg.tool, msg.params);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ id: msg.id, success: true, data }));
      }
    } catch (err) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ id: msg.id, success: false, error: err.message }));
      }
    }
  };

  ws.onclose = () => {
    console.log('[browser-pilot] Disconnected, retry in 3s');
    setTimeout(connect, RECONNECT_MS);
  };

  ws.onerror = () => ws.close();
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) throw new Error('No active tab');
  return tab;
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch {
    // Already injected — ok
  }
}

async function handleCommand(tool, params) {
  const tab = await getActiveTab();

  if (tool === 'navigate') {
    await chrome.tabs.update(tab.id, { url: params.url });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error(`Navigation timed out after ${NAVIGATE_TIMEOUT_MS}ms`));
      }, NAVIGATE_TIMEOUT_MS);

      function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
    return 'navigated';
  }

  if (tool === 'screenshot') {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    return dataUrl.replace(/^data:[^;]+;base64,/, '');
  }

  // All other tools delegate to content script
  await injectContentScript(tab.id);
  return chrome.tabs.sendMessage(tab.id, { tool, params });
}

connect();
