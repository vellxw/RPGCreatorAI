# Phase 11 AI Item Icon Generation Workflow

Issue: CP-068 / FRA-103
Date: 2026-06-02

## Result

RPGCreatorAI now has an offline, review-gated item icon generation workflow
for item, weapon, and armor database records. The workflow creates generated
icon candidates through the provider abstraction using the local
`offline-image-mock` fixture, stores the output as a pending catalog asset,
and assigns `iconAssetId` to the database record only after explicit user
review.

No live provider call, credential lookup, network request, paid API, native
runtime dependency, or runtime asset loading change was added.

## Workflow

The Database item/equipment surfaces now support:

- `Generate item icon`
- `Generate weapon icon`
- `Generate armor icon`
- editable generation metadata for subject, use case, palette, and style notes
- a metadata preview before generation
- `Run ... icon generation`, which renders `icon-item-v1` through the local
  mock provider
- a pending review candidate with QA dimensions and mock asset ref
- `Discard generated ... icon`
- `Accept generated ... icon`

Until the user accepts the pending draft, neither the asset catalog nor the
item/equipment database entry is mutated. Acceptance records a reviewed
generated image asset and assigns the accepted asset id through `iconAssetId`.

## Validation Boundary

`src/providers/itemIconGenerationWorkflow.ts` validates:

- owner kind, id, and name
- required prompt inputs
- prompt-template provenance
- provider/model ids from the offline image mock
- generated asset kind/source
- generated icon dimensions against the QA preview
- pending vs approved review state

Accepted assets use project-relative paths under `assets/generated/icons/`
and store generated provenance metadata. The normal path never stores API
keys, endpoints, account ids, tokens, live responses, or secrets.

## Editor Integration

`src/components/database/ItemIconGenerationPanel.tsx` owns the local draft,
candidate, and review UI state. `ItemsEditor` and `EquipmentEditor` pass
accepted generated assets back to `DatabaseScreen`, which owns project
mutation through existing reducer actions:

- `ADD_ASSET_CATALOG_ENTRY`
- `UPDATE_ITEM_DATABASE`
- `UPDATE_DATABASE_ENTRY`

`ItemData`, `WeaponData`, and `ArmorData` now have optional `iconAssetId`
fields. Project validation checks that icon references point to existing
image/generated catalog assets, and the reference index records item, weapon,
and armor icon asset references for delete/rename/repair safety.

## Evidence

Focused TDD and workflow coverage:

```powershell
npm test -- --run src/providers/__tests__/itemIconGenerationWorkflow.test.ts src/components/database/__tests__/ItemEquipmentEditors.test.tsx src/validation/__tests__/validateProject.test.ts
```

Result: PASS, 3 files and 51 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full frontend suite:

```powershell
npm test -- --run
```

Result: PASS, 78 files and 416 tests.

Production frontend build:

```powershell
npm run build
```

Result: PASS, 1947 modules transformed with the known non-fatal Vite
chunk-size warning.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\providers\itemIconGenerationWorkflow.ts src\providers\__tests__\itemIconGenerationWorkflow.test.ts src\components\database\ItemIconGenerationPanel.tsx src\components\database\ItemsEditor.tsx src\components\database\EquipmentEditor.tsx src\components\database\__tests__\ItemEquipmentEditors.test.tsx src\validation\validateProject.ts src\validation\referenceIndex.ts
```

Result: PASS for CP-068 scope; the only finding was a test assertion that
checks generated requests do not contain `apiKey`, `https://api`, or `sk-`.

Browser smoke with the in-app Browser:

- loaded `http://127.0.0.1:3003/`
- clicked `Use My First RPG`
- opened Database -> Items
- opened `Generate item icon`
- ran offline item icon generation
- confirmed pending review was visible before mutation
- accepted the generated icon
- confirmed `Potion Icon (potion_icon)` was selected in `Item icon asset`
- clicked `Validate`
- confirmed `Validation passed`

## Known Limits

The workflow is intentionally mock-backed for normal validation. It does not
write generated image bytes to disk, call live providers, select paid models,
or alter the native runtime. Future issues can add portraits, animations,
edits/variations, and visual QA scoring using the same review-gated pattern.
