# Phase 11 Audio Import Workflow

Issue: CP-052 / FRA-87
Date: 2026-06-02

## Result

RPGCreatorAI now supports local audio import as an editor-only desktop
workflow. Imported audio becomes both a project-owned asset catalog entry and
a selectable audio id for map BGM, system default BGM, and `playSound`
authoring controls.

The workflow stays local and deterministic:

- only desktop mode can open a local file picker
- browser mode reports import as unavailable instead of pretending it can read
  local files
- imported files are copied into the opened project
- the native runtime continues to consume project data only and has no AI,
  network, cloud, or provider dependency

## Import Policy

Allowed v1 audio format:

- `.wav`

Runtime audio v1 plays local WAV files through `AudioSystem`, so the import
pipeline intentionally rejects other formats for now.

Desktop copies go under:

```text
assets/imported/audio/
```

Existing project files are never overwritten. Duplicate filenames receive a
numeric suffix, and duplicate/default audio ids receive a unique `_2`, `_3`,
... suffix.

## Metadata And Authoring Link

The Assets workspace exposes an audio usage selector:

- `SFX`
- `BGM`

Successful imports create an asset catalog entry with:

- `kind: "audio"`
- `source: "imported"`
- project-relative path under `assets/imported/audio/`
- `imported`, `audio`, and usage tags

The editor also adds the imported audio id/path to `database.system.audio`.
That makes the imported id immediately available to:

- System default BGM
- Map BGM
- Event `playSound` commands

## Failure States

The UI reports:

- desktop import unavailable in browser mode
- no desktop project root opened
- unsupported source extensions
- invalid non-file sources
- unknown audio usage metadata
- copy or path errors returned by the desktop command

Canceling the file dialog is a no-op and does not dirty the project.

## Runtime Behavior

The native runtime already treats local audio as optional. Imported WAV ids are
registered like other authored audio ids; missing files or unavailable audio
devices warn and continue instead of blocking gameplay.

The runtime still does not read editor-only asset catalog metadata.

## Evidence

- Focused frontend and adapter tests:
  - `src/screens/__tests__/AssetsScreen.test.tsx`
  - `src/adapters/__tests__/audioImport.test.ts`
- Desktop import helper tests:
  - `src-tauri/src/fs_commands.rs`
- Runtime mock/validator tests:
  - `tests/test_audio_system.cpp`
  - `tests/test_runtime_project_validator.cpp`
- Browser smoke screenshot:
  - `docs/screenshots/phase11-cp052/audio-import-browser-unavailable.png`

## Known Limits

CP-052 imports `.wav` audio only. It does not transcode MP3/OGG, inspect audio
duration, generate audio, or change native runtime asset loading. Those remain
future asset pipeline or audio depth work.
