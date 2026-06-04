# Editor Screenshot Audit Workflow

Date: 2026-06-04

Issue: CP-097 / FRA-132

## Purpose

Define a repeatable, evidence-based screenshot audit workflow for the
RPGCreatorAI editor. This document ensures every major visual surface has
documented evidence, every visual regression has a discovery path, and every
audit follows the same checklist so quality remains consistent across phases.

This workflow integrates with:

- `docs/GAME_VISUAL_QA.md` — visual QA rubric for authored game scenes.
- `docs/EDITOR_RUNTIME_E2E_QA.md` — editor-to-runtime roundtrip validation.
- `docs/EMPTY_STATES.md` — empty-state policy.
- `docs/VALIDATION_LOG.md` — timestamped validation log.
- `docs/screenshots/` — committed evidence storage.
- CP-032 editor surface integration gate — precedent for JSON assertion audits.

## When to Capture Screenshots

Screenshots are **required** at these trigger points:

| Trigger | Scope | Required? |
| --- | --- | --- |
| New workspace or screen added | The new screen plus adjacent screens affected | Yes |
| Layout or navigation change | All screens affected by the change | Yes |
| Component visual update (size, color, spacing) | The changed component in context | Yes |
| New empty/loading/error state | The surface showing the new state | Yes |
| Disabled-state or accessibility change | The affected controls | Yes |
| Integration gate (milestone boundary) | Full audit of all core workflows | Yes |
| Responsive or viewport behavior change | Desktop and narrow viewport captures | Yes |
| Phase boundary (milestone close) | Full audit sweep | Yes |
| Bug fix affecting visual layout | The fixed surface before and after | Recommended |

## Required Screenshots — Core Editor Workflows

Each screenshot captures the **desktop** editor shell viewport (1280x800 or
the Tauri window default). Narrow viewport captures (768px wide) are required
only where explicitly noted.

### 1. Startup and Project Open

| ID | Screenshot | Description |
| --- | --- | --- |
| S-01 | `startup-desktop.png` | First-run startup screen showing open/create/import/sample actions (desktop mode). |
| S-02 | `startup-empty-state.png` | Startup screen with no recent projects, confirming empty-state guidance. |

### 2. Map Editor — Main Workspace

| ID | Screenshot | Description |
| --- | --- | --- |
| M-01 | `map-editor-desktop.png` | Full map editor with map tree, canvas, tile palette, and inspector visible. |
| M-02 | `map-tree-expanded.png` | Map tree with nested hierarchy visible, selected map highlighted. |
| M-03 | `map-properties-panel.png` | Map properties inspector showing tileset, scroll, encounter, battleback, parallax, viewport, and start position fields. |
| M-04 | `tile-palette-active.png` | Tile palette with brush tool selected, layer tabs, tile grid, and brush metadata visible. |
| M-05 | `canvas-viewport-desktop.png` | Map canvas at default zoom showing tiles, events, and player start position. |
| M-06 | `canvas-overlays-collision.png` | Canvas with collision overlay active, showing passability markers. |
| M-07 | `canvas-overlays-region.png` | Canvas with region overlay active, showing region markers. |
| M-08 | `map-editor-narrow.png` | Map editor at 768px width — responsive behavior, no horizontal overflow, no overlapping panels. |

### 3. Events Workspace

| ID | Screenshot | Description |
| --- | --- | --- |
| E-01 | `events-list-desktop.png` | Events list showing event entries, breadcrumbs, and page tabs. |
| E-02 | `event-page-tabs.png` | Event editor with multiple page tabs visible, page conditions, and page-scoped controls. |
| E-03 | `event-command-stack.png` | Command stack editor showing typed commands, insert/move/delete controls, and branch structure. |
| E-04 | `event-movement-route.png` | Movement route step editor with route step controls visible. |
| E-05 | `event-empty-state.png` | Events workspace with no events — empty-state guidance per EMPTY_STATES.md. |

### 4. Database Workspace

| ID | Screenshot | Description |
| --- | --- | --- |
| D-01 | `database-navigation-desktop.png` | Database screen with tab navigation, list, and detail pane visible. |
| D-02 | `database-list-filter.png` | Database list with search/filter active, showing filtered results. |
| D-03 | `database-actors-detail.png` | Actors editor detail pane showing stats, skills, equipment, portrait fields. |
| D-04 | `database-items-detail.png` | Items editor detail showing description, icon, modifiers, and price. |
| D-05 | `database-enemies-detail.png` | Enemies editor detail showing stats, drops, and troop references. |
| D-06 | `database-tilesets-detail.png` | Tilesets editor detail showing tileset layers and metadata. |
| D-07 | `database-animations-detail.png` | Animations editor detail showing animation set/clip metadata. |
| D-08 | `database-system-detail.png` | System tab showing default settings, starting party, and currency. |
| D-09 | `database-types-detail.png` | Types tab showing type entries. |
| D-10 | `database-terms-detail.png` | Terms tab showing terminology labels. |
| D-11 | `database-empty-state.png` | A database tab with no records — empty-state guidance visible. |
| D-12 | `database-reference-badge.png` | Database detail showing reference badges and delete warning for a referenced record. |

### 5. Validation and Save

| ID | Screenshot | Description |
| --- | --- | --- |
| V-01 | `validation-errors-blocked.png` | Bottom panel showing validation errors blocking save. |
| V-02 | `validation-warnings-allowed.png` | Bottom panel showing warnings with save allowed. |
| V-03 | `validation-empty-clean.png` | Bottom panel showing no errors and no warnings. |
| V-04 | `save-success-feedback.png` | Toolbar showing successful save feedback. |
| V-05 | `save-failure-feedback.png` | Toolbar showing save failure with recovery guidance. |

### 6. Playtest Workspace

| ID | Screenshot | Description |
| --- | --- | --- |
| P-01 | `playtest-launch-controls.png` | Playtest screen showing Project Start, Current Map, Selected Event launch buttons. |
| P-02 | `playtest-runtime-log.png` | Runtime Log tab with log entries visible. |
| P-03 | `playtest-event-trace.png` | Event Trace tab with trace entries visible. |
| P-04 | `playtest-runtime-state.png` | Runtime State tab with state snapshot visible. |
| P-05 | `playtest-empty-state.png` | Playtest screen before first launch — empty-state guidance for Runtime Log/Event Trace/Runtime State. |
| P-06 | `playtest-browser-unavailable.png` | Browser-mode playtest showing honest unavailable state for native features. |

### 7. Assets Workspace

| ID | Screenshot | Description |
| --- | --- | --- |
| A-01 | `assets-catalog-list.png` | Assets workspace showing catalog list with filter and detail pane. |
| A-02 | `assets-import-panel.png` | Asset import panel (desktop mode) showing file selection and metadata fields. |
| A-03 | `assets-empty-state.png` | Assets workspace with no imported assets — empty-state guidance visible. |

### 8. Settings Workspace

| ID | Screenshot | Description |
| --- | --- | --- |
| C-01 | `settings-provider-list.png` | Settings screen showing provider availability, capability gates, and disabled states. |
| C-02 | `settings-no-providers.png` | Settings with zero providers configured — honest no-action state. |

### 9. Error and Recovery States

| ID | Screenshot | Description |
| --- | --- | --- |
| R-01 | `error-save-blocked.png` | Validation error banner blocking save with actionable guidance. |
| R-02 | `error-missing-tileset.png` | Map properties showing missing tileset reference. |
| R-03 | `error-desktop-unavailable.png` | Browser-mode surfaces showing desktop-unavailable honest state. |

## Audit Checklist

For each screenshot, verify these checks:

### Spacing

- [ ] Consistent padding inside containers (no elements touching edges).
- [ ] Consistent margins between sibling elements.
- [ ] No cramped or excessively spaced sections.
- [ ] Text line-height is readable (no lines colliding).

### Overlap

- [ ] No text clipped by container boundaries.
- [ ] No elements overlapping siblings or parent boundaries.
- [ ] Modals/overlays fully contained within viewport.
- [ ] Dropdown menus not clipped by parent overflow.
- [ ] Scrollable areas show content without cut-off items.

### Disabled States

- [ ] Disabled buttons are visually distinct (reduced opacity or style change).
- [ ] Disabled controls have `aria-disabled` or `disabled` attributes.
- [ ] Disabled states explain why the control is unavailable when relevant.
- [ ] No interactive controls appear active when they are non-functional.

### Information Density

- [ ] Lists and detail panes are readable without excessive whitespace.
- [ ] Dense data tables or grids use consistent row heights.
- [ ] Tooltips or help text available for abbreviated labels.
- [ ] Empty states guide the next action without marketing filler.

### Empty / Loading / Error States

- [ ] Every workspace has an empty-state per `docs/EMPTY_STATES.md`.
- [ ] Loading indicators are present for async operations.
- [ ] Error states provide actionable recovery guidance.
- [ ] Browser-only honest unavailable states are present where applicable.

### Responsive / Viewport Variants

- [ ] Desktop viewport (1280x800): all core workflows render without overflow.
- [ ] Narrow viewport (768px): primary workflows remain usable, no horizontal scroll on main content.
- [ ] Sidebar collapses or adapts at narrow widths.
- [ ] No controls shrink below 20px touch/click target.

### Navigation and Accessibility

- [ ] Active navigation items are visually highlighted.
- [ ] `aria-current` is set on the active workspace button.
- [ ] Icon-only controls have `aria-label` or `title` attributes.
- [ ] Tab order follows visual layout.

## Evidence Storage

All screenshot evidence is stored under `docs/screenshots/` following this
naming convention:

```
docs/screenshots/{phase-or-issue-id}/
```

Examples:

- `docs/screenshots/phase11-cp032/` — CP-032 editor surface integration gate.
- `docs/screenshots/phase11-cp097/` — CP-097 editor screenshot audit workflow.
- `docs/screenshots/phase11-cp023/` — CP-023 empty states evidence.

Each audit run produces:

1. **PNG screenshots** — one file per required screenshot ID.
2. **Audit smoke JSON** (optional) — `editor-surface-audit-smoke.json` with
   structured assertions, following the CP-032 format:

```json
{
  "boot": { "opened": true, "url": "http://127.0.0.1:3010" },
  "states": [
    {
      "name": "mapsDesktop",
      "badFuture": false,
      "bodyOverflowX": false,
      "tinyButtons": [],
      "tinyButtonCount": 0,
      "sidebar": "Maps Events Database Playtest"
    }
  ],
  "assertions": {
    "noFutureActions": true,
    "noDesktopOverflow": true,
    "noTinyButtons": true
  }
}
```

3. **Audit report** — a summary appended to this document or the relevant
   phase gate doc.

## Follow-Up Issue Filing

When the audit discovers a defect:

1. **Classify severity:**

   | Severity | Description | Action |
   | --- | --- | --- |
   | **Blocking** | Element prevents authoring workflow (broken click target, missing critical state) | File issue immediately, set priority High/Urgent |
   | **Visible defect** | Spacing, overlap, or styling issue visible in normal use | File issue, set priority Medium |
   | **Minor polish** | Inconsistent spacing, edge-case truncation, cosmetic detail | File issue, set priority Low or batch with next polish pass |

2. **File the issue with evidence:**

   - Title: `[Visual QA] {workspace} — {defect description}`
   - Attach the screenshot showing the defect.
   - Reference the audit checklist ID (e.g., "M-08 narrow viewport check failed").
   - Include the viewport size, OS/browser, and reproduction steps.
   - Apply labels: `visual-qa`, `audit`, `phase-11`.

3. **Link to the audit:**

   - Reference the audit doc or gate doc that discovered the defect.
   - Reference the screenshot ID from the required screenshots table.

4. **Do not batch-close:**

   - Follow AGENTS.md Linear discipline: one issue = one fix = one commit.
   - Each defect gets its own validation evidence.

## Audit Execution Steps

To perform a full audit:

1. **Start the editor dev server:**

   ```powershell
   npm run dev
   ```

2. **Open Chrome DevTools MCP** (or browser automation) against `http://localhost:5173`.

3. **Navigate to each workspace** in the required screenshots list.

4. **Capture each screenshot** and save to `docs/screenshots/{issue-id}/`.

5. **Run the audit checklist** against each screenshot.

6. **Record findings** — pass or fail each checklist item per screenshot.

7. **File follow-up issues** for any failures.

8. **Append results** to `docs/VALIDATION_LOG.md`.

9. **Commit evidence** with the audit doc changes.

## Integration with Existing Gates

This audit workflow is additive. It does not replace:

- `docs/GAME_VISUAL_QA.md` — continues to score runtime scene visuals.
- `docs/EDITOR_RUNTIME_E2E_QA.md` — continues to validate editor-to-runtime roundtrip.
- CP-032 style integration gates — continue to use structured JSON assertions.

For milestone integration gates (e.g., CP-032, CP-048), include this audit's
required screenshots as part of the gate evidence set. The JSON assertion
format from CP-032 remains valid and recommended for automated checks.

## Audit History

| Date | Issue | Scope | Result | Evidence |
| --- | --- | --- | --- | --- |
| 2026-06-02 | CP-032 | Editor surface integration gate | PASS | `docs/screenshots/phase11-cp032/` |
| 2026-06-04 | CP-097 | Full editor screenshot audit workflow defined | N/A (checklist) | `docs/screenshots/phase11-cp097/` |
