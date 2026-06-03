# Linear Issue Autopilot

Step-by-step workflow for autonomous agents working Linear issues in
RPGCreatorAI. The permanent rules live in `AGENTS.md` under "Linear Issue
Discipline". This skill covers the procedural workflow.

## Pre-flight

1. Read `AGENTS.md` — especially "Linear Issue Discipline" and "Git Rules".
2. Read `docs/GOAL_STACK.md` for the current active phase and next issue.
3. Read the backlog source document at
   `docs/superpowers/plans/` for the issue map and validation labels.
4. Confirm `git status --short` is clean or only has expected changes.
5. Confirm `git remote -v` points to the expected origin.

## Per-issue workflow

### 1. Read the Linear issue

- Use Linear MCP `get_issue` to fetch the full issue by ID.
- Read the description, validation section, labels, and milestone.
- If MCP fails, **stop immediately**. Do not continue pretending it worked.

### 2. Move to In Progress

- Use Linear MCP `save_issue` to set state to In Progress.
- Post a start comment via `save_comment`.
- If MCP fails to update, **stop immediately**.

### 3. Understand the scope

- Read any referenced docs, specs, or source files.
- Identify files to change or inspect.
- If the issue is ambiguous or requires an undocumented product decision,
  **stop and report**.

### 4. Implement

- Make the smallest coherent changes that satisfy the issue.
- Do not expand scope beyond what the issue describes.
- Do not add features, refactors, or improvements not in the issue.

### 5. Validate

Run all validation commands required by the issue labels:

| Label | Validation |
|-------|------------|
| `docs` | Docs-only check; verify any commands claimed in docs |
| `qa` | Focused tests or smoke checks for changed behavior |
| `integration-gate` | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1` |
| `desktop` | Rust/Tauri tests and desktop smoke |
| `runtime` | Native CMake/build/CTest and runtime smoke |
| `editor`, `ux`, `database` | `npm run typecheck`, focused Vitest, `npm run build` |
| `assets`, `animation`, `gpt-image`, `visual-qa` | Asset pipeline tests, visual QA evidence, runtime export checks |
| `ai-provider`, `provider-*`, `content-ai`, `security` | Offline mock/contract tests only |

Additional gates:
- `git diff --check` or `git diff --cached --check` before commit.
- Never make live paid AI provider calls during normal validation.
- Use mocks, fixtures, contract tests, or offline diagnostics.

**Record exact commands and exact results.** Never claim validation passed
unless the command was actually run and succeeded.

### 6. Update docs

- Update `docs/VALIDATION_LOG.md` with timestamp, command, result, and
  pass/fail.
- Update any phase docs or task files if at a milestone boundary.

### 7. Commit and push

- Stage only files related to this issue.
- Do not stage `.commandcode/` unless explicitly requested.
- Do not stage unrelated files, secrets, or generated binaries.
- Commit with a descriptive message.
- Push to `origin/main`.
- Record the commit hash.

### 8. Comment and close

- Post a final Linear comment with:
  - Files changed summary
  - Validation commands and exact results
  - Commit hash
  - Push confirmation
- Move the issue to Done via `save_issue`.
- If MCP fails to comment or update, **stop immediately**.

### 9. Continue

- Move to the next issue in CP order.
- Repeat from step 1.

## Edge cases

### Issue already satisfied

- Verify with evidence (code, tests, docs).
- Post a Linear comment documenting why it's already satisfied.
- Only then mark Done or leave as-is.
- Never claim "functionally satisfied" or "satisfied in spirit" without
  documented evidence in a Linear comment.

### Issue requires a product decision

- Stop and report to the user.
- Do not make assumptions about product direction.
- Document the ambiguity in a Linear comment.

### Linear MCP is down

- Stop all Linear-related work immediately.
- Do not continue implementing issues you cannot comment on or close.
- Do not batch-close issues when MCP comes back.
- Resume one issue at a time with fresh MCP connections.

## Anti-patterns

These are explicitly forbidden by AGENTS.md:

- Batch-closing issues
- Closing issues "in spirit" or "functionally satisfied"
- Claiming validation passed without running commands
- Continuing work while pretending Linear was updated
- Making live paid AI calls during validation
- Committing secrets, API keys, or tokens
- Staging `.commandcode/` or unrelated files
- Moving to Done without validation evidence
