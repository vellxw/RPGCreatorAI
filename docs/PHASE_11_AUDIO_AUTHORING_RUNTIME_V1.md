# Phase 11 Audio Authoring Runtime V1

Issue: CP-036 / FRA-71
Date: 2026-06-02

## Result

CP-036 connects local audio authoring to the existing deterministic runtime
audio path. Users can configure local BGM/SFX ids and project-relative `.wav`
paths from the editor instead of editing JSON by hand.

## Implemented Scope

- `system.audio` is the editor-owned audio registry for local audio ids and
  project-relative WAV paths.
- The System editor exposes editable audio id/path rows and uses known audio
  ids for Default BGM.
- The Map settings panel exposes map BGM as a known audio id, falling back to
  the system Default BGM when unset.
- The event command editor exposes `playSound.soundId` as a known audio id.
- The bundled sample `database/system.json` declares the default local audio
  ids consumed by the runtime smoke path.

## Validation Policy

- Frontend validation rejects unknown Default BGM, map BGM, and `playSound`
  audio ids.
- Frontend validation rejects invalid audio ids, unsafe project-relative paths,
  and non-`.wav` local audio paths.
- Native runtime validation loads audio ids from built-in defaults,
  `system.audio`, and optional `database.audio` shards using `audio`,
  `sounds[]`, or `bgm[]`.
- Native runtime validation warns when optional WAV files are missing. Missing
  audio files do not block launch.

## Runtime Boundary

`AudioSystem` remains the only SDL audio boundary. CP-036 adds no AI, network,
cloud, streaming, paid provider call, or arbitrary scripting dependency.

## Known Limits

- Audio playback is still local WAV-only.
- Volume, pitch, pan, fade, BGS/ME channels, and file import workflows remain
  future work.
- The current smoke environment may warn about missing sample WAV files or an
  unavailable WASAPI endpoint; those warnings are expected and non-fatal.
