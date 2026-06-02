# Phase 11 GPT Image Model Configuration

Issue: CP-065 / FRA-100
Date: 2026-06-02

## Result

GPT Image-capable editor workflows can now select a configured image model
safely through data-driven provider metadata, capability gates, Settings
controls, and offline mock fixtures.

This issue does not add a live OpenAI adapter, image generation action, asset
write pipeline, credential read, network call, or native runtime dependency.
OpenAI remains one optional editor/tooling provider among several registry
entries.

## Official Docs Check

Before coding, the current official OpenAI image-generation documentation was
rechecked:

- Image generation guide:
  `https://platform.openai.com/docs/guides/image-generation`
- Create image API reference:
  `https://platform.openai.com/docs/api-reference/images/create`

The implementation records the current documented GPT Image model id
`gpt-image-2` as configurable metadata. It models API-facing settings for
quality, size, output format, output compression, background, and moderation.
Style remains prompt-only editor guidance because the current GPT Image API
payload should not be given a fabricated `style` parameter.

## Code Changes

Provider metadata:

- `src/providers/providerRegistry.ts` lists `gpt-image-2` as an OpenAI image
  model option without making it a required default.
- The local mock provider now has a separate `offline-image-mock` model for
  offline `image.generate` fixtures.

Capability data:

- `src/providers/modelCapabilityRegistry.ts` declares `gpt-image-2` image,
  image-edit, and vision capability data.
- `offline-image-mock` declares only offline image-generation capability.

Settings and gating:

- `src/providers/providerImageGenerationSettings.ts` normalizes image settings,
  builds an OpenAI-style image payload, and reports image-generation readiness
  from provider enablement, credential state, and model capability data.
- `src/screens/SettingsScreen.tsx` shows compact `Image Model Settings` for
  image-capable providers with quality, size, and prompt-only style guidance
  controls. It still renders no generate, connect, or test-provider action.

Mock validation:

- `src/providers/mockProviderAdapter.ts` returns deterministic offline
  `image.generate` fixture responses for `offline-image-mock`.
- `src/providers/mockProviderContract.ts` adds the `image-success` fixture.

## Safety Boundaries

- `ProviderConfig.model` stays user-configurable; `gpt-image-2` is not written
  as a default provider config.
- The image settings contain no API key, endpoint, account id, project id, or
  credential value.
- Style guidance is kept out of the API payload and can be consumed by later
  prompt-template issues.
- Image-generation readiness fails closed for disabled providers, missing
  credentials, empty model ids, and unknown/unsupported model capability data.
- The native runtime remains untouched and provider-independent.

## Validation

Focused RED before implementation:

```powershell
npm test -- --run src/providers/__tests__/providerImageGenerationSettings.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/providers/__tests__/mockProviderContract.test.ts src/screens/__tests__/SettingsScreen.test.tsx
```

Result: FAIL as expected. The settings module, image model descriptors, image
mock fixture, and Settings UI were missing.

Focused GREEN after implementation:

```powershell
npm test -- --run src/providers/__tests__/providerImageGenerationSettings.test.ts src/providers/__tests__/providerRegistry.test.ts src/providers/__tests__/modelCapabilityRegistry.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/providers/__tests__/mockProviderContract.test.ts src/screens/__tests__/SettingsScreen.test.tsx
```

Result: PASS, 6 files and 29 tests.

TypeScript:

```powershell
npm run typecheck
```

Result: PASS after fixing the `imageSettings` key type in Settings.

Full frontend gate:

```powershell
npm run typecheck
npm test -- --run
npm run build
```

Result: PASS. Full Vitest passed 75 files and 398 tests. Vite transformed
1941 modules and emitted the known non-fatal chunk-size warning.

Settings smoke:

```powershell
npm run dev -- --host 127.0.0.1 --port 3002
npx --yes --package @playwright/cli playwright-cli -s=cp065c open http://127.0.0.1:3002/
npx --yes --package @playwright/cli playwright-cli -s=cp065c click "button:has-text('Use My First RPG')"
npx --yes --package @playwright/cli playwright-cli -s=cp065c click "button:has-text('Settings')"
npx --yes --package @playwright/cli playwright-cli -s=cp065c snapshot
npx --yes --package @playwright/cli playwright-cli -s=cp065c console
npx --yes --package @playwright/cli playwright-cli -s=cp065c close
```

Result: PASS. Settings showed the image model panel, GPT Image 2 metadata,
prompt-only style guidance, capability gates, and no live provider actions.
The console reported 0 errors and 0 warnings.

## Next

CP-066 can build the image prompt template library on top of this foundation.
It should consume the prompt-only style guidance and keep normal validation
offline with mocks and fixtures.
