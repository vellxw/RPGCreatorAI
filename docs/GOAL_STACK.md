# Goal Stack — RPGCreatorAI

## Current Goal

Phase 11 — Complete Product Platform — ACTIVE.

## Active Phase

Phase 11 extends the completed Phase 10 MVP into a complete local-first
RPGCreatorAI product platform. The active priority is usable-first release
readiness: Windows dev reliability, packaged builds, onboarding, end-to-end
authoring workflows, editor/runtime/database polish, asset import and
generation pipelines, optional AI editor tooling, provider safety, audits, QA,
docs, and final ship evidence.

The native runtime remains local, deterministic, data-driven, and independent
of AI providers, network, cloud services, provider credentials, marketplace
systems, and arbitrary scripting. AI may be added only as optional
editor/tooling infrastructure above the runtime boundary, with mocks and
fixtures for normal validation.

Primary Phase 11 sources:

- `docs/PHASE_11_PRODUCT_CHARTER.md`
- `docs/superpowers/plans/2026-06-01-phase11-complete-platform-backlog.md`
- `docs/PHASE_11_EXECUTION_PROTOCOL.md`
- `docs/PHASE_11_PLANNING_INTEGRATION_GATE.md`
- `docs/PHASE_11_RELEASE_ARTIFACT_POLICY.md`
- `docs/RELEASE_BRANDING_ASSETS.md`
- `docs/FIRST_RUN_APP_DATA_POLICY.md`
- `docs/DIAGNOSTICS.md`
- `docs/PHASE_11_PACKAGING_INTEGRATION_GATE.md`
- `docs/PHASE_11_GPT_IMAGE_MODEL_CONFIGURATION.md`
- `docs/PHASE_11_IMAGE_PROMPT_TEMPLATE_LIBRARY.md`
- `docs/PHASE_11_AI_TILESET_GENERATION_WORKFLOW.md`
- `docs/PHASE_11_AI_ITEM_ICON_GENERATION_WORKFLOW.md`
- `docs/PHASE_11_AI_PORTRAIT_GENERATION_WORKFLOW.md`
- `docs/PHASE_11_IMAGE_EDIT_VARIATION_WORKFLOW.md`
- `docs/PHASE_11_GENERATED_IMAGE_VISUAL_QA_SCORING.md`
- `docs/PHASE_11_GPT_IMAGE_ASSET_PIPELINE_INTEGRATION_GATE.md`
- `docs/PHASE_11_CHARACTER_CONCEPT_GENERATOR.md`
- `docs/PHASE_11_SPRITE_SHEET_GENERATION_PIPELINE.md`
- `docs/PHASE_11_ANIMATION_STRIP_NORMALIZATION.md`
- `docs/PHASE_11_ANIMATION_COVERAGE_VALIDATOR.md`
- `docs/PHASE_11_ANIMATION_PREVIEW_GENERATION.md`
- `docs/PHASE_11_RUNTIME_BMP_EXPORT_GENERATED_CHARACTERS.md`
- `docs/PHASE_11_CHARACTER_ANIMATION_QA_REVIEW.md`
- `docs/PHASE_11_AI_CHARACTER_ANIMATION_INTEGRATION_GATE.md`
- `.kiro/specs/phase11-complete-product-platform/`
- Linear project `RPGCreatorAI Complete Product Platform`
- `docs/GAME_VISUAL_DESIGN.md` for authored game visual rules

## Open subgoals (top of stack first)

- Phase 11 Linear milestone 10 — AI game content pipelines (CP-086 next).
- Phase 11 Linear milestone 10 — AI game content pipelines.
- Phase 11 Linear milestone 11 — multi-provider integrations.
- Phase 11 Linear milestone 12 — continuous visual/UX audits.
- Phase 11 Linear milestone 13 — QA automation and regression.
- Phase 11 Linear milestone 14 — security, privacy, and cost controls.
- Phase 11 Linear milestone 15 — docs, examples, Linear closeout, and final
  ship gate.

## Closed subgoals

- Phase 11 CP-001 through CP-008 — planning and scope lock completed. Product
  charter, repo/product audit, risk register, provider/legal baseline, backlog
  source, execution protocol, validation baseline, and planning integration
  gate are versioned and aligned with Linear milestone 00.
- Phase 11 CP-009 through CP-016 — release hardening and packaging completed.
  Windows native builds now default out of OneDrive, restricted-policy `.bat`
  wrappers exist,
  the local unsigned Tauri package prototype builds and smoke-launches with a
  colocated runtime, CP-011 defines the unsigned artifact, version naming,
  future NSIS/MSI, and signing-boundary policy, and CP-012 adds tracked
  release branding source/icons with package metadata validation. CP-013
  centralizes first-run app-data roots for config, runtime logs, and playtest
  sessions, documents cleanup, and adds a fresh-app-data package smoke. CP-014
  exposes a stable runtime diagnostics query, displays the diagnostics folder
  in Playtest before the first log exists, and documents failed-startup and
  failed-runtime-launch support paths. CP-015 refreshes README, build/run,
  Windows build, runtime bridge, and architecture docs so the documented
  developer, desktop, packaging, smoke, diagnostics, branding, and first-run
  commands match the current Phase 11 behavior, including known non-fatal
  warnings and browser-only limitations. CP-016 reran the full canonical
  local gate and packaged-app smoke, verified colocated package artifacts under
  `%LOCALAPPDATA%`, confirmed generated binaries/app-data outputs were not
  staged, and wrote `docs/PHASE_11_PACKAGING_INTEGRATION_GATE.md`.
- Phase 11 CP-017 — open/create project flow completed. The first-run startup
  screen now exposes open, create, import, and bundled-sample paths; desktop
  creation writes a safe starter project through `fs.createProjectDialog`
  without overwriting existing project data; browser creation is explicitly
  memory-backed until export; invalid folder errors are surfaced as actionable
  user messages; and focused frontend, Rust, build, desktop content, and
  Playwright startup/create smoke checks validated the flow.
- Phase 11 CP-018 — save and validation user flow completed. Save now reports
  validation-blocked, adapter-failure, warning, success, and saving states with
  persistent non-blocking toolbar feedback; the editor toolbar exposes
  Validate directly; `performSave()` returns recovery context and timestamps
  successful saves; and the validation panel explains whether Save is blocked
  or allowed and how to recover.
- Phase 11 CP-019 — project-start playtest launch flow completed. The Playtest
  runtime bridge now labels launches by active mode, shows explicit loading,
  validation-blocked, unavailable, failed, stopped, and success feedback, keeps
  browser mode honest, points successful launches to Runtime Log/Event Trace/
  Runtime State diagnostics, and has explicit frontend plus Rust coverage that
  project-start temp sessions preserve source project data.
- Phase 11 CP-020 — current-map playtest launch flow completed. Current Map
  launch requests are now built from one tested helper, stale selected-map
  states are blocked before the desktop session adapter, the playtest toolbar
  disables Current Map when the selected map is not loaded, and launch feedback
  explains whether the runtime will use the authored start position or the
  temporary `0,0,down` map-iteration spawn.
- Phase 11 CP-021 — selected-event playtest launch flow completed. Selected
  Event now uses the fresh event from loaded map data, blocks missing/stale
  selections before the desktop session adapter, warns when conditional pages
  may leave the event inactive or when commands are absent, prioritizes
  selected-event validation errors in launch feedback, and points successful
  launches to Event Trace and Runtime Log for event debugging.
- Phase 11 CP-022 — recoverable error states completed. Startup open/create/
  import, recent-project open, save adapter failures, browser/desktop
  filesystem unavailable states, runtime launch/session failures, and provider
  disabled surfaces now have explicit recovery copy or documented honest
  unavailable states. Save failures keep the editor dirty and point desktop
  users to `.backups` when partial writes may need inspection.
- Phase 11 CP-023 — empty states and first-time guidance completed. A shared
  dense `EmptyState` surface now guides no-map, missing-map, no-event,
  database-list/detail, items, tileset, animation, output, runtime-log,
  event-trace, and runtime-state first-use states without marketing filler or
  unimplemented AI actions. Screenshot evidence is recorded under
  `docs/screenshots/phase11-cp023/`.
- Phase 11 CP-024 — end-to-end usability integration gate completed. The full
  canonical `scripts/dev/verify.ps1` gate passed, browser smoke covered
  create/edit/validate/save and playtest diagnostics honesty, selected-event
  mode was verified after explicit event selection, diagnostics verification
  passed, and standalone Tauri content smoke passed with a controlled
  `dev:tauri` server. Evidence is recorded in
  `docs/PHASE_11_END_TO_END_USABILITY_GATE.md` and
  `docs/screenshots/phase11-cp024/`.
- Phase 11 CP-025 — primary navigation polish completed. The sidebar now
  exposes only implemented workspaces (`Maps`, `Events`, `Database`, and
  `Playtest`), hidden/future `Project`, `Dialogue`, `Assets`, and AI surfaces
  remain out of primary navigation, active workspace buttons expose
  `aria-current`, the inert top-toolbar settings control was removed, and
  Events breadcrumbs now navigate through real buttons instead of fake
  clickable text. Evidence is recorded in
  `docs/screenshots/phase11-cp025/`.
- Phase 11 CP-026 — map tree workflow polish completed. Map movement now
  inserts within sibling groups and renumbers affected orders, deleting a
  non-start parent reparents direct children to root with stable ordering,
  creating or duplicating under a collapsed parent expands that parent before
  selecting the new map, start/last-map deletes are blocked before prompting,
  child-retaining delete confirmations are explicit, and icon-only map-tree
  controls expose accessible names and disabled states. Evidence is recorded
  in `docs/screenshots/phase11-cp026/`.
- Phase 11 CP-027 — map properties polish completed. The map inspector now
  exposes editable tileset, scroll, encounter, battleback, parallax, viewport,
  and start position/direction settings without JSON editing, shows missing
  tileset references explicitly, clamps start positions when assigning a new
  start map, normalizes saved map metadata, and validates invalid scroll,
  encounter-step, and parallax-scroll values before save/playtest handoff.
  Evidence is recorded in `docs/screenshots/phase11-cp027/`.
- Phase 11 CP-028 — tile palette and brush workflow polish completed. The
  tile palette now labels search, tool, layer, and tile buttons for keyboard
  and screen-reader use, removes the unimplemented pipette control, shows the
  selected brush metadata, explains missing tilesets and locked/hidden active
  layers before painting, and reducer no-op map mutations no longer dirty the
  project or add history. Evidence is recorded in
  `docs/screenshots/phase11-cp028/`.
- Phase 11 CP-029 — layer workflow polish completed. Locked and hidden
  layers now reject brush, rectangle, and fill mutations without dirtying the
  project or adding history; the canvas mirrors the blocked state in its
  bottom status; visual foreground layers render after events to match runtime
  occlusion; and collision, passability, and region overlays are tagged and
  visually distinct from authored tiles. Evidence is recorded in
  `docs/screenshots/phase11-cp029/`.
- Phase 11 CP-030 — event editor surface polish completed. The Events
  workspace now exposes page-scoped graphic, trigger, priority, condition,
  movement, and option controls without JSON editing, keeps page command edits
  scoped to the selected page id, preserves page-one legacy command mirroring,
  and makes movement-route step controls addressable and readable. Evidence is
  recorded in `docs/screenshots/phase11-cp030/`.
- Phase 11 CP-031 — database navigation and large-list polish completed. The
  Database workspace now filters large record lists, keeps hidden selected
  records understandable while searching, gives icon-only list actions stable
  names, and surfaces reference impact before destructive deletes for standard
  database records, items, and animation sets. Evidence is recorded in
  `docs/screenshots/phase11-cp031/`.
- Phase 11 CP-032 — professional editor surface integration gate completed.
  Focused frontend coverage and screenshot audit now validate navigation, map
  tree, map properties, tile/layer workflows, Events, and Database as one
  coherent authoring surface. The gate also fixed unstable compact controls in
  map-tree rows, Events breadcrumbs/page actions/condition actions, and
  Database list icon actions so the audited desktop and narrow views expose no
  future AI/provider actions, no desktop horizontal overflow, and no visible
  controls smaller than 20 px. Evidence is recorded in
  `docs/PHASE_11_EDITOR_SURFACE_INTEGRATION_GATE.md` and
  `docs/screenshots/phase11-cp032/`.
- Phase 11 CP-033 — runtime command gap audit completed. The command matrix
  confirms all 29 authored v1 event commands have schema, editor UI,
  validation/parser support, native EventRunner dispatch, and focused evidence
  for the current scope. Remaining gaps are product-depth items around battle,
  audio, plugin-command registry, movement-route breadth, diagnostics, and
  native unknown-command validator parity, all mapped to existing milestone 04
  issues CP-034 through CP-040. Evidence is recorded in
  `docs/PHASE_11_RUNTIME_COMMAND_GAP_AUDIT.md`.
- Phase 11 CP-034 — runtime menu flow polish completed. Inventory, party,
  quests, save/load, shop, and battle summary surfaces were audited through
  focused C++ coverage and smoke screenshots. Empty load slots now give
  explicit disabled-state feedback instead of emitting a load action, missing
  shop item listings are unavailable and cannot mutate inventory/gold, long
  shop lists render around the selected row, and the deterministic runtime
  smoke path now asserts the shop and battle overlays are active before
  writing their screenshots. Evidence is recorded in
  `docs/screenshots/phase11-cp034/`.
- Phase 11 CP-035 — battle authoring runtime gaps closed for v1. Battle actor
  stats now resolve through shared runtime data (`baseStats` plus class growth
  by level plus equipment modifiers), the party menu displays the same stats
  used by `BattleSystem`, battle database references are validated natively
  before launch, empty troops are rejected, and `startBattle.canEscape=true` is
  explicitly blocked by editor/runtime validation until interactive escape is
  implemented. Evidence is recorded in
  `docs/PHASE_11_BATTLE_RUNTIME_GAP_CLOSURE.md`.
- Phase 11 CP-036 — audio authoring runtime v1 completed. `system.audio`
  now stores editable local WAV ids and paths, System/Map/Event editors expose
  common audio references without JSON editing, frontend and native validators
  check unknown ids plus unsafe or unsupported audio paths, and the native
  validator warns rather than blocks when optional local WAV files are absent.
  Evidence is recorded in `docs/PHASE_11_AUDIO_AUTHORING_RUNTIME_V1.md`.
- Phase 11 CP-037 — deterministic plugin command registry v2 completed.
  Authored plugin commands now use a typed local registry for `debug.log`,
  `debug.setSwitch`, and `debug.setVariable` in the editor, TypeScript
  validator, native runtime validator, and `EventRunner` dispatch. Unknown
  safe commands remain non-fatal, while registered commands validate argument
  types and switch/variable references before playtest handoff.
- Phase 11 CP-038 — save/load UX and runtime slot polish completed.
  `SaveManager` now exposes detailed save/load results while preserving the
  legacy bool/optional API, validates save envelopes for supported
  `schemaVersion`, map id, player position, and direction, and reports empty,
  corrupt, or future-version slots as distinct states. The runtime menu marks
  corrupt/future slots as existing but not loadable, blocks load actions for
  them, and surfaces actionable feedback without moving gameplay rules into
  persistence.
- Phase 11 CP-039 — runtime diagnostics and developer overlay completed.
  Runtime state snapshots now serialize bounded collections with explicit
  limits, total counts, omitted counts, map dimensions, map-event count, and
  event-trace count/capacity. `EventTraceBuffer` exposes size/capacity for
  tests and snapshot diagnostics, the Playtest Runtime State panel surfaces
  the bounded summary, and `RPG_RUNTIME_DEBUG_OVERLAY=1` enables a small
  in-window runtime debug overlay without IPC, AI, network, or gameplay
  mutation.
- Phase 11 CP-040 — runtime feature completeness integration gate completed.
  The canonical `scripts/dev/verify.ps1` gate passed frontend typecheck,
  full Vitest, frontend build, native C++ configure/build/CTest, Tauri content
  check, Rust desktop tests, runtime smoke, and editor-runtime screenshot
  roundtrip. Runtime milestone 04 is green and ready for database/system
  dependency work. Evidence is recorded in
  `docs/PHASE_11_RUNTIME_FEATURE_COMPLETENESS_GATE.md`.
- Phase 11 CP-041 — database schema gap audit completed. The support matrix
  now distinguishes TypeScript schema, bundled JSON shards, editor/desktop
  preservation, TypeScript validation, native loader/validator support, and
  actual runtime consumption. CP-041 also aligned optional `database.audio`
  preservation across TypeScript and Tauri, added native `ProjectLoader`
  path capture for separated `weapons`, `armors`, and `states` shards, and
  maps large gaps to existing CP-042 through CP-048 follow-up issues.
  Evidence is recorded in `docs/PHASE_11_DATABASE_SCHEMA_GAP_AUDIT.md`.
- Phase 11 CP-042 — actor, class, and skill editor polish completed.
  Actor skills and class usable equipment now use editable reference
  checklists instead of comma-separated ID fields, unknown refs stay visible
  and removable, learned-skill rows have safer empty/no-skill states, stat
  labels are human-readable, and skill delete warnings are covered when actors
  or classes still reference the skill. Evidence is recorded in
  `docs/PHASE_11_ACTOR_CLASS_SKILL_EDITOR_POLISH.md`.
- Phase 11 CP-043 — enemy and troop editor polish completed. Enemy drop and
  troop member add actions no longer create empty references, default starter
  drops are immediately meaningful, member move/remove controls have stable
  accessible labels and disabled boundary states, empty/no-reference states are
  repairable from the UI, and the native runtime validator now blocks invalid
  enemy stats, exp/gold, and drop chance ranges before launch. Evidence is
  recorded in `docs/PHASE_11_ENEMY_TROOP_EDITOR_POLISH.md`.
- Phase 11 CP-044 — item, equipment, and state editor polish completed.
  Items now expose readable modifier labels for every stat, weapon and armor
  editors expose complete stat modifier grids, weapon/armor/state traits use
  row-based list controls instead of comma-separated text, trait validation
  catches blanks and duplicates, and the native pre-launch validator blocks
  invalid runtime-consumed item/equipment data. Separated `weapons`, `armors`,
  and `states` remain editor/validation shards for v1; direct runtime
  equipment/state simulation remains future depth. Evidence is recorded in
  `docs/PHASE_11_ITEM_EQUIPMENT_STATE_EDITOR_POLISH.md`.
- Phase 11 CP-045 — system, types, and terms polish completed. The Database
  screen now exposes standalone `Types` and `Terms` tabs, type tables and
  terminology labels are editable with visible missing-label warnings,
  starting party editing uses actor reference selects instead of raw
  comma-separated ids, starting gold reflects the configured currency term,
  and TypeScript validation now flags unstable system defaults for duplicate
  party actors, empty party-with-actors, and missing player animation-set
  defaults. Types and terms remain editor/validation data; the native runtime
  remains independent of editor-only labels. Evidence is recorded in
  `docs/PHASE_11_SYSTEM_TYPES_TERMS_POLISH.md`.
- Phase 11 CP-046 — common event authoring polish completed. The shared
  command stack now receives common-event owner context, `callCommonEvent`
  target editing excludes the owning common event while preserving existing
  self/unknown references for repair, empty-branch append behavior is covered
  for reusable common-event stacks, and both TypeScript and native pre-launch
  validation now reject direct common-event self-calls. Full multi-event cycle
  detection remains future reference-analysis depth. Evidence is recorded in
  `docs/PHASE_11_COMMON_EVENT_AUTHORING_POLISH.md`.
- Phase 11 CP-047 — reference repair tools completed. The shared reference
  index now detects broken refs and same-table replacement options for
  database, map, event-command, project-start, and map-tree parent sources;
  the Validation tab exposes explicit replacement controls; and
  `REPAIR_REFERENCE` applies source-scoped, target-validated, undoable repairs
  without destructive cleanup or generated content. Evidence is recorded in
  `docs/PHASE_11_REFERENCE_REPAIR_TOOLS.md`.
- Phase 11 CP-048 — database/system completeness integration gate completed.
  The canonical `scripts/dev/verify.ps1` gate passed frontend typecheck, full
  Vitest, frontend build, native C++ configure/build/CTest, Tauri content
  check, Rust desktop tests, runtime smoke, and editor-runtime screenshot
  roundtrip; browser smoke also verified representative Database/System tabs
  and validation feedback. Milestone 05 is ready to hand off to asset library
  and import pipeline work. Evidence is recorded in
  `docs/PHASE_11_DATABASE_SYSTEM_COMPLETENESS_GATE.md`.
- Phase 11 CP-049 — asset catalog v2 completed. Project metadata now points
  to `data/assets/catalog.json`, the editor/browser/desktop adapters
  round-trip `FullProjectState.assets`, the primary navigation exposes a real
  Assets workspace with list/filter/detail/preview basics, TypeScript
  validation rejects missing/duplicate/unsafe asset metadata, and Tauri
  open/save/create/playtest flows preserve the catalog without making the
  native runtime consume editor-only metadata. Evidence is recorded in
  `docs/PHASE_11_ASSET_CATALOG_V2.md` and
  `docs/screenshots/phase11-cp049/`.
- Phase 11 CP-050 — image import workflow completed. Desktop projects can
  import local `.png`, `.jpg`, `.jpeg`, `.bmp`, and `.webp` files into
  `assets/imported/images/` without overwriting existing project files, the
  generated catalog entry is unique and undo/history-aware through the project
  reducer, browser mode shows an honest unavailable state, and unsupported
  files report clear errors. The workflow remains editor-only and does not
  add runtime, AI, network, or provider dependencies. Evidence is recorded in
  `docs/PHASE_11_IMAGE_IMPORT_WORKFLOW.md` and
  `docs/screenshots/phase11-cp050/`.
- Phase 11 CP-051 — spritesheet import workflow completed. The Animations
  database can open a metadata-first import panel, preview frame/action/
  direction/anchor/FPS/loop/display settings before file selection, import
  local spritesheets into `assets/imported/spritesheets/` without overwriting
  existing files, add a `spritesheet` catalog entry with frame metadata, and
  create a linked animation set/clip without JSON editing. Validation accepts
  catalog spritesheet clip assets, rejects non-spritesheet catalog refs, and
  checks clip frame metadata against catalog metadata. Evidence is recorded in
  `docs/PHASE_11_SPRITESHEET_IMPORT_WORKFLOW.md` and
  `docs/screenshots/phase11-cp051/`.
- Phase 11 CP-052 — audio import workflow completed. The Assets workspace can
  import local `.wav` files in desktop mode, tag them as BGM or SFX, copy them
  into `assets/imported/audio/` without mutating external sources, add an
  `audio` catalog entry, and register the imported id/path in `system.audio`
  so System default BGM, map BGM, and event `playSound` selectors can use it.
  Browser mode reports import as unavailable honestly, and native mock/runtime
  validator coverage confirms imported WAV refs are requestable and safe.
  Evidence is recorded in `docs/PHASE_11_AUDIO_IMPORT_WORKFLOW.md` and
  `docs/screenshots/phase11-cp052/`.
- Phase 11 CP-053 — tileset import workflow completed. The Tilesets database
  can open a metadata-first import panel, preview tile size/columns/count,
  foreground split, default passability, and region marker metadata before
  file selection, import local tileset images into `assets/imported/tilesets/`
  without overwriting existing files, add a catalog `tileset` entry, and
  create linked A/B/Region/Collision tile metadata without JSON editing.
  Project validation now accepts imported `tileset` catalog assets and checks
  visual layer tile ids against the active project tileset database.
  Evidence is recorded in `docs/PHASE_11_TILESET_IMPORT_WORKFLOW.md` and
  `docs/screenshots/phase11-cp053/`.
- Phase 11 CP-054 — asset metadata editor completed. The Assets workspace now
  edits catalog display name, source, tags, provenance, dimensions, runtime
  compatibility, runtime notes, protected status, and notes while keeping asset
  ids, kind, and path immutable in the UI. The detail panel surfaces
  generated/imported/protected/runtime status and reference sources for the
  selected asset; TypeScript validation rejects invalid metadata values, and
  the shared reference index reports catalog asset references without treating
  static generated tile keys as broken asset refs. Evidence is recorded in
  `docs/PHASE_11_ASSET_METADATA_EDITOR.md` and
  `docs/screenshots/phase11-cp054/`.
- Phase 11 CP-055 — asset optimization and runtime export completed.
  `scripts/dev/export_runtime_assets.py` and its PowerShell/BAT wrappers now
  convert cataloged visual assets into deterministic runtime BMP outputs with
  magenta transparency, preserve local WAV assets as runtime-ready audio,
  write `data/assets/runtime-manifest.json`, and validate missing runtime
  outputs. The native runtime validator now warns before launch when
  animation clip BMP outputs are absent while keeping runtime fallback
  behavior non-fatal. Evidence is recorded in
  `docs/PHASE_11_ASSET_OPTIMIZATION_RUNTIME_EXPORT.md`.
- Phase 11 CP-056 — asset library integration gate completed. The gate
  validated asset catalog preservation, image/audio/spritesheet/tileset import
  workflows, metadata editing, reference indexing, runtime export manifest
  validation, desktop import helpers, native runtime validation, runtime
  smoke, and editor-runtime roundtrip as one milestone boundary. Milestone 06
  is ready to hand off to optional AI Provider Hub work. Evidence is recorded
  in `docs/PHASE_11_ASSET_LIBRARY_INTEGRATION_GATE.md`.
- Phase 11 CP-057 — provider settings UI completed. Settings is now an
  implemented primary workspace for optional provider availability metadata,
  capability display, model labels, disabled and missing-credential states,
  and provider-independent safety copy. The provider store no longer models
  `apiKey` values, no live provider action is rendered, and normal
  editor/runtime workflows remain usable with no configured providers.
  Evidence is recorded in `docs/PHASE_11_PROVIDER_SETTINGS_UI.md`.
- Phase 11 CP-058 — credential storage policy completed. Desktop Settings can
  save or forget user-entered provider credentials through a Tauri
  `credentials` bridge that stores Windows DPAPI-protected app-data blobs and
  returns metadata only. Browser mode reports credential storage unavailable,
  redaction helpers cover renderer/Rust feedback, provider ids are path-safe,
  and project JSON plus the native runtime remain credential-free. Evidence is
  recorded in `docs/PHASE_11_CREDENTIAL_STORAGE_POLICY.md`.
- Phase 11 CP-059 — AI request queue and cancellation completed. The editor now
  has a bounded, persisted AI request queue model with queued/running/
  cancelled/failed/succeeded states, progress, cancellation, retry, restart
  recovery, idempotency keys, and write-intent guards that avoid duplicate
  destructive writes on retry. Settings exposes a compact queue status panel
  without adding live provider calls or generation actions. Evidence is
  recorded in `docs/PHASE_11_AI_REQUEST_QUEUE.md`.
- Phase 11 CP-060 — provider registry and adapter interface completed. Provider
  metadata, supported operations, credential requirements, model-list policy,
  and adapter request/response shapes now live in editor-side TypeScript
  contracts. `providerStore` defaults derive from the registry, and the first
  mock local adapter validates deterministic offline text requests,
  cancellation, unsupported-operation failure, and usage metadata without live
  provider calls. Evidence is recorded in
  `docs/PHASE_11_PROVIDER_REGISTRY_ADAPTER.md`.
- Phase 11 CP-061 — model capability registry completed. Model capabilities,
  limits, workflow definitions, and availability gates now live as editor-side
  data. Settings shows read-only capability gates driven by configured model
  capability descriptors rather than provider names, while still exposing no
  generation/connect/test-provider actions. Evidence is recorded in
  `docs/PHASE_11_MODEL_CAPABILITY_REGISTRY.md`.
- Phase 11 CP-062 — cost, rate-limit, and budget states completed. Provider
  registry metadata now records unknown/free cost availability, paid-work
  session confirmation policy, and provider-managed rate-limit/quota recovery
  guidance. The mock adapter exposes deterministic rate-limit and quota
  fixture failures, the AI queue rejects unconfirmed expensive estimated-cost
  jobs before enqueueing, and Settings shows a read-only `Cost & Budget` panel
  with no live provider actions. Evidence is recorded in
  `docs/PHASE_11_COST_RATE_LIMIT_BUDGET_STATES.md`.
- Phase 11 CP-063 — mocked provider contract test suite completed. Offline
  fixtures now cover success, malformed responses, provider errors,
  rate-limit, timeout, and cancellation; request serialization is deterministic
  and redacts secret-looking fields; response normalization produces one
  adapter shape with retry guidance; and disabled/missing-credential provider
  readiness is covered without live APIs. Evidence is recorded in
  `docs/PHASE_11_MOCK_PROVIDER_CONTRACTS.md`.
- Phase 11 CP-064 — AI Provider Hub foundation integration gate completed. The
  full provider-hub suite, frontend validation, static provider/runtime scans,
  zero-provider Settings smoke, and canonical `scripts/dev/verify.ps1` gate
  passed. Milestone 07 is ready to hand off to GPT Image 2 asset pipeline work
  while the native runtime remains independent of AI, providers, network,
  cloud, credentials, and live APIs. Evidence is recorded in
  `docs/PHASE_11_AI_PROVIDER_HUB_FOUNDATION_GATE.md`.
- Phase 11 CP-065 — GPT Image model configuration completed. OpenAI
  `gpt-image-2` is recorded as configurable provider/model metadata, image
  settings normalize quality, size, output format, background, moderation, and
  prompt-only style guidance, Settings exposes those controls without live
  provider actions, and the local mock adapter/contract suite now covers
  deterministic offline `image.generate` responses through
  `offline-image-mock`. Evidence is recorded in
  `docs/PHASE_11_GPT_IMAGE_MODEL_CONFIGURATION.md`.
- Phase 11 CP-066 — image prompt template library completed. Versioned
  templates now cover tilesets, item icons, character portraits, runtime UI
  panels, and reference boards; every rendered prompt includes binding visual
  context from `docs/GAME_VISUAL_DESIGN.md`, rejects proprietary style copying
  requests, and can emit an auditable generated-asset provenance manifest.
  Evidence is recorded in `docs/PHASE_11_IMAGE_PROMPT_TEMPLATE_LIBRARY.md`.
- Phase 11 CP-067 — AI tileset generation workflow completed. The Tilesets
  database now has a metadata-first generated-draft workflow that renders the
  versioned tileset prompt template through the local offline mock provider,
  creates a pending review candidate, validates dimensions and tile metadata,
  and only adds the generated asset plus tileset database records after user
  acceptance. Toolbar validation now includes the asset catalog so generated
  tileset asset references validate correctly. Evidence is recorded in
  `docs/PHASE_11_AI_TILESET_GENERATION_WORKFLOW.md`.
- Phase 11 CP-068 — AI item icon generation workflow completed. Items,
  weapons, and armors now expose a metadata-first generated icon workflow that
  renders the versioned item icon prompt through the local offline mock
  provider, creates pending catalog candidates, and assigns accepted
  `iconAssetId` values only after review. Validation and reference indexing
  now cover item/equipment icon asset references. Evidence is recorded in
  `docs/PHASE_11_AI_ITEM_ICON_GENERATION_WORKFLOW.md`.
- Phase 11 CP-069 — AI portrait generation workflow completed. Actors and
  map event NPC metadata now expose a metadata-first generated portrait
  workflow that renders the versioned character portrait prompt through the
  local offline mock provider, creates pending catalog candidates, and assigns
  accepted `portraitAssetId` values only after explicit review. Validation and
  reference indexing now cover actor/event portrait asset references. Evidence
  is recorded in `docs/PHASE_11_AI_PORTRAIT_GENERATION_WORKFLOW.md`.
- Phase 11 CP-070 — image edit and variation workflow completed. The Assets
  detail panel now exposes capability-gated, source-gated image edit/variation
  authoring for image, generated, tileset, and spritesheet catalog entries.
  The local `offline-image-edit-mock` fixture handles normal validation
  through `image.edit`, source assets are preserved, candidates remain pending
  until review, and accepted outputs are added as new generated catalog assets
  with source/mask/reference/prompt/model provenance. Evidence is recorded in
  `docs/PHASE_11_IMAGE_EDIT_VARIATION_WORKFLOW.md`.
- Phase 11 CP-071 — generated image visual QA scoring completed. Generated
  image candidates now show a reviewer-facing checklist for dimensions,
  transparency, style consistency, readability, and runtime suitability before
  project assignment. Accept/reject flows store finalized QA score, notes,
  tags, unresolved warnings, and rejection metadata in generated asset
  metadata while keeping rejected candidates out of project data. Evidence is
  recorded in `docs/PHASE_11_GENERATED_IMAGE_VISUAL_QA_SCORING.md`.
- Phase 11 CP-072 — GPT Image asset pipeline integration gate completed.
  Provider/model config, prompt templates, mock image generation, generated
  tilesets, item/equipment icons, portraits, image edit/variation candidates,
  review gates, and visual QA scoring now have one mock-only integration test.
  Generated image manifests now record their provider operation, Settings
  remains usable without OpenAI credentials or live actions, and milestone 08
  is ready for the AI character/animation work in milestone 09. Evidence is
  recorded in `docs/PHASE_11_GPT_IMAGE_ASSET_PIPELINE_INTEGRATION_GATE.md`.
- Phase 11 CP-073 — character concept generator completed. Actor and event
  editors now expose reviewed character concept generation through the local
  offline image mock, versioned `character-concept-v1` prompt template,
  pending generated asset candidates, visual QA review, owner provenance, and
  explicit `conceptAssetId` assignment only after acceptance. Validation and
  reference indexing now cover actor/event concept asset references. Evidence
  is recorded in `docs/PHASE_11_CHARACTER_CONCEPT_GENERATOR.md`.
- Phase 11 CP-074 — sprite sheet generation pipeline completed. The
  Animations editor now exposes reviewed sprite sheet generation from optional
  character concepts through the local offline image mock, versioned
  `character-spritesheet-v1` prompt template, pending generated `spritesheet`
  assets, frame/metadata validation, visual QA, source concept provenance, and
  insertion of the accepted asset plus animation set only after review.
  Evidence is recorded in
  `docs/PHASE_11_SPRITE_SHEET_GENERATION_PIPELINE.md`.
- Phase 11 CP-075 — animation strip normalization completed. The local asset
  pipeline now includes `normalize_animation_strip.py` plus PowerShell and
  batch wrappers to normalize generated/imported horizontal sprite strips into
  editor PNG, web PNG, runtime BMP, and deterministic trace manifests. The
  pipeline enforces safe paths, frame size/count, anchor, FPS, loop,
  transparency, non-empty frames, shared scale, and output validation. Evidence
  is recorded in `docs/PHASE_11_ANIMATION_STRIP_NORMALIZATION.md`.
- Phase 11 CP-076 — direction and action coverage validator completed.
  Project validation now checks full player coverage, NPC idle/walk coverage,
  enemy combat coverage, `any` direction fallback coverage, and
  runtime-compatible spritesheet output metadata before save/playtest. Coverage
  gaps surface as warnings; malformed spritesheet metadata and incompatible
  referenced outputs are errors. Evidence is recorded in
  `docs/PHASE_11_ANIMATION_COVERAGE_VALIDATOR.md`.
- Phase 11 CP-077 — preview GIF generation completed. The local asset pipeline
  now includes manifest-driven animation preview generation with GIF and sheet
  outputs under docs screenshots, source-linked preview manifests, validation
  that previews stay outside runtime dependency paths, and checked-in visual QA
  evidence for `player_adventurer_walk_down`. Evidence is recorded in
  `docs/PHASE_11_ANIMATION_PREVIEW_GENERATION.md`.
- Phase 11 CP-078 — runtime BMP export for generated characters completed.
  The runtime asset exporter now reads CP-075 normalization manifests, converts
  normalized character strips to `assets/generated/runtime/{id}.bmp` with the
  runtime transparency key, records generated-character metadata in
  `data/assets/runtime-manifest.json`, and preserves the native
  `SpriteCatalog::runtimePathFor` convention. Evidence is recorded in
  `docs/PHASE_11_RUNTIME_BMP_EXPORT_GENERATED_CHARACTERS.md`.
- Phase 11 CP-079 — character animation QA review surface completed.
  Generated sprite sheet candidates now require explicit character animation
  QA before entering project animation data, with preview, metadata, coverage,
  runtime compatibility, reviewer notes, accept/reject metadata, UI blocking
  for failed-QA player animation assignments, and validator errors for
  rejected generated animation assets in runtime-critical player slots.
  Evidence is recorded in
  `docs/PHASE_11_CHARACTER_ANIMATION_QA_REVIEW.md`.
- Phase 11 CP-080 — AI character animation integration gate completed.
  The mock-backed character/animation pipeline is now validated end to end:
  reviewed character concepts, source-linked sprite sheet generation,
  animation QA, visual QA, project validation, editor preview rendering,
  normalized preview/export fixtures, runtime BMP manifest validation, and
  native runtime fixture path tests all pass without live provider calls.
  Evidence is recorded in
  `docs/PHASE_11_AI_CHARACTER_ANIMATION_INTEGRATION_GATE.md`.
- Phase 11 CP-081 — AI Map Draft Generator completed. The sparkles icon action
  in the Map Tree launches a modal overlay where creators configure drafts.
  Pending candidates list sizes, layers, and events, then validate against standard
  project assets before Accept/Discard decisions. No live network or provider APIs
  are called. Evidence is recorded in `docs/PHASE_11_AI_MAP_DRAFT_GENERATOR.md`.
- Phase 11 CP-082 — AI Quest Generator completed. Sparks icon in DatabaseList opens
  a quest generator modal supporting offline prompt-based draft generation of quests
  with objectives, rewards, state schemas, validation against maps/items, and insert workflow.
  Evidence is recorded in `docs/PHASE_11_AI_QUEST_GENERATOR.md`.
- Phase 11 CP-083 — AI Event Command Generator completed. Sparks button in CommandStackEditor
  launches modal where users describe commands sequence, showing candidate commands, provenance
  information, validation details, and accepting them as editable commands with support for
  insertion paths. Evidence is recorded in `docs/PHASE_11_AI_EVENT_COMMAND_GENERATOR.md`.
- Phase 11 CP-084 — AI Database Draft Generator completed. Sparks button next to name inputs
  in ActorsEditor, EnemiesEditor, and ItemsEditor opens draft generation modals with prompt config,
  candidate review, and validations of structures/references before applying the properties.
  Evidence is recorded in `docs/PHASE_11_AI_DATABASE_DRAFT_GENERATOR.md`.
- Phase 11 CP-085 — AI Balancing Assistant completed. Sparks button in the Database tab bar
  opens a balancing modal supporting progression curve configuration, prompt inputs, proposed adjustments
  review lists across Actors, Enemies, and Items, reference validations, and accept apply updates.
  Evidence is recorded in `docs/PHASE_11_AI_BALANCING_ASSISTANT.md`.
- Phase 11 CP-097 — editor screenshot audit workflow completed. The repeatable
  editor screenshot audit checklist now defines 67 required screenshots across
  9 categories (startup, map editor, events, database, assets, playtest, settings,
  validation/save, error/recovery), an audit checklist covering spacing, overlap,
  disabled states, information density, empty/loading/error states, responsive
  viewport variants, and accessibility, a consistent evidence storage convention
  under `docs/screenshots/`, follow-up issue filing guidance with severity
  classification, and integration with existing `GAME_VISUAL_QA.md`,
  `EDITOR_RUNTIME_E2E_QA.md`, `EMPTY_STATES.md`, `VALIDATION_LOG.md`, and
  the CP-032 JSON assertion format. Representative screenshot evidence was
  captured via Chrome DevTools MCP under `docs/screenshots/phase11-cp097/`.
  Evidence is recorded in `docs/EDITOR_SCREENSHOT_AUDIT.md`.
- Phase 11 CP-098 — runtime screenshot audit workflow completed. The repeatable
  runtime screenshot audit checklist defines 33 required screenshots across
  10 categories (map/movement, dialogue, interactions/state, pause menu,
  inventory, party/status, quests, save/load slots, shop, battle), an audit
  checklist covering text fit, composition, entity occlusion, viewport framing,
  color/styling, state correctness, and responsive scaling, smoke script
  alignment guidance so automated and visual evidence stay consistent, follow-up
  issue filing guidance with severity classification, and integration with
  existing RUNTIME_UI_DESIGN.md, EDITOR_SCREENSHOT_AUDIT.md, GAME_VISUAL_QA.md,
  and EDITOR_RUNTIME_E2E_QA.md. Evidence is recorded in
  `docs/RUNTIME_SCREENSHOT_AUDIT.md`.
- Phase 11 CP-099 — responsive layout audit completed. The editor was tested
  at 4 viewport sizes (768x600, 1024x768, 1280x800, 1920x1080) across Maps,
  Database, and Playtest workspaces. All sizes pass with no horizontal scroll,
  no buttons below 20px, and all controls accessible. Screenshot evidence and
  automated JS checks recorded under `docs/screenshots/phase11-cp099/`. Evidence
  is recorded in `docs/RESPONSIVE_LAYOUT_AUDIT.md`.
- Phase 11 CP-100 — accessibility audit completed. All 88 interactive buttons
  audited for accessible names; 2 zoom control buttons in MapCanvas were missing
  `aria-label` and `title` and were fixed. All 19 form inputs have proper labels.
  14 decorative images without alt text identified as minor non-blocking items.
  Evidence is recorded in `docs/ACCESSIBILITY_AUDIT.md`.
- Phase 11 CP-101 — UX copy audit completed. All UI copy across toolbar,
  validation, errors, empty states, playtest, AI/provider states, and database
  forms audited for clarity. No vague or placeholder copy found. No code changes
  required. Evidence is recorded in `docs/UX_COPY_AUDIT.md`.
- Phase 11 CP-102 — generated asset quality audit completed. All 5 cataloged
  assets, 6 runtime manifest entries, and 1 animation normalization manifest
  verified for dimensions, transparency, runtime outputs, and frame metadata.
  No assets fail critical criteria. Evidence is recorded in
  `docs/GENERATED_ASSET_QUALITY_AUDIT.md`.
- Phase 11 CP-103 — regression triage workflow completed. The workflow defines
  severity classification (Blocking/Visible/Minor), required Linear issue fields,
  routing rules by audit source, duplicate and known-limitation handling, and a
  sample audit finding using the CP-100 zoom button accessibility fix. Evidence
  is recorded in `docs/REGRESSION_TRIAGE_WORKFLOW.md`.
- Phase 10 INT-005 (FRA-35) — final MVP green gate passed. The canonical
  `scripts/dev/verify.ps1` gate passed frontend typecheck, full Vitest,
  frontend build, native C++ configure/build/CTest, Tauri content check, Rust
  desktop tests, runtime smoke, and editor-runtime screenshot roundtrip.
  Phase 10 MVP validation report was written in
  `docs/PHASE_10_MVP_VALIDATION_REPORT.md`.
- Phase 10 INT-004 (FRA-34) — MVP documentation now matches the implemented
  local workflow: README and build docs list current commands, browser vs
  desktop behavior, temp playtest sessions, validation gates, and explicit
  MVP limitations; architecture/runtime bridge docs describe the Tauri bridge,
  bounded logs/traces/snapshots, and no runtime IPC/AI/cloud/scripting
  dependency; map/visual docs align with Phase 10 layers, playtest, and smoke
  evidence. TypeScript typecheck passed after the documentation closeout.
- Phase 10 INT-003 (FRA-33) — Playtest/Debug tooling integration is present on
  `main`: no local or remote `PT-*` branch refs remain after fetch/prune,
  Linear shows FRA-22 through FRA-26 Done, Slice 6 tasks are checked, and the
  integrated code includes temp playtest sessions, bounded runtime logs,
  deterministic event traces, bounded runtime state snapshots, and MVP
  placeholder AI/debug UI gating. Frontend typecheck, full Vitest, frontend
  build, Rust desktop tests, and the Tauri content check passed against the
  integrated state.
- Phase 10 INT-002 (FRA-32) — Runtime MZ foundation integration is present on
  `main`: no local or remote `RT-*` branch refs remain after fetch/prune,
  Linear shows FRA-15 through FRA-21 Done, Slice 5 tasks are checked, and the
  integrated code includes the runtime validator, selectable choices,
  event-target movement routes, event priority/Y-sort, foreground occlusion,
  local audio v1, and deterministic plugin commands. Native CMake
  configure/build/CTest and runtime smoke validated those systems together.
- Phase 10 INT-001 (FRA-31) — Database V2 integration is present on `main`:
  there are no remaining local or remote `DB-*` branch refs after
  fetch/prune, Linear shows FRA-6 through FRA-14 Done, Slice 4 tasks are
  checked, and the integrated code includes the shared database framework,
  dedicated tileset/item/equipment/state/party/combat/setup/progression/
  animation editors, common-event command editing, and reference safety.
  Frontend typecheck, full Vitest, frontend build, and Rust desktop tests
  passed against the integrated state.
- Phase 10 QA-004 (FRA-30) — `scripts/dev/verify.ps1` is now the canonical
  MVP green gate. It runs frontend typecheck, Vitest, frontend build, native
  C++ configure/build/CTest, Tauri content verification, Rust desktop tests,
  runtime smoke, and editor-runtime roundtrip validation, with targeted
  `-SkipFrontend`, `-SkipDesktop`, `-SkipRuntime`, and `-SkipSmoke` flags and
  a final gate summary.
- Phase 10 QA-003 (FRA-29) — runtime smoke now launches the native runtime,
  runs `--smoke-shots` into `docs/screenshots/phase10-mvp/`, and fails unless
  logs prove choice selection, event-target movement, local `chest_open` audio
  request, `pluginCommand debug.log`, and clean smoke completion. The smoke
  path also captures route-coach dialogue, the moved crate, and foreground
  player occlusion.
- Phase 10 QA-002 (FRA-28) — editor/runtime roundtrip now has one command
  that runs frontend save/session tests, Tauri content verification, Rust
  desktop tests, native CMake/CTest, runtime launch smoke, and screenshot
  hash proof that edited project data changes the rendered runtime frame.
- Phase 10 QA-001 (FRA-27) — bundled sample now exercises MVP feature
  coverage: choices, self-switch pages, a switch-gated parallel common event,
  event-target movement routes, `playSound`, `pluginCommand debug.log`,
  foreground occlusion, and TypeScript/C++ fixture coverage.
- Phase 10 PT-005 (FRA-26) — placeholder AI/debug UI is gated for MVP:
  clickable bottom-panel generation suggestions were replaced by real
  diagnostics, the `ai-tools` route was removed from primary navigation and
  toolbar routing, the future AI workspace is read-only if reached directly,
  and Playtest remains focused on validation, runtime logs, event traces, and
  runtime/editor state surfaces.
- Phase 10 PT-004 (FRA-25) — native runtime state snapshots now write a
  bounded local `runtime-state-snapshot.json` file next to runtime logs through
  an atomic temp-write/replace path. The JSON includes map/player state, gold,
  party, switches, variables, self switches, inventory, active modal state,
  running event ids, and frame number. Tauri exposes a bounded snapshot read,
  and the Playtest Runtime State tab renders the native snapshot while the
  side inspector remains explicitly labeled as simulated editor state.
- Phase 10 PT-003 (FRA-24) — event execution now emits deterministic
  `[TRACE]` stdout rows with sequence, source, map/event/common-event ids,
  command path/type, action, and result. `EventTraceBuffer` keeps an
  in-memory ring for tests/runtime, map and common-event runners tag their
  source, and the Playtest Event Trace tab parses the bounded runtime log
  tail with filters for map events, common events, warnings, and branches.
- Phase 10 PT-002 (FRA-23) — native runtime launches now capture stdout and
  stderr into app-data runtime log files. The desktop bridge exposes only the
  latest log path, a bounded 256 KiB tail read, and an allowlisted log-folder
  opener. The Playtest bottom panel includes a Runtime Log tab, polls while
  the runtime is running, and browser mode reports native logs as unavailable.
- Phase 10 PT-001 (FRA-22) — desktop playtest launch now builds temporary
  project snapshots for project-start, current-map, and selected-event modes
  under the app data directory. Runtime launch uses the temp root as
  `current_dir` while executable lookup remains rooted at the source project,
  so the source project is not mutated and the bridge stays argument-free.
- Phase 10 RT-007 (FRA-21) — deterministic plugin command v1 adds the
  `pluginCommand` data shape with safe `pluginId`, `command`, and scalar
  `args`, editor key/value controls, map/common-event C++ parsing,
  allowlisted runtime dispatch for `debug.log`, `debug.setSwitch`, and
  `debug.setVariable`, plus non-fatal warnings for unknown commands. This is
  registry dispatch only, not scripting or arbitrary code execution.
- Phase 11 CP-037 (FRA-72) — deterministic plugin command registry v2 replaces
  the ad hoc debug command path with typed registry metadata. The editor offers
  registered `debug.log`, `debug.setSwitch`, and `debug.setVariable` commands
  with typed defaults, TypeScript and native validators enforce registered
  arg types plus switch/variable references, and `EventRunner` dispatches via
  a fixed local registry while unknown safe commands remain non-fatal.
- Phase 10 RT-006 (FRA-20) — native runtime audio v1 now routes
  `playSound` through `Game` instead of direct `EventRunner` logging.
  `platform/AudioSystem` owns the SDL audio boundary, exposes an injectable
  backend for tests, resolves deterministic local audio ids from defaults and
  project system data, starts default/map BGM requests, plays local WAVs when
  assets/devices exist, and logs warnings while continuing when optional audio
  is missing or unavailable.
- Phase 10 RT-003 (FRA-17) — native runtime movement routes now target the
  player, `thisEvent`, and named events. `MapScene` stores runtime event
  positions separately from authored map JSON, `Game` uses those positions for
  collision/render/event lookup, routes honor blocking, `through`,
  `skippable`, `wait`, and repeat guard behavior, and map transfers re-seed
  runtime event state from the new map.
- Phase 10 RT-004 (FRA-18) — entity snapshots now carry explicit render
  priority. `Game` derives event priority from active event pages with legacy
  fallback, `Renderer2D` draws below, same, and above buckets deterministically,
  and same-priority events interleave with the player by visual foot Y plus
  stable id tie-breaks.
- Phase 10 RT-005 (FRA-19) — runtime map rendering now uses explicit
  background and foreground passes. `MapScene` selects renderable visual layers
  by role, collision/region layers stay non-rendered gameplay/editor data, and
  `Game` draws background, below/same entities, foreground occluders,
  above-priority entities, then overlays.
- Phase 10 MVP-000 (FRA-5) — repository docs now lock the remaining MVP
  closeout scope against Linear issues FRA-6 through FRA-35, including
  Database V2, Runtime MZ foundation, Playtest/Debug tools, Integration QA,
  validation evidence, commit/push, and final reporting expectations.
- Phase 10 Slice 4B — Database V2 types/terms foundation: project data now
  includes `data/database/types.json` and `data/database/terms.json`; the
  TypeScript schema, browser/export/import adapters, desktop Tauri
  save/load, C++ `ProjectLoader`, and editor validation all preserve the new
  shards. Validation now rejects duplicate or unnamed type entries, missing
  default equipment slots, and missing required term labels.
- Phase 10 Slice 4A — Database V2 separated equipment/state foundation:
  weapons, armors, and states are first-class database tables with sample
  data, browser/Tauri round-trip support, validation for duplicate ids,
  editor CRUD tabs, and legacy item migration for older projects that still
  store equipment as item rows.
- Phase 10 Slice 3D command-stack range selection/delete — event command rows
  now have checkbox selection, shift-click range selection within the same
  command-list parent, toolbar and keyboard delete for selected ranges, and
  reducer-level `REMOVE_COMMAND_RANGE` / `REMOVE_PAGE_COMMAND_RANGE` actions
  that preserve page-1 legacy mirroring while no-oping cross-branch endpoints.
- Phase 10 Slice 3D movement-route basics — `setMovementRoute` is now a typed
  event command with editor controls, route-step validation, C++ map/common
  event parsing, `EventRunner` movement-route requests, and deterministic
  player-target execution through existing collision/facing rules. Player
  routes dispatch touch events at destination tiles and `wait: true` blocks
  the issuing runner before tail commands continue. Event-target movement and
  repeat-loop guard behavior were completed later by FRA-17 / RT-003.
- Phase 10 Slice 3D command stack v1 — event command editing now supports
  insert around selection, move up/down, duplicate, local cut/copy/paste,
  delete, and explicit empty branch targets for Then, Else, choice labels,
  Victory, and Defeat. Reducer coverage locks page-1 legacy mirroring and
  nested insertion into conditionals, choices, and battle branches.
- Phase 10 Slice 3C — deterministic scheduled events: `EventScheduler` now
  runs active-page map autorun/parallel events and switch-conditioned
  autorun/parallel common events in separate runner contexts; autorun blocks
  input while parallel waits do not; scheduled runners share runtime
  resolvers; common-event parsing covers self switches and animations; and
  scheduled map transfers preserve the transferring runner until its command
  tail completes.
- Phase 10 Slice 3B — runtime event page activation: C++ runtime now selects
  the active page from last to first by switch, variable, and self-switch
  conditions; `Game` uses active pages for interact/touch triggers, command
  execution, render graphic/animation metadata, collision priority, and
  `through`; inactive paged events do not render or override collision; and
  `EventRunner` executes `controlSelfSwitch` / `ifSelfSwitch` against the
  owning map/event scope captured at command-list start.
- Phase 10 Slice 3A — event page and self-switch foundation: `GameEvent`
  now supports normalized `pages`; the editor can add, update, reorder, and
  edit page-scoped commands; page conditions include self switches A-D; event
  command validation understands `controlSelfSwitch` and `ifSelfSwitch`; the
  C++ map loader accepts both legacy command lists and editor-authored page
  data; `GameState` and saves persist self switches. Runtime page activation
  and self-switch command execution remain the next open slice.
- Phase 10 Slice 2 — map authoring v2: tilesets are data-driven through
  `data/database/tilesets.json`; editor layers cover ground, decoration,
  foreground, collision, region, and events; layer visibility/lock controls
  are available in the palette; locked layers reject paint mutations; region
  painting and region overlays are active; passability overlays read tileset
  metadata; map/project validation detects missing layers, invalid regions,
  unsupported tiles, and unknown tilesets; Tauri and C++ loaders round-trip
  tileset database paths, map tileset ids, display names, and layer metadata.
- Phase 10 Slice 1 — editor shell map tree and professional map properties:
  map references now support `parentId`, `order`, and `expanded`; maps support
  display name, tileset, scroll, encounter, battleback, parallax, and layer
  role metadata; the editor has a visible map tree with create, duplicate,
  delete, reorder, expand/collapse, child map creation, and rename via
  double-click; placeholder controls for unreal AI/debug/event-page flows were
  removed until implemented.
- Phase 9 hotfix validation baseline — recorded validation for commit
  `13f6545` on the Phase 10 branch before starting Phase 10 work.
- Phase 9 hotfix — character sheets now render at `display.heightTiles`
  instead of padded tile interiors; runtime/editor both use bottom-center
  character anchoring; `playerMovementSpeed` and
  `defaultCharacterHeightTiles` are editable system data; event
  `displayHeightTiles` overrides are validated; editor playtest memoizes
  static SVG layers and starts/chains held movement without a dead frame.
- Phase 9 implementation slice — input now uses held movement in the
  native runtime and editor playtest preview; player rendering follows a
  transient interpolated position while GameState remains tile-based;
  animation sets are data-driven through `data/database/animations.json`;
  `playAnimation` commands are validated and applied by `Game`; generated
  player/NPC animation sheets, prompts, manifests, and preview GIFs are
  versioned.
- Slice 11 — end-to-end visual QA closeout with committed editor/runtime
  evidence, full-bleed visual tile regression coverage, corrected runtime
  screenshot tooling, final validation, and phase documentation.
- Slice 10 — runtime UX regression pass under the widescreen visual
  standard; existing inventory, party, quest, save/load, shop, and battle
  reward surfaces verified intact on the upgraded sample.
- Slice 9 — layer-aware map authoring with brush sizing, fill, rectangle,
  eraser, selected-tile preview, map resizing, and viewport preset controls.
- Slice 8 — runtime-like playtest framing, project-seeded preview state,
  and editor collision overlays that expose truth without replacing the
  authored visual layer.
- Slice 7 — runtime authored-blocker rendering, widened smoke traversal,
  and validated native widescreen scene playback on the upgraded sample.
- Slice 6 — reusable authored starter scenes, in-editor template application,
  and a bundled widescreen sample project replacing the old tiny-board
  default.
- Slice 5 — deterministic supplementary visual assets for authored scenes:
  snow, tree, interior surfaces, collision/void overlays, and shop/battle
  markers shared by editor and runtime.
- Slice 4 — explicit visual/collision tile validation, editor-side void
  treatment, and runtime nearest-neighbor tile rendering defaults.
- Slice 3 — editor scene-stage sizing, fit/100% controls, map bounds,
  camera rail, and viewport-frame overlays.
- Slice 2 — shared viewport helpers, project-driven runtime resolution,
  and clamped camera model.
- Slice 1 — visual source of truth, QA rubric, phase reset, and
  backward-compatible project visual profile. Commits `38926b9`,
  `2135017`.
- Phase 7 — Polished creator-to-player loop — DONE (`f951dd6`).
- Phase 6 — Complete RPG Creation System Foundation — DONE (`a12efa8`).
- Slice 0 — original asset foundation (generated atlases, editor assets,
  runtime sprites, emoji replacement). Commit `0012eca`.
- Slice 1 — runtime pause / main menu skeleton (menu state machine wired
  into `Game`, HUD/menu rendering, keyboard navigation tests). Commit
  `0012eca`.
- Slice 2 — runtime inventory / party / quest views (real item
  descriptions plus render-ready menu snapshots). Commit `19c1c6c`.
- Slice 3 — save/load slot picker metadata (centralized `SaveManager`
  slot listing consumed by the runtime menu). Commit `19c1c6c`.
- Slice 4 — shop UI (modal buy flow, gold checks, owned counts, runtime
  rendering). Commit `0681487`.
- Slice 5 — battle result UI (summary handoff, paused event continuation,
  reward screen). Commit `0681487`.
- Slice 6 — undo / redo history (toolbar buttons + keyboard shortcuts,
  paint / drag stroke coalescing). Commits `332a73f`, `98a31a8`.
- Slice 7 — map tile and collision painting (palette-driven brush workflow).
  Commit `332a73f`.
- Slice 8 — event placement, drag/move, duplicate, delete, `Ctrl+D`,
  and confirmation prompts. Commits `332a73f`, `98a31a8`.
- Slice 9 — editor → save → runtime round-trip QA, native screenshots,
  and live browser verification. Commit `98a31a8`.
- Slice 10 — final validation, docs, phase report, and clean handoff.
  Closed by the phase-completion commit.
- Slice 1 — data model expansion (schemas, types, JSON files, validators,
  Rust shell round-trip, vitest + cargo coverage). Commit `7936b8f`.
- Slice 2 — Database editor screen with tabs, CRUD, dirty tracking.
  Commit `7936b8f`.
- Slice 3 — runtime event command system v1 (24 commands). Commit
  `46d2726`.
- Slice 4 — typed switches/variables, ifSwitch/ifVariable, showChoices.
  Commit `46d2726`.
- Slice 5 — quest system runtime + save/load + idempotency. Commit
  `46d2726`.
- Slice 6 — gold + party + actor HP + inventory remove. Commit `46d2726`.
- Slice 7 — runtime DB loader, equipment stat modifiers in battle.
  Commit `d4fec32`.
- Slice 8 — battle system v1 (deterministic, formula tested, rewards).
  Commit `d4fec32`.
- Slice 9 — shops (data round-trip + dialogue-stub runtime). Commit
  `d4fec32`.
- Slice 10 — sample town/house exercising every v1 command. Commit
  `6c27308`.
- Slice 11 — Phase 6 final validation + reporting. Commit `a12efa8`.

## Closed subgoals from previous phases

- Phase 5: Desktop shell + filesystem + runtime bridge — DONE (`6665220`).
- Phase 4.1: Validation hardening — DONE (`3303cab`).
- Phase 4: Editor persistence + runtime bridge — DONE (`da0b7bc`).
- Phase 3: Visual editor MVP — DONE (`4493309`).
- Phase 2: Visible playable RPG runtime — DONE (`148dc13`).
- Phase 1: Bootstrap — DONE (`41273a8`).

## Persistence rule

This file is the source of truth for the active phase. It is updated at
each slice boundary, **not** based on chat memory.
