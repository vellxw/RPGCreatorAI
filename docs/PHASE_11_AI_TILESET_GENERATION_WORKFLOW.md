# Phase 11 AI Tileset Generation Workflow

Issue: CP-067 / FRA-102
Date: 2026-06-02

## Result

RPGCreatorAI now has an offline, review-gated tileset generation workflow in
the Tilesets database editor. The workflow creates generated draft candidates
through the provider abstraction using the local `offline-image-mock` fixture,
routes accepted output into the asset catalog, and adds editable tileset
database records only after explicit user review.

No live provider call, credential lookup, network request, paid API, native
runtime dependency, or runtime asset loading change was added.

## Workflow

The Database -> Tilesets surface now supports:

- `Generate draft tileset`
- editable generation metadata: id, name, tile size, columns, tile count,
  default passability, foreground split, region markers, subject, use case,
  palette, and style notes
- a metadata preview before generation
- `Run tileset generation`, which renders `tileset-rpg-map-v1` through the
  local mock provider
- a pending review candidate with QA dimensions, tile size, and mock asset ref
- `Discard generated tileset`
- `Accept generated tileset`

Until the user accepts the pending draft, neither the asset catalog nor the
tileset database is mutated. Acceptance records a reviewed generated tileset
asset and appends an editable tileset with per-tile metadata.

## Validation Boundary

`src/providers/tilesetGenerationWorkflow.ts` validates:

- draft id/name/tile size/columns/tile count
- prompt-template provenance
- provider/model ids from the offline image mock
- generated asset dimensions
- tile grid alignment
- tile metadata count and asset references
- pending vs approved review state

Accepted assets use project-relative paths under
`assets/generated/tilesets/` and store generated provenance metadata. The
normal path never stores API keys, endpoints, account ids, tokens, live
responses, or secrets.

## Editor Integration

`src/components/database/TilesetEditor.tsx` owns the local UI state for draft
generation and review. `src/screens/DatabaseScreen.tsx` still owns project
mutation through existing reducer actions:

- `ADD_ASSET_CATALOG_ENTRY`
- `UPDATE_TILESET_DATABASE`

The toolbar validation path was also fixed to pass `projectState.assets` into
`validateProject()`. Without that asset catalog input, accepted generated
tileset tile references were correctly present in project state but were
reported as unknown in the toolbar feedback.

## Evidence

Focused TDD and workflow coverage:

```powershell
npm test -- --run src/providers/__tests__/tilesetGenerationWorkflow.test.ts src/components/database/__tests__/TilesetEditor.test.tsx src/components/layout/__tests__/TopToolbarSaveFlow.test.tsx src/adapters/__tests__/tilesetImport.test.ts src/validation/__tests__/validateProject.test.ts src/stores/__tests__/assetCatalogReducer.test.ts
```

Result: PASS, 6 files and 56 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full frontend suite:

```powershell
npm test -- --run
```

Result: PASS, 77 files and 409 tests.

Production frontend build:

```powershell
npm run build
```

Result: PASS, 1945 modules transformed with the known non-fatal Vite
chunk-size warning.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\providers\tilesetGenerationWorkflow.ts src\providers\__tests__\tilesetGenerationWorkflow.test.ts src\components\database\TilesetEditor.tsx src\components\database\__tests__\TilesetEditor.test.tsx src\components\layout\TopToolbar.tsx src\components\layout\__tests__\TopToolbarSaveFlow.test.tsx
```

Result: PASS for CP-067 scope; the only finding was a test assertion that
checks generated requests do not contain `apiKey`, `https://api`, or `sk-`.

Browser smoke with Chrome DevTools MCP:

- loaded the bundled sample
- opened Database -> Tilesets
- opened `Generate draft tileset`
- confirmed the metadata preview
- ran offline tileset generation
- confirmed pending review without project mutation
- accepted the generated tileset
- confirmed the new tileset was editable
- clicked `Validate`
- confirmed toolbar feedback reported `Validation passed`
- confirmed no XHR/fetch/WebSocket/EventSource requests

Snapshot evidence:

- `docs/screenshots/phase11-cp067/tileset-generation-draft-panel.snapshot.txt`
- `docs/screenshots/phase11-cp067/tileset-generation-pending-review.snapshot.txt`
- `docs/screenshots/phase11-cp067/tileset-generation-validation-passed.snapshot.txt`

Chrome reported existing accessibility issues around unlabeled form fields in
the dense tileset editor surface. It reported no runtime console errors or
warnings for the generated tileset workflow.

## Known Limits

The workflow is intentionally mock-backed for normal validation. It does not
write generated image bytes to disk, call live providers, select paid models,
or alter the native runtime. Future issues can add item icons, portraits,
edits/variations, and visual QA scoring using the same review-gated pattern.
