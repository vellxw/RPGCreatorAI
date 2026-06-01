# Validation Log

Append-only log of major validation runs. Newest entries on top.

---

## Phase 10 FRA-25 / PT-004 — runtime state snapshot inspector

- `2026-06-01 15:34:12 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; new `tests/test_runtime_debug_snapshot.cpp` intentionally failed
  because `runtime/RuntimeDebugSnapshot.h` did not exist.
- `2026-06-01 15:34:12 -03:00` —
  `npm test -- --run src/components/playtest/__tests__/RuntimeStatePanel.test.tsx src/adapters/__tests__/DesktopRuntimeAdapter.test.ts`
  — RED; `RuntimeStatePanel` and `DesktopRuntimeAdapter.readLatestSnapshot`
  did not exist yet.
- `2026-06-01 15:35:00 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml runtime_commands::tests::runtime_debug_snapshot_path_stays_in_runtime_logs_dir -- --exact`
  — RED; snapshot path/read helpers and size cap were not implemented.
- `2026-06-01 15:39:12 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS; configure completed with existing third-party CMake warnings and
  `RPGTests` passed.
- `2026-06-01 15:39:12 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml runtime_commands::tests::runtime_debug_snapshot_path_stays_in_runtime_logs_dir -- --exact`
  — PASS.
- `2026-06-01 15:39:12 -03:00` —
  `npm test -- --run src/components/playtest/__tests__/RuntimeStatePanel.test.tsx src/adapters/__tests__/DesktopRuntimeAdapter.test.ts`
  — PASS; 2 files and 9 tests passed.
- `2026-06-01 15:40:00 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml runtime_commands::tests::read_runtime_snapshot_caps_to_bounded_json_size -- --exact`
  — PASS.
- `2026-06-01 15:40:30 -03:00` — `npm run typecheck` — PASS.
- `2026-06-01 15:41:50 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS; configure completed with existing third-party CMake warnings,
  Ninja reported no work to do, and `RPGTests` passed.
- `2026-06-01 15:41:50 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml`
  — PASS; 25 Rust tests passed.
- `2026-06-01 15:41:50 -03:00` —
  `npm test -- --run src/components/playtest/__tests__/RuntimeStatePanel.test.tsx src/adapters/__tests__/DesktopRuntimeAdapter.test.ts`
  — PASS; 2 files and 9 tests passed on the final required rerun.
- `2026-06-01 15:41:50 -03:00` — `npm run build` — PASS; `tsc --noEmit`
  and Vite build completed, with the existing chunk-size warning only.
- `2026-06-01 15:42:30 -03:00` — `npm run typecheck` — PASS on the exact
  Linear-required frontend validation command.
- `2026-06-01 15:42:30 -03:00` —
  `$env:RPG_RUNTIME_DEBUG_SNAPSHOT_PATH=<temp>; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build; ConvertFrom-Json <temp>`
  — PASS; runtime stayed alive, smoke reported `SMOKE PASSED`, and the
  generated snapshot parsed with `mapId=town` and `frameNumber=55`.
- `2026-06-01 15:42:30 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.
- Fix applied so far: added deterministic runtime snapshot JSON
  serialization, atomic temp-write/replace helper, `Game` snapshot assembly,
  periodic `Application` snapshot writing via
  `RPG_RUNTIME_DEBUG_SNAPSHOT_PATH`, Tauri bounded snapshot read IPC, adapter
  bridge methods, and the Playtest Runtime State tab with honest browser
  unavailability.
- Final pass/fail for this issue validation: PASS.

---

## Phase 10 FRA-24 / PT-003 — deterministic event trace output

- `2026-06-01 15:21:25 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; new `tests/test_event_trace.cpp` intentionally failed because
  `events/EventTrace.h` did not exist.
- `2026-06-01 15:21:25 -03:00` —
  `npm test -- --run src/components/playtest/__tests__/EventTracePanel.test.tsx`
  — RED; `EventTracePanel` did not exist yet.
- `2026-06-01 15:24:54 -03:00` —
  `npm test -- --run src/components/playtest/__tests__/EventTracePanel.test.tsx`
  — PASS; 1 file and 2 tests passed after adding trace parsing and filters.
- `2026-06-01 15:24:54 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; `EventScheduler.cpp` needed the full `GameState` definition for
  source map fallback.
- `2026-06-01 15:25:30 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; `EventTrace.cpp` was not yet included in the current generated build
  files after adding the new source.
- `2026-06-01 15:25:55 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default && cmake --build --preset default"`
  — PASS; configure completed with existing third-party CMake warnings and
  Ninja linked `RuntimeLib`, `rpg_creator_runtime.exe`, and `rpg_tests.exe`.
- `2026-06-01 15:26:15 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed.
- `2026-06-01 15:26:40 -03:00` — `npm run typecheck` — PASS.
- `2026-06-01 15:27:32 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS; configure completed with existing third-party CMake warnings,
  Ninja reported no work to do, and `RPGTests` passed.
- `2026-06-01 15:27:32 -03:00` —
  `npm test -- --run src/components/playtest/__tests__/EventTracePanel.test.tsx`
  — PASS; 1 file and 2 tests passed on the final required rerun.
- `2026-06-01 15:27:32 -03:00` — `npm run build` — PASS; `tsc --noEmit`
  and Vite build completed, with the existing chunk-size warning only.
- `2026-06-01 15:28:15 -03:00` — `npm run typecheck` — PASS on the exact
  Linear-required frontend validation command.
- `2026-06-01 15:28:15 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime stayed alive, loaded the town map, logged the
  `town_theme` audio request, warned about the missing optional WAV, and
  reported `SMOKE PASSED`.
- `2026-06-01 15:28:15 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.
- `2026-06-01 15:29:40 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — RED; the added `waitFinish` assertion exposed that waits traced start but
  not timer completion.
- `2026-06-01 15:30:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS after storing active wait trace metadata and emitting `waitFinish`
  when the timer drains.
- `2026-06-01 15:30:20 -03:00` — `npm run typecheck` — PASS.
- `2026-06-01 15:30:20 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime stayed alive, loaded the town map, logged the
  `town_theme` audio request, warned about the missing optional WAV, and
  reported `SMOKE PASSED`.
- `2026-06-01 15:30:20 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.
- Fix applied: added `EventTraceBuffer` and stable `[TRACE]` JSON-line
  formatting, threaded trace buffers through `Game`, `EventRunner`, and
  scheduled map/common-event runners, emitted command start/finish, wait,
  branch, choice, request, and warning trace rows, and added the Playtest
  Event Trace panel parser with map/common/warning/branch filters.
- Final pass/fail for this issue validation: PASS.

---

## Phase 10 FRA-23 / PT-002 — runtime log viewer and bounded log reading

- `2026-06-01 15:07:04 -03:00` —
  `npm test -- --run src/components/playtest/__tests__/RuntimeLogPanel.test.tsx`
  — RED; `RuntimeLogPanel` did not exist yet.
- `2026-06-01 15:07:04 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml runtime_commands::tests::read_runtime_log_tail_caps_to_256_kib -- --exact`
  — RED; `MAX_RUNTIME_LOG_TAIL_BYTES` and `read_runtime_log_tail_at` did not
  exist yet.
- `2026-06-01 15:07:36 -03:00` —
  `npm test -- --run src/adapters/__tests__/DesktopRuntimeAdapter.test.ts`
  — RED; `DesktopRuntimeAdapter` did not expose `getLatestLog`,
  `readLatestLogTail`, or `openLogFolder`.
- `2026-06-01 15:12:13 -03:00` —
  `npm test -- --run src/components/playtest/__tests__/RuntimeLogPanel.test.tsx src/adapters/__tests__/DesktopRuntimeAdapter.test.ts`
  — PASS; 2 files and 8 tests passed after adding the runtime log panel and
  adapter bridge methods.
- `2026-06-01 15:12:13 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml runtime_commands::tests::read_runtime_log_tail_caps_to_256_kib -- --exact`
  — PASS after adding shell-side log tail reading with a 256 KiB cap.
- `2026-06-01 15:13:00 -03:00` — `npm run typecheck` — PASS.
- `2026-06-01 15:14:00 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml`
  — PASS; 23 Rust tests passed.
- `2026-06-01 15:14:25 -03:00` —
  `npm test -- --run src/components/playtest/__tests__/RuntimeLogPanel.test.tsx src/adapters/__tests__/DesktopRuntimeAdapter.test.ts`
  — PASS; 2 files and 8 tests passed on the final required rerun.
- `2026-06-01 15:14:25 -03:00` — `npm run typecheck` — PASS.
- `2026-06-01 15:14:25 -03:00` — `npm run build` — PASS; Vite emitted the
  existing chunk-size warning only.
- `2026-06-01 15:14:25 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml`
  — PASS; 23 Rust tests passed on the final required rerun.
- `2026-06-01 15:15:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS; configure completed with existing third-party CMake warnings,
  Ninja had no work to do, and `RPGTests` passed.
- `2026-06-01 15:15:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime stayed alive, loaded the town map, logged the
  `town_theme` audio request, warned about the missing optional WAV, and
  reported `SMOKE PASSED`.
- `2026-06-01 15:15:00 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.
- Fix applied: added shell-side stdout/stderr log capture on runtime launch,
  latest-log and bounded-tail IPC commands, a narrow log-folder opener,
  runtime adapter log methods, a `RuntimeLogPanel`, Playtest bottom-panel tabs,
  runtime-log polling while the native process is running, and honest browser
  unavailable states.
- Final pass/fail for this issue validation: PASS.

---

## Phase 10 FRA-22 / PT-001 — playtest session builder

- `2026-06-01 14:44:00 -03:00` —
  `npm test -- --run src/adapters/__tests__/PlaytestSessionAdapter.test.ts src/adapters/__tests__/DesktopRuntimeAdapter.test.ts`
  — RED; `PlaytestSessionAdapter` did not exist yet and
  `DesktopRuntimeAdapter.launch()` did not forward the source executable
  search root.
- `2026-06-01 14:44:00 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml`
  — RED; `PlaytestSessionRequest` and `create_playtest_session_at` did not
  exist yet.
- `2026-06-01 14:52:46 -03:00` —
  `npm test -- --run src/adapters/__tests__/PlaytestSessionAdapter.test.ts src/adapters/__tests__/DesktopRuntimeAdapter.test.ts`
  — PASS; 2 files and 7 tests passed after adding the playtest session
  adapter and executable-search-root launch option.
- `2026-06-01 14:52:46 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml`
  — PASS; 21 Rust tests passed after adding temp session creation,
  selected-event/current-map start rewriting, source-file non-mutation
  coverage, asset copy, and pruning coverage.
- `2026-06-01 14:53:00 -03:00` — `npm run typecheck` — PASS.
- `2026-06-01 14:56:38 -03:00` —
  `npm test -- --run src/stores/__tests__/editorStore.test.ts`
  — RED; the new reducer test showed selected-event playtest mode remained
  active after clearing the selected event.
- `2026-06-01 14:56:58 -03:00` —
  `npm test -- --run src/stores/__tests__/editorStore.test.ts`
  — PASS after resetting selected-event mode to current-map when the event
  selection is cleared.
- `2026-06-01 14:57:14 -03:00` —
  `npm test -- --run src/adapters/__tests__/PlaytestSessionAdapter.test.ts src/adapters/__tests__/DesktopRuntimeAdapter.test.ts src/stores/__tests__/editorStore.test.ts`
  — PASS; 3 files and 12 tests passed.
- `2026-06-01 14:57:14 -03:00` — `npm run typecheck` — FAIL; the new
  editor-store test fixture used `as const`, making `commands` readonly and
  incompatible with `GameEvent`.
- `2026-06-01 14:57:14 -03:00` — `npm run build` — FAIL for the same
  readonly test fixture type error before Vite build started.
- `2026-06-01 14:57:51 -03:00` —
  `npm test -- --run src/adapters/__tests__/PlaytestSessionAdapter.test.ts src/adapters/__tests__/DesktopRuntimeAdapter.test.ts src/stores/__tests__/editorStore.test.ts`
  — PASS; 3 files and 12 tests passed after typing the fixture as
  `GameEvent`.
- `2026-06-01 14:57:51 -03:00` — `npm run typecheck` — PASS.
- `2026-06-01 14:57:51 -03:00` — `npm run build` — PASS; Vite emitted the
  existing chunk-size warning only.
- `2026-06-01 14:57:14 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml`
  — PASS; 21 Rust tests passed.
- `2026-06-01 14:58:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS; configure completed with existing third-party CMake warnings,
  Ninja had no work to do, and `RPGTests` passed.
- `2026-06-01 14:58:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime stayed alive, loaded the town map, logged the
  `town_theme` audio request, warned about the missing optional WAV, and
  reported `SMOKE PASSED`.
- `2026-06-01 15:00:00 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml fs_commands::tests::playtest_session_pruning_preserves_protected_session -- --exact`
  — RED; the new pruning test did not compile because
  `prune_playtest_sessions` did not yet accept a protected session path.
- `2026-06-01 15:00:00 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml fs_commands::tests::playtest_session_pruning_preserves_protected_session -- --exact`
  — PASS after preventing the just-created session root from being pruned.
- `2026-06-01 15:01:00 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml`
  — PASS; 22 Rust tests passed with protected-session pruning coverage.
- `2026-06-01 15:01:00 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.
- `2026-06-01 15:02:00 -03:00` — `git diff --cached --check` — PASS.
- Fix applied: added desktop/browser playtest session adapters, Tauri temp
  session creation under app data, mode-specific temp `project.json` start
  rewriting, optional `assets/` copy, five-session pruning, runtime launch
  executable search root support, protected current-session pruning, and
  playtest toolbar mode selection.
- Final pass/fail for this issue validation: PASS.

---

## Phase 10 FRA-21 / RT-007 — deterministic plugin command v1

- `2026-06-01 14:32:31 -03:00` —
  `npm test -- --run src/validation/__tests__/validateProject.test.ts`
  — RED; new plugin-command validation tests failed because
  `pluginCommand` was still reported as an unknown command type and no
  safe-identifier/scalar-arg checks existed.
- `2026-06-01 14:32:31 -03:00` —
  `npm test -- --run src/components/events/__tests__/CommandStackEditor.test.tsx`
  — RED; the command selector did not expose a `Plugin Command` option.
- `2026-06-01 14:33:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; new C++ tests failed to compile because `EventCommand` did not yet
  expose `pluginId`, `pluginCommand`, or `PluginArg`/`pluginArgs`.
- `2026-06-01 14:35:49 -03:00` —
  `npm test -- --run src/validation/__tests__/validateProject.test.ts`
  — PASS after adding the TypeScript command type and validation rules.
- `2026-06-01 14:35:49 -03:00` —
  `npm test -- --run src/components/events/__tests__/CommandStackEditor.test.tsx`
  — PASS after adding the selector placeholder and command card metadata.
- `2026-06-01 14:36:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — PASS after adding runtime plugin args, map/common-event parsing, and
  `EventRunner` built-in dispatch.
- `2026-06-01 14:36:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed with plugin command parser and runner coverage.
- `2026-06-01 14:39:28 -03:00` —
  `npm test -- --run src/validation/__tests__/validateProject.test.ts`
  — PASS; 34 validation tests passed.
- `2026-06-01 14:39:40 -03:00` —
  `npm test -- --run src/components/events/__tests__/CommandStackEditor.test.tsx`
  — PASS; 4 command stack editor tests passed.
- `2026-06-01 14:39:50 -03:00` — `npm run typecheck` — PASS.
- `2026-06-01 14:40:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS; configure completed with existing third-party CMake warnings,
  Ninja had no work to do, and `RPGTests` passed.
- `2026-06-01 14:40:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime stayed alive, logged the `town_theme` audio request,
  warned about the missing optional WAV, and reported `SMOKE PASSED`.
- `2026-06-01 14:40:00 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.
- Fix applied: added `pluginCommand` with safe `pluginId`, `command`, and
  scalar `args`, editor key/value controls, map/common-event C++ parsing,
  allowlisted `debug.log`, `debug.setSwitch`, and `debug.setVariable`
  dispatch, plus non-fatal warnings for unknown plugin commands.
- Final pass/fail for this issue validation: PASS.

---

## Phase 10 FRA-20 / RT-006 — local audio v1

- `2026-06-01 14:12:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; new audio tests failed because `platform/AudioSystem.h` did not
  exist and `EventRunner` did not expose `consumeSoundRequest`.
- `2026-06-01 14:18:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default && cmake --build --preset default"`
  — PASS after adding `AudioSystem` and regenerating CMake so the new
  platform source was included.
- `2026-06-01 14:19:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — RED; `AudioSystem::playBgm` cleared queued audio even when no previous
  BGM was active, producing an extra backend `stopAll()` call.
- `2026-06-01 14:20:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS after only clearing BGM when replacing an active BGM.
- `2026-06-01 14:20:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime stayed alive, logged
  `Audio requested: town_theme -> assets/audio/town_bgm.wav`, warned about
  the missing optional WAV, and reported `SMOKE PASSED`.
- `2026-06-01 14:22:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS after documentation updates; CMake configured, Ninja reported no
  work to do, and `RPGTests` passed.
- `2026-06-01 14:22:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime smoke again logged the `town_theme` audio request, warned
  for the missing optional WAV, and reported `SMOKE PASSED`.
- `2026-06-01 14:22:00 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.
- Fix applied: added `platform/AudioSystem` with an injectable backend and
  SDL WAV playback path, deterministic audio registry defaults plus
  system/audio database overrides, `EventRunner` sound requests consumed by
  `Game`, startup/default-map BGM requests, optional map `bgm` parsing, and
  missing-file/device warnings that do not abort runtime startup.
- Final pass/fail for this issue validation: PASS.

---

## Phase 10 FRA-19 / RT-005 — foreground layer occlusion

- `2026-06-01 14:03:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; new render-layer role tests failed because `MapRenderPass` and
  `MapScene::getRenderLayers` did not exist.
- `2026-06-01 14:05:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — PASS after adding map render passes, role-filtered render layers,
  foreground/background map rendering, and split entity rendering.
- `2026-06-01 14:05:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed with new render-layer role tests.
- `2026-06-01 14:08:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default"`
  — PASS with existing third-party CMake policy/deprecation warnings only.
- `2026-06-01 14:08:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — PASS; Ninja reported no work to do after the green build.
- `2026-06-01 14:08:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed.
- `2026-06-01 14:08:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime smoke reported `SMOKE PASSED`.
- `2026-06-01 14:08:00 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.
- Fix applied: added map render passes, role-filtered visual layer selection,
  background/foreground renderer passes, split entity rendering around the
  foreground pass, foreground-role tests, and visual design documentation for
  runtime occlusion semantics.
- Final pass/fail for this issue validation: PASS.

---

## Phase 10 FRA-18 / RT-004 — event priority and Y-sort rendering

- `2026-06-01 13:55:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; new render ordering tests failed because `EntityRenderSprite` did
  not yet expose ids/render priority, `buildEntityRenderOrder` did not exist,
  and `EventPageEvaluator` did not expose active render priority.
- `2026-06-01 13:57:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — PASS after adding render priority metadata, active-page priority mapping,
  deterministic entity ordering, and renderer integration.
- `2026-06-01 13:57:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed with new priority mapping and render-order tests.
- `2026-06-01 13:59:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default"`
  — PASS with existing third-party CMake policy/deprecation warnings only.
- `2026-06-01 13:59:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — PASS; Ninja reported no work to do after the green build.
- `2026-06-01 13:59:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed.
- `2026-06-01 13:59:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime smoke reported `SMOKE PASSED`.
- `2026-06-01 13:59:00 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.
- Fix applied: added entity render priority and stable ids to render
  snapshots, active render priority lookup through `EventPageEvaluator`,
  deterministic below/same/above ordering with same-bucket foot-Y sorting,
  renderer integration, and docs/status updates.
- Final pass/fail for this issue validation: PASS.

---

## Phase 10 FRA-17 / RT-003 — event-target movement routes

- `2026-06-01 13:43:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; new movement-route tests failed because `MapScene` did not yet
  expose runtime event positions.
- `2026-06-01 13:47:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — PASS after adding runtime event state, event-target route execution, and
  event-route coverage.
- `2026-06-01 13:48:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed with new named-event, `thisEvent`,
  skippable/wait, blocked, repeat-guard, and transfer-reset route cases.
- `2026-06-01 13:50:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default"`
  — PASS with existing third-party CMake policy/deprecation warnings only.
- `2026-06-01 13:51:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — PASS; Ninja reported no work to do after the green build.
- `2026-06-01 13:51:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed.
- `2026-06-01 13:51:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime smoke reported `SMOKE PASSED`.
- `2026-06-01 13:51:00 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.
- Fix applied: added runtime-only event positions to `MapScene`, event-route
  execution for `thisEvent` and named event targets, runtime-position aware
  event lookup/rendering/collision, repeat guard behavior, transfer reset
  coverage, and parser coverage for named event movement routes.
- Final pass/fail for this issue validation: PASS.

---

## FRA-14 / DB-009 — database delete and rename reference safety

- `2026-06-01 13:15 -03:00` —
  `npm test -- --run src/validation/__tests__/referenceIndex.test.ts`
  — RED; the new reference index module did not exist before
  implementation.
- `2026-06-01 13:15 -03:00` —
  `npm test -- --run src/stores/__tests__/databaseReducer.test.ts`
  — RED; `RENAME_DATABASE_ENTRY` changed only the database id and left page
  conditions and command references untouched.
- `2026-06-01 13:16 -03:00` —
  `npm test -- --run src/validation/__tests__/referenceIndex.test.ts src/stores/__tests__/databaseReducer.test.ts`
  — PASS (2 files, 12 tests).
- `2026-06-01 13:16 -03:00` — `npm run typecheck` — FAIL; the new reducer
  test fixture inferred a too-narrow map shape after `projectReducer`
  returned `ProjectStoreState`.
- `2026-06-01 13:17 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`)
  after annotating the reducer fixture as `ProjectStoreState`.
- `2026-06-01 13:17 -03:00` —
  `npm test -- --run src/validation/__tests__/referenceIndex.test.ts src/stores/__tests__/databaseReducer.test.ts`
  — PASS (2 files, 12 tests) after wiring delete/rename UI safety.
- `2026-06-01 13:17 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`)
  after wiring delete/rename UI safety.
- `2026-06-01 13:18 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`); Vite reported the existing chunk-size warning.
- `2026-06-01 13:18 -03:00` — `git diff --check` — PASS; warnings only
  about Git normalizing LF to CRLF on touched files.
- Fix applied: added `referenceIndex`, indexed map/page/command/common-event
  and database references, added deterministic reference-updating rename for
  database entries, blocked deletion of referenced database-list entries, and
  added an update-references choice when renaming referenced IDs.
- Final pass/fail for this issue validation: PASS.

---

## FRA-13 / DB-008 — animation database V2 editor and preview

- `2026-06-01 13:08 -03:00` —
  `npm test -- --run src/components/database/__tests__/AnimationsEditor.test.tsx`
  — RED; the new component test could not resolve `AnimationsEditor`,
  proving the animation database editor did not exist before implementation.
- `2026-06-01 13:08 -03:00` —
  `npm test -- --run src/assets/generated/__tests__/assetCatalog.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — RED; the asset catalog did not expose flat animation sheet keys and
  animation clip validation did not report malformed clip metadata.
- `2026-06-01 13:10 -03:00` —
  `npm test -- --run src/components/database/__tests__/AnimationsEditor.test.tsx`
  — PASS (1 file, 2 tests).
- `2026-06-01 13:10 -03:00` —
  `npm test -- --run src/assets/generated/__tests__/assetCatalog.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — PASS (2 files, 20 tests).
- `2026-06-01 13:10 -03:00` — `npm run typecheck` — FAIL; clip direction
  editing used the command animation direction type, which allows `current`,
  instead of the database clip direction type, which allows `any`.
- `2026-06-01 13:11 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`)
  after narrowing clip direction updates to `AnimationClipData['direction']`.
- `2026-06-01 13:11 -03:00` —
  `npm test -- --run src/components/database/__tests__/AnimationsEditor.test.tsx`
  — PASS (1 file, 2 tests) on the final focused rerun.
- `2026-06-01 13:11 -03:00` —
  `npm test -- --run src/assets/generated/__tests__/assetCatalog.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — PASS (2 files, 20 tests) on the final required rerun.
- `2026-06-01 13:11 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`)
  on the final required rerun.
- `2026-06-01 13:11 -03:00` — `git diff --check` — PASS; warnings only
  about Git normalizing LF to CRLF on touched files.
- `2026-06-01 13:12 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`); Vite reported the existing chunk-size warning.
- Fix applied: added `AnimationsEditor` and `AnimationPreview`, exposed flat
  generated animation sheet keys/URLs for validation and preview selects,
  added the standalone Animations database tab and reducer action, and added
  validation for clip assets, frame sizes, frame counts, FPS, anchors, and
  missing player idle/walk directional clips.
- Final pass/fail for this issue validation: PASS.

---

## FRA-12 / DB-007 — common event command-stack editing

- `2026-06-01 12:54 -03:00` —
  `npm test -- --run src/components/events/__tests__/CommandStackEditor.test.tsx`
  — RED; the new component test could not resolve `CommandStackEditor`,
  proving the shared command-stack component did not exist before
  implementation.
- `2026-06-01 12:55 -03:00` —
  `npm test -- --run src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts`
  — RED; `LOAD_PROJECT` exposed a fallback database inconsistency where
  migrated legacy armors used slot `body`, but `emptyDatabases()` did not
  include the project-owned armor slot ids.
- `2026-06-01 12:55 -03:00` —
  `npm test -- --run src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS (2 files, 76 tests) after aligning fallback equipment slots with
  the real types shard.
- `2026-06-01 13:00 -03:00` —
  `npm test -- --run src/components/events/__tests__/CommandStackEditor.test.tsx`
  — PASS (1 file, 3 tests).
- `2026-06-01 13:00 -03:00` —
  `npm test -- --run src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS (2 files, 76 tests).
- `2026-06-01 13:00 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`).
- `2026-06-01 13:03 -03:00` —
  `npm test -- --run src/components/events/__tests__/CommandStackEditor.test.tsx`
  — PASS (1 file, 3 tests) after removing the legacy inline command-stack
  copy from `EventEditorScreen`.
- `2026-06-01 13:03 -03:00` —
  `npm test -- --run src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS (2 files, 76 tests) after the extraction cleanup.
- `2026-06-01 13:03 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`)
  after the extraction cleanup.
- `2026-06-01 13:04 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`); Vite reported the existing chunk-size warning.
- Fix applied: added shared `CommandStackEditor`, wired map events through
  the extracted component using the existing page/legacy command actions,
  wired common events through `UPDATE_COMMON_EVENT_COMMANDS`, added reducer
  coverage for common event command undo/isolation, added validation coverage
  for nested common event commands, and aligned default equipment slots with
  the seeded `types` database.
- Final pass/fail for this issue validation: PASS.

---

## FRA-11 / DB-006 — quest, shop, switch, variable, and system V2 editors

- `2026-06-01 12:44 -03:00` —
  `npm test -- --run src/components/database/__tests__/SetupProgressionEditors.test.tsx`
  — RED; the new component test could not resolve `QuestsEditor`, proving
  the focused setup/progression editors did not exist before implementation.
- `2026-06-01 12:44 -03:00` —
  `npm test -- --run src/validation/__tests__/validateDatabases.test.ts src/validation/__tests__/validateProject.test.ts`
  — RED; invalid quest/shop/variable/system numeric data was not yet
  reported.
- `2026-06-01 12:46 -03:00` —
  `npm test -- --run src/components/database/__tests__/SetupProgressionEditors.test.tsx`
  — PASS (1 file, 4 tests).
- `2026-06-01 12:46 -03:00` —
  `npm test -- --run src/validation/__tests__/validateDatabases.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS (2 files, 44 tests).
- `2026-06-01 12:47 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`).
- `2026-06-01 12:47 -03:00` —
  `npm test -- --run src/validation/__tests__/validateDatabases.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS (2 files, 44 tests) on the final required rerun.
- `2026-06-01 12:48 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`)
  on the final required rerun.
- `2026-06-01 12:48 -03:00` —
  `npm test -- --run src/components/database/__tests__/SetupProgressionEditors.test.tsx`
  — PASS (1 file, 4 tests) on the final component rerun.
- `2026-06-01 12:48 -03:00` — `git diff --check` — PASS; warnings only
  about Git normalizing LF to CRLF on touched files.
- Fix applied: added `QuestsEditor`, `ShopsEditor`,
  `SwitchesVariablesEditor`, and `SystemEditor`; wired them into the Database
  screen; added switch/variable usage counting for inline reference context;
  and added validation for duplicate quest objective ids, quest reward
  ranges, reward item amounts, shop prices/duplicate listings, finite
  variable initial values, non-negative starting gold, and system animation
  references.
- Final pass/fail for this issue validation: PASS.

---

## FRA-10 / DB-005 — actor, class, skill, enemy, and troop V2 editors

- `2026-06-01 12:34 -03:00` —
  `npm test -- --run src/components/database/__tests__/PartyCombatEditors.test.tsx`
  — RED; the new component test could not resolve `ActorsEditor`, proving
  the dedicated party/combat editors did not exist before implementation.
- `2026-06-01 12:34 -03:00` —
  `npm test -- --run src/validation/__tests__/validateDatabases.test.ts`
  — RED; invalid party/combat numeric ranges and references were not yet
  reported.
- `2026-06-01 12:37 -03:00` —
  `npm test -- --run src/components/database/__tests__/PartyCombatEditors.test.tsx`
  — PASS (1 file, 5 tests).
- `2026-06-01 12:37 -03:00` —
  `npm test -- --run src/validation/__tests__/validateDatabases.test.ts`
  — PASS (1 file, 13 tests).
- `2026-06-01 12:38 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`).
- `2026-06-01 12:38 -03:00` — `cmake --preset default` — PASS, with
  existing third-party CMake policy/deprecation warnings only.
- `2026-06-01 12:38 -03:00` — `cmake --build --preset default` — FAIL when
  run from the plain PowerShell environment because `cl.exe` could not find
  the standard library header `<string>`.
- `2026-06-01 12:39 -03:00` —
  `cmd /c "call \"C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat\" -arch=x64 -host_arch=x64 -no_logo && cmake --preset default"`
  — PASS; this confirmed the build environment required `VsDevCmd`, matching
  the repository verification script behavior.
- `2026-06-01 12:39 -03:00` —
  `cmd /c "call \"C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat\" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — PASS (41 build steps), with existing doctest MSVC warning C5285 only.
- `2026-06-01 12:40 -03:00` —
  `cmd /c "call \"C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat\" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS (1/1 CTest target, 0 failures).
- `2026-06-01 12:40 -03:00` —
  `npm test -- --run src/components/database/__tests__/PartyCombatEditors.test.tsx src/validation/__tests__/validateDatabases.test.ts`
  — PASS (2 files, 18 tests) on the final focused rerun.
- `2026-06-01 12:40 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`)
  on the final focused rerun.
- `2026-06-01 12:40 -03:00` — `git diff --check` — PASS; warnings only
  about Git normalizing LF to CRLF on touched files.
- Fix applied: added dedicated `ActorsEditor`, `ClassesEditor`,
  `SkillsEditor`, `EnemiesEditor`, and `TroopsEditor`; wired them into the
  Database screen; and added validation for actor level/HP/MP/base stats,
  class growth/usable equipment/learned skill levels, skill target/element/
  numeric fields, enemy stats/rewards/drop rates, and empty/unknown troop
  members.
- Final pass/fail for this issue validation: PASS.

---

## FRA-9 / DB-004 — item, weapon, armor, and state V2 editors

- TDD RED before implementation (timestamp not captured after context
  compaction) —
  `npm test -- --run src/components/database/__tests__/ItemEquipmentEditors.test.tsx`
  — RED; the new component test could not resolve `ItemsEditor`.
- TDD RED before implementation (timestamp not captured after context
  compaction) —
  `npm test -- --run src/stores/__tests__/databaseReducer.test.ts`
  — RED; `UPDATE_ITEM_DATABASE` did not replace the legacy item shard.
- TDD RED before implementation (timestamp not captured after context
  compaction) —
  `npm test -- --run src/validation/__tests__/validateDatabases.test.ts`
  — RED; invalid item/equipment/state references and numeric ranges were not
  reported.
- `2026-06-01 00:13 -03:00` —
  `npm test -- --run src/components/database/__tests__/ItemEquipmentEditors.test.tsx`
  — RED; 2/3 tests passed, armor slot select emitted an empty value because
  default UI options omitted the `shield` slot.
- `2026-06-01 00:13 -03:00` —
  `npm test -- --run src/components/database/__tests__/ItemEquipmentEditors.test.tsx`
  — PASS (1 file, 3 tests).
- `2026-06-01 00:13 -03:00` —
  `npm test -- --run src/stores/__tests__/databaseReducer.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — PASS (2 files, 21 tests).
- `2026-06-01 00:14 -03:00` — `npm run typecheck` — FAIL; TypeScript
  could not narrow weapon-only and armor-only fields in `EquipmentEditor`.
- `2026-06-01 00:14 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`).
- `2026-06-01 00:15 -03:00` —
  `npm test -- --run src/components/database/__tests__/ItemEquipmentEditors.test.tsx src/stores/__tests__/databaseReducer.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — PASS (3 files, 24 tests) on the final focused rerun.
- `2026-06-01 00:15 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`)
  on the final focused rerun.
- `2026-06-01 00:15 -03:00` — `git diff --check` — PASS; warnings only
  about Git normalizing LF to CRLF on touched files.
- Fix applied: added dedicated `ItemsEditor`, `EquipmentEditor`, and
  `StatesEditor`; added the Database `Items` tab and item database reducer
  action; and added validation for item categories/slots/effects/modifiers,
  weapon/armor type refs, equipment slots, animation refs, prices, stat
  params, state priority, and state restrictions.
- Final pass/fail for this issue validation: PASS.

---

## FRA-8 / DB-003 — dedicated tileset database editor

- `2026-05-31 23:55 -03:00` —
  `npm test -- --run src/components/database/__tests__/TilesetEditor.test.tsx`
  — RED; new test could not resolve `TilesetEditor`, proving the dedicated
  editor did not exist before implementation.
- `2026-05-31 23:56 -03:00` —
  `npm test -- --run src/visual/__tests__/tileCatalog.test.ts src/validation/__tests__/validateProject.test.ts`
  — RED; `tileAssetForKey` was missing and tileset duplicate/asset validation
  did not report errors.
- `2026-05-31 23:59 -03:00` —
  `npm test -- --run src/components/database/__tests__/TilesetEditor.test.tsx`
  — PASS (2/2 tests).
- `2026-05-31 23:59 -03:00` —
  `npm test -- --run src/visual/__tests__/tileCatalog.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS (2 files, 34 tests).
- `2026-05-31 23:59 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`).
- `2026-05-31 23:59 -03:00` — `git diff --check` — PASS; warnings only
  about Git normalizing LF to CRLF on touched files.
- Fix applied: added `TilesetEditor`, the Database screen `Tilesets` tab,
  a tileset database reducer action, tile asset fallback helpers, and
  tileset validation for duplicate tile ids, unknown tile assets, invalid
  groups/passability, and malformed numeric metadata.
- Final pass/fail for this issue validation: PASS.

---

## FRA-7 / DB-002 — types and terms database shards verification

- `2026-05-31 23:48 -03:00` —
  `npm test -- --run src/adapters/__tests__/BrowserMemoryAdapter.test.ts src/adapters/__tests__/FileSystemAdapter.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — PASS (3 files, 23 tests). This verifies browser defaults, filesystem
  adapter preservation, and malformed `types` / `terms` validation.
- `2026-05-31 23:48 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`).
- `2026-05-31 23:48 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml` — PASS (18 Rust tests,
  plus empty main/doc-test targets).
- `2026-05-31 23:49 -03:00` — `git diff --check` — PASS; warnings only
  about Git normalizing LF to CRLF on touched markdown files.
- Fix applied: none required; the repo already contained the `types` and
  `terms` implementation from the earlier Phase 10 Slice 4B work. This
  issue closeout records fresh Linear validation evidence and marks the
  Phase 10 task checkbox complete.
- Final pass/fail for this issue validation: PASS.

---

## FRA-6 / DB-001 — Database V2 editor framework extraction

- `2026-05-31 23:39 -03:00` —
  `npm test -- --run src/components/database/__tests__/DatabaseFields.test.tsx`
  — RED; new test could not resolve `DatabaseFields`, confirming the
  framework components did not exist before implementation.
- `2026-05-31 23:43 -03:00` —
  `npm test -- --run src/components/database/__tests__/DatabaseFields.test.tsx`
  — PASS (3/3 tests) after adding shared scalar fields, reference select,
  and array field editing primitives.
- `2026-05-31 23:43 -03:00` —
  `npm test -- --run src/stores/__tests__/databaseReducer.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — PASS (2 files, 19 tests).
- `2026-05-31 23:43 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`).
- `2026-05-31 23:43 -03:00` — `git diff --check` — PASS; warnings only
  about Git normalizing LF to CRLF on touched files.
- `2026-05-31 23:45 -03:00` —
  `npm test -- --run src/components/database/__tests__/DatabaseFields.test.tsx src/stores/__tests__/databaseReducer.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — PASS (3 files, 22 tests) on the combined focused frontend validation.
- `2026-05-31 23:45 -03:00` — `npm run typecheck` — PASS (`tsc --noEmit`)
  on the final pre-commit rerun.
- `2026-05-31 23:45 -03:00` — `git diff --check` — PASS after the final
  validation-log update; LF-to-CRLF warnings only.
- Fix applied: extracted `DatabaseLayout`, `DatabaseList`,
  `DatabaseFields`, `ReferenceSelect`, and `ArrayFieldEditor`, then rewired
  `DatabaseScreen` to delegate generic list/detail behavior without changing
  database JSON shapes.
- Final pass/fail for this issue validation: PASS.

---

## FRA-5 / MVP-000 — Phase 10 MVP scope lock

- `2026-05-31 23:34 -03:00` — `git diff --check` — PASS; warnings only
  about Git normalizing LF to CRLF on the touched markdown files.
- `2026-05-31 23:34 -03:00` — `git diff --check` — PASS after adding this
  validation-log entry; same LF-to-CRLF warnings only.
- Change type: planning/docs-only. No configure, build, runtime smoke, or
  test run was required by this Linear issue.
- Fix applied: updated Phase 10 requirements/design/tasks, goal stack, and
  RPG systems matrix so the remaining MVP work maps to Linear issues
  FRA-6 through FRA-35 with conservative system statuses and explicit
  non-goals.
- Final pass/fail for this issue validation: PASS.

---

## Phase 10 Slice 3B — runtime event page activation

- `2026-05-20 09:43 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — PASS after adding `EventPageEvaluator`, active-page trigger/command/
  render/collision routing, and `controlSelfSwitch` / `ifSelfSwitch`
  execution.
- QA scout found that self switches must use the event-owner map captured at
  command-list start rather than the live current map after a transfer, and
  that inactive paged events must not override collision tiles. Fix applied:
  `EventRunner` captures `currentOwnerMapId`, paged events without an active
  page expose no commands/triggers, and `Game::canPlayerMoveTo` falls back to
  tile collision for inactive paged events.
- `2026-05-20 09:46 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — PASS after the owner-map and inactive-page fixes.
- `2026-05-20 09:47 -03:00` — `git diff --check` — PASS.
- `2026-05-20 09:47 -03:00` — `npm test` — PASS (18 files,
  133 tests).
- `2026-05-20 09:48 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-20 09:48 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-20 09:49 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-20 09:50 -03:00` — `npm run desktop:verify-content` — PASS;
  a temporary `dev:tauri` server on `127.0.0.1:1420` served the editor and
  was stopped after verification.

### Fixes applied

- Added a C++ active-page evaluator that scans event pages from last to first
  and checks switch, variable, and self-switch conditions.
- Routed interact/touch triggers, command execution, render graphics,
  animation metadata, collision priority, and `through` through the active
  event page.
- Implemented `controlSelfSwitch` and `ifSelfSwitch` in `EventRunner` with
  owner map/event scoping preserved across transfers.
- Added C++ coverage for page selection, inactive-page behavior, `through`,
  self-switch command branches, owner-map capture, and loader parsing.

### Deferred from this slice

- Automatic `autorun` / `parallel` map and common-event scheduling remains
  Slice 3C.

---

## Phase 10 Slice 3A — event pages and self-switch foundation

- `2026-05-20 09:09 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts`
  — initially FAILED as expected under TDD because event page normalization,
  page actions, page-scoped command editing, and event-page validation were
  not implemented yet.
- `2026-05-20 09:17 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS after implementing event pages, page actions, self-switch command
  validation, and nested page command editing (2 files, 61 tests).
- `2026-05-20 09:18 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-20 09:18 -03:00` — `npm test` — PASS (18 files,
  133 tests).
- `2026-05-20 09:19 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-20 09:21 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — initially FAILED because the C++ loader did not read
  editor-authored `options.trigger` inside an event page. Fix applied:
  `MapLoader` now accepts both compact runtime pages and editor-authored
  page objects.
- `2026-05-20 09:24 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — PASS; configure/build/CTest passed after the dual-shape page parser fix.
- `2026-05-20 09:28 -03:00` — `git diff --check` — PASS.
- `2026-05-20 09:28 -03:00` — `npm test` — PASS (18 files,
  133 tests).
- `2026-05-20 09:29 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-20 09:29 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-20 09:30 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-20 09:31 -03:00` — `npm run desktop:verify-content` — PASS;
  a temporary `dev:tauri` server on `127.0.0.1:1420` served the
  RPGCreatorAI editor and was stopped after the check.
- `2026-05-20 09:34 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — PASS after QA fix for preserving `controlSelfSwitch` and
  `ifSelfSwitch` command data in `MapLoader`.
- `2026-05-20 09:35 -03:00` — `git diff --check` — PASS.
- `2026-05-20 09:35 -03:00` — `npm test` — PASS (18 files,
  133 tests).
- `2026-05-20 09:36 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-20 09:36 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-20 09:37 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-20 09:38 -03:00` — `npm run desktop:verify-content` — PASS;
  a temporary `dev:tauri` server on `127.0.0.1:1420` served the editor and
  was stopped after verification.

### Fixes applied

- Added `EventPage` data types, A-D self-switch conditions, and
  `controlSelfSwitch` / `ifSelfSwitch` command types.
- Normalized legacy flat events into single-page events while preserving the
  old first-page projection for compatibility.
- Added editor page tabs, page metadata editing, and page-scoped command
  editing across nested branches.
- Added C++ self-switch storage and save/load persistence plus loader support
  for optional `event.pages`.
- Preserved editor-authored `controlSelfSwitch` and `ifSelfSwitch` command
  data, including nested branches, in the C++ map loader.

### Deferred from this slice

- Runtime active-page selection, self-switch command execution, and
  autorun/parallel scheduling remain Slice 3B/3C work.

---

## Phase 9 Hotfix — RPG Maker scale and no-lag movement

**Date**: 2026-05-19

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npm test -- --run src/playtest/__tests__/tileFluidMotion.test.ts src/validation/__tests__/validateProject.test.ts src/validation/__tests__/bundledSample.test.ts` | FAIL -> PASS | Initial RED covered missing movement-speed helper, missing `displayHeightTiles`/system validation, and missing bundled defaults. Final: 26/26 focused tests passed. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke` | PASS | Configure/build/CTest passed using the repo's MSVC bootstrap and out-of-OneDrive build dir. |
| `npm test` | PASS | 18 files, 107 tests. |
| `npm run build` | PASS | `tsc --noEmit` and `vite build` passed. |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib` | PASS | 17/17 Rust tests. |
| `%LOCALAPPDATA%\RPGCreatorAI\build\rpg_creator_runtime.exe --smoke-shots docs/screenshots/phase-9-animation-hotfix` | PASS | Runtime wrote the full smoke set plus Phase 9 hotfix frames. |
| Screenshot bbox audit for `phase9-01-walk-midstep.bmp` | PASS | Player bbox measured `48px` high in the runtime smoke screenshot. |
| Playwright browser check at `http://127.0.0.1:5173` | PASS | Editor preview player clip was `48px` high and moved `12.8px` within 80ms of holding `W`; screenshot saved as `editor-preview-playtest.png`. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1` | PASS | Final configure/build/CTest plus runtime 3-second smoke passed with `SMOKE PASSED`. |
| Pre-commit rerun at `2026-05-19 02:29:09 -03:00`: `npm test`; `npm run build`; `cargo test --manifest-path src-tauri/Cargo.toml --lib`; `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1` | PASS | Fresh closeout validation: 107/107 Vitest tests, Vite build, 17/17 Rust tests, CTest, and runtime smoke passed. |

### Fixes applied

- Removed sprite padding from runtime entity drawing and made character
  render rects bottom-center on the logical tile.
- Added animation-set display metadata, event display-height overrides,
  and system-level `playerMovementSpeed` / `defaultCharacterHeightTiles`.
- Changed the bundled sample to `playerMovementSpeed: "double"` and kept
  tile logic/collision/saves unchanged.
- Updated editor playtest preview to use the runtime display rules,
  memoize static map/event layers, and start/chained held movement in the
  same visual update.

### Final pass/fail

- Frontend: PASS
- C++ runtime: PASS
- Rust shell: PASS
- Runtime smoke screenshots: PASS
- Editor browser preview: PASS

## Phase 8 — Slice 1 Game Visual Source of Truth + Visual Profile

**Date**: 2026-05-17

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx vitest run src/visual/__tests__/visualProfile.test.ts src/adapters/__tests__/BrowserMemoryAdapter.test.ts` | FAIL → PASS | Initial RED: missing `visualProfile` module and no seeded profile. Final: 9/9 tests passed after implementation. |
| `cmd /c scripts\dev\verify-runtime.bat` | FAIL → PASS | Initial RED: `ProjectData` had no `visualProfile`. Final: C++ build succeeded and `RPGTests` passed. |
| `npx tsc --noEmit` | PASS | 0 errors after the profile implementation. |

### Fixes applied

- Added `docs/GAME_VISUAL_DESIGN.md` as the binding visual standard and
  `docs/GAME_VISUAL_QA.md` as the scorecard.
- Reset governing docs to Phase 8 and declared the visual design document
  as the source of truth.
- Added a backward-compatible project `visualProfile` with safe editor
  normalization and safe runtime defaults for legacy JSON.

### Final pass/fail

- Frontend focused tests: PASS
- C++ runtime focused validation: PASS
- TypeScript compile: PASS

## Phase 8 — Slice 2 Shared Viewport / Camera Model

**Date**: 2026-05-18

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx vitest run src/visual/__tests__/viewport.test.ts` | FAIL → PASS | Initial RED: missing `viewport.ts`. Final: 3/3 tests passed. |
| `cmd /c scripts\dev\verify-runtime.bat` | FAIL → PASS | Initial RED: `Camera2D` lacked `setViewport`, `follow`, and `centerRoom`. Final: runtime build succeeded and `RPGTests` passed with new camera coverage. |
| `npx tsc --noEmit` | PASS | 0 errors after viewport helpers landed. |

### Fixes applied

- Added shared editor-side viewport math for visible tile span and
  fit-to-view scaling.
- Added runtime camera viewport awareness, clamp-to-bounds follow
  behavior, and fixed-room centering.
- Switched runtime window creation from hardcoded `800x600` to the saved
  project visual profile resolution.

### Final pass/fail

- Frontend focused tests: PASS
- C++ runtime focused validation: PASS
- TypeScript compile: PASS

## Phase 8 — Slice 3 Editor Canvas Scale + Screen Bounds Overlay

**Date**: 2026-05-18

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx vitest run src/visual/__tests__/viewport.test.ts src/stores/__tests__/editorStore.test.ts` | FAIL → PASS | Initial RED: missing camera-frame helpers and no zoom-mode state. Final: 7/7 tests passed. |
| `npx tsc --noEmit` | PASS | 0 errors. |
| `npx vite build` | PASS | Production bundle built successfully. |
| Live browser verification at `http://127.0.0.1:3000/` | PASS | DOM exposed `Frame 1280×720`, `Fit`, `100%`, and SVG geometry proved stage `1280×720`, map bounds `320×320`, viewport frame `1280×720`. |

### Fixes applied

- Switched the editor from raw-map sizing to a profile-aware scene stage.
- Added fit-to-view / actual-size controls, map bounds, camera rail, and
  current viewport overlay.
- Preserved editing coordinates while supporting stage bounds larger than
  the authored map.

### Final pass/fail

- Frontend focused tests: PASS
- Production build: PASS
- Browser verification: PASS

## Phase 8 — Slice 4 No-Gap Validation + Void Visibility

**Date**: 2026-05-18

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx vitest run src/validation/__tests__/validateProject.test.ts` | FAIL → PASS | Initial RED: no warnings for void cells and no errors for unsupported tile ids. Final: 13/13 tests passed. |
| `cmd /c scripts\dev\verify-runtime.bat` | PASS | Runtime build/tests remained green after sprite-catalog updates. |
| `npx tsc --noEmit` | PASS | 0 errors. |

### Fixes applied

- Added explicit supported tile-id catalogs for visual and collision
  layers.
- Added warnings for void tiles and errors for unsupported visual /
  collision ids.
- Made editor voids visually unmistakable instead of silently falling
  back to grass.
- Forced nearest-neighbor runtime rendering and routed unknown runtime
  tiles to the future `tile_void_warning` asset key instead of silently
  appearing valid.

### Final pass/fail

- Frontend validation tests: PASS
- C++ runtime focused validation: PASS
- TypeScript compile: PASS

## Phase 7 — Slice 0 Original Asset Foundation

**Date**: 2026-05-17

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx vitest run src/assets/generated/__tests__/assetCatalog.test.ts` | PASS | 3/3 tests |
| `cmd /c scripts\dev\verify-runtime.bat` | PASS | Added `SpriteCatalog` + `MenuSystem` coverage; `RPGTests` passed |
| `npx tsc --noEmit` | PASS | 0 errors |
| `npx vite build` | PASS | Generated asset PNGs included in production bundle |
| `npx vitest run` | PASS | 10 files, 65 tests |
| `cmd /c scripts\dev\smoke-runtime.bat` | PASS | Runtime spawned, loaded project/databases/map |
| `%LOCALAPPDATA%\RPGCreatorAI\build\rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-7-assets-smoke` | PASS | 9 screenshots written with committed sprite rendering |

### Fixes applied

- Replaced production emoji placeholders with generated assets or vector
  icons across the editor / playtest UI.
- Added original generated asset atlases plus derived transparent PNG and
  runtime BMP assets.
- Added runtime sprite lookup / texture loading and updated sample event
  sprite ids.
- Wired the pause-menu shell into the runtime and added keyboard
  navigation coverage for the new menu state machine.

### Final pass/fail

- Frontend: PASS
- C++ runtime: PASS
- Runtime smoke: PASS
- Visual smoke shots: PASS

## Phase 2 — Visible Playable RPG Runtime MVP

### Run 1 — initial Phase 2 validation

- Command: `build_bootstrap.bat` (configures via `cmake`, builds via
  `cmake --build`, runs `ctest`)
- Result: ALL PASSED
- Build output: `[317/317] Linking CXX executable rpg_creator_runtime.exe`
- Test output: `1/1 Test #1: RPGTests ......... Passed 0.21 sec — 100% tests passed, 0 tests failed out of 1`
- Warnings: doctest C5285 (std::tuple specialization) — known third-party
  warning, harmless under MSVC 19.51 / C++20.
- Fix applied: none required.
- Final: PASS.

### Run 2 — runtime smoke

- Command: launch `build\rpg_creator_runtime.exe` for 4 seconds, capture
  stdout/stderr.
- stdout:
  - `[INFO] RPG Creator Runtime starting...`
  - `[INFO] Project loaded: Demo RPG`
  - `[INFO] Map loaded: town`
- stderr: empty
- Process status: still alive after 4 s; window opened titled
  "Demo RPG"; killed cleanly.
- Final: PASS.

---

## Phase 1 — Bootstrap

### Run — bootstrap configure/build/ctest

- Command: `build_bootstrap.bat`
- Result: ALL PASSED
- ctest: `1/1 Test #1: RPGTests ......... Passed 0.17 sec`
- Final: PASS (Phase 1 commit `41273a8`).


---

## Phase 2 Visual Verification

### Run — `--smoke-shots` deterministic harness

- Command: `build\rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-2`
- Result: PASS — exit 0, 9 screenshots written, full event trace captured.
- Trace (relevant log lines):
  - `[INFO] Map loaded: town`
  - `[INFO] Dialogue [Anciano]: No cruces el puente de noche.`
  - `[INFO] Map loaded: house`
  - `[INFO] Dialogue: Encontraste una pocion.`
  - `[INFO] playSound: chest_open`
  - `[INFO] Dialogue: El cofre esta vacio.`
  - `[INFO] Game saved to saves/slot_1.json`
  - `[INFO] Map loaded: town` (transfer back)
  - `[INFO] Game loaded from saves/slot_1.json`
  - `[INFO] Map loaded: house` (load restored map)
  - `[INFO] Dialogue: Partida cargada.`
- Pixel verification (see `docs/PHASE_2_VISUAL_VERIFICATION.md`):
  dialogue-edge pixel ratio jumps from 0.04% (idle) to ≥0.58% (dialogue
  frames); ground/wall ratios swap between town and house palettes;
  NPC red appears only on town frames; chest orange only on house
  frames.
- Final: PASS.

### Run — full validation after harness changes

- Command: `build_bootstrap.bat`
- Build: 317/317 link OK.
- Tests: `1/1 Test #1: RPGTests ......... Passed 0.15 sec — 100% tests passed`.
- Final: PASS.


---

## Phase 4 — Editor Persistence & Runtime Bridge

**Date**: 2026-05-15

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx tsc --noEmit` | PASS | 0 errors |
| `npx vite build` | PASS | 290 KB JS bundle, 18.29s |
| `npx vitest run` | PASS | 32 / 32 tests |
| `cmd /c build_bootstrap.bat` | BLOCKED | Pre-existing OneDrive file-lock during FetchContent rename. No C++ files were modified in Phase 4. |

### Fix applied
- The C++ build failure is environmental (OneDrive holds locks on `build/_deps/` during cmake's directory rename). Documented in `docs/PHASE_4_VALIDATION_REPORT.md` with workaround suggestions. No code changes required for Phase 4.

### Final pass/fail
- Frontend: PASS
- C++ runtime: unmodified, build blocked by OneDrive sync (not a Phase 4 regression)


---

## Phase 4.1 — Validation Hardening & Desktop Bridge Preparation

**Date**: 2026-05-15

### Commands run

| Command | Result | Notes |
|---------|--------|-------|
| `npx tsc --noEmit` | PASS | exit 0 |
| `npx vite build` | PASS | 290 KB JS, 16s |
| `npx vitest run` | PASS | 32/32 tests |
| `scripts\dev\verify-runtime.bat` | PASS | configure + build + ctest, build dir `%LOCALAPPDATA%\RPGCreatorAI\build` |
| `scripts\dev\verify.ps1` (full incl. smoke) | PASS | runtime stays alive 3s, [INFO] Project loaded, [INFO] Map loaded |

### Fixes applied
- Replaced `New-TemporaryFile` in `scripts/dev/verify.ps1` with `[System.IO.Path]::GetTempFileName()` to remove a Windows PowerShell version dependency.
- Defaulted CMake binary dir to `%LOCALAPPDATA%\RPGCreatorAI\build` across `verify.ps1`, `verify-runtime.bat`, and `build_bootstrap.bat` so FetchContent rename steps no longer collide with OneDrive's filter driver.
- Added new `scripts/dev/verify-runtime.bat` for a pure-cmd path (no PowerShell required).
- Updated `smoke-runtime.ps1` to accept `-BuildDir`, run from repo root for `data/` lookups, and use ASCII-only status output.

### Final pass/fail
- Frontend: PASS
- C++ runtime: PASS
- Smoke: PASS
- OneDrive lock issue: RESOLVED via out-of-OneDrive build directory


---

## Phase 5 — Desktop Shell + Real FileSystem + Runtime Bridge (in progress)

**Date**: 2026-05-16

### Bug uncovered: silent Vite port collision in Tauri dev mode

Tauri 2's `beforeDevCommand` originally invoked `npm run dev`, whose Vite
config used port 3000 and was happy to silently fall back to a different
port when 3000 was already taken by another local project. Tauri then
opened a webview for whatever was on that fallback port, which could be
an unrelated app. This is a class-of-bug we never want to ship: the
shell process being alive does not prove the right page loaded.

### Fix

* New `npm run dev:tauri` script: `vite --port=1420 --strictPort --host=127.0.0.1`. `--strictPort` makes Vite **fail** instead of silently moving when 1420 is taken.
* `src-tauri/tauri.conf.json` `beforeDevCommand` now points at `dev:tauri`, `devUrl` is `http://localhost:1420`.
* CSP is narrowed to allow only `http://localhost:1420` and its websocket.
* `npm run dev` (the existing Phase 4.1 browser script on port 3000) is unchanged for users who want pure browser mode.

### Regression check

`scripts/dev/verify-tauri-content.ps1` now hits `http://127.0.0.1:1420/`
and asserts the response body contains `<title>RPGCreatorAI` and the
editor entry `/src/main.tsx`. Exits non-zero otherwise. This catches the
silent-port-collision class of bug for future Phase 5 work.

### Tauri dev verification (this run)

| Check | Result |
|-------|--------|
| Vite bound to `127.0.0.1:1420` with `--strictPort` | PASS |
| `verify-tauri-content.ps1` | PASS (`OK: serving the RPGCreatorAI editor`) |
| Page `<title>` is `RPGCreatorAI — Visual Editor` | PASS |
| DOM includes `RPGCreatorAI`, `My First RPG`, `Maps`, `Events`, `AI Tools` | PASS (no missing strings) |
| Tauri window screenshot | `docs/screenshots/phase-5/02-tauri-window.png` (1456×939) |
| Renderer DOM screenshot | `docs/screenshots/phase-5/01-tauri-dev-content.png` |
| `data/project.json` title aligned to `My First RPG` | PASS |

### Other Phase 5 validation so far

| Check | Result |
|-------|--------|
| `rustup` user-space install | PASS (Rust 1.95.0, Cargo 1.95.0) |
| `npx tsc --noEmit` | PASS |
| `npx vite build` | PASS (295 KB JS, 19s) |
| `npx vitest run` | PASS (43/43 tests) |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib` | PASS (14/14 Rust tests) |
| `cargo build --manifest-path src-tauri/Cargo.toml` | PASS (4m45s first build, target dir under `%LOCALAPPDATA%`) |
| `scripts/dev/verify-runtime.bat` | PASS (C++ runtime still green) |


### `--strictPort` fail-loud verification

Manually held port 1420 with a TcpListener and ran `npx vite --port=1420 --strictPort --host=127.0.0.1`. Vite exited with code 1 and the message `Error: Port 1420 is already in use`. The silent-fallback class of bug cannot recur.

```
Held 1420 with PID 17796
vite running: False, exit=1
vite stopped, ExitCode=1
Error: Port 1420 is already in use
    at Server.onError (...)
```


---

## Phase 6 — Complete RPG Creation System Foundation

### Slice 1+2 (commit `7936b8f`) — data model + database editor

- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 8 files, 59 passed, 59 total
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` — 16 passed (added two new database round-trip tests)
- `scripts\dev\verify-runtime.bat` — configure + build clean, ctest 1/1 RPGTests passed

### Slice 3-6 (commit `46d2726`) — runtime command system v1, switches/variables, quests, gold, party

- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 8 files, 59 passed
- `cargo test ... --lib` — 16 passed
- `verify-runtime.bat` — ctest 1/1 (rpg_tests went from 24 cases / 95 assertions to 47 cases / 145 assertions)

### Slice 7-9 (commit `d4fec32`) — runtime database loader, BattleSystem v1, full editor command UI

- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 8 files, 59 passed
- `cargo test ... --lib` — 16 passed
- `verify-runtime.bat` — ctest 1/1 (rpg_tests 49 cases / 151 assertions, including BattleSystem damage formula + empty-party auto-defeat)

### Slice 10+11 — sample game + final validation

- Sample town/house exercise: dialogue, choices, switch toggle, variable arithmetic, gold change, quest start/objective/complete, shop open, deterministic battle with rewards, transfer, save/load.
- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 9 files, 62 passed (added bundledSample.test.ts)
- `cargo test ... --lib` — 16 passed
- `verify-runtime.bat` — ctest 1/1
- `scripts\dev\smoke-runtime.bat` — runtime spawned (pid logged), `[INFO] Project loaded: My First RPG`, `[INFO] Databases loaded: 1 actors, 1 enemies, 1 troops, 1 quests, 1 shops, 1 common events`, `[INFO] Map loaded: town`, SMOKE PASSED.
- `npm run desktop:verify-content` — skipped (requires running dev server).

---

## Phase 7 — Polished creator-to-player loop

### Slice 0+1 (commit `0012eca`) — generated asset foundation + runtime menu shell

- `npx vitest run src/assets/generated/__tests__/assetCatalog.test.ts` — PASS (3 tests)
- `scripts\dev\verify-runtime.bat` — PASS
- `npx tsc --noEmit` — PASS
- `npx vite build` — PASS
- `npx vitest run` — PASS (10 files, 65 tests)
- `scripts\dev\smoke-runtime.bat` — PASS
- `rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-7-assets-smoke` — PASS (9 screenshots)

### Slice 2+3 (pending commit) — runtime menu data + save/load slot metadata

- `scripts\dev\verify-runtime.bat` — initially FAILED while compiling
  `tests/test_save_manager.cpp` because `SaveManager::listSlots` did not yet
  exist; fix applied: introduced centralized slot metadata in
  `SaveManager`, then routed `MenuSystem` through it.
- `scripts\dev\verify-runtime.bat` — PASS after fix (1/1 ctest target;
  includes new menu snapshot and save-slot metadata coverage).

### Slice 4+5 (pending commit) — shop modal + battle reward summary

- `scripts\dev\verify-runtime.bat` — initially FAILED while compiling
  `tests/test_shop_system.cpp` because `runtime/ShopSystem.h` did not yet
  exist; fix applied: introduced `ShopSystem`, runtime integration, and shop
  renderer panel.
- `scripts\dev\verify-runtime.bat` — PASS after shop implementation.
- `scripts\dev\verify-runtime.bat` — initially FAILED while compiling
  `tests/test_battle_summary_system.cpp` and the new EventRunner regression
  because `BattleSummarySystem` and `consumeBattleSummaryRequest()` did not
  yet exist; fix applied: introduced explicit battle-summary handoff and
  renderer panel.
- `scripts\dev\verify-runtime.bat` — PASS after battle summary integration.

### Slice 6-8 (pending commit) — undo / redo + map and event authoring

- `npx vitest run src/stores/__tests__/projectReducer.test.ts` — initially
  FAILED on the new undo/redo, tile painting, and event CRUD expectations;
  fix applied: introduced project history snapshots plus map/event reducer
  actions.
- `npx vitest run src/stores/__tests__/projectReducer.test.ts` — PASS
  (15/15).
- `npx tsc --noEmit` — PASS.
- `npx vitest run` — PASS (10 files, 69 tests).
- `npx vite build` — PASS.
- Live browser verification against `http://127.0.0.1:3000/` — PASS:
  path brush changed a map tile to `tile_path.png`, event placement grew the
  canvas event count, duplicate increased the count again, and Undo restored
  the previous count.
- Screenshot captured:
  `docs/screenshots/phase-7-editor/01-editor-workflow.png`.

### Slice 6-9 follow-up (pending commit) — editor polish + end-to-end proof

- `npx vitest run src/utils/__tests__/eventEditing.test.ts src/e2e/__tests__/editorRoundtrip.test.ts src/stores/__tests__/projectReducer.test.ts`
  — initially FAILED because `src/utils/eventEditing.ts` did not exist;
  fix applied: added shared duplicate-placement / editable-target helpers,
  then wired `Ctrl+D`, delete confirmation, and drag coalescing through the
  live editor.
- `npx vitest run src/utils/__tests__/eventEditing.test.ts src/e2e/__tests__/editorRoundtrip.test.ts src/stores/__tests__/projectReducer.test.ts`
  — PASS after the fix (21/21).
- `npx tsc --noEmit` — PASS.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (17/17, including new map-edit round-trip coverage).
- `scripts\dev\verify-runtime.bat` — PASS after extending the native smoke
  harness to capture menu, shop, and battle-result screens.
- `rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-7` — PASS
  (17 native runtime screenshots).
- `powershell -File scripts/dev/verify-editor-runtime-roundtrip.ps1` —
  initially FAILED because the temp project copy lacked a `saves/`
  directory; fix applied: create the directory before launch.
- `powershell -File scripts/dev/verify-editor-runtime-roundtrip.ps1` —
  PASS after the fix (baseline and edited frame hashes differed).
- Live browser verification against `http://127.0.0.1:3000/` — PASS:
  event placement worked, `Ctrl+D` duplicated to the next free tile, delete
  opened a confirm dialog, and `Delete` removed the event after acceptance.
- Screenshot captured:
  `docs/screenshots/phase-7/18-editor-shortcuts-after-delete.png`.

### Slice 10 — final validation + closeout

- `npx tsc --noEmit` — PASS.
- `npx vite build` — PASS.
- `npx vitest run` — PASS (12 files, 75 tests).
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (17/17 Rust tests).
- `cargo build --manifest-path src-tauri/Cargo.toml` — PASS.
- `scripts\dev\verify-runtime.bat` — PASS.
- `powershell -File scripts/dev/verify.ps1` — PASS; runtime smoke observed
  `Project loaded: My First RPG`, `Map loaded: town`, and `SMOKE PASSED`.
- `powershell -File scripts/dev/verify-editor-runtime-roundtrip.ps1` —
  PASS; baseline / edited frame hashes differed.
- `npm run desktop:verify-content` — PASS with a temporary strict-port Vite
  dev server on `127.0.0.1:1420`.
- `rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-7` —
  PASS (17 native runtime screenshots refreshed).

---

## Phase 8 — Game visual foundation and creator workflow hardening

### Slice 5 — supplementary original visual assets

- `2026-05-18 00:23 -03:00` —
  `npx vitest run src/assets/generated/__tests__/assetCatalog.test.ts src/visual/__tests__/tileCatalog.test.ts`
  — initially FAILED because the expanded scene-asset catalog and tile IDs
  did not exist yet; fix applied: added deterministic supplementary asset
  generation plus editor/runtime catalog wiring.
- `2026-05-18 00:25 -03:00` —
  `python scripts/dev/generate_visual_assets.py` — PASS; generated original
  scene-support assets into `src/assets/generated/`,
  `assets/generated/web/`, and `assets/generated/runtime/`.
- `2026-05-18 00:25 -03:00` —
  `npx vitest run src/assets/generated/__tests__/assetCatalog.test.ts src/visual/__tests__/tileCatalog.test.ts`
  — PASS (4 tests).
- `2026-05-18 00:25 -03:00` — `npx tsc --noEmit` — PASS.
- `2026-05-18 00:26 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — PASS; runtime tests now include the expanded tile catalog coverage.

### Slice 6 — authored scene templates and widescreen bundled sample

- `2026-05-18 00:30 -03:00` —
  `npx vitest run src/templates/__tests__/sceneTemplates.test.ts src/validation/__tests__/bundledSample.test.ts src/stores/__tests__/projectReducer.test.ts`
  — initially FAILED because scene templates, map replacement support, and
  the widescreen bundled sample did not exist yet; fix applied: added seven
  reusable templates, template application in the editor, reducer support,
  and upgraded the bundled project maps.
- `2026-05-18 00:33 -03:00` —
  `npx vitest run src/templates/__tests__/sceneTemplates.test.ts src/validation/__tests__/bundledSample.test.ts src/stores/__tests__/projectReducer.test.ts`
  — PASS (25 tests).
- `2026-05-18 00:33 -03:00` — `npx tsc --noEmit` — PASS.
- `2026-05-18 00:34 -03:00` — `npx vite build` — PASS.
- `2026-05-18 00:34 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — initially FAILED because native loader tests still asserted the obsolete
  `10x10` town and old start position; fix applied: updated those tests to
  assert the new authored widescreen sample.
- `2026-05-18 00:35 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — PASS after the stale native assertions were updated.

### Slice 7 — runtime scene framing and authored blocker rendering

- `2026-05-18 00:38 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — initially FAILED because native sprite routing still collapsed authored
  `tree` and `interiorWall` blockers into the old generic wall sprite; fix
  applied: preserve explicit authored blocker visuals while retaining the
  legacy wall fallback.
- `2026-05-18 00:39 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — PASS after the sprite-routing fix.
- `2026-05-18 00:40 -03:00` — `cmd /c scripts\dev\smoke-runtime.bat`
  — PASS; runtime opened the widescreen sample and reached
  `SMOKE PASSED`.
- `2026-05-18 00:40 -03:00` —
  `rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-8-runtime-smoke`
  — PASS (17 native runtime screenshots captured after widening the smoke
  traversal to the new authored sample layout).

### Slice 8 — editor/runtime preview consistency

- `2026-05-18 00:46 -03:00` —
  `npx vitest run src/visual/__tests__/viewport.test.ts src/templates/__tests__/sceneTemplates.test.ts src/validation/__tests__/bundledSample.test.ts`
  — PASS (12 tests).
- `2026-05-18 00:46 -03:00` — `npx tsc --noEmit` — PASS.
- `2026-05-18 00:46 -03:00` — `npx vite build` — PASS.
- Result: the simulated playtest surface now derives its viewport from the
  same visual profile/camera helpers as the editor and native runtime, and
  editor collision cells render as an overlay rather than erasing authored
  scene art.

### Slice 9 — map-authoring workflow hardening

- `2026-05-18 00:52 -03:00` —
  `npx vitest run src/stores/__tests__/editorStore.test.ts src/stores/__tests__/projectReducer.test.ts`
  — initially FAILED because layer/tool state, rectangle painting, flood
  fill, and map resizing were not implemented yet; fix applied: added
  explicit editor authoring modes plus reducer actions for those operations.
- `2026-05-18 00:55 -03:00` —
  `npx vitest run src/stores/__tests__/editorStore.test.ts src/stores/__tests__/projectReducer.test.ts`
  — PASS (24 tests).
- `2026-05-18 00:55 -03:00` — `npx tsc --noEmit` — PASS.
- `2026-05-18 00:58 -03:00` —
  `npx vitest run src/stores/__tests__/editorStore.test.ts src/stores/__tests__/projectReducer.test.ts src/e2e/__tests__/editorRoundtrip.test.ts`
  — PASS (25 tests).
- `2026-05-18 00:58 -03:00` — `npx vite build` — PASS.
- Browser screenshot verification against `http://127.0.0.1:3000/` — PASS:
  map settings, layer tabs, selected-tile preview, brush-size buttons, and
  the clean visual-layer scene presentation all rendered correctly.

### Slice 10 — runtime UX/playability regression pass

- `2026-05-18 01:00 -03:00` — `cmd /c scripts\dev\verify-runtime.bat`
  — PASS.
- `2026-05-18 01:00 -03:00` — `cmd /c scripts\dev\smoke-runtime.bat`
  — PASS.
- `2026-05-18 01:00 -03:00` —
  `rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-8-ux-smoke`
  — PASS (17 screenshots captured during verification, then cleaned from
  the repo working tree because final evidence belongs under the dedicated
  game-visual-design screenshot set).
- Verified runtime surfaces under the widened scene profile: pause menu,
  inventory, party/status, quest journal, save slots, load slots, shop, and
  battle reward summary.

### Slice 11 — visual QA closeout and final evidence

- `2026-05-18 01:13 -03:00` — `python -m unittest tests.test_visual_assets`
  — initially FAILED because the original `tile_grass`, `tile_path`,
  `tile_water`, and `tile_wall` assets still had transparent outer edges;
  fix applied: regenerated those tiles as full-bleed original assets.
- `2026-05-18 01:14 -03:00` — `python scripts/dev/generate_visual_assets.py`
  — PASS; refreshed full-bleed generated web/runtime terrain tiles.
- `2026-05-18 01:14 -03:00` — `python -m unittest tests.test_visual_assets`
  — PASS; every production visual tile is opaque on all outer edges.
- `2026-05-18 01:18 -03:00` —
  `powershell -File scripts/dev/visual-verify.ps1 -OutputDir output\\visual-closeout\\runtime-wide-new`
  — PASS after fixing the script to prefer the same active out-of-OneDrive
  runtime build directory used by the main verification pipeline instead of
  an obsolete in-repo executable.
- `2026-05-18 01:19 -03:00` — editor/runtime evidence capture — PASS;
  committed screenshot set populated under
  `docs/screenshots/game-visual-design/`:
  `01-editor-16x9-map.png`, `02-runtime-16x9-map.png`,
  `03-editor-square-map.png`, `04-runtime-square-map.png`,
  `05-map-validation-no-gaps.png`, `06-scene-template-town.png`,
  `07-scene-template-forest.png`, and
  `08-scene-template-interior.png`.
- `2026-05-18 01:22 -03:00` — `npx tsc --noEmit` — PASS.
- `2026-05-18 01:22 -03:00` — `npx vite build` — PASS.
- `2026-05-18 01:23 -03:00` — `npx vitest run` — PASS
  (17 files, 97 tests).
- `2026-05-18 01:23 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (17/17 Rust tests).
- `2026-05-18 01:24 -03:00` —
  `cargo build --manifest-path src-tauri/Cargo.toml` — PASS.
- `2026-05-18 01:25 -03:00` — `scripts\\dev\\verify-runtime.bat`
  — PASS.
- `2026-05-18 01:25 -03:00` —
  `powershell -File scripts/dev/verify.ps1` — PASS; runtime smoke observed
  `Project loaded: My First RPG`, `Map loaded: town`, and `SMOKE PASSED`.
- `2026-05-18 01:27 -03:00` — `npm run desktop:verify-content`
  — PASS with a strict-port Vite server on `127.0.0.1:1420`.
- `2026-05-18 01:27 -03:00` — screenshot dimension audit — PASS;
  runtime evidence captured at `1280x720` and `768x768`, while editor
  evidence remained full-page `1600x900` captures with the authored frame
  visible inside the UI.

### Phase 9 — smooth movement and character animation foundation

- `2026-05-18 21:31 -03:00` —
  `git ls-remote https://github.com/0x0funky/agent-sprite-forge.git HEAD`
  — PASS; verified pinned upstream commit
  `fff651a89223b044ccfc0b75ed9f3754c6d739b1`.
- `2026-05-18 21:32 -03:00` — Python dependency check — Pillow present,
  NumPy missing. Fix applied:
  `python -m pip install numpy` — PASS (`numpy 2.4.6` installed).
- `2026-05-18 21:34 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev\generate-animation-assets.ps1`
  — PASS; generated 40 animation sheets plus manifest, prompts, metadata,
  and preview PNG/GIF evidence.
- `2026-05-18 21:39 -03:00` — `npm test` — PASS (18 files, 103 tests).
- `2026-05-18 21:40 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev\verify.ps1 -SkipSmoke`
  — PASS; configure/build/CTest passed.
- `2026-05-18 21:40 -03:00` —
  `cargo fmt --manifest-path src-tauri\Cargo.toml` — initially FAILED
  because `rustfmt` was not installed. Fix applied:
  `rustup component add rustfmt`, then `cargo fmt --manifest-path
  src-tauri\Cargo.toml` — PASS.
- `2026-05-18 21:40 -03:00` —
  `cargo test --manifest-path src-tauri\Cargo.toml --lib` — PASS
  (17/17 Rust tests).
- `2026-05-18 21:41 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-18 21:46 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev\verify.ps1 -SkipSmoke`
  — PASS after updating `runSmokeShots()` to account for leading
  `playAnimation` commands.
- `2026-05-18 21:47 -03:00` —
  `%LOCALAPPDATA%\RPGCreatorAI\build\rpg_creator_runtime.exe --smoke-shots docs\screenshots\phase-9-animation`
  — PASS; native screenshot harness wrote the normal RPG smoke sequence
  plus Phase 9 frames for walk mid-step, player interact, hurt, and
  attack.
- `2026-05-18 21:48 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev\verify.ps1`
  — PASS; configure/build/CTest passed and runtime 3-second smoke stayed
  alive with no stderr errors.
- `2026-05-18 21:49 -03:00` — `npm test` — PASS (18 files, 103 tests).
- `2026-05-18 21:49 -03:00` —
  `cargo test --manifest-path src-tauri\Cargo.toml --lib` — PASS
  (17/17 Rust tests).
- `2026-05-18 21:49 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).

### Phase 9 Hotfix — character scale and movement parity baseline

- `2026-05-19 21:01 -03:00` — `git diff --check` — PASS.
- `2026-05-19 21:01 -03:00` — `npm test` — PASS (18 files,
  107 tests).
- `2026-05-19 21:01 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-19 21:01 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (17/17 Rust tests).
- `2026-05-19 21:01 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.

### Phase 10 Slice 1 — professional editor shell and map tree

- `2026-05-19 21:03 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — initially
  FAILED as expected under TDD because map tree reducer actions did not
  exist yet. Fix applied: implemented map property, create, duplicate,
  remove, reference update, move, and reorder reducer actions.
- `2026-05-19 21:05 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — PASS
  (26/26 tests).
- `2026-05-19 21:05 -03:00` —
  `npm test -- src/validation/__tests__/validateProject.test.ts` —
  initially FAILED as expected under TDD because project map-tree validation
  did not exist yet. Fix applied: added duplicate id, missing map data,
  missing parent, orphan map, and cycle validation.
- `2026-05-19 21:06 -03:00` —
  `npm test -- src/validation/__tests__/validateProject.test.ts` — PASS
  (20/20 tests).
- `2026-05-19 21:11 -03:00` — `npm test` — PASS (18 files,
  115 tests).
- `2026-05-19 21:11 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-19 21:12 -03:00` — `npm run desktop:verify-content` —
  PASS; `http://127.0.0.1:1420/` served the RPGCreatorAI editor.
- `2026-05-19 21:12 -03:00` —
  `npx --yes playwright screenshot --timeout=30000 http://127.0.0.1:1420 output\phase10-slice1\editor-map-tree.png`
  — PASS; screenshot captured for the new map tree editor shell and copied
  to `docs/screenshots/phase10-slice1/editor-map-tree.png`.
- `2026-05-19 21:17 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS (49/49 tests) after QA fixes for atomic reorder, descendant-cycle
  prevention, and map path validation.
- `2026-05-19 21:17 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests) after adding stable root `parentId: null` serialization
  and map-reference metadata round-trip coverage.
- `2026-05-19 21:18 -03:00` — `git diff --check` — PASS.
- `2026-05-19 21:18 -03:00` — `npm test` — PASS (18 files,
  118 tests).
- `2026-05-19 21:18 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-19 21:18 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-19 21:18 -03:00` — `npm run desktop:verify-content` —
  PASS.
- `2026-05-19 21:19 -03:00` — `npm run build` — initially FAILED because
  `ExternalLink` was still used by the AI Tools toolbar after placeholder
  button cleanup. Fix applied: restored the icon import.
- `2026-05-19 21:19 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).

### Phase 10 Slice 2 — data-driven tilesets and layer authoring

- `2026-05-20 02:34 -03:00` —
  `npm test -- src/visual/__tests__/tileCatalog.test.ts src/stores/__tests__/editorStore.test.ts src/stores/__tests__/projectReducer.test.ts src/validation/__tests__/validateProject.test.ts src/validation/__tests__/bundledSample.test.ts`
  — initially FAILED as expected under TDD because tile catalog helpers,
  concrete authoring layers, locked-layer paint refusal, layer metadata
  reducer actions, tileset validation, and region validation did not exist
  yet. Fix applied: implemented data-driven tilesets, layer controls, region
  authoring, passability overlays, and validation.
- `2026-05-20 02:35 -03:00` — focused TypeScript slice tests — PASS
  (5 files, 65 tests).
- `2026-05-20 02:35 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-20 02:35 -03:00` — `npm test` — PASS (18 files,
  126 tests).
- `2026-05-20 02:36 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-20 02:36 -03:00` —
  `cmake --build --preset default --target rpg_tests` — PASS/no rebuild
  required for the in-repo build tree.
- `2026-05-20 02:36 -03:00` — `ctest --preset default` — PASS
  (1/1 C++ tests).
- `2026-05-20 02:38 -03:00` — Browser smoke at
  `http://127.0.0.1:3000` — PASS; editor loaded, layer controls for
  Ground/Decor/Front/Pass/Region were present, Region selection exposed
  region brushes, and console error log was empty. Screenshot capture through
  the in-app browser timed out twice, so this run is recorded as DOM/console
  smoke rather than screenshot evidence.
- `2026-05-20 02:39 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `Databases loaded: ... 2 tilesets ...` followed by `SMOKE PASSED`.
- `2026-05-20 02:39 -03:00` — `npm run desktop:verify-content` —
  initially FAILED because no Vite server was running on the Tauri-only
  port `127.0.0.1:1420`. Fix applied: started `npm run dev:tauri`.
- `2026-05-20 02:40 -03:00` — `npm run desktop:verify-content` — PASS;
  `http://127.0.0.1:1420/` served the RPGCreatorAI editor.
- `2026-05-20 02:41 -03:00` — `git diff --check` — PASS.
- `2026-05-20 02:41 -03:00` — `npm test` — PASS (18 files,
  126 tests) after normalizing sample map layer order.
- `2026-05-20 02:41 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-20 02:42 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-20 02:42 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED` with `2 tilesets` loaded.
- `2026-05-20 02:42 -03:00` — `npm run desktop:verify-content` — PASS.

### Phase 10 Slice 3C — deterministic scheduled events

- `2026-05-24 15:55 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — PASS; configure/build/CTest passed after adding `EventScheduler` and
  runtime scheduled-event integration.
- `2026-05-24 15:55 -03:00` —
  `npm test -- src/validation/__tests__/validateProject.test.ts` — PASS
  (1 file, 26 tests) after adding common-event trigger validation.
- `2026-05-24 19:49 -03:00` —
  `npm test -- src/validation/__tests__/validateProject.test.ts` — PASS
  (1 file, 27 tests) after adding required condition switches for
  autorun/parallel common events.
- `2026-05-24 19:49 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — PASS; configure/build/CTest passed after preserving scheduled runners
  through map-transfer tails and parsing common-event animations.
- `2026-05-24 19:50 -03:00` — `git diff --check` — PASS.
- `2026-05-24 19:51 -03:00` — `npm test` — PASS (18 files,
  135 tests).
- `2026-05-24 19:51 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-24 19:51 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-24 19:52 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED` after loading `2 tilesets` and `1 common events`.
- `2026-05-24 19:52 -03:00` — `npm run desktop:verify-content` — PASS;
  `http://127.0.0.1:1420/` served the RPGCreatorAI editor.

### Phase 10 Slice 3D — command stack v1 polish

- `2026-05-24 19:59 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — PASS
  (1 file, 39 tests) after adding reducer operations for insert, move,
  duplicate, and branch-target command insertion.
- `2026-05-24 19:59 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`) after wiring the event-editor command toolbar.
- `2026-05-24 20:02 -03:00` — `git diff --check` — PASS.
- `2026-05-24 20:02 -03:00` — `npm test` — PASS (18 files,
  138 tests).
- `2026-05-24 20:02 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-24 20:02 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-24 20:03 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-24 20:03 -03:00` — Chrome DevTools UI smoke at
  `http://127.0.0.1:1420/` — PASS; Events screen rendered command toolbar
  actions, branch target rows, copy enabled paste, paste duplicated the
  selected command branch, dirty state updated, and console had no errors.
- `2026-05-24 20:03 -03:00` — `npm run desktop:verify-content` — PASS;
  `http://127.0.0.1:1420/` served the RPGCreatorAI editor.

### Phase 10 Slice 3D — movement-route basics

- `2026-05-24 20:11 -03:00` —
  `npm test -- src/validation/__tests__/validateProject.test.ts` — RED;
  the new `setMovementRoute` validation test failed because movement-route
  target/step validation did not exist yet.
- `2026-05-24 20:11 -03:00` —
  `cmake --build build --target rpg_tests --config Debug` — BLOCKED before
  reaching the new C++ test because the direct PowerShell environment did not
  have MSVC standard include paths (`fatal error C1083: 'string'`). Fix:
  use repo `scripts/dev/verify.ps1`, which bootstraps `VsDevCmd.bat`.
- `2026-05-24 20:16 -03:00` —
  `npm test -- src/validation/__tests__/validateProject.test.ts` — PASS
  (1 file, 28 tests) after adding `setMovementRoute` command validation.
- `2026-05-24 20:16 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`) after wiring the event command editor UI.
- `2026-05-24 20:16 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — PASS
  (1 file, 39 tests) before the reducer route regression was added.
- `2026-05-24 20:17 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — PASS; configure/build/CTest passed with the new C++ route parser and
  `EventRunner` request tests.
- `2026-05-24 20:17 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — PASS
  (1 file, 40 tests) after adding page-1 mirroring coverage for
  `setMovementRoute`.
- `2026-05-25 10:29 -03:00` —
  `npm test -- src/validation/__tests__/validateProject.test.ts src/validation/__tests__/validateMap.test.ts`
  — RED; malformed `setMovementRoute` data threw on missing `steps` instead
  of reporting validation errors.
- `2026-05-25 10:29 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — RED; new `Game` tests showed player movement routes skipped touch events
  and `wait: true` did not block tail commands.
- `2026-05-25 10:31 -03:00` —
  `npm test -- src/validation/__tests__/validateProject.test.ts src/validation/__tests__/validateMap.test.ts`
  — PASS (2 files, 30 tests) after route shape validation stopped throwing.
- `2026-05-25 10:32 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — PASS; configure/build/CTest passed after route movement reused touch
  dispatch and `wait: true` blocked by route duration before tail commands.
- `2026-05-25 10:33 -03:00` — `git diff --check` — PASS.
- `2026-05-25 10:33 -03:00` — `npm test` — PASS (19 files,
  142 tests).
- `2026-05-25 10:34 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-25 10:34 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-25 10:35 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-25 10:36 -03:00` — Chrome DevTools UI smoke at
  `http://127.0.0.1:1420/` — PASS; Events screen exposed
  `Set Movement Route`, adding it created a selectable command, the route
  editor rendered target/repeat/skippable/wait controls, adding a `Wait`
  route step updated the command to 2 steps, dirty state appeared, and
  console had no errors.
- `2026-05-25 10:36 -03:00` — `npm run desktop:verify-content` — PASS;
  `http://127.0.0.1:1420/` served the RPGCreatorAI editor.

### Phase 10 Slice 3D — command-stack range selection/delete

- `2026-05-25 10:40 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — RED; new
  `REMOVE_COMMAND_RANGE` and `REMOVE_PAGE_COMMAND_RANGE` expectations left
  root and nested branch commands unchanged because reducer batch actions did
  not exist yet.
- `2026-05-25 10:42 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — PASS
  (1 file, 42 tests) after adding same-list range delete actions and page-1
  mirroring.
- `2026-05-25 10:45 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — PASS
  (1 file, 42 tests) after wiring command-row range selection UI.
- `2026-05-25 10:45 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-25 10:45 -03:00` —
  `npm test -- src/stores/__tests__/projectReducer.test.ts` — PASS
  (1 file, 43 tests) after adding cross-branch range no-op coverage.
- `2026-05-25 10:47 -03:00` — `npm test` — PASS (19 files,
  145 tests).
- `2026-05-25 10:47 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-25 10:48 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-25 10:48 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-25 10:49 -03:00` — Chrome DevTools UI smoke at
  `http://127.0.0.1:1420/` — PASS; Events screen rendered command-row
  checkboxes, shift-click selected a 4-command range inside one choice branch,
  toolbar showed `4 selected`, Delete removed that inclusive range and marked
  the project dirty, branch headers stayed outside selection, and console had
  no errors.
- `2026-05-25 10:49 -03:00` — `npm run desktop:verify-content` — PASS;
  `http://127.0.0.1:1420/` served the RPGCreatorAI editor.
- `2026-05-25 10:51 -03:00` —
  `npm test -- src/utils/__tests__/commandSelection.test.ts` — RED; the
  extracted command-selection helper did not exist yet, proving the new
  anchor-reset and checkbox-keyboard tests were active before implementation.
- `2026-05-25 10:52 -03:00` —
  `npm test -- src/utils/__tests__/commandSelection.test.ts` — PASS
  (1 file, 3 tests) after adding shared command-selection helpers.
- `2026-05-25 10:53 -03:00` —
  `npm test -- src/utils/__tests__/commandSelection.test.ts src/stores/__tests__/projectReducer.test.ts`
  — PASS (2 files, 46 tests) after wiring the event editor to the helper,
  improving checkbox accessible names, and keying the command stack by
  map/event/page to clear stale selection on context changes.
- `2026-05-25 10:53 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`) after the helper refactor.
- `2026-05-25 10:54 -03:00` — `npm test` — PASS (20 files,
  148 tests).
- `2026-05-25 10:54 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — FAIL; the
  `runtime_commands::tests::locate_picks_up_env_override` test raced with
  another test mutating the global `RPG_RUNTIME_EXE` environment variable and
  observed the local runtime fallback path instead of the temporary override.
- `2026-05-25 10:54 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib runtime_commands::tests::locate_picks_up_env_override -- --exact --nocapture`
  — PASS; isolated reproduction supported an environment-race root cause.
- `2026-05-25 10:54 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib runtime_commands::tests -- --test-threads=1`
  — PASS; serializing the two env-mutating tests confirmed the race.
- `2026-05-25 10:55 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests) after guarding env-mutating runtime tests with a
  test-only mutex and restoring the previous env var.
- `2026-05-25 10:55 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED`.
- `2026-05-25 10:57 -03:00` — Chrome DevTools UI smoke at
  `http://127.0.0.1:1420/` — PASS; checkbox labels now include command
  titles/descriptions, shift-click selected a 4-command range, pressing
  Delete while focus remained on the checkbox removed the range, switching to
  `shop_keeper` remounted the stack with zero checked commands and disabled
  Delete, and console had no errors.
- `2026-05-25 10:57 -03:00` — `npm run desktop:verify-content` — PASS;
  `http://127.0.0.1:1420/` served the RPGCreatorAI editor.

### Phase 10 Slice 4B — types and terms database shards

- `2026-05-31 22:08 -03:00` —
  `npm test -- src/adapters/__tests__/BrowserMemoryAdapter.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — RED; seeded project lacked `database.types` / `database.terms`, and
  database validation did not inspect type tables or required term labels.
- `2026-05-31 22:08 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib fs_commands::tests::read_project_extracts_database_shards -- --exact`
  — RED; Tauri database shard extraction did not include `types` or `terms`.
- `2026-05-31 22:11 -03:00` —
  `npm test -- src/adapters/__tests__/BrowserMemoryAdapter.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — PASS (2 files, 17 tests) after adding the TypeScript schema, bundled
  shards, browser adapter extraction, default merging, and validation rules.
- `2026-05-31 22:11 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib fs_commands::tests::read_project_extracts_database_shards -- --exact`
  — PASS after adding Tauri database refs, object-shard extraction, and
  fixture coverage for `types` and `terms`.
- `2026-05-31 22:12 -03:00` —
  `npm test -- src/adapters/__tests__/BrowserMemoryAdapter.test.ts src/validation/__tests__/validateDatabases.test.ts`
  — PASS (2 files, 17 tests) after adding export/import assertions for the
  new shards.
- `2026-05-31 22:12 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib fs_commands::tests::write_then_read_round_trips_databases -- --exact`
  — PASS after asserting Tauri write/read preserves object-style
  `types`/`terms`.
- `2026-05-31 22:13 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — RED; new C++ ProjectLoader test showed `DatabaseReference` did not yet
  expose `typesPath` or `termsPath`.
- `2026-05-31 22:14 -03:00` — `npm run typecheck` — PASS.
- `2026-05-31 22:14 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke`
  — PASS; configure/build/CTest passed after `ProjectLoader` parsed optional
  `database.types` and `database.terms` paths.
- `2026-05-31 22:14 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-31 22:15 -03:00` — `npm test` — PASS (20 files,
  152 tests).
- `2026-05-31 22:15 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and `vite build`).
- `2026-05-31 22:15 -03:00` —
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` — PASS
  (18/18 Rust tests).
- `2026-05-31 22:16 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest passed and runtime smoke reported
  `SMOKE PASSED` after loading `My First RPG`.
- `2026-05-31 22:17 -03:00` — Chrome DevTools UI smoke at
  `http://127.0.0.1:1420/` — PASS; Database screen opened, Weapons tab
  showed `Iron Sword`, weapon type and price fields rendered, and console had
  no warnings or errors.
- `2026-05-31 22:17 -03:00` — `npm run desktop:verify-content` — PASS;
  `http://127.0.0.1:1420/` served the RPGCreatorAI editor.
- `2026-05-31 22:17 -03:00` — `git diff --check` — PASS with line-ending
  conversion warnings only.

### Phase 10 FRA-15 / RT-001 — native runtime project validator seam

- `2026-06-01 13:19:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; new C++ test intentionally failed because
  `runtime/RuntimeProjectValidator.h` did not exist.
- `2026-06-01 13:24:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS after adding `RuntimeProjectValidator`, startup integration, and
  focused validator coverage.
- `2026-06-01 13:27:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime stayed alive for 3 seconds, loaded project/databases/map,
  and emitted no `[ERROR]` lines.
- `2026-06-01 13:30:00 -03:00` — `cmake --preset default` — PASS with
  existing FetchContent/dependency deprecation warnings only.
- `2026-06-01 13:30:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — PASS; Ninja reported no work to do after the previous green build.
- `2026-06-01 13:30:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed.
- `2026-06-01 13:30:00 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.

### Phase 10 FRA-16 / RT-002 — interactive runtime choices UI

- `2026-06-01 13:35:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — RED; new `DialogueSystem` and `EventRunner` tests failed because choice
  UI APIs did not exist and `showChoices` still defaulted to first choice.
- `2026-06-01 13:36:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS after adding choice state, runner wait/branch consumption, input
  handling, rendering, and smoke-harness choice confirmation.
- `2026-06-01 13:36:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime stayed alive for 3 seconds, loaded project/databases/map,
  and emitted no `[ERROR]` lines.
- `2026-06-01 13:38:00 -03:00` — `cmake --preset default` — PASS with
  existing FetchContent/dependency deprecation warnings only.
- `2026-06-01 13:38:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default"`
  — PASS.
- `2026-06-01 13:38:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed.
- `2026-06-01 13:38:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/smoke-runtime.ps1 -BuildDir build`
  — PASS; runtime smoke reported `SMOKE PASSED`.
- `2026-06-01 13:38:00 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.

### Phase 10 FRA-26 / PT-005 — placeholder AI/debug UI gating

- `2026-06-01 15:48:30 -03:00` —
  `npm test -- --run src/components/layout/__tests__/MvpPlaceholderGating.test.tsx`
  — RED as expected; new tests found visible bottom-panel AI suggestions,
  `AI Tools` navigation dispatching `ai-tools`, and an actionable provider
  screen.
- `2026-06-01 15:50:29 -03:00` —
  `npm test -- --run src/components/layout/__tests__/MvpPlaceholderGating.test.tsx`
  — PASS after replacing bottom-panel suggestions with diagnostics, removing
  primary `ai-tools` navigation/routing, and making the future AI workspace
  read-only.
- `2026-06-01 15:52:09 -03:00` — `npm run typecheck` — FAIL; the new test's
  Vitest mock generic did not satisfy `React.Dispatch<EditorAction>`. Fix:
  typed the mock as a one-argument dispatch function.
- `2026-06-01 15:52:45 -03:00` — `npm run typecheck` — PASS.
- `2026-06-01 15:52:45 -03:00` —
  `npm test -- --run src/components/layout/__tests__/MvpPlaceholderGating.test.tsx`
  — PASS (3/3 tests).
- `2026-06-01 15:52:45 -03:00` —
  `npm test -- --run src/stores/__tests__/editorStore.test.ts` — PASS
  (5/5 tests).
- `2026-06-01 15:53:00 -03:00` — `npm run build` — PASS (`tsc --noEmit`
  and Vite production build; existing chunk-size warning only).
- `2026-06-01 15:53:00 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; CMake configure/build, CTest, and runtime smoke all passed. Smoke
  reported `SMOKE PASSED`; existing optional missing-audio warning remained
  non-fatal.
- `2026-06-01 15:54:08 -03:00` — `git diff --check` — PASS with line-ending
  conversion warnings only.

### Phase 10 FRA-27 / QA-001 — bundled sample MVP coverage

- `2026-06-01 15:58:28 -03:00` —
  `npm test -- --run src/validation/__tests__/bundledSample.test.ts`
  — RED as expected; new fixture coverage found missing `controlSelfSwitch`,
  self-switch pages, gated common-event coverage, and foreground occlusion.
- `2026-06-01 15:59:30 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — RED; initial C++ coverage used a complex doctest `CHECK(a || b)`. Fix:
  split the condition into a named boolean assertion.
- `2026-06-01 16:00:10 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — RED as expected; sample maps still lacked foreground occlusion and the
  `route_coach` event required by the new loader test.
- `2026-06-01 16:01:45 -03:00` —
  `npm test -- --run src/validation/__tests__/bundledSample.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS; 40 Vitest tests passed after expanding the bundled sample.
- `2026-06-01 16:02:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS; `RPGTests` passed.
- `2026-06-01 16:04:07 -03:00` —
  `npm test -- --run src/validation/__tests__/bundledSample.test.ts src/validation/__tests__/validateProject.test.ts`
  — PASS; 2 files and 40 tests passed.
- `2026-06-01 16:04:20 -03:00` — `npm run typecheck` — PASS.
- `2026-06-01 16:04:40 -03:00` — `npm run build` — PASS; Vite build
  completed with the existing chunk-size warning only.
- `2026-06-01 16:05:00 -03:00` —
  `cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 -no_logo && cmake --build --preset default && ctest --test-dir build --output-on-failure"`
  — PASS; Ninja reported no work to do and `RPGTests` passed.
- `2026-06-01 16:05:20 -03:00` —
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1`
  — PASS; configure/build/CTest/runtime smoke completed, with existing
  non-fatal dependency warnings and optional missing-audio warning only.
- `2026-06-01 16:05:34 -03:00` — `git diff --check` — PASS with
  line-ending conversion warnings only.

