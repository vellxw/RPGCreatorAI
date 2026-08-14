# La Novena Promesa — diseño del capítulo 1

Status: `draft`  
Audience: adult players of psychological horror and queer romance  
Target playtime: 15–30 minutes  
Content: body horror, blood, coercive medical imagery, adult romance; no
sexual content is required for the slice.

## Premise

Damian, an adult night-shift archivist, returns to the sealed SANTA facility
after receiving a message from Elian, the man he abandoned nine years ago. The
facility records memories as “promises”. The ninth promise is still active,
and the entity wearing Elian's face wants Damian to finish it.

## Player verbs and loop

1. Explore a tilemap and inspect evidence.
2. Read illustrated VN scenes and choose how much truth to share.
3. Solve the archive power puzzle while managing lucidity.
4. Escape the entity during a short chase.
5. Revisit the evidence board and choose an ending.

## Canonical state

| Variable/flag | Range | Meaning |
| --- | ---: | --- |
| `bond` | 0–4 | trust between Damian and Elian |
| `lucidity` | 0–100 | resistance to hallucination |
| `evidence` | 0–4 | verified facts recovered |
| `flags.archive_open` | bool | archive gate solved |
| `flags.heard_the_ninth` | bool | entity's true voice heard |
| `flags.promised_truth` | bool | Damian chose honesty |
| `flags.chase_survived` | bool | player reached the lift |

## Maps and beats

| Map | Beat | Exit |
| --- | --- | --- |
| `facility_lobby` | message, first portrait scene, locked archive | archive clue found |
| `archive_sublevel` | puzzle, evidence choice, first body-horror reveal | archive gate open |
| `service_corridor` | chase, confession, final choice | one of two endings |

## Decisions and endings

- Hide the old photograph: `bond -1`, `lucidity +5`.
- Show the photograph: `bond +1`, `evidence +1`.
- Accept the entity's shortcut: `lucidity -25`, `flags.heard_the_ninth`.
- Tell Elian the truth: `bond +1`, `flags.promised_truth`.

Ending **The Kept Promise** requires `bond >= 3`, `evidence >= 2`, and
`promised_truth`. Ending **The Ninth Witness** is the fallback and preserves
the hook for chapter 2. Both endings are valid, checkpointed, and replayable.

## Accessibility and safety

Gore is configurable (`full`, `reduced`, `off`) and must never hide a required
interaction. Add warnings at first launch, allow reduced motion, subtitles,
text speed, high-contrast dialogue, and remappable keyboard/gamepad actions.

