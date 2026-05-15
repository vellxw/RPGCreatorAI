# Phase 2 Visual Verification

**Status:** PASS — runtime opens a window, all visible elements render
in the expected frames, and every Phase 2 success criterion was
exercised end-to-end through a deterministic in-process harness.

## Method

Synthetic keyboard injection via `SendInput` proved unreliable on
Windows 11 (focus-stealing prevention drops events between captures
even with `AttachThreadInput`). Switched to a deterministic in-process
harness:

1. Runtime gained a `--smoke-shots <dir>` CLI flag.
2. `Application::runSmokeShots()` drives `Game` through public verbs
   (`stepMove`, `stepInteract`, `stepDismissDialogue`, `stepSave`,
   `stepLoad`, `pumpEvents`) — the same code paths used by real
   keyboard input.
3. After each scripted action a single frame is rendered and the
   backbuffer is read with `SDL_RenderReadPixels` and saved as BMP via
   `SDL_SaveBMP`.
4. `scripts/dev/visual-verify.ps1` runs the harness and converts BMPs
   to PNGs.

This bypasses input synthesis entirely while still exercising the
real renderer pipeline, so the captured pixels are exactly what a
player would see.

## Captured Sequence

Stored in [`docs/screenshots/phase-2/`](screenshots/phase-2/).

| # | File | Scene |
|---|------|-------|
| 01 | `01-town-initial.png` | Town map at startup. Player at (4,4). NPC (red) visible at (6,4). Door (blue) at (3,3). |
| 02 | `02-npc-dialogue.png` | Player at (5,4) facing right, NPC dialogue: "Anciano: No cruces el puente de noche." |
| 03 | `03-house-arrived.png` | After touch transfer through door (3,3) → house map. Player at (3,4). Chest (orange) visible at (4,1). |
| 04 | `04-chest-first-open.png` | Player adjacent to chest, dialogue: "Encontraste una pocion." (then `addItem potion=1`, `setFlag chest_001_opened=true`). |
| 05 | `05-chest-already-opened.png` | Re-interact: ifFlag else-branch dialogue "El cofre esta vacio." |
| 06 | `06-save-feedback.png` | F5 save: in-window dialogue "Partida guardada." |
| 07 | `07-back-in-town.png` | Walked to door (3,5), touch transfer back to town. Town palette restored. |
| 08 | `08-load-feedback.png` | F9 load: house map restored from `saves/slot_1.json`, dialogue "Partida cargada." |
| 09 | `09-after-load.png` | Steady state on the loaded map. |

## Pixel Verification

`scripts/dev/analyze-screenshots.ps1` samples each PNG against the
`Renderer2D` palette (subsample step = 2px, RGB squared-distance
threshold = 50²). Results:

```
image                            Ground      Wall    Player       NPC     Chest  Transfer        Bg   DlgEdge
01-town-initial.png               12.56      8.41      0.11      0.10      0.00      0.10     78.67      0.04
02-npc-dialogue.png               12.56      7.61      0.11      0.10      0.00      0.10     78.77      0.75
03-house-arrived.png               4.12      4.48      0.12      0.00      0.10      0.10     91.05      0.04
04-chest-first-open.png            4.12      4.48      0.11      0.00      0.10      0.10     90.45      0.63
05-chest-already-opened.png        4.12      4.48      0.11      0.00      0.10      0.10     90.50      0.59
06-save-feedback.png               4.12      4.48      0.11      0.00      0.10      0.10     90.49      0.59
07-back-in-town.png               12.56      8.41      0.11      0.10      0.00      0.10     78.67      0.04
08-load-feedback.png               4.12      4.48      0.11      0.00      0.10      0.10     90.51      0.58
09-after-load.png                  4.12      4.48      0.11      0.00      0.10      0.10     91.05      0.04
```

Verdicts:

- **Map tiles visible** — town frames show 12.56% ground + 8.41% wall;
  house frames show 4.12% / 4.48% (smaller map, more background).
- **Player visible** in every frame (~0.11% yellow pixels).
- **NPC visible** only on town frames (red pixels disappear after the
  transfer to house in 03 and reappear in 07).
- **Chest visible** only on house frames (orange pixels appear in 03
  and disappear in 07).
- **Transfer tile visible** in every map frame (blue pixels at door
  position).
- **Dialogue box visible** specifically when expected (frames 02, 04,
  05, 06, 08) — `DlgEdge` jumps from 0.04% to ≥0.58% precisely on those
  frames. The 4× / 14× delta is unmistakable.

## Runtime Log Trace

```
[INFO] RPG Creator Runtime starting...
[INFO] Project loaded: Demo RPG
[INFO] Map loaded: town
[INFO] Screenshot: ...01-town-initial.bmp
[INFO] Dialogue [Anciano]: No cruces el puente de noche.
[INFO] Screenshot: ...02-npc-dialogue.bmp
[INFO] Map loaded: house
[INFO] Screenshot: ...03-house-arrived.bmp
[INFO] Dialogue: Encontraste una pocion.
[INFO] Screenshot: ...04-chest-first-open.bmp
[INFO] playSound: chest_open
[INFO] Dialogue: El cofre esta vacio.
[INFO] Screenshot: ...05-chest-already-opened.bmp
[INFO] Game saved to saves/slot_1.json
[INFO] Dialogue: Partida guardada.
[INFO] Screenshot: ...06-save-feedback.bmp
[INFO] Map loaded: town
[INFO] Screenshot: ...07-back-in-town.bmp
[INFO] Game loaded from saves/slot_1.json
[INFO] Map loaded: house
[INFO] Dialogue: Partida cargada.
[INFO] Screenshot: ...08-load-feedback.bmp
[INFO] Screenshot: ...09-after-load.bmp
[INFO] Smoke shots complete.
[INFO] RPG Creator Runtime shut down.
```

This trace matches exactly the expected sequence of game events.

## Visual Limitations

These are intentional limits of the placeholder renderer; not Phase 2
defects.

- **Bitmap font is ASCII-only.** The 5x7 embedded font omits accented
  Spanish glyphs (á, é, í, ó, ú, ñ, ¿, ¡); JSON content uses
  unaccented Spanish to match. Text remains legible.
- **No camera edge clamping.** Maps smaller than the viewport draw
  off-center near edges. Visually fine; clamp can come in Phase 3.
- **No animation.** Player is a static rectangle with a direction dot;
  there are no walk frames.
- **No audio.** `playSound` logs only.
- **Save / load feedback** appears via the same dialogue UI rather
  than a dedicated toast/banner.

## Files Changed in This Verification Pass

Implementation:
- `src/main.cpp` — added `--smoke-shots <dir>` CLI handling.
- `src/core/Application.{h,cpp}` — added `runSmokeShots()` /
  `renderFrameOnce()` / `snapshot()` plumbing.
- `src/core/Game.{h,cpp}` — added public verbs (`stepMove`,
  `stepInteract`, `stepDismissDialogue`, `stepSave`, `stepLoad`,
  `pumpEvents`).
- `src/platform/Window.{h,cpp}` — added `saveScreenshot()` using
  `SDL_RenderReadPixels` + `SDL_SaveBMP`.

Tooling / docs:
- `scripts/dev/visual-verify.ps1` (rewritten as wrapper around the
  in-process harness) + `.bat` shim.
- `scripts/dev/analyze-screenshots.ps1` — palette-percentage analyzer.
- `docs/screenshots/phase-2/*.png` — captured frames.
- `docs/PHASE_2_VISUAL_VERIFICATION.md` (this file).

No gameplay or feature surface was modified. The only logic touch was
exposing already-present Game capabilities through a verb API so the
harness could call them without input synthesis.

## Build / Test / Smoke after Changes

- `build_bootstrap.bat`: ALL PASSED — 317/317 build, 1/1 ctest passed.
- `--smoke-shots`: completed cleanly, `[INFO] Smoke shots complete.`,
  exit 0.
- Runtime still opens a window in the standard `app.run()` path
  (interactive smoke captured earlier).
