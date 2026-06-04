# UX Copy Audit

Date: 2026-06-04

Issue: CP-101 / FRA-136

## Result

PASS with one repair applied. UI copy across the editor is clear,
action-oriented, and honest about capabilities after replacing one visible
sample sprite label that used placeholder-facing wording.

## Audit Scope

The audit covered all UI copy visible in the Maps, Events, Database, Assets,
Playtest, and Settings workspaces in browser mode at 1280x800 viewport.

## Copy Audit by Area

### Toolbar

| Copy | Assessment |
| --- | --- |
| "RPGCreatorAI" | Clear product name |
| "My First RPG" | Project name display |
| "Undo" / "Redo" | Standard, clear |
| "All changes saved" | Clear state feedback |
| "Save" (description: "Validate and save project data") | Action-oriented, honest |
| "Validate" | Action-oriented |
| "Playtest" | Action-oriented |
| "Export" | Action-oriented |
| "Import" | Action-oriented |

### Validation Panel

| Copy | Assessment |
| --- | --- |
| "Project passes validation" | Clear success state |
| "Save will still re-check before writing project files." | Honest about behavior |
| "No blocking errors" | Clear diagnostic |
| "Runtime output appears after launching a playtest." | Helpful guidance |
| "Runtime Debug Panels" | Clear section header |
| "Use Runtime Log, Event Trace, and Runtime State in Playtest." | Clear guidance |

### Map Editor

| Copy | Assessment |
| --- | --- |
| "Map Tree" | Clear section header |
| "Generate map draft" | Action-oriented (AI feature) |
| "Create root map" | Action-oriented |
| "Collapse map group Town" | Descriptive |
| "Tile Palette" | Clear section header |
| "Selected" | Clear label |
| "grass" / "Tile 1 · A · passable" | Informative metadata |
| "Brush ground" | Clear layer/tool indicator |
| "GAME VIEWPORT · 16:9" | Clear viewport info |
| "Frame 1280×720" | Clear dimensions |
| "Map Settings" | Clear section header |
| "Sample NPC" | Clear bundled sample sprite choice |

### Events Workspace

| Copy | Assessment |
| --- | --- |
| "Events" | Clear section header |
| "Search events..." | Clear placeholder |
| "Event Commands" | Clear section header |
| "Executed top to bottom." | Clear instructional |
| "Event Properties" | Clear section header |
| "No errors" / "Everything looks good!" | Clear success state |

### Database Workspace

| Copy | Assessment |
| --- | --- |
| Tab names (Actors, Classes, Skills, etc.) | Clear, standard RPG terminology |
| "Showing 1 of 1 actors" | Clear count display |
| "New actor" | Action-oriented |
| "Search actors" | Clear placeholder |
| "Referenced by 1 reference" | Clear reference safety |
| "Generate actor draft" | Action-oriented (AI feature) |

### Assets Workspace

| Copy | Assessment |
| --- | --- |
| "Assets" | Clear section header |
| "cataloged asset" | Clear count label |
| "Filter assets" | Clear placeholder |
| "Import Image" / "Import Audio" | Action-oriented |
| "Reference safety" | Clear section header |
| "No catalog references" | Clear empty state |

### Playtest Workspace

| Copy | Assessment |
| --- | --- |
| "Playtest Controls" | Clear section header |
| "Movement: WASD / Arrows" | Clear keyboard guidance |
| "Interact: E / Enter / Space" | Clear keyboard guidance |
| "Save: F5" / "Load: F9" | Clear keyboard shortcuts |
| "Editor Preview (simulated) — not the native runtime" | Honest disclaimer |
| "The preview below is a simulated editor preview, not the native runtime." | Honest, clear |
| "Browser mode: process spawning is not exposed by Vite." | Honest limitation |
| "Native runtime launch unavailable" | Clear state feedback |
| "Editor preview running" | Clear status |

### Settings Workspace

| Copy | Assessment |
| --- | --- |
| "Provider Settings" | Clear section header |
| "Providers are optional editor tooling." | Clear scope statement |
| "Editor-only" / "Runtime independent" | Clear capability badges |
| "Disabled" | Clear provider state |
| "Runtime impact: none" | Honest, reassuring |
| "Credential storage is only available in the desktop shell." | Honest limitation |
| "Provider is disabled." | Clear disabled state |
| "Secret values are not stored in project data." | Security assurance |
| "No AI work is running" | Clear queue state |

## Assessment Summary

| Category | Status | Notes |
| --- | --- | --- |
| Toolbar copy | PASS | Clear, action-oriented |
| Validation feedback | PASS | Honest about re-checking |
| Error states | PASS | Clear, actionable |
| Empty states | PASS | Per EMPTY_STATES.md policy |
| Playtest guidance | PASS | Honest about browser limitations |
| AI/Provider states | PASS | Honest about capabilities, no overpromising |
| Database forms | PASS | Standard RPG terminology |
| Keyboard shortcuts | PASS | Clear, discoverable |

## Repair Applied

The original CP-101 pass missed one visible event sprite option labeled
"Placeholder NPC". The underlying sprite id remains `npc_placeholder` for data
compatibility, but the production-facing label is now "Sample NPC". A focused
EventEditorScreen regression test prevents the placeholder-facing label from
returning.

After this repair, the visible UI copy is action-oriented and honest about
capabilities. The EMPTY_STATES.md policy is followed consistently.
