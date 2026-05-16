# Goal Stack — RPGCreatorAI

## Current Goal
Phase 5: Desktop Shell + Real FileSystem + Runtime Bridge — SPEC COMPLETE (awaiting approval to implement)

## Active Phase
Phase 5 (planning only)

## Spec Artifacts Created
- `.kiro/specs/phase5-desktop-shell-runtime-bridge/requirements.md`
- `.kiro/specs/phase5-desktop-shell-runtime-bridge/design.md`
- `.kiro/specs/phase5-desktop-shell-runtime-bridge/tasks.md`
- `docs/PHASE_5_SCOPE.md`
- `docs/DESKTOP_SHELL_ARCHITECTURE.md`
- `docs/FILESYSTEM_ADAPTER.md`
- `docs/RUNTIME_LAUNCH_BRIDGE.md`

## Subgoals (Implementation, not yet started)
1. ⬜ Add Tauri toolchain (Rust, @tauri-apps/cli)
2. ⬜ Generate Tauri scaffold under `src-tauri/`
3. ⬜ Define typed IPC surface (`window.rpgBridge`)
4. ⬜ Implement Rust commands: fs.* and runtime.* and config.*
5. ⬜ Path sandbox + atomic write + backup + prune
6. ⬜ Real `FileSystemAdapter` and `DesktopRuntimeAdapter` wiring
7. ⬜ Toolbar Open/Recent actions (gated on shell presence)
8. ⬜ Renderer + Rust unit tests
9. ⬜ Desktop dev build pipeline
10. ⬜ Validation green: tsc, vite, vitest, cargo test, desktop build, runtime smoke
11. ⬜ Commit + push

## Success Criteria (mirror PHASE_5_SCOPE)
- `npm run desktop:dev` opens the editor in a desktop window
- Open Project loads from disk via the shell
- Save writes atomically with backups
- Open in Runtime spawns the C++ runtime
- Browser mode keeps Phase 4.1 behaviour intact
- All pipelines green; working tree clean

## Current Status
Spec complete. Waiting for user approval before implementation begins.

## Blockers
None for the spec.
For implementation: requires the Rust toolchain on this machine. Documented in DESKTOP_SHELL_ARCHITECTURE.md.

## Next Action
Wait for explicit approval, then start at task T1 (tooling).
