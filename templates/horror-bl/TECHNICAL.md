# La Novena Promesa — technical seed

- Runtime target: Phaser + TypeScript adapter, WebGL with Canvas fallback.
- Editor target: Tauri + React on Windows.
- Logical viewport: 960×540; tile size: 48 px; fixed simulation tick: 60 Hz.
- Renderer never owns flags, variables, inventory, saves, or endings.
- Runtime bundle contains only approved local assets and JSON; no IA SDK,
  provider key, shell, filesystem, or network capability.
- Save schema: portable `schemaVersion: 2`, simulation state only.
- Initial animation contract: `AnimationPackage v1`, four directions, idle/walk/
  interact clips, fixed frame canvas, shared ground-contact anchor.
- Plugin mode: experimental, deny-by-default permissions; no filesystem,
  shell, network, or DOM access.
- Release profiles: Windows portable first; Android consumes the same
  GameBundle after Windows parity and offline QA.

