# Phase 11 Sprite Sheet Generation Pipeline

Issue: CP-074 / FRA-109
Date: 2026-06-02

## Result

The editor can now generate reviewed character sprite sheet candidates through
the provider pipeline. The workflow builds a prompt-backed mock image request,
records source concept/reference provenance, validates frame metadata before
approval, and only inserts the generated `spritesheet` asset plus animation set
after explicit visual QA acceptance.

No live AI call, credential lookup, network request, paid API, native runtime
dependency, or runtime AI dependency was added.

## Workflow Contract

1. The Animations database tab exposes optional sprite sheet generation.
2. Generation can use a reviewed character concept asset as source direction.
3. The `character-spritesheet-v1` prompt template renders the source concept,
   frame layout, transparent-background requirement, and project visual rules.
4. Normal validation uses the local `offline-image-mock` provider.
5. Candidates are generated as pending `spritesheet` assets with frame
   metadata, source concept links, reference asset ids, owner provenance, and
   `pending-review`.
6. Candidate validation checks dimensions, frame boundaries, transparency
   review metadata, frame count, clip metadata, anchors, and animation set
   asset references before approval.
7. Accepting a candidate stamps review and visual QA metadata, imports the
   asset into the catalog, and adds the generated animation set.
8. Rejecting or discarding a candidate does not mutate project data.

## Code Changes

CP-074 adds:

- `src/providers/spriteSheetGenerationWorkflow.ts`
- `src/components/database/SpriteSheetGenerationPanel.tsx`
- `character-spritesheet-v1` in the image prompt template library
- generated sprite sheet manifest metadata on generated asset provenance
- sprite sheet generation controls in `AnimationsEditor`
- focused provider, UI, prompt-template, and project validation coverage

Generated sprite sheets are stored as catalog candidates under:

```text
assets/generated/spritesheets/{assetId}.png
```

Accepted sprite sheets enter project data as ordinary catalog assets with
`kind: "spritesheet"` and a generated animation set whose first clip references
that asset.

## Evidence

TDD red step:

```powershell
npm test -- --run src/providers/__tests__/spriteSheetGenerationWorkflow.test.ts src/providers/__tests__/imagePromptTemplates.test.ts src/components/database/__tests__/AnimationsEditor.test.tsx src/validation/__tests__/validateProject.test.ts
```

Result: FAIL before implementation. The sprite sheet workflow module did not
exist, `character-spritesheet-v1` was missing, and Animations had no
`Generate sprite sheet` action.

Focused CP-074 behavior:

```powershell
npm test -- --run src/providers/__tests__/spriteSheetGenerationWorkflow.test.ts src/providers/__tests__/imagePromptTemplates.test.ts src/components/database/__tests__/AnimationsEditor.test.tsx src/validation/__tests__/validateProject.test.ts
```

Result: PASS, 4 files and 58 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS after fixing the invalid-fixture manifest typing in the new
workflow test.

Full frontend suite:

```powershell
npm test -- --run
```

Result: PASS, 84 files and 447 tests.

Production frontend build:

```powershell
npm run build
```

Result: PASS, 1957 modules transformed with the known non-fatal Vite
chunk-size warning.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\providers\spriteSheetGenerationWorkflow.ts src\providers\__tests__\spriteSheetGenerationWorkflow.test.ts src\components\database\SpriteSheetGenerationPanel.tsx src\components\database\AnimationsEditor.tsx src\components\database\__tests__\AnimationsEditor.test.tsx src\providers\imagePromptTemplates.ts src\providers\__tests__\imagePromptTemplates.test.ts src\types\project.ts src\validation\__tests__\validateProject.test.ts
```

Result: PASS for CP-074 scope. Matches were only test assertions that reject
`apiKey`, `https://api`, and `sk-` in generated requests.

Browser smoke with the in-app Browser:

- loaded `http://127.0.0.1:3003/`
- clicked `Use My First RPG`
- opened Database
- generated and accepted `Arc Concept (arc_concept)` as a reviewed source
  concept
- opened the Animations database tab
- confirmed `Sprite sheet generation`
- opened `Generate sprite sheet`
- confirmed `Arc Concept (arc_concept)` was selected as source concept
- confirmed `Sprite sheet generation metadata preview`
- clicked `Run sprite sheet generation`
- confirmed `Generated sprite sheet review` and `Visual QA checklist`
- clicked `Accept generated sprite sheet`
- confirmed `arc_sprite` was added as the fourth animation set
- confirmed the clip selected `Arc Sprite Sheet (arc_sprite_sheet)`
- clicked `Validate`
- confirmed toolbar feedback reported `Validation passed`
- confirmed 0 browser warnings/errors

## Known Limits

Normal validation remains mock-backed. Browser smoke does not write a real PNG
for `mock://generated/...`, so the animation preview can show `Missing asset`
after acceptance even though the catalog asset and animation set references are
valid. Runtime export and real generated bitmap materialization remain later
pipeline work.

## Next

CP-075 can build richer animation clip generation or animation database
expansion on top of reviewed sprite sheet assets.
