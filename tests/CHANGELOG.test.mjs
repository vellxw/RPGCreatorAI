// Minimal Node script that validates CHANGELOG.md is well-formed and covers
// the milestones we expect to be listed. This is intentionally not a Vitest
// test because the changelog is a top-level repo file (not a TS module) and
// the validation is just regex + file presence.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const changelogPath = join(here, '..', 'CHANGELOG.md');

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

let content;
try {
  content = readFileSync(changelogPath, 'utf8');
} catch (e) {
  console.error(`FAIL: cannot read ${changelogPath}: ${e.message}`);
  process.exit(1);
}

assert(content.includes('# Changelog'), 'missing "# Changelog" header');
assert(content.includes('## [Unreleased]'), 'missing "## [Unreleased]" section');
assert(content.includes('## [0.13.0]'), 'missing "## [0.13.0]" header for Phase 13');
assert(content.includes('## [0.12.0]'), 'missing "## [0.12.0]" header for Phase 12');
assert(content.includes('## [0.11.0]'), 'missing "## [0.11.0]" header for Phase 11');

for (const milestone of ['M00', 'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10', 'M11', 'M12']) {
  assert(content.includes(`**${milestone} —`), `missing ${milestone} sub-section under Phase 12`);
}

assert(/Keep a Changelog/i.test(content), 'missing "Keep a Changelog" attribution');
assert(/Semantic Versioning/i.test(content), 'missing "Semantic Versioning" attribution');

const phase12Section = content.split('## [0.12.0]')[1] ?? '';
const commitHashes = phase12Section.match(/\b[0-9a-f]{7}\b/g) ?? [];
assert(commitHashes.length >= 20, `expected >= 20 commit hashes in Phase 12 section, found ${commitHashes.length}`);

console.log(`PASS: CHANGELOG.md validates (${commitHashes.length} commit hashes referenced)`);
