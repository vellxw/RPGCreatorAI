# Optional Phaser runtime adapter

This directory is an additive browser renderer. It does not replace the C++
runtime or the React editor, and it does not own gameplay state.

The host supplies a `SimulationPort`, the existing runtime asset manifest, and
the authored viewport dimensions to `createPhaserRuntime`. `BootScene` preloads
assets by stable `runtimeKey`; `PlayScene` forwards semantic input and projects
immutable render snapshots into disposable Phaser objects.

Phaser is lazy-loaded from the pinned project dependency when the default
loader is used; hosts may still inject an already-loaded namespace through
`options.phaser`. When WebGL is unavailable, automatic renderer selection
uses Canvas 2D.

Editor and web shells should call `mountPhaserRuntime` with a `GameBundleV1`,
the renderer-neutral `SimulationPort`, and a connected container. The returned
host owns only its nested mount element and Phaser instance. `destroy()` is
idempotent, while `resize()` refreshes FIT layout (or changes the logical
viewport when explicit dimensions are supplied).

Catalog paths stay project-relative. The default `assetBaseUrl` is `./`, so a
portable web build resolves them beside its own document without network
access. Hosts mounted under a synthetic same-origin prefix may provide that
prefix explicitly (Android uses `/assets/www/`). Scheme-based or escaping
asset locations are rejected before Phaser preloads them.

## Horror/BL release asset contract

The chapter keeps authored IDs stable across the compiler and renderer:

- `portrait.damian` and `portrait.elian` are regular image entries. They are
  preloaded from the local manifest and shown by the DOM dialogue surface with
  `object-fit: contain`; a textual initial remains visible if decoding fails.
- `threat.ninth-witness` is a world image (or a future compiled strip). Its
  catalog width/height determine the display aspect ratio, so the renderer does
  not force a non-square source into a square tile.
- AnimationPackage clips must reach the runtime as independent horizontal
  strips. The compiled animation database supplies `frameSize`, `frameCount`,
  FPS, loop, and pixel anchor metadata; manifest creation fills missing strip
  dimensions from that canonical clip instead of treating it as a static image.

Changing action or direction may select a different stable strip key. The
Phaser view recreates only that disposable image object while simulation state
remains untouched. Missing or failed world textures render a colored geometric
placeholder, and missing backgrounds fall back to the authored room color.
No fallback may substitute editor fixtures into a release allowlist.
