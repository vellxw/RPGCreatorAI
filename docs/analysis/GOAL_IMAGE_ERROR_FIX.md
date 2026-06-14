# GOAL: Fix "Cannot read 'image.png' (this model does not support image input)" Error

## Problem Description

When launching RPGCreatorAI (Project Start), the following error appears:
```
ERROR: Cannot read "image.png" (this model does not support image input)
```

This error originates from OpenAI's API and indicates that:
1. A PNG image file (`image.png`) is being read and sent to an OpenAI model
2. The model being used does NOT support image input
3. This happens during some AI operation that occurs on project startup

## Root Cause Analysis

The error occurs because one of the AI providers is trying to use a model that doesn't support image input for an operation that requires it. Possible causes:

1. **Wrong model for operation**: A text-only model (like `gpt-5.5`) is being used for `vision.analyze` or `image.edit`
2. **Model mismatch in workflow**: The image generation/editing workflow is falling back to a wrong model
3. **Missing capability check**: The code isn't properly validating that the selected model supports the required capability before making the API call
4. **Race condition**: On startup, an AI operation might be triggered before the correct model is set

## Investigation Tasks

### Task 1: Find where "image.png" is referenced
Search the codebase for any reference to "image.png" - it might be a default placeholder, sprite, or test file.

### Task 2: Trace the AI operation flow on startup
Find what AI operations run when the project starts. Look for:
- AI Studio initialization
- Asset preloading
- Sprite sheet loading
- Vision analysis on startup

### Task 3: Check model capability validation
Find where the code validates that a model supports `vision.analyze` or `image.edit` before making the request.

### Task 4: Check the OpenAI adapter error handling
Look at `openAiProviderAdapter.ts` to see how errors from OpenAI are handled and propagated.

## Expected Solution

The fix should ensure that:
1. Only models with the `image` capability are used for image generation
2. Only models with the `image-edit` capability are used for image editing
3. Only models with the `vision` capability are used for vision analysis
4. Proper error messages are shown when no capable model is configured
5. The system falls back gracefully (e.g., to mock mode) when no capable model is available

## Files to Inspect

- `src/providers/openAiProviderAdapter.ts` - OpenAI adapter
- `src/providers/modelCapabilityRegistry.ts` - Model capabilities
- `src/providers/imageEditVariationWorkflow.ts` - Image edit workflow
- `src/providers/portraitGenerationWorkflow.ts` - Portrait generation
- `src/providers/spriteSheetGenerationWorkflow.ts` - Sprite sheet generation
- `src/providers/tilesetGenerationWorkflow.ts` - Tileset generation
- `src/providers/characterConceptGenerationWorkflow.ts` - Character concept
- `src/providers/itemIconGenerationWorkflow.ts` - Item icon generation
- `src/stores/` - Redux stores that might trigger AI operations on startup
- `src-tauri/src/` - Rust backend that might trigger AI operations

## Verification

After the fix:
1. Project should start without AI-related errors
2. Image generation should work with configured `gpt-image-2` model
3. If no image-capable model is configured, a clear error should be shown (not the cryptic OpenAI error)
4. All AI operations should validate model capabilities before making API calls

## Prompt for Next AI

```
You are fixing an error in RPGCreatorAI where starting the project shows:
"ERROR: Cannot read 'image.png' (this model does not support image input)"

This error is from OpenAI's API and means an image is being sent to a model that doesn't support image input.

Steps:
1. Search for "image.png" in the codebase to find where it's used
2. Find what AI operations run on project startup
3. Trace the flow to find where a text-only model is being used for image operations
4. Add proper model capability validation before making API calls
5. Ensure proper error handling when no image-capable model is configured

Key files to check:
- src/providers/openAiProviderAdapter.ts
- src/providers/modelCapabilityRegistry.ts
- src/providers/*GenerationWorkflow.ts
- src/stores/ (for startup AI triggers)

Build and test after fixes.
```