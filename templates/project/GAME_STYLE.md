# {{PROJECT_TITLE}} — Game Style

Status: `{{draft|approved|needs-review}}`  
Style owner: `{{OWNER}}`  
Style version: `{{VERSION_OR_DATE}}`

## Authority

This file is the project-specific source of truth for visual and sensory
direction. It specializes the engine-level `docs/GAME_VISUAL_DESIGN.md` rules
for this game. Engine-supported viewport, camera, tile alignment, map fill,
collision readability, preview, and runtime presentation constraints still
apply. If a desired direction conflicts with them, record the conflict as an
open decision instead of silently overriding the engine contract.

## Experience sentence

{{In one sentence, describe what the game should look, sound, and feel like
during its defining moment.}}

## Visual grammar

- Art mode: {{PIXEL_ART|PAINTED|VECTOR|HYBRID_WITH_RULES}}
- Shape language: {{SHAPES_AND_SILHOUETTES}}
- Value structure: {{LIGHT_DARK_HIERARCHY}}
- Detail density: {{WHERE_DETAIL_IS_HIGH_OR_LOW}}
- Line/edge treatment: {{OUTLINES_EDGES}}
- Texture/material language: {{TEXTURES}}
- Motion language: {{TIMING_EASING_IMPACT_AND_IDLE_MOTION}}

### Palette

| Role | Color/value | Usage | Avoid |
| --- | --- | --- | --- |
| Background | {{HEX_OR_DESCRIPTION}} | {{USAGE}} | {{AVOID}} |
| Playable space | {{HEX_OR_DESCRIPTION}} | {{USAGE}} | {{AVOID}} |
| Interactive accent | {{HEX_OR_DESCRIPTION}} | {{USAGE}} | {{AVOID}} |
| Danger | {{HEX_OR_DESCRIPTION}} | {{USAGE}} | {{AVOID}} |
| UI/text | {{HEX_OR_DESCRIPTION}} | {{USAGE}} | {{AVOID}} |

Do not rely on hue alone for gameplay meaning. Record contrast targets and
color-vision-safe cues under Accessibility below.

## Viewport, camera, and scale

Mirror the concrete values in `data/project.json.visualProfile`.

- Aspect ratio: `{{16:9|4:3|1:1|custom}}`
- Base resolution: `{{WIDTH}}x{{HEIGHT}}`
- Tile size: `{{PIXELS}}`
- Camera mode: `{{follow-player|fixed-room}}`
- Map presentation: `{{full-scene|PROJECT_SUPPORTED_VALUE}}`
- Zoom/integer scaling: {{RULE}}
- Character scale: {{HEIGHT_IN_TILES_AND_PROPORTIONS}}
- UI safe areas: {{HUD_DIALOGUE_AND_SUBTITLE_SPACE}}

### Scene composition rules

- Focal route/interactions: {{RULE}}
- Foreground, playable midground, and background separation: {{RULE}}
- Interior density and walking lanes: {{RULE}}
- Exterior boundaries and reveal: {{RULE}}
- Intentional empty space versus forbidden void: {{RULE}}

## Character, environment, effects, and UI

### Characters

{{Silhouette, proportions, facial readability, costume grouping, animation
cadence, and allowed variations.}}

### Environments and props

{{Architecture, biome language, prop clustering, material scale, collision
legibility, and interaction cues.}}

### Effects and transitions

{{Particles, flashes, camera motion, transition timing, intensity limits, and
reduced-motion behavior.}}

### Interface and typography

{{Typefaces or fallback categories, sizes, spacing, panel treatment, icons,
focus states, dialogue layout, and text density.}}

## Sensory direction

### Music

- Musical identity: {{INSTRUMENTATION_HARMONY_RHYTHM}}
- Exploration/combat/dialogue rules: {{STATE_RULES}}
- Loop and transition behavior: {{LOOP_RULES}}

### Sound effects and ambience

- Material and interaction vocabulary: {{SFX_LANGUAGE}}
- Environmental ambience: {{AMBIENCE}}
- Mix priority and loudness intent: {{MIX_RULES}}

### Voice and language

{{Voice presence, performance tone, pronunciation, localization constraints,
or explicitly state that there is no voice.}}

## Accessibility and comfort

- Minimum contrast/readability: {{TARGET}}
- Non-color cues: {{SHAPE_LABEL_SOUND_OR_MOTION_CUES}}
- Photosensitivity limits: {{FLASH_LIMITS}}
- Reduced motion: {{ALTERNATIVE}}
- Audio-independent cues and captions: {{RULE}}

## Reference and provenance register

References define qualities to study, not content to reproduce. Do not ask
contributors or generators to copy a protected character, composition,
franchise, trademark, soundtrack, voice, or a living artist's signature
style. Prefer first-party, public-domain, appropriately licensed, or locally
authored references. Link every production asset itself from `ASSETS.md`.

| ID | Reference/source | Owner/creator | License or usage basis | Qualities used | Forbidden copying | Retrieved/reviewed |
| --- | --- | --- | --- | --- | --- | --- |
| STYLE-001 | {{PATH_OR_URL}} | {{CREATOR}} | {{LICENSE_PERMISSION_OR_INTERNAL}} | {{COLOR_LIGHT_SHAPE_PACING}} | {{CHARACTERS_LAYOUT_LOGOS_STYLE_MIMICRY}} | {{YYYY-MM-DD}} |

### Generated style material

For generated mood images or style explorations, also record provider/model,
date, prompt-template id/version, relevant non-secret prompt summary, input
asset ids, review state, and linked catalog/history record. Never record API
keys or raw private provider responses.

## Do / do not

| Do | Do not |
| --- | --- |
| {{POSITIVE_IMPLEMENTABLE_RULE}} | {{VISIBLE_FAILURE_MODE}} |
| Keep walkable space and interactables readable. | Hide gameplay truth in decorative art. |
| Validate editor and runtime presentation together. | Approve a style from a mood board alone. |

## Style acceptance checklist

- [ ] The scene is complete at the authored viewport with no accidental gaps.
- [ ] Tiles, sprites, collision, interaction cues, and UI remain readable.
- [ ] Art, motion, text, audio, and ambience reinforce the experience sentence.
- [ ] Editor preview and runtime framing agree.
- [ ] Every reference and generated exploration has reviewable provenance.
- [ ] Every shipping asset passes the rights and readiness checks in `ASSETS.md`.

