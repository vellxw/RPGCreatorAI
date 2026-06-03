# AI Event Command Generator

The AI Event Command Generator is an optional editor-only tooling utility that allows creators to generate sequences of event commands from text prompts using structured model outputs.

## Purpose

Instead of manually building complex event command stacks for dialogues, item transfers, and switch controls, creators can generate draft templates matching the exact schema and local project dependencies, review the changes, and accept or discard them directly in the editor.

## Architecture and Boundaries

Like all AI tooling in RPGCreatorAI, the Event Command Generator respects the local-first boundaries:
- **No Runtime Dependency**: The generated commands are saved as standard C++-compatible project event commands JSON and executed locally by the native C++ runtime. The runtime has no network, API, or AI provider requirements.
- **Offline validation and Mocking**: The generator is validated in development using the offline mock provider.
- **Strict Validation**: All generated commands are validated against the `EventCommand` schemas, map references, and item references before they can be accepted.

## Schemas & Validation

The generator produces structured event commands according to the `rpgcreatorai.eventCommandsDraft.v1` response format.
Before any candidate command draft is inserted into the project, it is validated against the following criteria:
1. **Command Types**: Every command must be one of the 29 supported `EventCommand` types (e.g., `showText`, `addItem`, `controlSelfSwitch`, etc.).
2. **Required Fields**: Commands must contain all required fields matching their specific type (e.g., `showText` must contain a `text` string).
3. **Reference Integrity**: 
   - `transferMap` and `setPlayerPosition` commands must target maps that exist in the project context.
   - `addItem` and `removeItem` commands must reference items that exist in the project database.
   - `addItem` and `removeItem` amounts must be positive numbers.

## Review and Acceptance Workflow

1. In the **Events** workspace, select a map event or page.
2. In the event command stack header, click the **Sparkles** icon (Generate event commands).
3. Enter an AI Prompt describing the sequence of actions (e.g., "Create a sequence of text and add a potion item.").
4. Click **Generate Draft**.
5. Review the generated commands under **Candidate Review Details**. Unresolved validation errors will prevent acceptance.
6. Click **Accept and Insert** to add the commands to the active command stack, or **Discard** to try again.
7. Save the project to persist the commands.
