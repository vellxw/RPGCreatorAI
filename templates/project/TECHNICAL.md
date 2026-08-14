# {{PROJECT_TITLE}} — Technical Contract

Status: `{{draft|approved|needs-review}}`  
Technical owner: `{{OWNER}}`  
Last reviewed: `{{YYYY-MM-DD}}`

## Runtime and platform target

- RPGCreatorAI/editor version or commit: {{VERSION_OR_COMMIT}}
- Runtime targets: {{WINDOWS_OR_OTHER_VALIDATED_TARGETS}}
- Input targets: {{KEYBOARD_GAMEPAD_TOUCH}}
- Distribution shape: {{PLAYTEST|LOCAL_PACKAGE|OTHER}}
- Offline requirement: {{REQUIREMENT}}

Do not claim a platform, package, smoke check, or performance result unless it
was actually validated and evidence was recorded.

## Data contract

The runtime entry point is `data/project.json` with `schemaVersion: 1`.
Game rules and content live in project JSON; the renderer does not own gameplay
logic. Project documentation describes intent but is never executed.

- Start map and position: {{MAP_ID_X_Y_DIRECTION}}
- Project visual profile: {{SUMMARY_MATCHING_DATA_PROJECT_JSON}}
- Required database shards: {{PATHS}}
- Map layer roles: `ground`, `decoration`, `foreground`, `collision`, `region`
  as applicable; each tile array must match map dimensions.
- Save compatibility target: {{SAVE_POLICY}}
- Migration policy: {{MIGRATION_OR_NO_MIGRATION}}

Paths must be project-relative, use stable ids, and stay inside the project
root. Never place credentials or provider secrets in project JSON, logs,
documentation, exported assets, or provenance records.

## Architecture boundaries

- Editor data and runtime data: {{BOUNDARY}}
- Gameplay state and persistence: {{BOUNDARY}}
- Events and rendering: {{BOUNDARY}}
- AI/generation tools and runtime: generation is an authoring-time layer;
  accepted local data/assets must run without a provider or network.
- Candidate review: pending/rejected outputs have no runtime impact; only
  accepted, validated outputs may enter runtime-facing data.

## Performance and size budgets

| Budget | Target | Measurement/evidence |
| --- | --- | --- |
| Base resolution/frame behavior | {{TARGET}} | {{METHOD}} |
| Frame rate/frame time | {{TARGET}} | {{METHOD}} |
| Startup/playtest launch | {{TARGET}} | {{METHOD}} |
| Map dimensions/events | {{LIMIT_OR_EXPECTATION}} | {{METHOD}} |
| Runtime asset size/memory | {{TARGET}} | {{METHOD}} |
| Save/load time and size | {{TARGET}} | {{METHOD}} |

## Asset runtime contract

- Authoring catalog: `data/assets/catalog.json`
- Runtime manifest: `data/assets/runtime-manifest.json`
- Imported sources: `assets/imported/`
- Generated sources/editor outputs: `assets/generated/source/` and
  `assets/generated/web/`
- Runtime exports: `assets/generated/runtime/`
- Audio: {{SUPPORTED_FORMATS_AND_RULES}}
- Transparency, frames, anchors, and scale: {{RULES}}

`ASSETS.md` owns rights/provenance review. Catalog metadata owns machine
references. These must agree before release.

## Validation and release gates

Record the exact project-appropriate commands and their actual results. Do not
paste aspirational output.

| Gate | Command/workflow | Required result | Latest evidence |
| --- | --- | --- | --- |
| Project validation | {{COMMAND_OR_EDITOR_ACTION}} | No blocking errors | {{LINK_OR_NOT_RUN}} |
| Runtime asset validation | {{COMMAND_OR_WORKFLOW}} | No missing/stale outputs | {{LINK_OR_NOT_RUN}} |
| Playtest smoke | {{COMMAND_OR_WORKFLOW}} | Core loop completes | {{LINK_OR_NOT_RUN}} |
| Visual QA | Compare against `GAME_STYLE.md` | Checklist passes | {{LINK_OR_NOT_RUN}} |
| Rights/provenance review | Review `ASSETS.md` | No blocked shipping asset | {{LINK_OR_NOT_RUN}} |

## Failure and recovery expectations

- Missing or invalid data: {{USER_VISIBLE_BEHAVIOR}}
- Missing asset: {{USER_VISIBLE_BEHAVIOR}}
- Corrupt/incompatible save: {{USER_VISIBLE_BEHAVIOR}}
- Provider/network unavailable: authoring assistance may fail safely; the
  accepted project and runtime remain usable offline.
- Backup and recovery: {{POLICY}}

## Known limitations and technical debt

| Item | Impact | Workaround | Owner/milestone |
| --- | --- | --- | --- |
| {{LIMITATION}} | {{IMPACT}} | {{WORKAROUND}} | {{OWNER}} |

## Technical decision log

| Date | Decision | Alternatives/reason | Affected contract |
| --- | --- | --- | --- |
| {{YYYY-MM-DD}} | Initial technical baseline | Project creation | All |

