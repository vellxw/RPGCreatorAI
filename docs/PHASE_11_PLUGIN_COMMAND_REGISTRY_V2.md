# Phase 11 CP-037 — Deterministic Plugin Command Registry V2

CP-037 upgrades `pluginCommand` from v1 safe scalar authoring into a typed
deterministic registry. This remains local data dispatch only. It does not add
a scripting VM, dynamic code loading, AI calls, network access, or arbitrary
runtime extension execution.

## Registry

Registered commands:

| Key | Args | Runtime behavior |
|-----|------|------------------|
| `debug.log` | optional `message: string` | Writes a deterministic local log line. |
| `debug.setSwitch` | `switchId: string`, `value: boolean` | Sets a project switch in `GameState`. |
| `debug.setVariable` | `variableId: string`, `value: number` | Sets a project variable in `GameState`. |

Unknown safe keys remain serializable and non-fatal. The runtime warns and
continues when a key is unsupported.

## Editor And Validation

- `src/plugins/pluginCommandRegistry.ts` is the TypeScript registry source for
  editor discovery and typed defaults.
- The command editor exposes registered commands through a select while
  preserving custom local command authoring.
- TypeScript project validation enforces safe ids, scalar args, registered arg
  types, and registered switch/variable references.
- Native runtime validation mirrors the same registered arg type/reference
  checks before startup.
- `EventRunner` dispatches registered commands through a fixed local C++
  registry table.
