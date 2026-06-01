# Phase 11 Execution Protocol

CP-006 / FRA-41 defines how agents execute Phase 11 issues without breaking
the repo. This protocol is subordinate to `AGENTS.md` and the active user
instruction. If this document conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Source Order

Use this source order for every issue:

1. Active user instruction and stop conditions.
2. `AGENTS.md`.
3. Current Linear issue description and comments.
4. `docs/PHASE_11_PRODUCT_CHARTER.md`.
5. `docs/superpowers/plans/2026-06-01-phase11-complete-platform-backlog.md`.
6. `docs/PHASE_11_RISK_REGISTER.md`.
7. `docs/PHASE_11_PROVIDER_LEGAL_BASELINE.md`.
8. `.kiro/specs/phase11-complete-product-platform/`.
9. Other docs and source files relevant to the issue.

## Branch And Worktree Strategy

- Default branch for this execution is `main`.
- Default push target is `origin/main`.
- Do not create a feature branch or worktree for normal CP-ordered work unless
  the issue, user, or a later protocol explicitly requires it.
- If an issue explicitly requires another branch, record that in Linear before
  work and push only to the requested branch.
- Before any branch switch, run `git status --short`. Do not switch with
  unresolved work unless the work is committed, stashed intentionally, or
  clearly unrelated and safe.
- Never use destructive branch commands such as `git reset --hard` or
  `git checkout -- <path>` unless the user explicitly requests that operation.
- If remote origin is not `https://github.com/vellxw/RPGCreatorAI.git`, stop.

## Issue Execution Loop

For each CP issue:

1. Fetch/open the Linear issue.
2. Move it to In Progress.
3. Comment that work is starting.
4. Inspect relevant repo files and docs.
5. Implement the smallest coherent scope that satisfies the issue.
6. Update docs whenever behavior, commands, file locations, architecture,
   data schemas, validation, screenshots, or user workflows change.
7. Run the validation required by the issue and this protocol.
8. Diagnose failures, apply fixes, and repeat until green.
9. Append major validation to `docs/VALIDATION_LOG.md`.
10. Run `git status --short`.
11. Stage only files related to the issue.
12. Run `git diff --cached --check`.
13. Commit with a clear message.
14. Push to the expected remote/branch.
15. Comment Linear with files, commands, results, commit hash, push result,
    final status, and known limitations.
16. Move the issue to Done.
17. Continue immediately to the next CP issue.

## Commit And Staging Rules

- Stage only files required for the current issue.
- Never stage `build/`, `.env`, generated binaries, API keys, secrets, app-data
  directories, or unrelated user files.
- Preserve unrelated dirty work. The pre-existing untracked
  `docs/agent_prompts/LINEAR_MVP_CODEX_GOAL_PROMPT.md` is not part of Phase 11
  issue commits unless a future issue explicitly names it.
- If unrelated changes are in files the issue must edit, inspect carefully and
  work with the existing changes. Ask only if the conflict makes progress
  impossible.
- Commit only after required validation is green or the issue is genuinely
  docs-only and that limited validation is documented.
- Push after every completed issue.

## Validation Selection

Always run `git diff --check` or `git diff --cached --check` before commit.

Use focused validation for narrow changes:

- Docs-only: source review plus `git diff --check`.
- Frontend/editor: `npm run typecheck`, focused `npm test`, and `npm run build`
  when behavior or bundling can be affected.
- Runtime C++: configure/build/CTest and runtime smoke where applicable.
- Desktop/Tauri: Rust tests, Tauri content checks, and desktop smoke where
  applicable.
- Asset pipeline: fixture tests, manifest checks, preview/runtime export
  checks, and visual QA evidence when assets change.
- AI/provider: mock and contract tests only; no live API requirement.

Use the canonical gate for integration gates and broad changes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Milestone integration gates are CP-008, CP-016, CP-024, CP-032, CP-040,
CP-048, CP-056, CP-064, CP-072, CP-080, CP-088, CP-096, CP-104, CP-112,
CP-120, and CP-128.

## Failure Handling

- Do not stop for compile errors, type errors, CMake issues, failing tests,
  stale tests, or small refactors needed to make validation green.
- Record meaningful validation failures and fixes in
  `docs/VALIDATION_LOG.md`.
- Re-run the failed command after fixing it.
- Do not claim a command passed unless that exact command was run and passed.
- Do not push broken code.

## Live API And Credential Restrictions

- Native runtime must never depend on AI, providers, network, cloud,
  credentials, marketplace systems, or arbitrary scripting.
- Normal validation must never require live paid provider calls.
- Use mocks, fixtures, and contract tests for provider work.
- Stop before any task requiring credentials, OAuth/login, account connection,
  signing certificates, or live paid calls.
- If the user explicitly authorizes live diagnostics, run them only through the
  approved credential path, redact secrets, and record them as optional
  diagnostics rather than normal gate evidence.
- Never store API keys or credentials in project JSON, repo files, docs, logs,
  screenshots, Linear comments, or validation output.

## Docs And Screenshot Requirements

Update docs when any issue changes:

- user-visible behavior,
- commands or scripts,
- build/package/run flow,
- file locations or app-data policy,
- validation gates,
- architecture boundaries,
- data schemas or sample data,
- provider/security/cost behavior,
- asset pipeline behavior.

Capture or refresh screenshots when an issue changes:

- editor layout or visual UI,
- runtime rendering or menus,
- asset previews or generated visual evidence,
- packaging/release screens where the issue requires user-facing proof.

Do not add screenshots for docs-only planning issues unless the issue asks for
visual evidence.

## Integration Gate Order

- Planning gate CP-008 must confirm CP-001 through CP-007 are internally
  consistent.
- Each later milestone gate must validate its milestone before downstream work
  relies on it.
- CP-126 writes the final validation report.
- CP-127 closes Linear project status.
- CP-128 is the final complete-platform ship gate and must not pass unless the
  full platform is validated.

## Blocked Conditions

Stop and report the blocker only when:

- credentials, OAuth, signing, or account login is required;
- admin/system install is required;
- destructive overwrite/delete outside the repo would be needed;
- remote origin is wrong or ambiguous;
- the next decision materially changes product direction;
- a required command needs interaction that cannot be automated;
- an external tool required by the issue is unavailable and cannot be replaced
  by a safe repo-local fallback.

Otherwise continue diagnosing, fixing, validating, committing, pushing, and
moving to the next issue.
