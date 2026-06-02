# Phase 11 Database/System Completeness Gate

Issue: CP-048 / FRA-83

## Result

Milestone 05 is green. The database and system authoring layer is integrated
across editor forms, TypeScript validation, desktop persistence, native
loading, native pre-launch validation, runtime smoke, and editor-runtime
roundtrip evidence.

The completed milestone covers:

- database schema gap audit and shard preservation;
- actor/class/skill, enemy/troop, item/equipment/state, system/types/terms,
  and common-event authoring polish;
- reference-safe delete/rename plus explicit broken-reference repair tools;
- TypeScript validation for database ranges, references, system defaults,
  common-event self-calls, and repair no-op cases;
- native loader/validator coverage for runtime-consumed database data.

## Validation Commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Result: PASS.

Gate summary:

- PASS: frontend typecheck.
- PASS: frontend tests, 57 files and 327 Vitest tests.
- PASS: frontend build, with the existing Vite chunk-size warning only.
- PASS: native C++ configure/build/CTest, `RPGTests` 1/1.
- PASS: Tauri content check on `127.0.0.1:1420`.
- PASS: Rust desktop tests, 33 tests.
- PASS: runtime smoke.
- PASS: editor-runtime screenshot roundtrip.

Additional browser smoke:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=cp048 open http://127.0.0.1:5177/
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button:has-text('Use My First RPG')"
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button:has-text('Database')"
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button[aria-label='Open Items database tab']"
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button[aria-label='Open Actors database tab']"
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button[aria-label='Open Enemies database tab']"
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button[aria-label='Open Troops database tab']"
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button[aria-label='Open System database tab']"
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button[aria-label='Open Types database tab']"
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button[aria-label='Open Terms database tab']"
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button[aria-label='Open Common Events database tab']"
npx --yes --package @playwright/cli playwright-cli -s=cp048 click "button:has-text('Validate')"
npx --yes --package @playwright/cli playwright-cli -s=cp048 snapshot
npx --yes --package @playwright/cli playwright-cli -s=cp048 console
npx --yes --package @playwright/cli playwright-cli -s=cp048 close
```

Result: PASS. Database tabs opened, Common Events showed reusable command
authoring controls, Validate reported `Validation passed`, and the console
reported 0 errors and 0 warnings.

## Roundtrip Evidence

The canonical gate includes Rust desktop persistence coverage for database
read/write, playtest temp sessions, and full-state reload. It also includes
the editor-runtime screenshot roundtrip:

- baseline hash:
  `6C65F8EF5028B064BA8694E005E752CD674861F2F553B7D49E78CD7B46D64944`
- edited hash:
  `D845D8BBEE8D38C68819A6ECCC927CE357A2FAEA86F4FD604D6EAB394E62340E`

## Known Boundaries

- Separated `weapons`, `armors`, and `states` remain editor/validation shards
  for v1; native gameplay still consumes item equipment modifiers.
- Types and terms remain editor/system-label data; the native runtime does not
  consume editor-only terminology.
- Switch and variable initial values are still documented as partial runtime
  depth: ids validate, but runtime state defaults remain false/0.
- Missing optional local WAV files and unavailable audio devices warn and
  continue; they do not block the gate.
- The Vite chunk-size warning and third-party CMake policy/deprecation
  warnings remain non-fatal.

## Next

Milestone 06 can start with asset library and import pipeline work. The native
runtime remains deterministic and independent of AI, network, cloud, and
provider credentials.
