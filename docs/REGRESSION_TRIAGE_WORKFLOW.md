# Regression Triage Workflow

Date: 2026-06-04

Issue: CP-103 / FRA-138

## Purpose

Define how audit findings from editor screenshots, runtime screenshots,
responsive layout, accessibility, UX copy, and asset quality audits become
actionable Linear issues. This workflow ensures every finding gets a clear
owner, severity, reproduction path, and resolution tracking.

## Severity Classification

| Severity | Definition | Priority | Timeline |
| --- | --- | --- | --- |
| **Blocking** | Prevents a core authoring or runtime workflow from completing (crash, data loss, unusable control) | High or Urgent | Fix before next integration gate |
| **Visible Defect** | Clearly wrong visual or behavioral state visible in normal use (text overflow, wrong color, incorrect feedback) | Medium | Fix in current phase |
| **Minor Polish** | Inconsistent spacing, edge-case truncation, cosmetic detail that does not block workflow | Low | Batch with next polish pass or defer |

## Required Issue Fields

Every audit finding filed as a Linear issue MUST include:

1. **Title:** `[Audit Type] {workspace/scene} — {defect description}`
   - Examples:
     - `[Visual QA] Maps — zoom buttons missing accessible names`
     - `[Runtime Visual QA] Battle — turn log text clipped at 800x600`
     - `[Responsive] Database — form overflow at 768px`

2. **Description:** Must contain all of:
   - **What:** Clear description of the defect
   - **Where:** File path, screen/workspace name, and component if applicable
   - **Screenshot:** Attached PNG/BMP showing the defect (from `docs/screenshots/`)
   - **Viewport/Context:** Window size, OS, browser/desktop mode
   - **Reproduction steps:** Numbered steps to reproduce
   - **Expected behavior:** What should happen
   - **Actual behavior:** What actually happens
   - **Audit reference:** Which audit document and checklist ID discovered this

3. **Labels:** Apply relevant labels:
   - `visual-qa` — visual/viewport issues
   - `audit` — found during systematic audit
   - `ux` — user experience issues
   - `phase-11` — current phase
   - `complete-platform` — Phase 11 milestone label
   - `parallel-safe` — can be worked on independently
   - `runtime` — native runtime issues
   - `docs` — documentation-only issues
   - `qa` — quality assurance issues

4. **Priority:** Map from severity:
   - Blocking → Urgent (1) or High (2)
   - Visible Defect → Medium (3)
   - Minor Polish → Low (4)

5. **Milestone:** Assign to the owning milestone or a stabilization bucket:
   - Milestone 12 (Continuous Visual/UX Audits) for audit-found issues
   - The relevant feature milestone if the defect is in a specific feature
   - Milestone 13 (QA automation) if the fix requires regression tests

## Routing Rules

| Finding Source | Route To | Labels |
| --- | --- | --- |
| Editor screenshot audit | Milestone 12 or feature milestone | `visual-qa`, `audit` |
| Runtime screenshot audit | Milestone 12 or feature milestone | `visual-qa`, `audit`, `runtime` |
| Responsive layout audit | Milestone 12 | `audit`, `ux` |
| Accessibility audit | Milestone 12 | `audit`, `ux` |
| UX copy audit | Milestone 12 | `audit`, `ux`, `docs` |
| Asset quality audit | Milestone 12 or asset pipeline milestone | `visual-qa`, `audit`, `assets` |
| Integration gate | The feature milestone that owns the gate | `qa` |

## Duplicate and Known Limitation Handling

### Before filing

1. Search Linear for existing issues with similar descriptions.
2. Check if the finding is already documented as a known limitation in:
   - `docs/EDITOR_SCREENSHOT_AUDIT.md`
   - `docs/RUNTIME_SCREENSHOT_AUDIT.md`
   - `docs/RESPONSIVE_LAYOUT_AUDIT.md`
   - `docs/ACCESSIBILITY_AUDIT.md`
   - `docs/UX_COPY_AUDIT.md`
   - `docs/GENERATED_ASSET_QUALITY_AUDIT.md`
   - Phase gate documents

### If duplicate

- Do not file a new issue.
- Add a comment to the existing issue with the new evidence (screenshot, viewport, context).
- Update the existing issue's description if the new evidence adds information.

### If found while auditing an issue already marked Done

Use the existing Linear issue when the finding is evidence drift or a scoped
defect in that issue's own deliverable, and the repair can be completed with
the same issue context. This avoids filing duplicate audit-cleanup issues while
still preserving evidence.

The repair comment MUST include:

- The original Linear issue id and original closeout commit.
- The exact false, stale, or incomplete claim.
- The files inspected or changed.
- The validation command that failed before repair, when applicable.
- The repair commit hash and push result.
- The final validation commands and pass/fail counts.

Open a new Linear issue instead when the finding is a new product defect outside
the original issue scope, needs a separate owner/milestone, cannot be fixed
immediately, or requires screenshots/reproduction work that should be tracked
independently. If the Done state itself is materially false and the issue cannot
be repaired immediately, reopen it before continuing.

### If known limitation

- Document the limitation in the relevant audit document.
- Do not file a Linear issue unless the limitation should be addressed in the current phase.
- If the limitation should be deferred, note it in the audit document's "Known Limitations" section.

### If unclear

- Stop and report to the user.
- Do not make assumptions about whether a finding is a defect or intentional design.

## Sample Audit Finding

**Title:** `[Accessibility] Maps — zoom buttons missing accessible names`

**Description:**
- **What:** Two icon-only zoom control buttons in the map canvas viewport have no `aria-label`, `title`, or text content, making them inaccessible to screen readers.
- **Where:** `src/components/editor/MapCanvas.tsx`, lines 591-600, viewport controls section.
- **Screenshot:** Snapshot from Chrome DevTools MCP showing `button` elements without accessible names.
- **Viewport:** 1280x800, browser mode.
- **Reproduction steps:**
  1. Open the editor in browser mode.
  2. Load the bundled sample project.
  3. Run `document.querySelectorAll('button')` and check each button for `aria-label`, `title`, or text content.
  4. Two zoom buttons in the viewport controls area have none of these.
- **Expected:** All interactive buttons have accessible names.
- **Actual:** Zoom out and zoom in buttons lack accessible names.
- **Audit reference:** `docs/ACCESSIBILITY_AUDIT.md`, "Buttons Without Accessible Names" section.

**Labels:** `audit`, `ux`, `phase-11`, `complete-platform`, `parallel-safe`
**Priority:** Medium (3)
**Milestone:** 12 Continuous Visual/UX Audits
**Resolution:** Fixed by adding `aria-label="Zoom out"`, `title="Zoom out"`, `aria-label="Zoom in"`, `title="Zoom in"` to the zoom buttons. Commit `6d4926e`.

## Completed-Issue Repair Examples

- **CP-101 / FRA-136:** Existing Done issue claimed no placeholder copy was
  found. Audit repair found visible "Placeholder NPC" copy in the Event editor,
  fixed it to "Sample NPC", added regression coverage, and commented evidence
  back on FRA-136.
- **CP-102 / FRA-137:** Existing Done issue claimed generated asset dimensions
  were valid. Audit repair found catalog/runtime metadata drift, aligned the
  JSON metadata to file headers, added manifest integrity coverage, and
  commented evidence back on FRA-137.

## Audit-to-Issue Flow

```
Audit performed
    ↓
Finding discovered
    ↓
Is it inside an already-Done issue's deliverable? ─── Yes → Repair/comment on existing issue or reopen if not immediately repairable
    ↓ No
Is it a defect? ─── No → Document as known limitation in audit doc
    ↓ Yes
Is it a duplicate? ─── Yes → Comment on existing issue with new evidence
    ↓ No
Classify severity (Blocking / Visible / Minor)
    ↓
File Linear issue with required fields
    ↓
Assign to milestone and labels
    ↓
Fix or defer based on severity and phase timeline
    ↓
Validate fix
    ↓
Close issue with evidence
```

## Integration

This workflow is referenced by:
- `docs/EDITOR_SCREENSHOT_AUDIT.md` — follow-up issue filing section
- `docs/RUNTIME_SCREENSHOT_AUDIT.md` — follow-up issue filing section
- AGENTS.md — Linear Issue Discipline section
