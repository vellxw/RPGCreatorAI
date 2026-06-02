# Phase 11 GPT Image Asset Pipeline Integration Gate

Issue: CP-072 / FRA-107
Date: 2026-06-02

## Result

The GPT Image-capable asset pipeline is validated as one mock-only editor
pipeline. Model configuration, prompt templates, mock image generation,
tileset/icon/portrait candidates, image edit/variation candidates, explicit
review, visual QA scoring, and generated asset metadata now have integration
coverage.

No live OpenAI call, credential lookup, network request, paid API, native
runtime dependency, or runtime asset dependency was added.

## Pipeline Contract

The completed milestone 08 pipeline is:

1. Provider/model metadata declares GPT Image capability while keeping OpenAI
   disabled and missing-credential-safe by default.
2. Normal validation uses the local `offline-image-mock` and
   `offline-image-edit-mock` providers.
3. Prompt templates render project-bound visual context from
   `docs/GAME_VISUAL_DESIGN.md`.
4. Generated tilesets, item/equipment icons, actor/event portraits, and
   image edit/variation outputs are created as pending candidates.
5. Pending candidates include `pending-review` and cannot enter project data
   until explicit review.
6. Accepted candidates remove `pending-review`, gain reviewed tags, and store
   generated provenance.
7. Visual QA scoring stamps accepted generated assets with
   `generated.visualQa` metadata.

## Code Changes

CP-072 adds a provider-level integration test:

- `src/providers/__tests__/gptImageAssetPipelineIntegration.test.ts`

The test verifies:

- default OpenAI provider config is disabled, missing-credential-safe, and has
  no configured model
- the app can use local image mocks without credentials
- all image workflows route through mock candidates
- candidates remain pending before assignment
- generated manifests do not contain API keys, live endpoints, or `sk-`
  looking secrets
- approved assets are visually QA-stamped and preserve prompt-template
  metadata after asset catalog normalization

CP-072 also records `operation: "image.generate"` in generated metadata for:

- tileset generation
- item/equipment icon generation
- portrait generation

Image edit/variation already recorded `operation: "image.edit"`. With this
change every generated image manifest records its provider operation.

## Evidence

TDD red step:

```powershell
npm test -- --run src/providers/__tests__/gptImageAssetPipelineIntegration.test.ts
```

Result: FAIL before the integration test existed, then FAIL with the new test
because generation manifests did not record `operation: "image.generate"` and
one matcher needed correction.

Focused integration:

```powershell
npm test -- --run src/providers/__tests__/gptImageAssetPipelineIntegration.test.ts
```

Result: PASS, 1 file and 2 tests.

Mock-only GPT Image asset pipeline suite:

```powershell
npm test -- --run src/providers/__tests__/providerImageGenerationSettings.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/imagePromptTemplates.test.ts src/providers/__tests__/tilesetGenerationWorkflow.test.ts src/providers/__tests__/itemIconGenerationWorkflow.test.ts src/providers/__tests__/portraitGenerationWorkflow.test.ts src/providers/__tests__/imageEditVariationWorkflow.test.ts src/providers/__tests__/generatedImageVisualQa.test.ts src/providers/__tests__/gptImageAssetPipelineIntegration.test.ts
```

Result: PASS, 12 files and 52 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS after fixing optional `AssetCatalogEntry.tags` access in the
new integration test.

Full frontend suite:

```powershell
npm test -- --run
```

Result: PASS, 82 files and 437 tests.

Production frontend build:

```powershell
npm run build
```

Result: PASS, 1953 modules transformed with the known non-fatal Vite
chunk-size warning.

Live-call/secret scan:

```powershell
rg -n "(fetch|axios|WebSocket|EventSource|XMLHttpRequest|https://api|apiKey|secret|token|sk-)" src\providers\providerImageGenerationSettings.ts src\providers\providerRegistry.ts src\providers\modelCapabilityRegistry.ts src\providers\mockProviderAdapter.ts src\providers\mockProviderContract.ts src\providers\imagePromptTemplates.ts src\providers\tilesetGenerationWorkflow.ts src\providers\itemIconGenerationWorkflow.ts src\providers\portraitGenerationWorkflow.ts src\providers\imageEditVariationWorkflow.ts src\providers\generatedImageVisualQa.ts src\providers\__tests__\gptImageAssetPipelineIntegration.test.ts src\providers\__tests__\providerImageGenerationSettings.test.ts src\providers\__tests__\modelCapabilityRegistry.test.ts src\providers\__tests__\providerRegistry.test.ts src\providers\__tests__\mockProviderAdapter.test.ts src\providers\__tests__\mockProviderContract.test.ts src\providers\__tests__\imagePromptTemplates.test.ts src\providers\__tests__\tilesetGenerationWorkflow.test.ts src\providers\__tests__\itemIconGenerationWorkflow.test.ts src\providers\__tests__\portraitGenerationWorkflow.test.ts src\providers\__tests__\imageEditVariationWorkflow.test.ts src\providers\__tests__\generatedImageVisualQa.test.ts
```

Result: PASS for CP-072 scope. Matches were existing test assertions,
mock-redaction fixture text, and the existing static Moonshot registry base
URL; no live call path or secret value was added.

Browser smoke with the in-app Browser:

- loaded `http://127.0.0.1:3003/`
- clicked `Use My First RPG`
- opened Settings
- confirmed `Image Model Settings` and `GPT Image 2`
- confirmed Settings exposed no `Run image generation` or `Test provider`
  live action
- opened Assets
- ran `Run image variation`
- confirmed `Visual QA checklist` and `5 cataloged assets` while the candidate
  was pending
- accepted the candidate
- confirmed `6 cataloged assets` and generated metadata
- clicked `Validate`
- confirmed `Validation passed`
- confirmed 0 console warnings/errors

## Known Limits

Milestone 08 remains mock-backed for normal validation. Live OpenAI diagnostics
remain opt-in only and were not run. The native runtime is unchanged and still
consumes only accepted local project data, never AI providers or credentials.

## Next

CP-073 can build character concept generation on top of this integrated
review-gated asset pipeline.
