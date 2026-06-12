const WS_URL = 'ws://localhost:7717';
const RECONNECT_MS = 3000;
let ws = null;

function connect() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => console.log('[browser-pilot] Connected to MCP server');

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    try {
      const data = await handleCommand(msg.tool, msg.params);
      ws.send(JSON.stringify({ id: msg.id, success: true, data }));
    } catch (err) {
      ws.send(JSON.stringify({ id: msg.id, success: false, error: err.message }));
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
    await new Promise((resolve) => {
      function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
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
    return dataUrl.replace('data:image/png;base64,', '');
  }

  // All other tools delegate to content script
  await injectContentScript(tab.id);
  return await chrome.tabs.sendMessage(tab.id, { tool, params });
}

connect();
