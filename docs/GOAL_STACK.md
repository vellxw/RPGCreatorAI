# Goal Stack — RPGCreatorAI

## Current Goal
Phase 4.1: Validation Hardening & Desktop Bridge Preparation — COMPLETE

## Active Phase
Phase 4.1

## Subgoals
1. ✅ Fix `verify.ps1` — drop unsupported `New-TemporaryFile`
2. ✅ Route CMake binary dir outside OneDrive (`%LOCALAPPDATA%\RPGCreatorAI\build`)
3. ✅ Add `scripts/dev/verify-runtime.bat` (pure cmd path)
4. ✅ Update `build_bootstrap.bat` to honour `BUILD_DIR` env var
5. ✅ Run actual validation: tsc, vite build, vitest, cmake configure, cmake build, ctest, runtime smoke
6. ✅ Document workaround in `docs/WINDOWS_BUILD_NOTES.md`
7. ✅ Refresh `docs/PHASE_4_VALIDATION_REPORT.md`
8. ✅ Append `docs/VALIDATION_LOG.md`
9. ⬜ Commit and push

## Success Criteria
- Frontend typecheck/build/tests green ✅
- C++ runtime configures/builds/tests green ✅
- Runtime smoke passes ✅
- OneDrive lock issue resolved ✅
- No new screens, no UI redesign, no AI calls ✅

## Current Status
All validation green. About to commit Phase 4.1.

## Blockers
None.

## Next Action
Commit `Phase 4.1: harden validation and Windows runtime build` and push.
After that, the project is ready for Phase 5 (desktop shell + real
FileSystemAdapter / RuntimeLaunchAdapter integration) when the user
approves.
