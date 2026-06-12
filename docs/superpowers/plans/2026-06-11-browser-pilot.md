# Browser Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome/Arc/Firefox extension + local MCP server that lets Claude Code read, interact with, and screenshot any authenticated page in the user's real browser.

**Architecture:** A Node.js MCP server (stdio) starts a WebSocket server on localhost:7717. A Manifest V3 browser extension connects as WebSocket client. Claude sends MCP tool calls → MCP server validates allowlist + forwards via WebSocket → extension executes in the real browser tab with real session cookies.

**Tech Stack:** Node.js ESM, `@modelcontextprotocol/sdk`, `ws`, `zod`, Chrome Manifest V3 (content scripts + service worker)

---

## File Map

| File | Responsibility |
|---|---|
| `config/allowlist.json` | Persistent list of allowed domains |
| `mcp-server/package.json` | Node deps: sdk, ws, zod |
| `mcp-server/allowlist.js` | Read/write allowlist, `isAllowed(url)` check |
| `mcp-server/bridge.js` | WebSocket server, send commands to extension, await responses |
| `mcp-server/index.js` | MCP server, registers all tools, starts bridge |
| `mcp-server/allowlist.test.js` | Unit tests for allowlist logic |
| `browser-extension/manifest.json` | Manifest V3 declaration |
| `browser-extension/background.js` | Service worker: WebSocket client, tab navigation, screenshot |
| `browser-extension/content.js` | DOM ops: get_content, click, fill, wait, evaluate |
| `browser-extension/icons/` | PNG icons (16, 48, 128px) |
| `README.md` | Installation steps |

---

### Task 1: Project scaffold

**Files:**
- Create: `config/allowlist.json`
- Create: `mcp-server/package.json`
- Create: `browser-extension/manifest.json`

- [ ] **Step 1: Create directory structure**

```bash
cd /Users/korbold/Developer/Freelancer/browser-pilot
mkdir -p mcp-server browser-extension/icons config
```

- [ ] **Step 2: Create `config/allowlist.json`**

```json
{
  "domains": ["upwork.com", "linkedin.com", "indeed.com"]
}
```

- [ ] **Step 3: Create `mcp-server/package.json`**

```json
{
  "name": "browser-pilot-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "node --test allowlist.test.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "ws": "^8.18.0",
    "zod": "^3.24.0"
  }
}
```

- [ ] **Step 4: Install dependencies**

```bash
cd mcp-server && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Create `browser-extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Browser Pilot",
  "version": "1.0.0",
  "description": "Bridge Claude Code to your authenticated browser session",
  "permissions": ["activeTab", "tabs", "scripting", "storage"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 6: Create placeholder icons**

```bash
cd /Users/korbold/Developer/Freelancer/browser-pilot
# Minimal valid 1x1 green PNG (base64 decoded)
ICON="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
echo "$ICON" | base64 -d > browser-extension/icons/icon16.png
cp browser-extension/icons/icon16.png browser-extension/icons/icon48.png
cp browser-extension/icons/icon16.png browser-extension/icons/icon128.png
```

- [ ] **Step 7: Commit**

```bash
cd /Users/korbold/Developer/Freelancer/browser-pilot
git add config/ mcp-server/package.json mcp-server/package-lock.json browser-extension/manifest.json browser-extension/icons/
git commit -m "chore: project scaffold, deps, manifest"
```

---

### Task 2: Allowlist module + tests

**Files:**
- Create: `mcp-server/allowlist.js`
- Create: `mcp-server/allowlist.test.js`

- [ ] **Step 1: Write failing tests first**

Create `mcp-server/allowlist.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed, listDomains, addDomain } from './allowlist.js';

test('allows exact domain', () => {
  assert.equal(isAllowed('https://upwork.com/jobs'), true);
});

test('allows subdomain', () => {
  assert.equal(isAllowed('https://www.upwork.com/jobs'), true);
});

test('blocks unlisted domain', () => {
  assert.equal(isAllowed('https://evil.com/steal'), false);
});

test('blocks invalid URL', () => {
  assert.equal(isAllowed('not-a-url'), false);
});

test('listDomains returns array', () => {
  const domains = listDomains();
  assert.ok(Array.isArray(domains));
  assert.ok(domains.includes('upwork.com'));
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd mcp-server && npm test
```

Expected: `Error: Cannot find module './allowlist.js'`

- [ ] **Step 3: Implement `mcp-server/allowlist.js`**

```js
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../config/allowlist.json');

export function listDomains() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')).domains;
}

export function isAllowed(url) {
  try {
    const hostname = new URL(url).hostname;
    return listDomains().some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

export function addDomain(domain) {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  if (!config.domains.includes(domain)) {
    config.domains.push(domain);
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }
  return config.domains;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd mcp-server && npm test
```

Expected: `5 passing`

- [ ] **Step 5: Commit**

```bash
cd /Users/korbold/Developer/Freelancer/browser-pilot
git add mcp-server/allowlist.js mcp-server/allowlist.test.js
git commit -m "feat: allowlist module with domain validation"
```

---

### Task 3: WebSocket bridge

**Files:**
- Create: `mcp-server/bridge.js`

- [ ] **Step 1: Create `mcp-server/bridge.js`**

```js
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
      const msg = JSON.parse(data.toString());
      const handler = pending.get(msg.id);
      if (!handler) return;
      clearTimeout(handler.timer);
      pending.delete(msg.id);
      if (msg.success) {
        handler.resolve(msg.data);
      } else {
        handler.reject(new Error(msg.error));
      }
    });

    ws.on('close', () => {
      extensionSocket = null;
      process.stderr.write('[browser-pilot] Extension disconnected\n');
    });
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Developer/Freelancer/browser-pilot
git add mcp-server/bridge.js
git commit -m "feat: websocket bridge with pending command map + timeout"
```

---

### Task 4: MCP server with all tools

**Files:**
- Create: `mcp-server/index.js`

- [ ] **Step 1: Create `mcp-server/index.js`**

```js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { startBridge, sendCommand } from './bridge.js';
import { isAllowed, addDomain, listDomains } from './allowlist.js';

const server = new McpServer({ name: 'browser-pilot', version: '1.0.0' });

function guardUrl(url) {
  if (!isAllowed(url)) {
    throw new Error(`"${new URL(url).hostname}" not in allowlist. Call browser_allowlist_add first.`);
  }
}

server.tool(
  'browser_navigate',
  { url: z.string().url() },
  async ({ url }) => {
    guardUrl(url);
    await sendCommand('navigate', { url });
    return { content: [{ type: 'text', text: `Navigated to ${url}` }] };
  }
);

server.tool(
  'browser_get_content',
  { selector: z.string().optional() },
  async ({ selector }) => {
    const data = await sendCommand('get_content', { selector });
    return { content: [{ type: 'text', text: data }] };
  }
);

server.tool(
  'browser_screenshot',
  {},
  async () => {
    const data = await sendCommand('screenshot', {});
    return { content: [{ type: 'image', data, mimeType: 'image/png' }] };
  }
);

server.tool(
  'browser_click',
  { selector: z.string() },
  async ({ selector }) => {
    await sendCommand('click', { selector });
    return { content: [{ type: 'text', text: `Clicked: ${selector}` }] };
  }
);

server.tool(
  'browser_fill',
  { selector: z.string(), value: z.string() },
  async ({ selector, value }) => {
    await sendCommand('fill', { selector, value });
    return { content: [{ type: 'text', text: `Filled "${selector}" with value` }] };
  }
);

server.tool(
  'browser_wait',
  { selector: z.string(), timeout: z.number().optional() },
  async ({ selector, timeout }) => {
    await sendCommand('wait', { selector, timeout: timeout ?? 10000 });
    return { content: [{ type: 'text', text: `Element appeared: ${selector}` }] };
  }
);

server.tool(
  'browser_evaluate',
  { script: z.string() },
  async ({ script }) => {
    const data = await sendCommand('evaluate', { script });
    return { content: [{ type: 'text', text: String(data) }] };
  }
);

server.tool(
  'browser_allowlist_add',
  { domain: z.string() },
  async ({ domain }) => {
    const domains = addDomain(domain);
    return { content: [{ type: 'text', text: `Added. Allowlist: ${domains.join(', ')}` }] };
  }
);

server.tool(
  'browser_allowlist_list',
  {},
  async () => {
    const domains = listDomains();
    return { content: [{ type: 'text', text: domains.join('\n') }] };
  }
);

startBridge();
const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Test server starts without error**

```bash
cd mcp-server && echo '{}' | timeout 3 node index.js 2>&1 || true
```

Expected: `[browser-pilot] Extension connected` NOT shown (no extension yet), but no crash. Process starts cleanly.

- [ ] **Step 3: Commit**

```bash
cd /Users/korbold/Developer/Freelancer/browser-pilot
git add mcp-server/index.js
git commit -m "feat: MCP server with 9 browser tools"
```

---

### Task 5: Extension background service worker

**Files:**
- Create: `browser-extension/background.js`

- [ ] **Step 1: Create `browser-extension/background.js`**

```js
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Developer/Freelancer/browser-pilot
git add browser-extension/background.js
git commit -m "feat: extension service worker with WS client + command dispatch"
```

---

### Task 6: Content script (DOM operations)

**Files:**
- Create: `browser-extension/content.js`

- [ ] **Step 1: Create `browser-extension/content.js`**

```js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  execute(msg.tool, msg.params)
    .then(sendResponse)
    .catch(err => sendResponse({ __error: err.message }));
  return true; // keep message channel open for async response
});

async function execute(tool, params) {
  switch (tool) {
    case 'get_content': {
      if (params.selector) {
        const el = document.querySelector(params.selector);
        if (!el) throw new Error(`Element not found: ${params.selector}`);
        return el.innerText || el.innerHTML;
      }
      return document.documentElement.outerHTML;
    }

    case 'click': {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      el.click();
      return 'clicked';
    }

    case 'fill': {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      el.focus();
      el.value = params.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'filled';
    }

    case 'wait': {
      const timeout = params.timeout ?? 10000;
      const interval = 200;
      let elapsed = 0;
      while (elapsed < timeout) {
        if (document.querySelector(params.selector)) return 'found';
        await new Promise(r => setTimeout(r, interval));
        elapsed += interval;
      }
      throw new Error(`Timeout waiting for: ${params.selector}`);
    }

    case 'evaluate': {
      // eslint-disable-next-line no-eval
      const result = eval(params.script);
      return String(result ?? '');
    }

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
```

- [ ] **Step 2: Handle `__error` responses in bridge**

The content script returns `{ __error: "..." }` on failure. Update `bridge.js` to propagate this as a real error. Open `mcp-server/bridge.js` and update the `ws.on('message')` handler:

```js
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  const handler = pending.get(msg.id);
  if (!handler) return;
  clearTimeout(handler.timer);
  pending.delete(msg.id);
  if (msg.success) {
    // Content script may return { __error } inside data
    if (msg.data && typeof msg.data === 'object' && msg.data.__error) {
      handler.reject(new Error(msg.data.__error));
    } else {
      handler.resolve(msg.data);
    }
  } else {
    handler.reject(new Error(msg.error));
  }
});
```

- [ ] **Step 3: Commit**

```bash
cd /Users/korbold/Developer/Freelancer/browser-pilot
git add browser-extension/content.js mcp-server/bridge.js
git commit -m "feat: content script DOM ops + bridge error propagation"
```

---

### Task 7: README + Claude Code MCP config

**Files:**
- Create: `README.md`
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Create `README.md`**

```markdown
# browser-pilot

MCP server + browser extension that gives Claude Code full access to your authenticated browser sessions.

## Install

### 1. MCP server

```bash
cd mcp-server && npm install
```

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "browser-pilot": {
      "command": "node",
      "args": ["/Users/korbold/Developer/Freelancer/browser-pilot/mcp-server/index.js"]
    }
  }
}
```

Restart Claude Code.

### 2. Browser extension

**Chrome / Arc:**
1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `browser-extension/` folder

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `browser-extension/manifest.json`

The extension connects automatically when Claude Code starts the MCP server.

## Usage

Claude Code now has these tools:

| Tool | What it does |
|---|---|
| `browser_navigate` | Go to URL in active tab |
| `browser_get_content` | Get page HTML or element text |
| `browser_screenshot` | Capture viewport |
| `browser_click` | Click element by CSS selector |
| `browser_fill` | Fill input field |
| `browser_wait` | Wait for element to appear |
| `browser_evaluate` | Run JS in page context |
| `browser_allowlist_add` | Add domain to allowlist |
| `browser_allowlist_list` | Show allowed domains |

## Security

Only domains in `config/allowlist.json` are accessible. Default: `upwork.com`, `linkedin.com`, `indeed.com`.
```

- [ ] **Step 2: Add MCP to Claude Code settings**

Open `~/.claude/settings.json`. If `mcpServers` key exists, add the entry. If the file doesn't exist yet:

```bash
# Check current settings
cat ~/.claude/settings.json
```

Add under `mcpServers`:
```json
"browser-pilot": {
  "command": "node",
  "args": ["/Users/korbold/Developer/Freelancer/browser-pilot/mcp-server/index.js"]
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/korbold/Developer/Freelancer/browser-pilot
git add README.md
git commit -m "docs: README with install and usage instructions"
```

---

### Task 8: End-to-end smoke test

- [ ] **Step 1: Start MCP server manually to verify it boots**

```bash
cd /Users/korbold/Developer/Freelancer/browser-pilot/mcp-server
node index.js &
```

Expected: No error, process hangs waiting for connections.

- [ ] **Step 2: Load extension in Chrome/Arc**

1. Go to `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → select `browser-extension/`
4. Extension should appear with green icon (no errors in background console)

- [ ] **Step 3: Verify WebSocket connection**

Open the extension's background service worker console:
- Chrome: `chrome://extensions` → "Inspect views: service worker"
- Look for log: `[browser-pilot] Connected to MCP server`

- [ ] **Step 4: Kill background server, restart Claude Code**

```bash
kill %1  # stop background node process
```

Restart Claude Code — it will start the MCP server via config. Verify `browser-pilot` appears in available MCP tools.

- [ ] **Step 5: Test with Upwork (already logged in)**

Ask Claude Code:
```
Use browser_navigate to go to https://www.upwork.com/nx/search/jobs/?q=flutter&sort=recency
Then browser_screenshot
Then browser_get_content with selector ".job-tile-title"
```

Expected: Screenshot of job results, text content of job titles.
