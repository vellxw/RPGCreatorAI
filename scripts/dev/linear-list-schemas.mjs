// Dump the input schema for the Linear MCP tools we care about.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TOKEN_PATH = join(homedir(), '.commandcode', 'mcp-tokens.json');
const tokenCache = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
const ACCESS_TOKEN = tokenCache.tokens.linear.accessToken;
const ENDPOINT = 'https://mcp.linear.app/mcp';

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${ACCESS_TOKEN}`,
  },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
});
const text = await res.text();
const dataLine = text.split('\n').find(l => l.startsWith('data: '));
const data = JSON.parse(dataLine.slice(6));
const wanted = ['list_projects', 'list_issue_statuses', 'save_issue', 'save_comment'];
for (const t of data.result.tools) {
  if (!wanted.includes(t.name)) continue;
  console.log(`\n=== ${t.name} ===`);
  console.log(JSON.stringify(t.inputSchema, null, 2));
}
