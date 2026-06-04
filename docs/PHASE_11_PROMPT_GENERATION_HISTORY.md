# Phase 11 Prompt And Generation History

CP-087 adds an editor-owned generation history model for AI-assisted content.
The native runtime does not read this data and does not depend on providers.

## Storage

Generation history lives in `project.generationHistory` inside `project.json`.
It is optional for older projects and normalizes to:

- `schemaVersion: 1`
- `maxRecords`
- `records[]`

Each record captures:

- `kind`: `text`, `image`, `asset`, or `structured-data`
- `operation`
- `providerId` and `modelId`
- `createdAt`
- redacted `prompt`
- redacted `inputContext`
- redacted `output` or `outputSummary`
- prompt template metadata when available
- `reviewState`
- accepted output links
- review/acceptance events

## Redaction Boundary

History stores safe metadata only. Prompt text, input context, and output
metadata are recursively sanitized before they enter project data.

The sanitizer redacts:

- authorization headers
- keys named like API keys, tokens, secrets, credentials, or passwords
- common `sk-...` secret strings in free-form prompts
- free-form `token ...`, `secret ...`, `credential ...`, and `password ...`
  phrases

Large text fields are bounded and deep objects/lists are truncated so prompt
history does not become an unbounded dump of provider request context.

## Accepted Output Links

Generated assets accepted into the asset catalog are automatically recorded as
accepted history records when their metadata includes prompt, provider, and
model data. The accepted output link stores asset id, path, and label.

Structured/text workflows can use `appendGenerationHistoryRecord()` and
`linkGenerationHistoryOutput()` to link accepted database, map, event, or asset
outputs without bypassing normal reducers.

## Cleanup And Export

`appendGenerationHistoryRecord()` enforces `maxRecords` retention by trimming
oldest entries first. `clearGenerationHistory()` clears records while keeping
the history container valid. `exportGenerationHistory()` returns a clone for
support/export flows without allowing accidental mutation of project state.

## Validation

CP-087 validation covers:

- safe record creation with prompt, provider, model, input context, output, and
  review state
- recursive secret redaction
- retention trimming
- accepted asset/database output links
- export clone behavior
- cleanup behavior
- reducer auto-recording for accepted generated assets
