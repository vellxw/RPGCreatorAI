#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PATHS = [join(homedir(), '.commandcode', 'mcp-tokens.json')];
let token;
for (const p of PATHS) if (existsSync(p)) token = JSON.parse(readFileSync(p, 'utf8')).tokens.linear.accessToken;

const PROJECT_NAME = 'RPGCreatorAI Phase 12 — Product UX And AI Studio';
let cursor = null;
const collected = [];
let pageIdx = 0;
do {
  const args = { project: PROJECT_NAME, limit: 50 };
  if (cursor) args.cursor = cursor;
  let res;
  let attempt = 0;
  while (attempt < 5) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30000);
    try {
      res = await fetch('https://mcp.linear.app/mcp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Math.floor(Math.random() * 100000),
          method: 'tools/call',
          params: { name: 'list_issues', arguments: args },
        }),
        signal: controller.signal,
      });
      clearTimeout(t);
      break;
    } catch (e) {
      clearTimeout(t);
      attempt += 1;
      console.error(`  attempt ${attempt} failed: ${e?.cause?.code ?? e.message}`);
      if (attempt >= 5) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  const raw = await res.text();
  const data = raw.split('\n').find((l) => l.startsWith('data:'))?.slice(5).trim() ?? raw;
  const parsed = JSON.parse(data);
  const text = parsed.result?.content?.[0]?.text;
  if (!text) {
    console.error('mcp error: no content');
    console.error(parsed);
    process.exit(2);
  }
  if (text.startsWith('MCP error')) {
    console.error('mcp error:', text);
    process.exit(2);
  }
  const obj = JSON.parse(text);
  for (const i of obj.issues ?? []) collected.push(i);
  cursor = obj.hasNextPage ? obj.cursor : null;
  pageIdx += 1;
  console.log(`page ${pageIdx}: +${obj.issues?.length ?? 0} (total so far: ${collected.length})`);
  await new Promise((r) => setTimeout(r, 500));
} while (cursor);

console.log(`\nTotal FRA issues: ${collected.length}\n`);

const counts = {};
const notDone = [];
for (const i of collected) {
  counts[i.status] = (counts[i.status] ?? 0) + 1;
  if (i.status !== 'Done') notDone.push(i);
}
console.log('status counts:', counts);
console.log('not-done issues:', notDone.length);
if (notDone.length) {
  for (const i of notDone) console.log(`  ${i.id}  ${i.status}  ${i.title}`);
}

const out = collected.map((i) => ({
  id: i.id,
  px: (i.title.match(/^PX-\d+/) ?? [''])[0],
  milestone: i.projectMilestone?.name?.match(/M\d+/)?.[0] ?? '',
  milestoneName: i.projectMilestone?.name ?? '',
  title: i.title,
  status: i.status,
  url: i.url,
}));
writeFileSync('docs/linear-phase12-issues.json', JSON.stringify(out, null, 2));
console.log('\nwrote docs/linear-phase12-issues.json');
