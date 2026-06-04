# Phase 11 Linear Closeout Status

Issue: CP-127 / FRA-162
Date: 2026-06-04

## Result

This closeout records the real Linear project state before the final ship
gate. It does not mark the project complete.

Project:
`https://linear.app/franco-company/project/rpgcreatorai-complete-product-platform-bdbde50826e7`

Project-linked Linear status document:
`https://linear.app/franco-company/document/cp-127-pre-ship-linear-closeout-status-56b4d6f8148e`

Latest pushed repo commit at review time:
`fb1a8662bcc359fa7df3f6bd095f531b99b6c9ca`
(`Add CP-126 complete platform validation report`).

Validated baseline from the final report:
`c596a79970a2b55238662c5c321e28f31d7c34e9`
(`Expand CP-125 bundled sample evidence`).

## Linear State Reviewed

FRA-162 / CP-127 was read from Linear before this document was written.

Project review on 2026-06-04 returned:

- Project status: Backlog.
- Project completed date: not set.
- Milestones 00 through 14: 100%.
- Milestone 15, `Docs Examples And Final Ship`: 78.13%.
- Todo issues: FRA-163 / CP-128, `Complete Platform Final Ship Gate`.
- In Progress issues: FRA-162 / CP-127, `Linear Closeout Comments And
  Project Status`.
- Done issue listing returned completed project issues with no next page.

After CP-127 closes, CP-128 is expected to be the only remaining open issue.
The project must remain incomplete until CP-128 passes the final ship gate and
records its own evidence.

## Status Update Tool Limitation

The Linear connector exposed status-update wrappers, but the backend rejected
both operations during CP-127:

```text
_get_status_updates -> MCP error -32602: Tool get_status_updates not found
_save_status_update -> MCP error -32602: Tool save_status_update not found
```

Because of that connector limitation, CP-127 uses this repo-tracked document,
the project-linked Linear document above, and the FRA-162 issue comment as the
durable closeout/status artifacts. No project status update object is claimed.

## Evidence Links

Final validation report:
`docs/PHASE_11_COMPLETE_PLATFORM_VALIDATION_REPORT.md`

That report records:

- `scripts/dev/verify.ps1` PASS.
- `npm run desktop:package:windows` PASS.
- Runtime smoke PASS.
- Editor-runtime screenshot roundtrip PASS.
- AI/provider validation as offline/mock-backed normal validation.
- No live paid provider calls during normal validation.
- Known limitations and immediate CP-127 / CP-128 next steps.

Related issues:

- FRA-161 / CP-126:
  `https://linear.app/franco-company/issue/FRA-161/cp-126-complete-platform-final-validation-report`
- FRA-162 / CP-127:
  `https://linear.app/franco-company/issue/FRA-162/cp-127-linear-closeout-comments-and-project-status`
- FRA-163 / CP-128:
  `https://linear.app/franco-company/issue/FRA-163/cp-128-complete-platform-final-ship-gate`

## Known Limitations Carried Into CP-128

- The Windows package remains an unsigned Tauri debug no-bundle prototype.
  Signing, installer generation, publisher identity, store upload, and release
  credentials require explicit future decisions and credentials.
- Browser mode cannot access arbitrary local files, spawn the native runtime,
  create native playtest session folders, read native runtime logs, or read
  native runtime state snapshots.
- Live provider diagnostics were not run. They require explicit credentials,
  user opt-in, and cost/rate-limit awareness.
- Local audio files/devices are optional; missing files or unavailable devices
  warn and continue.
- Known non-fatal Vite chunk-size and CMake/dependency warnings remain present
  during otherwise passing validation.
- `.commandcode/taste/` is an existing untracked workspace artifact and must
  not be staged.

## CP-128 Handoff

CP-128 must:

1. Re-read FRA-163 from Linear.
2. Confirm no unsafe staged files.
3. Run the full canonical verification gate.
4. Run the packaged Windows smoke.
5. Confirm final evidence and screenshots.
6. Commit and push final ship-gate docs if changed.
7. Comment FRA-163 with exact evidence.
8. Move FRA-163 Done only after validation passes.
9. Complete the Linear project only after CP-128 is Done.
