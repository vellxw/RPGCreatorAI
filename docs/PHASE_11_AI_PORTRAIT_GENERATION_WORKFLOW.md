# Phase 11 AI Portrait Generation Workflow

Issue: CP-069 / FRA-104
Date: 2026-06-02

## Result

RPGCreatorAI now has an offline, review-gated portrait generation workflow
for actor database records and map event NPC metadata. The workflow builds
portrait candidates from local actor/event context, routes generation through
the provider abstraction using the local `offline-image-mock` fixture, stores
accepted output as project-owned generated image assets, and assigns portrait
references only after explicit user review.

No live provider call, credential lookup, network request, paid API, native
runtime dependency, or runtime asset loading change was added.

## Workflow

The actor and event editor surfaces now support:

- `Generate actor portrait`
- `Generate event portrait`
- editable generation metadata for subject, use case, palette, and style notes
- a metadata preview before generation
- `Run ... portrait generation`, which renders `portrait-character-v1`
  through the local mock provider
- a pending review candidate with QA dimensions and mock asset ref
- `Discard generated ... portrait`
- `Accept generated ... portrait`

Until the user accepts the pending draft, neither the asset catalog nor the
actor/event metadata is mutated. Acceptance records a reviewed generated image
asset and assigns the accepted asset id through `portraitAssetId`.

## Validation Boundary

`src/providers/portraitGenerationWorkflow.ts` validates:

- owner kind, id, and name
- required prompt inputs
- prompt-template provenance
- provider/model ids from the offline image mock
- generated asset kind/source
- generated portrait dimensions against the QA preview
- pending vs approved review state

Accepted assets use project-relative paths under `assets/generated/portraits/`
and store generated provenance metadata. The normal path never stores API
keys, endpoints, account ids, tokens, live responses, or secrets.

## Editor Integration

`src/components/database/PortraitGenerationPanel.tsx` owns the local draft,
candidate, and review UI state. `ActorsEditor` and `EventEditorScreen` pass
accepted generated assets back to the project reducer through existing
project mutation actions:

- `ADD_ASSET_CATALOG_ENTRY`
- `UPDATE_ACTOR_DATABASE`
- `UPDATE_EVENT`

`ActorData` and `GameEvent` now have optional `portraitAssetId` fields.
Project validation checks that portrait references point to existing
image/generated catalog assets, and the reference index records actor and
event portrait asset references for rename/delete/repair safety.

## Evidence

Focused TDD and workflow coverage:

```powershell
npm test -- --run src/providers/__tests__/portraitGenerationWorkflow.test.ts src/components/database/__tests__/PartyCombatEditors.test.tsx src/screens/__tests__/EventEditorSurface.test.tsx src/validation/__tests__/validateProject.test.ts
```

Result: PASS, 4 files and 59 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full frontend suite:

```powershell
npm test -- --run
```

Result: PASS, 79 files and 423 tests.

Production frontend build:

```powershell
npm run build
```

Result: PASS, 1949 modules transformed with the known non-fatal Vite
chunk-size warning.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\providers\portraitGenerationWorkflow.ts src\providers\__tests__\portraitGenerationWorkflow.test.ts src\components\database\PortraitGenerationPanel.tsx src\components\database\ActorsEditor.tsx src\screens\EventEditorScreen.tsx src\components\database\__tests__\PartyCombatEditors.test.tsx src\screens\__tests__\EventEditorSurface.test.tsx src\validation\validateProject.ts src\validation\referenceIndex.ts
```

Result: PASS for CP-069 scope; the only finding was a test assertion that
checks generated requests do not contain `apiKey`, `https://api`, or `sk-`.

Browser smoke with the in-app Browser:

- loaded `http://127.0.0.1:3003/`
- clicked `Use My First RPG`
- opened Events
- selected the `old_man` event
- opened `Generate event portrait`
- ran offline event portrait generation
- confirmed pending review was visible before mutation
- accepted the generated portrait
- confirmed `old_man Portrait (old_man_portrait)` was selected in
  `Portrait asset`
- clicked `Validate`
- confirmed the validation panel reported no errors

## Known Limits

The workflow is intentionally mock-backed for normal validation. It does not
write generated image bytes to disk, call live providers, select paid models,
or alter the native runtime. Future issues can add animation sheets,
variations, edit passes, and visual QA scoring using the same review-gated
pattern.
