# Linear Auth Gate — Phase 12 Closure Barrier

**Status**: BLOCKED on user-side MCP re-authentication.
**Recorded**: 2026-06-17.
**Owner**: human (auth-required action).

## What happened

Phase 12 implementation closed every code and documentation task from
PX-001 (FRA-435) through PX-250 (FRA-620+) on the local repo. All
artifacts are committed and pushed to `origin/main` (latest commit
`eef41e3`).

However, the Linear issue side of the project was **not** closed in
Linear itself beyond M03. Specifically:

- M00 (FRA-435..444 / PX-001..010): closed in Linear in earlier runs.
- M01 (FRA-445..464 / PX-011..030): closed in Linear in earlier runs.
- M02 (FRA-465..489 / PX-031..055): closed in Linear in earlier runs.
- M03 (FRA-490 / FRA-515..520 / PX-056..085): closed in Linear in
  earlier runs.
- **M04..M12 (FRA-521..620+ / PX-086..250): NOT closed in Linear.**

The first attempt in this session to call Linear MCP returned
`HTTP 401 — Authentication required`. The MCP access token stored at
`%USERPROFILE%\.commandcode\mcp-tokens.json` is no longer valid for
the Linear GraphQL API (MCP OAuth tokens are not interchangeable with
personal API keys or with the GraphQL endpoint without the MCP server
wrapper).

## Why this is a hard blocker

Per the project operating rules in `AGENTS.md`:

> Stop only if credentials are required, admin install is required,
> about to delete/overwrite user data outside this repo, remote origin
> is wrong or ambiguous, a product decision materially changes project
> direction, a command requires user interaction the agent cannot
> complete, or a tool/environment limitation cannot be solved from the
> repo.

Re-authenticating the Linear MCP requires either:
1. Running `cmd mcp auth linear` interactively (human OAuth flow), or
2. Providing a personal Linear API key (`lin_api_*`).

Neither action can be completed by the agent. The script that ships
with this gate (`scripts/dev/linear-batch-close.mjs`) is ready to run
the moment MCP access is restored — it lists every FRA-5xx / FRA-6xx
issue that should be closed, posts the evidence comment, and moves
each issue to Done.

## What was done to minimize blast radius

1. **Honest disclosure**: the gap was logged in
   `docs/VALIDATION_LOG.md` and `docs/PHASE_12_M12_INTEGRATION_GATE.md`
   before this run, not hidden behind a "done" claim.
2. **Reusable artifact**: `scripts/dev/linear-batch-close.mjs` is
   idempotent, dry-run by default, and reads from the MCP token cache.
   When MCP auth is restored, the user runs:
   ```bash
   node scripts/dev/linear-batch-close.mjs --apply
   ```
   and every M04..M12 issue is closed with the matching evidence
   comment in one batch.
3. **Pending in-repo work closed**: the only outstanding in-repo
   follow-up flagged during Phase 12 (M07 App.tsx + TopToolbar
   "Save & Playtest" wire-up) is implemented in this same gate so the
   user does not need a separate Phase 13 just for the first-run flow.
4. **No fake state**: `git log`, `git status`, and the Linear-visible
   state were never overwritten with synthetic "Done" timestamps.

## Issues queued for closure (run script after re-auth)

| FRA   | PX    | Milestone | Title                                                         |
|-------|-------|-----------|---------------------------------------------------------------|
| 521   | 086   | M04       | Provider Mode Type Definitions                                 |
| 522   | 087   | M04       | Creator Mode Resolution Helper                                |
| 523   | 088   | M04       | Per-Pipeline Model Defaults                                  |
| 524   | 089   | M04       | Custom Advanced Provider Panel Boundary                       |
| 525   | 090   | M04       | Provider Mode Persistence                                    |
| 526   | 091   | M04       | Creator Mode Selector UI                                     |
| 527   | 092   | M04       | Per-Workflow Override UI                                     |
| 528   | 093   | M04       | Provider Mode Tests                                          |
| 529   | 094   | M04       | Provider Mode Integration Gate                               |
| 530   | 095   | M04       | M04 Ship Gate                                                 |
| 531   | 096   | M05       | Candidate Type Model                                          |
| 532   | 097   | M05       | Candidate Store Reducer                                       |
| 533   | 098   | M05       | Candidate Persistence Boundary                                |
| 534   | 099   | M05       | Candidate Activity Link                                       |
| 535   | 100   | M05       | Candidate Accept Action                                       |
| 536   | 101   | M05       | Candidate Reject Action                                       |
| 537   | 102   | M05       | Candidate Review Panel UI                                     |
| 538   | 103   | M05       | Candidate Tests                                               |
| 539   | 104   | M05       | Candidate Integration Gate                                    |
| 540   | 105   | M05       | M05 Ship Gate                                                 |
| 541   | 106   | M06       | Developer Mode Store                                         |
| 542   | 107   | M06       | Developer Mode Toggle UI                                      |
| 543   | 108   | M06       | Developer Mode Disclaimer                                     |
| 544   | 109   | M06       | Developer Mode Capability Gating                              |
| 545   | 110   | M06       | Developer Mode Activity Logging                               |
| 546   | 111   | M06       | Developer Mode Tests                                          |
| 547   | 112   | M06       | Developer Mode Integration Gate                               |
| 548   | 113   | M06       | M06 Ship Gate                                                 |
| 549   | 114   | M07       | First-Run Store                                               |
| 550   | 115   | M07       | First-Run Path Selector UI                                    |
| 551   | 116   | M07       | Save & Playtest Helper                                        |
| 552   | 117   | M07       | First-Run Tests                                                |
| 553   | 118   | M07       | First-Run Integration Gate                                     |
| 554   | 119   | M07       | M07 Ship Gate                                                  |
| 555   | 120   | M08       | Provider Capability Matrix                                     |
| 556   | 121   | M08       | Legal & Cost Notes                                             |
| 557   | 122   | M08       | Recommendation Document                                        |
| 558   | 123   | M08       | M08 Ship Gate                                                  |
| 559   | 124   | M09       | Animation Quality Rubric                                       |
| 560   | 125   | M09       | Animation Rubric Fixtures                                      |
| 561   | 126   | M09       | Animation Rubric Tests                                         |
| 562   | 127   | M09       | M09 Ship Gate                                                  |
| 563   | 128   | M10       | Refinement Budget Model                                        |
| 564   | 129   | M10       | Refinement Executor Contract                                   |
| 565   | 130   | M10       | Multi-Round Refinement Loop                                    |
| 566   | 131   | M10       | Cost Guardrails                                                |
| 567   | 132   | M10       | Refinement Pipeline Tests                                      |
| 568   | 133   | M10       | Refinement Pipeline Integration Gate                           |
| 569   | 134   | M10       | M10 Ship Gate                                                  |
| 570   | 135   | M11       | Sprite Sheet Spec                                              |
| 571   | 136   | M11       | Sprite Sheet Optimization Validator                            |
| 572   | 137   | M11       | Sprite Sheet Optimization Tests                                |
| 573   | 138   | M11       | Sprite Sheet Optimization Integration Gate                     |
| 574   | 139   | M11       | M11 Ship Gate                                                  |
| 575   | 140   | M12       | Phase 12 Roadmap Final Reconciliation                          |
| 576   | 141   | M12       | Phase 12 Risk Register Final Reconciliation                    |
| 577   | 142   | M12       | Phase 12 Documentation Final Pass                              |
| 578   | 143   | M12       | Phase 12 Build & Test Final Pass                               |
| 579   | 144   | M12       | Phase 12 Visual QA Final Pass                                 |
| 580   | 145   | M12       | Phase 12 Runtime Smoke Final Pass                              |
| 581   | 146   | M12       | Phase 12 Provider Mock Contract Final Pass                     |
| 582   | 147   | M12       | Phase 12 Asset Pipeline Final Pass                             |
| 583   | 148   | M12       | Phase 12 Integration Test Final Pass                           |
| 584   | 149   | M12       | Phase 12 Ship Gate                                             |

## What the user must do

1. Re-authenticate the Linear MCP:
   ```bash
   cmd mcp auth linear
   ```
   (follow the OAuth prompt in the terminal).

2. After re-auth, run the closure script:
   ```bash
   node scripts/dev/linear-batch-close.mjs --apply
   ```

3. Verify the Linear board shows Done for every FRA in the table
   above. The script prints a per-issue confirmation line for each
   successful close and a final summary table.

## What the agent will not do

- Will not invent Linear Done timestamps.
- Will not write to Linear with a synthetic token.
- Will not collapse any of the above issues into a single "Phase 12
  done" meta-issue without preserving the per-issue evidence trail
  required by `AGENTS.md` §"Linear Issue Discipline".
