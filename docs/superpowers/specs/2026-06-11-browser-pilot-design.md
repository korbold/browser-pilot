# browser-pilot — Design Spec
Date: 2026-06-11

## Problem

Claude Code cannot access authenticated browser sessions. Upwork, LinkedIn, and other job portals block headless browsers (Cloudflare bot detection). The user has active sessions in their real browser but Claude cannot read or interact with those pages.

## Solution

A Chrome/Arc/Firefox extension that bridges Claude Code to the user's real browser session via a local WebSocket server exposed as an MCP.

## Architecture

```
Claude Code
    ↕ MCP (stdio)
mcp-server/         Node.js — MCP server + WebSocket server (ws://localhost:7717)
    ↕ WebSocket
browser-extension/  Manifest V3 — service worker connects as WebSocket client
    ↕ content scripts
Authenticated pages — real session, real cookies, no bot detection
```

## Components

| Component | Location | Responsibility |
|---|---|---|
| MCP server | `mcp-server/index.js` | Exposes MCP tools to Claude Code, runs WebSocket server |
| Tool definitions | `mcp-server/tools.js` | Schema + handler for each MCP tool |
| Allowlist | `mcp-server/allowlist.js` + `config/allowlist.json` | Domain whitelist enforcement |
| Extension background | `browser-extension/background.js` | Service worker, WebSocket client, tab management |
| Extension content script | `browser-extension/content.js` | DOM interaction: clicks, fills, reads, screenshots |

## MCP Tools

| Tool | Parameters | Description |
|---|---|---|
| `browser_navigate` | `url: string` | Navigate active tab to URL |
| `browser_get_content` | `selector?: string` | Return page HTML or element text |
| `browser_screenshot` | — | Capture viewport as base64 PNG |
| `browser_click` | `selector: string` | Click element by CSS selector |
| `browser_fill` | `selector: string, value: string` | Fill input field |
| `browser_wait` | `selector: string, timeout?: number` | Wait for element to appear (default 10s) |
| `browser_evaluate` | `script: string` | Execute JS in page context |
| `browser_allowlist_add` | `domain: string` | Add domain to allowlist |
| `browser_allowlist_list` | — | List allowed domains |

## Security

- Allowlist enforced on MCP server before any message reaches extension
- Default allowlist: `["upwork.com", "linkedin.com", "indeed.com"]`
- Any URL outside allowlist returns error immediately, no browser action taken
- WebSocket server bound to `localhost` only — not accessible from network
- `browser_evaluate` only executes on allowlisted domains

## File Structure

```
browser-pilot/
├── mcp-server/
│   ├── index.js
│   ├── tools.js
│   ├── allowlist.js
│   └── package.json
├── browser-extension/
│   ├── manifest.json       Manifest V3
│   ├── background.js       Service worker + WebSocket client
│   ├── content.js          DOM interaction
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── config/
│   └── allowlist.json
└── README.md
```

## Communication Protocol

Messages are JSON over WebSocket:

**MCP server → Extension (command):**
```json
{ "id": "uuid", "tool": "browser_navigate", "params": { "url": "https://upwork.com/..." } }
```

**Extension → MCP server (response):**
```json
{ "id": "uuid", "success": true, "data": "..." }
{ "id": "uuid", "success": false, "error": "Element not found: .job-title" }
```

Each command has a 30s timeout. MCP server returns error to Claude if extension doesn't respond.

## Extension Reconnection

Background service worker attempts WebSocket reconnect every 3s when disconnected. Silent — no user-visible errors.

## Installation

1. `cd mcp-server && npm install`
2. Add to `~/.claude/settings.json`:
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
3. Open Chrome/Arc → `chrome://extensions` → Enable Developer Mode → Load unpacked → select `browser-extension/`
4. Start Claude Code — MCP server starts, extension connects automatically

## Out of Scope

- Safari (requires Xcode + Apple signing)
- Multiple simultaneous browser windows (single WebSocket connection)
- Recording/replay of sessions
