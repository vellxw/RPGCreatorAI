# Goal Stack — RPGCreatorAI

## Current Goal
Phase 5: Desktop Shell + Real FileSystem + Runtime Bridge — IMPLEMENTATION COMPLETE

## Active Phase
Phase 5

## Subgoals
1. ✅ Spec checkpoint committed (`1af9c22`)
2. ✅ Rust toolchain installed (user-space, no admin)
3. ✅ `.cargo/config.toml` redirects target-dir outside OneDrive
4. ✅ Tauri 2.11 scaffold under `src-tauri/`
5. ✅ Typed IPC surface (`window.rpgBridge`)
6. ✅ Rust commands: fs_*, runtime_*, config_*, shell_info
7. ✅ Path sandbox: canonicalize_inside_user_space + ensure_inside + join_inside
8. ✅ Atomic write + per-file backup + N-per-file pruning + auto-`.gitignore`
9. ✅ Runtime executable resolution (env → project build → LOCALAPPDATA → shell sibling)
10. ✅ Renderer adapters wired through bridge
11. ✅ Toolbar Open / Recent gated on shell presence
12. ✅ PlaytestScreen runtime panel with status polling and Stop button
13. ✅ Frontend tests (43/43)
14. ✅ Rust unit tests (14/14)
15. ✅ Phase 4.1 C++ pipeline still green
16. ✅ Tauri dev verified end-to-end (Vite on 1420 strictPort + DOM content check + window screenshot)
17. ✅ Silent-port-collision bug found, fixed, and regression-tested

## Success Criteria (from PHASE_5_SCOPE)
- `npm run desktop:dev` opens the editor in a desktop window — VERIFIED
- Open Project loads from disk via the shell — IMPLEMENTED + REGRESSION TESTED via `verify-tauri-content.ps1`
- Save writes atomically with backups — UNIT TESTED
- Open in Runtime spawns the C++ runtime — IMPLEMENTED (path resolution + spawn + status + kill all unit tested)
- Browser mode keeps Phase 4.1 behaviour intact — VERIFIED via factory feature detection
- All pipelines green — VERIFIED

## Current Status
About to commit and push.
