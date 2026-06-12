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
    return { content: [{ type: 'text', text: String(data) }] };
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
    return { content: [{ type: 'text', text: domains.length ? domains.join('\n') : '(allowlist is empty)' }] };
  }
);

startBridge();
const transport = new StdioServerTransport();
await server.connect(transport);
