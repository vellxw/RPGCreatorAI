# Phase 11 Animation Coverage Validator

Issue: CP-076 / FRA-111
Date: 2026-06-02

## Result

RPGCreatorAI now validates required direction/action coverage for character
animation sets before save or playtest through the existing project validation
gate. The validator remains editor/tooling-only and does not change native
runtime loading behavior.

No live AI call, credential lookup, network request, paid API, native runtime
dependency, or runtime AI dependency was added.

## Coverage Policy

Coverage is determined from deterministic animation set ids and the configured
player animation set:

- player set: `system.playerAnimationSet`, or `player_adventurer` fallback
- NPC sets: ids beginning with `npc_` or `npc-`
- enemy sets: ids beginning with `enemy_` or `enemy-`

Required coverage:

- player: `idle`, `walk`, `interact`, `attack`, `hurt`, and `death` for
  `down`, `left`, `right`, and `up`
- NPC: `idle` and `walk` for `down`, `left`, `right`, and `up`
- enemy: `idle`, `attack`, `hurt`, and `death` for `down`, `left`, `right`,
  and `up`

A clip with direction `any` satisfies the required action for every direction.
Coverage gaps are warnings so authors see them in the editor validation panel
before save/playtest without changing existing save semantics.

## Runtime Compatibility Checks

Animation clips that reference catalog spritesheets now also validate:

- the asset is not marked `runtimeCompatible: false`
- the source extension is runtime-exportable (`.png`, `.jpg`, `.jpeg`,
  `.bmp`, or `.webp`)
- sheet width equals `frameWidth * frames` when width metadata exists
- sheet height equals `frameHeight` when height metadata exists

Existing frame width/height/count, FPS, anchor, and catalog reference checks
remain active.

## Evidence

TDD red step:

```powershell
npm test -- --run src/validation/__tests__/validateDatabases.test.ts
```

Result: FAIL before implementation. The validator did not require player
`interact` coverage, did not classify NPC/enemy coverage, and did not reject
malformed/runtime-incompatible spritesheet metadata.

Focused CP-076 validation:

```powershell
npm test -- --run src/validation/__tests__/validateDatabases.test.ts
```

Result: PASS, 25 tests.

Nearby frontend validation:

```powershell
npm run typecheck
npm test -- --run src/validation/__tests__/validateProject.test.ts src/components/database/__tests__/AnimationsEditor.test.tsx src/assets/generated/__tests__/assetCatalog.test.ts
```

Result: PASS; typecheck passed and nearby suites passed 3 files / 55 tests.

Full frontend validation:

```powershell
npm test -- --run
npm run build
```

Result: PASS; full Vitest passed 84 files / 450 tests. Production build
completed with 1957 modules transformed and the known non-fatal Vite
chunk-size warning.

Native runtime confirmation:

```powershell
ctest --test-dir $env:LOCALAPPDATA\RPGCreatorAI\build --output-on-failure
```

Result: PASS; 1/1 `RPGTests` passed. No native runtime paths changed.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\validation\validateProject.ts src\validation\__tests__\validateDatabases.test.ts
```

Result: PASS for CP-076 scope; no matches.

## Known Limits

CP-076 does not add a new animation-set ownership schema. NPC/enemy coverage
classification is intentionally conservative and id-based until a future
database schema explicitly assigns animation sets to character roles.
