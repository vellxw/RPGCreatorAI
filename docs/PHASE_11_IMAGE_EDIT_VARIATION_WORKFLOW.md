# Phase 11 Image Edit And Variation Workflow

Issue: CP-070 / FRA-105
Date: 2026-06-02

## Result

RPGCreatorAI now has an offline, review-gated image edit and variation
workflow for existing catalog assets. The workflow creates non-destructive
candidate assets from image, generated, tileset, or spritesheet sources,
records source/mask/reference/provenance metadata, and adds the output to the
project asset catalog only after explicit review.

No live provider call, credential lookup, network request, paid API, native
runtime dependency, or destructive source overwrite was added.

## Workflow

The Assets detail panel now supports:

- capability-gated `Image edit and variation`
- source gating for image, generated, tileset, and spritesheet assets
- `Variation` and `Edit` modes
- optional mask asset selection from other editable catalog assets
- comma-separated reference asset ids
- editable instruction, use-case, and preservation guidance
- `Run image variation` / `Run image edit`
- pending candidate review with QA dimensions and mock asset ref
- `Discard`
- `Accept`
- cancellation/failure status messages

Running the workflow never mutates the source asset. Acceptance records a new
project-owned generated image entry under `assets/generated/edits/` and
selects it in the asset catalog.

## Provider Boundary

CP-070 adds a separate local model descriptor:

- provider: `local`
- model: `offline-image-edit-mock`
- capability: `image-edit`
- operation: `image.edit`

The existing `offline-image-mock` remains generation-only. The mock provider
returns deterministic `offline-image-edit` fixture responses for normal tests
and browser smoke. Real providers remain optional editor tooling and are not
called by this workflow.

## Manifest And Provenance

Accepted edit/variation assets store generated metadata including:

- `operation: "image.edit"`
- `promptTemplateId: "asset-edit-v1"`
- source asset id and path
- optional mask asset id
- reference asset ids
- edit mode (`edit` or `variation`)
- provider/model ids
- rendered prompt provenance
- image settings

`GeneratedAssetMetadata` was extended with these optional fields so asset
catalog normalization preserves edit manifests across save/load.

## Evidence

Focused TDD and workflow coverage:

```powershell
npm test -- --run src/providers/__tests__/imageEditVariationWorkflow.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/imagePromptTemplates.test.ts src/screens/__tests__/AssetsScreen.test.tsx
```

Result: PASS, 6 files and 34 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS.

Full frontend suite:

```powershell
npm test -- --run
```

Result: PASS, 80 files and 431 tests.

Production frontend build:

```powershell
npm run build
```

Result: PASS, 1951 modules transformed with the known non-fatal Vite
chunk-size warning.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\providers\imageEditVariationWorkflow.ts src\providers\__tests__\imageEditVariationWorkflow.test.ts src\components\assets\ImageEditVariationPanel.tsx src\screens\AssetsScreen.tsx src\screens\__tests__\AssetsScreen.test.tsx src\providers\mockProviderAdapter.ts src\providers\modelCapabilityRegistry.ts src\providers\providerRegistry.ts src\providers\imagePromptTemplates.ts src\types\project.ts
```

Result: PASS for CP-070 scope; findings were the existing Moonshot provider
metadata base URL in `providerRegistry.ts` and a test assertion that checks
generated requests do not contain `apiKey`, `https://api`, or `sk-`.

Browser smoke with the in-app Browser:

- loaded `http://127.0.0.1:3003/`
- clicked `Use My First RPG`
- opened Assets
- confirmed `Image edit and variation` on `Player Adventurer Sheet`
- clicked `Run image variation`
- confirmed pending `player_adventurer_sheet_variation` candidate review
- accepted the generated variation
- confirmed the catalog increased to 6 assets and selected
  `Player Adventurer Sheet Variation`
- clicked `Validate`
- confirmed toolbar feedback reported `Validation passed`

## Known Limits

The workflow is intentionally mock-backed for normal validation. It does not
write generated image bytes to disk, call live providers, perform real mask
processing, or alter the native runtime. Future issues can add richer mask
authoring, live opt-in diagnostics, visual QA scoring, and runtime export
normalization while preserving the same review-gated pattern.
