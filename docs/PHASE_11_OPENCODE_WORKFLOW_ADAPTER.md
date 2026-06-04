# Phase 11 OpenCode Workflow Adapter

Issue: CP-094 / FRA-129
Date: 2026-06-04

## Result

OpenCode now has a real editor-side workflow adapter through the shared
`ProviderAdapter` interface. It appears as a controlled code/tooling workflow
provider and can satisfy the `code-tooling` capability gate without credentials
or a user-selected model.

The adapter prepares repo-local handoffs only. It does not spawn the OpenCode
CLI, does not open an HTTP server, does not mutate files, and does not run
shell commands during normal validation.

## Audit Finding

Linear had marked CP-094 Done with a closeout that cited commit `a95e4cf` and
described OpenCode provider metadata plus offline mock contracts. Repo
inspection found no CP-094/FRA-129 commit and no dedicated OpenCode workflow
adapter through the shared provider interface.

## Official Docs Check

Before implementation, current official OpenCode docs were rechecked:

- CLI commands: `https://opencode.ai/docs/cli/`
- Permissions: `https://opencode.ai/docs/permissions`
- Headless server: `https://opencode.ai/docs/server/`

Implementation choices from those docs:

- `opencode run` is the documented non-interactive CLI entry point for
  programmatic prompts.
- `opencode serve` exposes a headless HTTP server and can be protected with
  basic auth. RPGCreatorAI does not start or call that server in this adapter.
- Permissions resolve to `allow`, `ask`, or `deny`.
- OpenCode permissions include read/search/list tools, `edit`, `bash`,
  `webfetch`, and the `external_directory` guard.
- OpenCode's defaults can be permissive for many tools, so RPGCreatorAI uses
  explicit safe handoff permissions instead of relying on defaults.

## Code Changes

- `src/providers/openCodeWorkflowAdapter.ts` implements a dedicated OpenCode
  workflow adapter with repo-local path validation, safe permission
  normalization, deterministic handoff output, cancellation handling, failure
  status modeling, and secret redaction.
- `src/providers/providerRegistry.ts` now gives OpenCode a virtual
  `opencode-workflow` descriptor while keeping `modelSelection:
  'not-required'` and without preselecting a model in settings provider
  configs.
- `src/providers/modelCapabilityRegistry.ts` now declares the OpenCode
  workflow as a `code` and `tool` capability source for `code-tooling`, and
  resolves the virtual workflow descriptor only when OpenCode is enabled.
- `src/providers/__tests__/openCodeWorkflowAdapter.test.ts` covers capability
  discovery, routing gates, safe handoff output, execution rejection,
  out-of-workspace rejection, mocked workflow statuses, failure states, and
  redaction.

## Security Boundary

- The adapter never executes OpenCode directly.
- `execute` and `executionApproved` requests fail closed with
  `unsupported-operation`.
- `cwd` must remain inside the configured workspace root.
- `external_directory` is forced to `deny`.
- `edit: allow` and `bash: allow` are rejected for adapter-prepared handoffs.
- Prompt previews and workflow failure reasons pass through shared secret
  redaction.

## Validation

TDD RED before implementation:

```powershell
npm test -- --run src/providers/__tests__/openCodeWorkflowAdapter.test.ts
```

Result: FAIL as expected. Vitest could not resolve
`../openCodeWorkflowAdapter` because the adapter module did not exist.

Focused GREEN after implementation:

```powershell
npm test -- --run src/providers/__tests__/openCodeWorkflowAdapter.test.ts
```

Result: PASS, 1 file and 5 tests.

Focused provider/security regression:

```powershell
npm test -- --run src/providers/__tests__/openCodeWorkflowAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/security/__tests__/redaction.test.ts
```

Result: PASS, 4 files and 26 tests.

Store regression after preserving the no-default-model invariant:

```powershell
npm test -- --run src/stores/__tests__/providerStore.test.tsx src/providers/__tests__/openCodeWorkflowAdapter.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/security/__tests__/redaction.test.ts
```

Result: PASS, 5 files and 27 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full canonical gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS. Gates passed: frontend typecheck, full Vitest (104 files / 548
tests), frontend build, native C++ configure/build/CTest, Tauri content check,
43 Rust desktop tests, runtime smoke, and editor-runtime screenshot roundtrip.
Known nonfatal warnings remained: Vite chunk-size warning and existing CMake
FetchContent/deprecation warnings.
