# Phase 11 Image Prompt Template Library

Issue: CP-066 / FRA-101
Date: 2026-06-02

## Result

RPGCreatorAI now has a versioned, offline prompt template library for future
image-generation workflows. The library renders reusable, auditable prompts
for tilesets, item icons, character portraits, runtime UI panels, and visual
reference boards.

This issue does not add live provider calls, image generation buttons, asset
file writes, network access, or native runtime dependencies. It prepares prompt
and provenance infrastructure for CP-067 and later workflow issues.

## Template Library

`src/providers/imagePromptTemplates.ts` defines:

- `tileset-rpg-map-v1`
- `icon-item-v1`
- `portrait-character-v1`
- `ui-panel-v1`
- `reference-board-v1`

Every template is versioned and includes:

- required inputs: `subject`, `useCase`, `palette`, and `styleNotes`
- output guidance for the specific asset type
- style constraints tied to original RPGCreatorAI asset direction
- legal and safety constraints that reject proprietary style copying,
  franchise motifs, license claims, endorsement claims, and exact reference
  replication

## Visual Context

Every rendered prompt includes the binding visual source
`docs/GAME_VISUAL_DESIGN.md` and the current project visual rules:

- original assets only
- viewport-aware story-RPG composition
- complete frame coverage and readable playable space
- pixel-perfect alignment and tile-consistent scale
- readable collision, entrances, interactables, foreground, midground, and
  background
- no accidental voids, detached map islands, or purely atmospheric outputs

Inputs that ask to copy, clone, or render "in the style of" a third party are
replaced with a safe original-direction note before the prompt is rendered.

## Provenance Manifest

`buildImagePromptProvenance()` converts a rendered prompt into
`GeneratedAssetMetadata` suitable for `AssetCatalogEntry.generated`.

The manifest records:

- rendered prompt
- template id, version, and kind
- sanitized prompt inputs
- provider id and model id selected by the future workflow
- image settings such as quality, size, style guidance, output format,
  background, and moderation
- visual context source and version
- created timestamp

The manifest does not store API keys, endpoint URLs, account ids, project ids,
or live provider responses.

## Validation

Focused prompt-template RED before implementation:

```powershell
npm test -- --run src/providers/__tests__/imagePromptTemplates.test.ts
```

Result: FAIL as expected because `imagePromptTemplates` did not exist.

Focused prompt-template GREEN:

```powershell
npm test -- --run src/providers/__tests__/imagePromptTemplates.test.ts
```

Result: PASS, 1 file and 5 tests.

The tests cover required template coverage, visual context injection,
proprietary-style sanitization, missing-input failure, provenance manifest
generation, and asset catalog normalization preserving prompt manifests.

Full frontend gate:

```powershell
npm run typecheck
npm test -- --run
npm run build
```

Result: PASS. Full Vitest passed 76 files and 403 tests. Vite transformed
1941 modules and emitted the known non-fatal chunk-size warning.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\providers\imagePromptTemplates.ts src\providers\__tests__\imagePromptTemplates.test.ts src\types\project.ts docs\PHASE_11_IMAGE_PROMPT_TEMPLATE_LIBRARY.md
```

Result: PASS. Findings were only test names/assertions that verify no secret
or live endpoint is present.

## Next

CP-067 can use these templates to drive the AI tileset generation workflow.
That workflow should still route through provider capability gates and offline
fixtures for normal validation.
