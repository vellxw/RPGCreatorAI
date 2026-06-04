# Security Threat Model

CP-115 / FRA-150 defines the local/project/provider data boundary for
RPGCreatorAI. The product remains local-first: the native runtime is
deterministic and does not depend on AI providers, network access, cloud
services, provider credentials, or live APIs.

## Trust Boundaries

| Boundary | Contents | Persistence | Provider access |
| --- | --- | --- | --- |
| Project root | Authored project JSON under `data/`, project assets, generated assets accepted into the catalog, and project `.backups` | User-selected project directory | Only selected records/assets needed by an explicit provider-backed editor action may be included |
| Desktop app data | Recent projects config, DPAPI credential blobs, runtime logs, runtime snapshots, and playtest sessions | `%APPDATA%\RPGCreatorAI`, with fallback in `docs/FIRST_RUN_APP_DATA_POLICY.md` | Never sent as provider context |
| Browser editor memory | In-memory project state and import/export bundle state | Browser process only unless exported by the user | Same explicit-action rule as desktop editor |
| Native runtime | Reads project JSON/assets from its current directory and writes local saves/logs/snapshots | Runtime current directory and app-data diagnostics | No provider access |
| Provider adapters | Editor-side TypeScript contracts, mocked by default | No credential values in project data | May execute only after capability, credential, budget, and user-action gates pass |

## Local Data Locations

| Data class | Default location |
| --- | --- |
| Project JSON | `<projectRoot>\data\project.json`, maps, and database shards under `<projectRoot>\data\` |
| Project assets | `<projectRoot>\assets\` and catalog metadata under `<projectRoot>\data\assets\catalog.json` |
| Accepted generated assets | `<projectRoot>\assets\generated\` plus reviewed catalog/provenance metadata |
| Project save backups | `<projectRoot>\.backups\*.json` |
| Runtime save slots | `<runtime-current-dir>\saves\slot_*.json`; desktop playtest uses an app-data temp session root |
| Runtime diagnostics | `%APPDATA%\RPGCreatorAI\runtime-logs\` with policy fallback |
| Provider credentials | `%APPDATA%\RPGCreatorAI\provider-credentials\<providerId>.bin` DPAPI blobs with policy fallback |
| Build/package output | `%LOCALAPPDATA%\RPGCreatorAI\build`, `tauri-target`, and `release-artifacts` |

`docs/FIRST_RUN_APP_DATA_POLICY.md` is the operational location policy for
desktop app data, playtest sessions, package output, cleanup, and deletion
safety.

## Provider-Bound Context

Provider-bound context is allowed only after the user starts a
provider-backed editor action. It must be scoped to that action and may include:

- the prompt or form fields the user submitted
- the selected map, event, database record, asset, or generated candidate IDs
  needed by that workflow
- a minimal referenced record subset needed for validation, such as item IDs
  for quest rewards or tileset IDs for a map draft
- authored visual guidance from `docs/GAME_VISUAL_DESIGN.md` when rendering
  image prompt templates
- provider id, selected model id, operation, image settings, cost state, and
  generated-output provenance metadata

Provider-bound context must not include:

- provider credentials, API keys, bearer tokens, environment variables, or
  credential blobs
- runtime save slots, runtime logs, runtime snapshots, app-data recents, or
  playtest session directories
- the whole project by default when the workflow needs only selected records
- unrelated local files outside the selected project workflow
- rejected or pending generated output as accepted runtime data

Normal validation must use mocks, fixtures, and local smoke checks. Live
diagnostics require an explicit user request, configured credentials, cost or
unknown-cost disclosure, redaction, and diagnostic-only reporting.

## Enforcement

- Settings UI states that providers are optional, provider-backed actions can
  send selected prompts/project context only when run, secret values are not
  stored in project data, and the native runtime is provider-independent.
- Provider defaults start disabled, with empty model labels and no `apiKey`
  field.
- Credentialed adapters fail closed before HTTP when credentials are missing.
- The desktop credential bridge stores DPAPI blobs under app data and returns
  metadata only.
- The AI request queue records editor work state only; it does not replay
  restored running jobs automatically and does not mutate project data by
  itself.
- Generated assets/content stay candidates until explicit review and
  acceptance writes normal editable project data.
- Redaction is centralized for renderer/provider feedback before logs,
  diagnostics, docs, or Linear comments can include error text.

## Review Checklist

For each provider, generated-content, diagnostics, or release issue:

- Confirm no provider credential value is stored in project JSON, committed
  files, logs, screenshots, validation output, or Linear comments.
- Confirm provider-disabled/no-provider behavior still allows normal local
  editor workflows.
- Confirm runtime/save files have no provider, AI, network, cloud, credential,
  or live-API dependency.
- Confirm any provider-bound request context is visible, scoped, redacted, and
  initiated only by explicit user action.
- Confirm validation evidence names the actual commands run and does not rely
  on live paid provider calls.
