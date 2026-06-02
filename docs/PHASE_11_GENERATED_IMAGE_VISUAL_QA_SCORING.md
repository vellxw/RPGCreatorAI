# Phase 11 Generated Image Visual QA Scoring

Issue: CP-071 / FRA-106
Date: 2026-06-02

## Result

Generated image candidates now pass through a local visual QA review surface
before entering project data. The review captures rubric checks, score,
unresolved warnings, reviewer notes, tags, and rejection reasons, then stores
the finalized result in generated asset metadata on acceptance or rejection.

No live provider call, credential lookup, network request, paid API, native
runtime dependency, or destructive asset overwrite was added.

## Rubric

The visual QA draft evaluates generated image candidates against:

- dimensions
- transparency
- style consistency
- readability
- runtime suitability

Each check has a `pass`, `warning`, or `fail` status plus editable notes.
Dimensions are checked against the generated candidate preview. Transparency,
style consistency, readability, and runtime suitability remain explicit manual
review warnings until the reviewer resolves or accepts them.

## Review Surface

The shared `GeneratedImageVisualQaReviewPanel` is used by generated asset
entry points for:

- image edit and variation candidates in Assets
- generated item and equipment icons
- generated portraits for actors and events
- generated tileset drafts

Accepting a candidate finalizes the QA result with status `accepted`, stores it
under `asset.generated.visualQa`, adds QA tags to the catalog asset, and then
performs the existing catalog or assignment mutation. Rejecting a candidate
finalizes status `rejected` with rejection metadata and leaves project catalog
data unchanged.

## Metadata

`GeneratedAssetMetadata` now includes an optional `visualQa` field containing:

- reviewer id
- reviewed timestamp
- overall status
- numeric score
- rubric check results
- unresolved warnings
- notes
- tags
- optional rejection reason

This keeps generated visual review evidence with the asset manifest without
adding provider credentials or runtime dependencies.

## Evidence

TDD red step:

```powershell
npm test -- --run src/providers/__tests__/generatedImageVisualQa.test.ts src/screens/__tests__/AssetsScreen.test.tsx
```

Result: FAIL as expected before implementation. The visual QA provider module
and Assets review controls did not exist yet.

Focused QA and Assets coverage:

```powershell
npm test -- --run src/providers/__tests__/generatedImageVisualQa.test.ts src/screens/__tests__/AssetsScreen.test.tsx
```

Result: PASS, 2 files and 12 tests.

Cross-workflow generated image coverage:

```powershell
npm test -- --run src/providers/__tests__/generatedImageVisualQa.test.ts src/screens/__tests__/AssetsScreen.test.tsx src/components/database/__tests__/ItemEquipmentEditors.test.tsx src/components/database/__tests__/PartyCombatEditors.test.tsx src/components/database/__tests__/TilesetEditor.test.tsx
```

Result: PASS, 5 files and 32 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full frontend suite:

```powershell
npm test -- --run
```

Result: PASS, 81 files and 435 tests.

Production frontend build:

```powershell
npm run build
```

Result: PASS, 1953 modules transformed with the known non-fatal Vite
chunk-size warning.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\providers\generatedImageVisualQa.ts src\providers\__tests__\generatedImageVisualQa.test.ts src\components\assets\GeneratedImageVisualQaReviewPanel.tsx src\components\assets\ImageEditVariationPanel.tsx src\components\database\ItemIconGenerationPanel.tsx src\components\database\PortraitGenerationPanel.tsx src\components\database\TilesetEditor.tsx src\screens\__tests__\AssetsScreen.test.tsx src\types\project.ts
```

Result: PASS for CP-071 scope; no matches.

Browser smoke with the in-app Browser:

- loaded `http://127.0.0.1:3003/`
- clicked `Use My First RPG`
- opened Assets
- clicked `Run image variation`
- confirmed `Generated image variation review`
- confirmed `Visual QA checklist`, score, and unresolved QA warnings before
  acceptance
- accepted the candidate
- confirmed `Player Adventurer Sheet Variation` was added as the sixth catalog
  asset with generated metadata
- clicked `Validate`
- confirmed toolbar feedback reported `Validation passed`
- confirmed 0 console warnings/errors

## Known Limits

The scoring is intentionally a reviewer-facing local rubric. It does not
perform computer vision, image byte analysis, live provider diagnostics, or
runtime export normalization. Those can be added later while preserving the
same review-gated metadata contract.
