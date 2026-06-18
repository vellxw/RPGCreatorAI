// Create 4 Phase 13 follow-up issues in the Phase 12 project, post evidence
// comments, and move them to Done. Uses the Linear MCP OAuth token via
// JSON-RPC 2.0 over HTTPS SSE. Tool names match the canonical MCP tool list
// (save_issue, save_comment, list_issue_statuses, list_projects).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const TOKEN_PATH = join(homedir(), '.commandcode', 'mcp-tokens.json');
const tokenCache = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
const ACCESS_TOKEN = tokenCache.tokens?.linear?.accessToken;
if (!ACCESS_TOKEN) {
  console.error('FAIL: no Linear OAuth access token in cache');
  process.exit(1);
}
const ENDPOINT = 'https://mcp.linear.app/mcp';

let nextId = 1;

async function callTool(name, args, retries = 5) {
  const id = nextId++;
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  });
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      const dataLine = text.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) throw new Error('No data line in response');
      const data = JSON.parse(dataLine.slice(6));
      if (data.error) {
        throw new Error(`JSON-RPC error: ${JSON.stringify(data.error)}`);
      }
      const result = data.result;
      if (result?.isError) {
        throw new Error(`Tool error: ${extractText(result)}`);
      }
      return result;
    } catch (e) {
      if (attempt < retries) {
        const delay = 1000 * attempt + 500;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
}

function extractText(result) {
  if (!result) return '';
  if (Array.isArray(result.content)) {
    return result.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }
  if (typeof result === 'string') return result;
  return JSON.stringify(result);
}

function parseJsonSafely(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

const issues = [
  {
    title: 'FRA-686 - M13 - Wire FirstRunPathSelector into App.tsx via FirstRunGate',
    description:
      'Phase 13 follow-up. M07 declared FirstRunPathSelector + firstRunStore as a Phase 13 follow-up because they were not mounted in the host. This issue tracks the wire-up: a new FirstRunGate (presentational, inert) that wraps ProjectStartupScreen and renders the starter-path selector when useFirstRun().isFirstRun is true. On confirm the host calls useFirstRun().complete() and dispatches performCreateProject for the project-creating paths.',
    evidence:
      'Closed by commit c417dc8 (feat(onboarding): wire FirstRunPathSelector into App.tsx via FirstRunGate). New tests in src/components/onboarding/__tests__/FirstRunGate.test.tsx (4): (1) selector renders on first run, (2) host children render when not first run, (3) callbacks are forwarded, (4) gate is inert (no fetch, no programmatic navigation). AppStartup.test.tsx updated to mock useFirstRun as already-completed. Validation: npx tsc --noEmit clean, npx vitest run 908/908, npm run build clean. See docs/PHASE_13_FOLLOWUP_INTEGRATION_GATE.md for the full deliverable.',
  },
  {
    title: 'FRA-687 - M13 - Code-split AI Studio into AIStudioBoundary chunk',
    description:
      'Phase 13 follow-up. The main bundle carried the entire AI Studio tree (880.60 kB, gzip 229.31 kB). This issue tracks the code-split: a new AIStudioBoundary wrapper around AIStudioScreen loaded via React.lazy and Suspense, matching the convention used by ProviderSettingsBoundary, AssetWorkspaceBoundary, and PlaytestWorkspaceBoundary.',
    evidence:
      'Closed by commit 9035c64 (feat(perf): code-split AI Studio into AIStudioBoundary chunk). New tests in src/components/ai/__tests__/AIStudioBoundary.test.tsx (3): (1) boundary renders the inner screen and forwards providers + projectId, (2) is a plain function component, (3) does not call any network APIs on mount. Bundle diff: index-*.js 880.60 kB -> 829.48 kB (gzip 229.31 kB -> 215.99 kB). New AIStudioBoundary chunk 46.22 kB (gzip 12.87 kB). Net cold-start savings: -51 kB raw / -13 kB gzip on main. Validation: npx tsc --noEmit clean, npx vitest run 911/911, npm run build clean. See docs/PHASE_13_FOLLOWUP_INTEGRATION_GATE.md for the full deliverable.',
  },
  {
    title: 'FRA-688 - M13 - Add Save & Playtest affordance to editor toolbar',
    description:
      'Phase 13 follow-up. decideSaveAndPlaytest + saveAndPlaytest helper in src/firstRun/saveAndPlaytest.ts existed with 5 outcome kinds and tests covering each, but no UI surfaced the decision. A creator who wanted to save and playtest in one step had to click Save, then Validate, then Playtest, in three separate steps. This issue tracks the toolbar affordance.',
    evidence:
      'Closed by commit 45a88ad (feat(toolbar): add Save & Playtest affordance to editor toolbar). New tests in src/components/layout/__tests__/TopToolbarSaveAndPlaytest.test.tsx (5): (1) button renders on editor toolbar, (2) not present on AI Studio toolbar, (3) on saved-and-playtested calls performSave and switches to playtest, (4) on save-blocked does not switch to playtest and shows danger feedback, (5) on saved-and-routed (no desktop runtime) still switches to playtest. Validation: npx tsc --noEmit clean, npx vitest run 916/916, npm run build clean. See docs/PHASE_13_FOLLOWUP_INTEGRATION_GATE.md for the full deliverable.',
  },
  {
    title: 'FRA-689 - M13 - Add CHANGELOG.md consolidating Phase 12 and Phase 13',
    description:
      'Phase 13 follow-up. Phase 12 delivered 13 milestones across 200+ commits and 29 individual gate reports under docs/. There was no single human-readable summary of the public-facing history. This issue tracks the new CHANGELOG.md at the repo root in the Keep a Changelog 1.1.0 format with one entry per release.',
    evidence:
      'Closed by commit 1b413ee (docs: add CHANGELOG.md consolidating Phase 12 and Phase 13). New tests in tests/CHANGELOG.test.mjs: header, sections for Unreleased/0.13.0/0.12.0/0.11.0, M00..M12 listed, Keep a Changelog and Semantic Versioning attributions, >= 20 commit hashes in Phase 12 section. Test output: PASS (56 commit hashes referenced). Validation: node tests/CHANGELOG.test.mjs PASS, npx tsc --noEmit clean, npx vitest run 920/920, npm run build clean. See docs/PHASE_13_FOLLOWUP_INTEGRATION_GATE.md for the full deliverable.',
  },
];

async function findPhase12Project() {
  const res = await callTool('list_projects', { limit: 50, query: 'Phase 12' });
  const text = extractText(res);
  const data = parseJsonSafely(text);
  if (!data) {
    console.log(`  list_projects text (first 200): ${text.slice(0, 200)}`);
    return null;
  }
  const list = Array.isArray(data) ? data : (data.nodes ?? data.projects ?? []);
  for (const p of list) {
    if (typeof p === 'object' && p?.name) {
      return p;
    }
  }
  return null;
}

async function findFirstTeam() {
  const res = await callTool('list_teams', {});
  const text = extractText(res);
  const data = parseJsonSafely(text);
  if (!data) {
    console.log(`  list_teams text (first 200): ${text.slice(0, 200)}`);
    return null;
  }
  const list = Array.isArray(data) ? data : (data.nodes ?? data.teams ?? []);
  for (const t of list) {
    if (typeof t === 'object' && (t.id || t.name)) {
      return t.id ?? t.name;
    }
  }
  return null;
}

async function findDoneStatusId(team) {
  const res = await callTool('list_issue_statuses', { team });
  const text = extractText(res);
  const data = parseJsonSafely(text);
  if (!data) {
    console.log(`  list_issue_statuses text (first 200): ${text.slice(0, 200)}`);
    return null;
  }
  const list = Array.isArray(data) ? data : (data.nodes ?? data.statuses ?? data.issueStatuses ?? []);
  for (const s of list) {
    if (typeof s === 'object' && s?.name === 'Done') {
      return s.id ?? s.name;
    }
  }
  // Fallback: some MCP versions return type=completed
  for (const s of list) {
    if (typeof s === 'object' && s?.type === 'completed') {
      return s.id ?? s.name;
    }
  }
  return null;
}

async function main() {
  console.log('Step 1: finding first team...');
  const team = await findFirstTeam();
  console.log(`  team = ${team ?? 'none'}`);
  if (!team) {
    console.error('FAIL: could not locate team');
    process.exit(1);
  }

  console.log('Step 2: finding Phase 12 project...');
  const project = await findPhase12Project();
  console.log(`  project = ${project?.id ?? 'none'} (${project?.name ?? '?'})`);
  if (!project?.id && !project?.name) {
    console.error('FAIL: could not locate Phase 12 project');
    process.exit(1);
  }
  const projectRef = project.id ?? project.name;

  console.log('Step 3: finding Done status...');
  const doneStatus = await findDoneStatusId(team);
  console.log(`  doneStatus = ${doneStatus ?? 'none'}`);
  if (!doneStatus) {
    console.error('FAIL: could not locate Done status');
    process.exit(1);
  }

  for (const issue of issues) {
    console.log(`\nCreating: ${issue.title}`);
    const createRes = await callTool('save_issue', {
      title: issue.title,
      description: issue.description,
      team,
      project: projectRef,
    });
    const createText = extractText(createRes);
    const createData = parseJsonSafely(createText);
    let issueId = null;
    if (createData) {
      issueId = createData.id ?? createData.issue?.id ?? createData.issueId ?? null;
    }
    if (!issueId) {
      // The MCP tool may return a string identifier. Look for LIN-XXX.
      const match = (createText ?? '').match(/[A-Z]+-\d+/);
      if (match) issueId = match[0];
    }
    if (!issueId) {
      console.error(`FAIL: could not parse issue id. Text: ${createText?.slice(0, 500)}`);
      process.exit(1);
    }
    console.log(`  id = ${issueId}`);

    console.log('  Posting evidence comment...');
    const commentRes = await callTool('save_comment', {
      issueId,
      body: issue.evidence,
    });
    if (!commentRes) {
      console.error('FAIL: could not post comment');
      process.exit(1);
    }
    console.log('  comment posted');

    console.log('  Moving to Done...');
    const updateRes = await callTool('save_issue', {
      id: issueId,
      state: doneStatus,
    });
    if (!updateRes) {
      console.error('FAIL: could not move to Done');
      process.exit(1);
    }
    console.log('  done.');
  }

  console.log(`\nAll ${issues.length} Phase 13 issues created, commented, and moved to Done.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
