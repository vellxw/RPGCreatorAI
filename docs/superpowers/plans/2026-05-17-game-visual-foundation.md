# Game Visual Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tiny-square-map presentation with a shared visual-profile system, scene-scale authoring tools, complete starter scenes, and editor/runtime visual consistency.

**Architecture:** Add a persisted `visualProfile` to project data with backward-compatible defaults, then build shared TypeScript/C++ viewport helpers around it. The editor uses those helpers for map sizing, overlays, validation, and templates; the runtime loads the same profile to size the window, frame the camera, and render full-scene maps without seams.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tauri/Rust bridge, C++20, SDL2, doctest.

---

## File structure

- `src/types/project.ts`, `src/types/ProjectTypes.h` — persisted visual-profile types.
- `src/visual/viewport.ts` (new) — shared editor-side viewport math.
- `src/visual/sceneTemplates.ts` (new) — generated starter maps.
- `src/validation/validateMap.ts`, `src/validation/validateProject.ts` — completeness / void checks.
- `src/components/editor/MapCanvas.tsx`, `TilePalette.tsx`, `Inspector.tsx` — viewport overlays and richer map tools.
- `src/screens/PlaytestScreen.tsx` — profile-aware preview.
- `src/world/ProjectLoader.cpp`, `src/core/Application.cpp`, `src/core/Game.cpp`, `src/renderer/Camera2D.h`, `src/renderer/Renderer2D.cpp` — runtime loading, window sizing, camera, seam-safe drawing.
- `src/assets/generated/*`, `assets/generated/*` — additional original assets.
- `data/project.json`, `data/database/system.json`, `data/maps/*.json` — migrated bundled sample and default profile.
- `docs/GAME_VISUAL_DESIGN.md`, `docs/GAME_VISUAL_QA.md`, `docs/VALIDATION_LOG.md`, screenshots — source of truth and proof.

### Task 1: Persist the visual profile

**Files:**
- Modify: `src/types/project.ts`
- Modify: `src/types/ProjectTypes.h`
- Modify: `src/world/ProjectLoader.cpp`
- Modify: `data/project.json`
- Test: `src/validation/__tests__/validateProject.test.ts`
- Test: `tests/test_project_loader.cpp`

- [ ] **Step 1: Write failing tests**

```ts
it('accepts a project visualProfile and defaults missing legacy fields safely', () => {
  const legacy = makeProjectWithoutVisualProfile();
  const migrated = normalizeProjectVisualProfile(legacy);
  expect(migrated.aspectRatio).toBe('16:9');
  expect(migrated.baseResolution).toEqual({ width: 1280, height: 720 });
});
```

```cpp
TEST_CASE("ProjectLoader reads visual profile with legacy-safe defaults") {
    auto project = ProjectLoader::load("data/project.json");
    REQUIRE(project.has_value());
    CHECK(project->visualProfile.baseResolution.width == 1280);
    CHECK(project->visualProfile.aspectRatio == "16:9");
}
```

- [ ] **Step 2: Run the focused tests and verify RED**
- [ ] **Step 3: Add the TypeScript/C++ data structures and parser defaults**
- [ ] **Step 4: Re-run focused tests and verify GREEN**
- [ ] **Step 5: Commit the profile slice**

### Task 2: Build shared viewport math

**Files:**
- Create: `src/visual/viewport.ts`
- Test: `src/visual/__tests__/viewport.test.ts`
- Modify: `src/renderer/Camera2D.h`
- Modify: `src/core/Game.cpp`
- Test: `tests/test_camera.cpp` (new)

- [ ] **Step 1: Write failing viewport tests**

```ts
it('computes the visible tile span for a 16:9 viewport', () => {
  expect(getVisibleTileSpan({ width: 1280, height: 720 }, 32)).toEqual({
    columns: 40,
    rows: 23,
  });
});
```

```cpp
TEST_CASE("Camera clamps to map bounds for wider scenes") {
    Camera2D camera;
    camera.setViewport(1280, 720);
    camera.follow(640, 360, 1600, 960);
    CHECK(camera.getPosition().x >= 0);
    CHECK(camera.getPosition().y >= 0);
}
```

- [ ] **Step 2: Verify focused failures**
- [ ] **Step 3: Implement editor viewport helpers and runtime camera clamp math**
- [ ] **Step 4: Verify focused tests pass**
- [ ] **Step 5: Commit the viewport-math slice**

### Task 3: Make the editor frame scenes instead of tiny boards

**Files:**
- Modify: `src/stores/editorStore.ts`
- Modify: `src/components/editor/MapCanvas.tsx`
- Modify: `src/screens/PlaytestScreen.tsx`
- Modify: `src/index.css`
- Test: `src/components/editor/__tests__/mapCanvasGeometry.test.ts` (new)

- [ ] **Step 1: Add failing geometry tests**

```ts
it('fits a 16:9 map preview into the available viewport frame', () => {
  expect(computeFitZoom({ width: 1280, height: 720 }, { width: 900, height: 600 })).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Verify RED**
- [ ] **Step 3: Add fit-to-view, actual-size, screen-frame overlay, camera overlay, and profile-aware preview sizing**
- [ ] **Step 4: Verify editor tests and manually inspect in browser**
- [ ] **Step 5: Commit the editor-frame slice**

### Task 4: Eliminate accidental voids and seams

**Files:**
- Modify: `src/validation/validateMap.ts`
- Modify: `src/validation/validateProject.ts`
- Modify: `src/components/editor/MapCanvas.tsx`
- Modify: `src/renderer/Renderer2D.cpp`
- Test: `src/validation/__tests__/validateProject.test.ts`
- Test: `tests/test_map_loader.cpp`

- [ ] **Step 1: Add failing tests for missing tiles, explicit void tiles, and seam-safe output assumptions**
- [ ] **Step 2: Verify RED**
- [ ] **Step 3: Implement completeness warnings, explicit void visualization, and integer-aligned runtime tile drawing**
- [ ] **Step 4: Re-run focused tests and inspect screenshot output**
- [ ] **Step 5: Commit the no-gap slice**

### Task 5: Expand the asset set

**Files:**
- Modify/Create: `src/assets/generated/*`
- Modify/Create: `assets/generated/*`
- Modify: `src/assets/generated/assetCatalog.ts`
- Modify: `src/renderer/SpriteCatalog.cpp`
- Test: `src/assets/generated/__tests__/assetCatalog.test.ts`

- [ ] **Step 1: Extend asset-catalog tests for the required new assets**
- [ ] **Step 2: Verify RED**
- [ ] **Step 3: Generate or programmatically create the missing production assets**
- [ ] **Step 4: Verify tests and render smoke shots**
- [ ] **Step 5: Commit the asset slice**

### Task 6: Add complete scene templates

**Files:**
- Create: `src/visual/sceneTemplates.ts`
- Modify: `src/adapters/BrowserMemoryAdapter.ts`
- Modify: `data/maps/*.json`
- Test: `src/visual/__tests__/sceneTemplates.test.ts`
- Test: `src/validation/__tests__/bundledSample.test.ts`

- [ ] **Step 1: Add failing template tests**

```ts
it('builds each starter template with full coverage, a spawn, collision, and an interaction', () => {
  for (const template of sceneTemplates) {
    const result = createSceneTemplate(template.id);
    expect(result.map.layers.find(layer => layer.name === 'ground')?.tiles).not.toContain(0);
    expect(result.map.events.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Verify RED**
- [ ] **Step 3: Implement the requested starter templates and migrate the bundled sample to widescreen scene dimensions**
- [ ] **Step 4: Verify clean validation**
- [ ] **Step 5: Commit the template slice**

### Task 7: Make runtime obey the visual profile

**Files:**
- Modify: `src/core/Application.cpp`
- Modify: `src/core/Game.cpp`
- Modify: `src/renderer/Renderer2D.cpp`
- Modify: `src/platform/Window.cpp`
- Test: `tests/test_project_loader.cpp`
- Test: `tests/test_map_loader.cpp`

- [ ] **Step 1: Add focused tests for loaded profile values and camera behavior**
- [ ] **Step 2: Verify RED**
- [ ] **Step 3: Initialize the runtime window from the profile, clamp camera bounds, and keep HUD/UI rendering intact**
- [ ] **Step 4: Run `verify-runtime.bat` and smoke shots**
- [ ] **Step 5: Commit the runtime-profile slice**

### Task 8: Prove preview consistency

**Files:**
- Modify: `src/screens/PlaytestScreen.tsx`
- Modify/Create: `scripts/dev/*`
- Create: screenshot outputs under `docs/screenshots/game-visual-design/`

- [ ] **Step 1: Add any missing smoke/helper tests**
- [ ] **Step 2: Capture editor and runtime screenshots for 16:9 and square profiles**
- [ ] **Step 3: Document any intentional differences**
- [ ] **Step 4: Commit screenshots and consistency docs**

### Task 9: Harden the authoring workflow

**Files:**
- Modify: `src/components/editor/MapCanvas.tsx`
- Modify: `src/components/editor/TilePalette.tsx`
- Modify: `src/stores/projectStore.ts`
- Modify: `src/components/editor/Inspector.tsx`
- Test: `src/stores/__tests__/projectReducer.test.ts`

- [ ] **Step 1: Add failing tests for map resize, brush size, fill, rectangle, and validation-before-save**
- [ ] **Step 2: Verify RED**
- [ ] **Step 3: Implement the smallest complete workflow upgrades**
- [ ] **Step 4: Verify editor flow manually and through tests**
- [ ] **Step 5: Commit the authoring slice**

### Task 10: Finish validation and closeout

**Files:**
- Modify: `docs/VALIDATION_LOG.md`
- Modify: `docs/RPG_SYSTEMS_MATRIX.md`
- Modify: `docs/GOAL_STACK.md`
- Modify/Create: final report docs

- [ ] **Step 1: Run the required full validation suite**
- [ ] **Step 2: Capture all required screenshots**
- [ ] **Step 3: Score `docs/GAME_VISUAL_QA.md`**
- [ ] **Step 4: Update docs with exact commands/results**
- [ ] **Step 5: Commit, push, and confirm clean status**

## Execution choice

The user explicitly requested autonomous continuation until completion or
a real blocker, so this plan is executed inline in the current session
with stable slice commits and validation checkpoints.
