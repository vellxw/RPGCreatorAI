# Phase 11 Character Concept Generator

Issue: CP-073 / FRA-108
Date: 2026-06-02

## Result

The editor can now generate reviewed character concept candidates for actors
and map events. Concepts are created through the local offline image mock,
stored as pending generated asset candidates with owner provenance, and only
assigned to actors or events after explicit visual QA review and acceptance.

No live AI call, credential lookup, network request, paid API, native runtime
dependency, or runtime AI dependency was added.

## Workflow Contract

1. Actor and event editors expose a concept asset selector separate from
   portraits.
2. Opening concept generation builds a metadata-first draft from the selected
   actor or event plus the user's editable prompt fields.
3. The `character-concept-v1` prompt template renders project visual context
   into a provider request for `image.generate`.
4. Normal validation uses `offline-image-mock`; the request contains no API
   key, live endpoint, or secret-looking value.
5. Generated concepts remain pending candidates tagged with `pending-review`
   and owner metadata.
6. Visual QA review is required before assignment.
7. Accepting a candidate imports it into the asset catalog, stamps review/QA
   metadata, and assigns `conceptAssetId` to the actor or event.
8. Rejecting or discarding a candidate does not mutate project data.

## Code Changes

CP-073 adds:

- `src/providers/characterConceptGenerationWorkflow.ts`
- `src/components/database/CharacterConceptGenerationPanel.tsx`
- `conceptAssetId` on `ActorData` and `GameEvent`
- `ownerKind`, `ownerId`, and `ownerName` generated asset metadata fields
- `character-concept-v1` in the image prompt template library
- actor concept controls in `ActorsEditor`
- event concept controls in `EventEditorScreen`
- frontend validation for actor/event character concept asset references
- reference index rename/repair coverage for actor/event concept assets

The workflow stores accepted generated concepts under:

```text
assets/generated/concepts/{assetId}.png
```

Accepted concepts remain ordinary catalog image assets. Portrait or sprite
generation can use them later as reviewed source material without destructive
writes.

## Evidence

TDD red step:

```powershell
npm test -- --run src/providers/__tests__/characterConceptGenerationWorkflow.test.ts src/components/database/__tests__/PartyCombatEditors.test.tsx src/screens/__tests__/EventEditorSurface.test.tsx src/validation/__tests__/validateProject.test.ts
```

Result: FAIL before implementation. The provider workflow module did not
exist, actor/event concept generation buttons were absent, and validation did
not catch `conceptAssetId` references.

Focused CP-073 behavior:

```powershell
npm test -- --run src/providers/__tests__/characterConceptGenerationWorkflow.test.ts src/components/database/__tests__/PartyCombatEditors.test.tsx src/screens/__tests__/EventEditorSurface.test.tsx src/validation/__tests__/validateProject.test.ts
```

Result: PASS, 4 files and 60 tests.

Reference index coverage:

```powershell
npm test -- --run src/validation/__tests__/referenceIndex.test.ts
```

Result: PASS, 1 file and 5 tests.

Expanded CP-073 focus:

```powershell
npm test -- --run src/providers/__tests__/characterConceptGenerationWorkflow.test.ts src/providers/__tests__/imagePromptTemplates.test.ts src/components/database/__tests__/PartyCombatEditors.test.tsx src/screens/__tests__/EventEditorSurface.test.tsx src/validation/__tests__/validateProject.test.ts src/validation/__tests__/referenceIndex.test.ts
```

Result: PASS, 6 files and 70 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS after aligning the character concept workflow with the existing
`ProviderAdapterResponse.error` string type.

Full frontend suite:

```powershell
npm test -- --run
```

Result: PASS, 83 files and 442 tests.

Production frontend build:

```powershell
npm run build
```

Result: PASS, 1955 modules transformed with the known non-fatal Vite
chunk-size warning.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\providers\characterConceptGenerationWorkflow.ts src\providers\__tests__\characterConceptGenerationWorkflow.test.ts src\components\database\CharacterConceptGenerationPanel.tsx src\components\database\ActorsEditor.tsx src\screens\EventEditorScreen.tsx src\components\database\__tests__\PartyCombatEditors.test.tsx src\screens\__tests__\EventEditorSurface.test.tsx src\validation\validateProject.ts src\validation\referenceIndex.ts src\types\project.ts src\providers\imagePromptTemplates.ts src\providers\__tests__\imagePromptTemplates.test.ts
```

Result: PASS for CP-073 scope. Matches were test assertions that reject
`apiKey`, `https://api`, and `sk-` in generated requests; no live call path or
secret value was added.

Browser smoke with the in-app Browser:

- loaded `http://127.0.0.1:3003/`
- clicked `Use My First RPG`
- opened Database
- confirmed `Actor concept asset` and `Generate actor character concept`
- opened the actor concept generation form
- clicked `Run actor character concept generation`
- confirmed `Generated actor character concept review` and `Visual QA
  checklist`
- confirmed the actor concept selector stayed `(none)` while the candidate was
  pending
- clicked `Accept generated actor character concept`
- confirmed `Arc Concept (arc_concept)` was added and selected
- clicked `Validate`
- confirmed toolbar feedback reported `Validation passed`
- opened Events and confirmed `Event character concept generation` plus
  `Generate event character concept`
- confirmed 0 browser warnings/errors

## Known Limits

Character concept generation remains mock-backed for normal validation. It
creates reviewed concept image candidates only; portrait and sprite seeding are
future workflows. The native runtime is unchanged and still consumes only local
project data.

## Next

CP-074 can build animation/sprite generation on top of reviewed character
concept assets.
