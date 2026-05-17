# Goal Stack — RPGCreatorAI

## Current Goal

Phase 7 — Polished creator-to-player loop.

## Active Phase

Phase 7 — Slice 6 (editor undo / redo) next.

## Open subgoals (top of stack first)

1. Slice 6 — editor undo / redo.
2. Slice 7 — map tile painting + collision painting.
3. Slice 8 — event placement, drag/move, duplicate, delete.
4. Slice 9 — editor → save → runtime round-trip QA + screenshots.
5. Slice 10 — full validation, docs, final report, push.

## Closed subgoals

- Phase 6 — Complete RPG Creation System Foundation — DONE (`a12efa8`).
- Slice 0 — original asset foundation (generated atlases, editor assets,
  runtime sprites, emoji replacement). Commit `0012eca`.
- Slice 1 — runtime pause / main menu skeleton (menu state machine wired
  into `Game`, HUD/menu rendering, keyboard navigation tests). Commit
  `0012eca`.
- Slice 2 — runtime inventory / party / quest views (real item
  descriptions plus render-ready menu snapshots). Commit `19c1c6c`.
- Slice 3 — save/load slot picker metadata (centralized `SaveManager`
  slot listing consumed by the runtime menu). Commit `19c1c6c`.
- Slice 4 — shop UI (modal buy flow, gold checks, owned counts, runtime
  rendering). Pending commit in current worktree.
- Slice 5 — battle result UI (summary handoff, paused event continuation,
  reward screen). Pending commit in current worktree.
- Slice 1 — data model expansion (schemas, types, JSON files, validators,
  Rust shell round-trip, vitest + cargo coverage). Commit `7936b8f`.
- Slice 2 — Database editor screen with tabs, CRUD, dirty tracking.
  Commit `7936b8f`.
- Slice 3 — runtime event command system v1 (24 commands). Commit `46d2726`.
- Slice 4 — typed switches/variables, ifSwitch/ifVariable, showChoices.
  Commit `46d2726`.
- Slice 5 — quest system runtime + save/load + idempotency. Commit `46d2726`.
- Slice 6 — gold + party + actor HP + inventory remove. Commit `46d2726`.
- Slice 7 — runtime DB loader, equipment stat modifiers in battle.
  Commit `d4fec32`.
- Slice 8 — battle system v1 (deterministic, formula tested, rewards).
  Commit `d4fec32`.
- Slice 9 — shops (data round-trip + dialogue-stub runtime). Commit `d4fec32`.
- Slice 10 — sample town/house exercising every v1 command. Commit `6c27308`.
- Slice 11 — Phase 6 final validation + reporting. Commit `a12efa8`.

## Closed subgoals from previous phases

- Phase 5: Desktop shell + filesystem + runtime bridge — DONE (`6665220`).
- Phase 4.1: Validation hardening — DONE (`3303cab`).
- Phase 4: Editor persistence + runtime bridge — DONE (`da0b7bc`).
- Phase 3: Visual editor MVP — DONE (`4493309`).
- Phase 2: Visible playable RPG runtime — DONE (`148dc13`).
- Phase 1: Bootstrap — DONE (`41273a8`).

## Persistence rule

This file is the source of truth for the active phase. It is updated at
each slice boundary, **not** based on chat memory.
