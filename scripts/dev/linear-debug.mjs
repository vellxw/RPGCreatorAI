// Debug script: explore the Linear MCP endpoint and discover the actual tool
// names and arg shapes. Run: node scripts/dev/linear-debug.mjs
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TOKEN_PATH = join(homedir(), '.commandcode', 'mcp-tokens.json');
const tokenCache = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
const ACCESS_TOKEN = tokenCache.tokens.linear.accessToken;
const ENDPOINT = 'https://mcp.linear.app/mcp';

let nextId = 1;

async function callRpc(method, params = {}) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params });
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  console.log(`\n=== ${method} (HTTP ${res.status}) ===`);
  console.log('headers:', JSON.stringify(Object.fromEntries(res.headers), null, 2));
  console.log('body (first 1000):', text.slice(0, 1000));
  return text;
}

await callRpc('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'linear-debug', version: '0.0.1' },
});

await callRpc('tools/list', {});
