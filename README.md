# browser-pilot

MCP server + browser extension that gives Claude Code full access to your authenticated browser sessions.

## Install

### 1. MCP server

```bash
cd mcp-server && npm install
```

Add to `~/.claude/settings.json` under `mcpServers`:

```json
"browser-pilot": {
  "command": "node",
  "args": ["/Users/korbold/Developer/Freelancer/browser-pilot/mcp-server/index.js"]
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

Claude Code has these tools available:

| Tool | What it does |
|---|---|
| `browser_navigate` | Go to URL in active tab (allowlist required) |
| `browser_get_content` | Get page HTML or element text |
| `browser_screenshot` | Capture viewport as PNG |
| `browser_click` | Click element by CSS selector |
| `browser_fill` | Fill input field |
| `browser_wait` | Wait for element to appear |
| `browser_evaluate` | Run JS in page context |
| `browser_allowlist_add` | Add domain to allowlist |
| `browser_allowlist_list` | Show allowed domains |

## Security

Only domains in `config/allowlist.json` are accessible via `browser_navigate`. Default: `upwork.com`, `linkedin.com`, `indeed.com`.

Add more with: `browser_allowlist_add("example.com")`
