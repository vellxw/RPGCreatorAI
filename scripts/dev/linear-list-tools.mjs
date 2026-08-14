// List all Linear MCP tool names.
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
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {},
  }),
  signal: AbortSignal.timeout(15_000),
});

const text = await res.text();
const dataLine = text.split('\n').find(line => line.startsWith('data: '));
const data = JSON.parse(dataLine.slice(6));
const tools = data.result.tools;
for (const t of tools) {
  console.log(`${t.name}\t${t.title}\t${t.description.slice(0, 80)}`);
}
