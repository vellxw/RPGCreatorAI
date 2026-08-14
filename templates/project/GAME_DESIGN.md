# {{PROJECT_TITLE}} — Game Design

Status: `{{draft|approved|needs-review}}`  
Design owner: `{{OWNER}}`  
Last reviewed: `{{YYYY-MM-DD}}`

## Player promise

{{Describe the fantasy, role, and emotional result promised to the player in
one short paragraph.}}

## Audience and experience target

- Intended audience: {{AUDIENCE}}
- Session length: {{SESSION_LENGTH}}
- Expected total playtime: {{PLAYTIME}}
- Difficulty intent: {{DIFFICULTY}}
- Content boundaries and accessibility goals: {{BOUNDARIES}}

## Design pillars

Keep three to five. Each pillar must guide tradeoffs.

1. **{{PILLAR}}** — {{BEHAVIOR_AND_DECISION_RULE}}
2. **{{PILLAR}}** — {{BEHAVIOR_AND_DECISION_RULE}}
3. **{{PILLAR}}** — {{BEHAVIOR_AND_DECISION_RULE}}

## Core loop

1. {{PLAYER_ACTION}}
2. {{SYSTEM_RESPONSE}}
3. {{PLAYER_DECISION}}
4. {{REWARD_OR_CONSEQUENCE}}
5. {{HOW_THE_LOOP_DEEPENS_OR_RESTARTS}}

## Rules and systems

| System | Player-facing rule | Data owner | Failure/edge case |
| --- | --- | --- | --- |
| Exploration | {{RULE}} | `data/maps/*.json` | {{EDGE_CASE}} |
| Dialogue/events | {{RULE}} | map events / common events | {{EDGE_CASE}} |
| Progression | {{RULE}} | `data/database/*.json` | {{EDGE_CASE}} |
| Combat or conflict | {{RULE_OR_NOT_IN_SCOPE}} | {{DATA_OWNER}} | {{EDGE_CASE}} |

Gameplay truth belongs in project data. Documentation explains intent and
acceptance criteria; it must not become a hidden scripting layer.

## World, story, and content structure

- Premise: {{PREMISE}}
- Setting constraints: {{SETTING}}
- Player character: {{PLAYER_CHARACTER}}
- Central conflict: {{CONFLICT}}
- Ending condition: {{ENDING_CONDITION}}

### Content map

| Beat/area | Purpose | Entry condition | Exit condition | Required assets |
| --- | --- | --- | --- | --- |
| {{BEAT}} | {{PURPOSE}} | {{ENTRY}} | {{EXIT}} | {{ASSET_IDS_OR_LINK}} |

## Progression and economy

{{Define what changes over time, how rewards are earned, important caps, and
how grinding or dead ends are prevented. Use explicit numbers where they are
already decided.}}

## UX and accessibility requirements

- Required input methods: {{INPUTS}}
- Readability targets: {{TEXT_AND_CONTRAST}}
- Feedback for success, failure, damage, interaction, and unavailable actions:
  {{FEEDBACK}}
- Options or accommodations: {{OPTIONS}}

## Scope

### In scope for the current milestone

- {{DELIVERABLE}}

### Explicitly out of scope

- {{NON_GOAL}}

## Acceptance criteria

- [ ] A new player can {{OBSERVABLE_PLAYER_OUTCOME}}.
- [ ] The full loop completes without {{FAILURE_MODE}}.
- [ ] Every required scene meets `GAME_STYLE.md` and the engine visual contract.
- [ ] Every runtime-facing asset is approved in `ASSETS.md` and the asset catalog.
- [ ] Technical and release gates in `TECHNICAL.md` pass with recorded evidence.

## Open decisions

| Decision | Owner | Due | Impact if unresolved |
| --- | --- | --- | --- |
| {{QUESTION}} | {{OWNER}} | {{DATE}} | {{IMPACT}} |

## Change log

| Date | Decision | Reason | Affected data/docs |
| --- | --- | --- | --- |
| {{YYYY-MM-DD}} | Initial contract | Project creation | All |

