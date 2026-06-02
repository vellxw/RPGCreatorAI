# Phase 11 Character Animation QA Review

Issue: CP-079 / FRA-114
Date: 2026-06-02

## Result

Generated character sprite sheet candidates now require an explicit character
animation QA decision before they can enter project animation data. The review
surface shows preview evidence, generated metadata, clip coverage, runtime
compatibility status, and reviewer notes. Accepted candidates store animation
QA metadata on the generated asset, mark the asset runtime-compatible for the
editor validation contract, and keep the existing visual QA metadata. Rejected
candidates keep rejection notes in candidate metadata and do not mutate project
data.

No live AI call, credential lookup, network request, paid API, native runtime
dependency, or runtime AI dependency was added.

## Workflow Contract

1. Sprite sheet generation still produces a pending local mock candidate.
2. The generated sprite sheet review now includes `Character animation QA`.
3. Required checks cover preview evidence, manifest metadata, animation-set
   clip coverage, and runtime-exportable sheet metadata.
4. `Accept generated sprite sheet` remains disabled until character animation
   QA is accepted.
5. Rejection requires reviewer notes and keeps the rejected candidate out of
   project data.
6. Accepted generated assets store `generated.animationQa`, add
   `animation-qa-reviewed`, and preserve visual QA metadata on final import.
7. System player animation set options disable animation sets that reference a
   generated asset rejected by character animation QA.
8. Project validation rejects a `system.playerAnimationSet` that uses a
   rejected character animation QA asset, even if the data is imported or
   edited outside the UI.

## Code Changes

CP-079 adds:

- `src/providers/generatedAnimationQa.ts`
- character animation QA metadata types in `src/types/project.ts`
- character animation QA review UI in `SpriteSheetGenerationPanel`
- disabled select options in shared database fields
- failed-QA player animation assignment guard in `SystemEditor` and
  `DatabaseScreen`
- validator errors for rejected QA assets assigned to the runtime-critical
  player animation slot
- focused UI and validator coverage for accept, reject, and invalid assignment
  prevention

## Evidence

TDD red step:

```powershell
npm test -- --run src/components/database/__tests__/AnimationsEditor.test.tsx src/components/database/__tests__/SetupProgressionEditors.test.tsx src/validation/__tests__/validateDatabases.test.ts
```

Result: FAIL before implementation. The character animation QA panel, notes
textarea, blocked animation-set options, and validation error did not exist.

Focused CP-079 behavior:

```powershell
npm test -- --run src/components/database/__tests__/AnimationsEditor.test.tsx src/components/database/__tests__/SetupProgressionEditors.test.tsx src/validation/__tests__/validateDatabases.test.ts
```

Result: PASS, 3 files and 39 tests.

Frontend validation:

```powershell
npm run typecheck
npm test -- --run
npm run build
```

Result: PASS. TypeScript passed. Full Vitest passed 84 files and 453 tests.
Production build completed with 1958 modules transformed and the known
non-fatal Vite chunk-size warning.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\providers\generatedAnimationQa.ts src\components\database\SpriteSheetGenerationPanel.tsx src\components\database\SystemEditor.tsx src\screens\DatabaseScreen.tsx src\validation\validateProject.ts src\components\database\__tests__\AnimationsEditor.test.tsx src\components\database\__tests__\SetupProgressionEditors.test.tsx src\validation\__tests__\validateDatabases.test.ts
```

Result: PASS for CP-079 scope; no matches.

Browser/CLI smoke:

- Browser plugin loaded `http://127.0.0.1:3003/`, opened the bundled sample,
  and reached the editor before its CDP locator/screenshot commands began
  timing out.
- `npx --yes @playwright/cli -s=cp079` completed the local smoke against the
  same dev server: opened the bundled sample, entered Database > Animations,
  opened sprite sheet generation, ran the offline mock generation, confirmed
  `Character animation QA`, confirmed `Runtime compatibility`, confirmed
  `Accept generated sprite sheet` was disabled before animation QA approval,
  clicked `Accept character animation QA`, and confirmed the final accept
  button became enabled.

## Known Limits

The QA decision is editor/tooling metadata. Rejected candidates remain local to
the review session unless a future asset-history feature stores rejected
candidates outside project runtime data. Runtime asset export remains handled by
the existing CP-078 generated-character BMP export workflow.
