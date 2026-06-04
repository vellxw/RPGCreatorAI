# Accessibility Audit

Date: 2026-06-04

Issue: CP-100 / FRA-135

## Result

PASS with fixes applied. Core editor workflows are accessible. Two icon-only
zoom buttons were missing accessible names and have been fixed.

## Audit Scope

The audit covered the Maps, Events, Database, Assets, Playtest, and Settings
workspaces in browser mode at 1280x800 viewport.

## Findings

### Buttons Without Accessible Names

**Before fix:** 2 buttons (zoom controls in MapCanvas) had no `aria-label`,
`title`, or text content.

**After fix:** Both zoom buttons now have `aria-label` and `title` attributes.

| Button | Location | Fix Applied |
| --- | --- | --- |
| Zoom Out | MapCanvas viewport controls | `aria-label="Zoom out"` + `title="Zoom out"` |
| Zoom In | MapCanvas viewport controls | `aria-label="Zoom in"` + `title="Zoom in"` |

**Current state:** 0 buttons without accessible names. All 88 interactive
buttons in the editor have text content, `aria-label`, `title`, or
`description` attributes.

### Images Without Alt Text

14 images lack `alt` attributes. These are decorative or functional icons used
in the sidebar navigation and tile palette:

- Sidebar navigation icons (map, event, database, assets) — 4 images
- Battle UI icon — 1 image
- Tile palette tile preview images — 9 images

These images are used as visual indicators alongside text labels and are
inside buttons that already have accessible names. This is a minor issue
that does not block accessibility.

### Form Inputs

All 19 form inputs (textboxes, spinbuttons, comboboxes, checkboxes) have
proper accessible labels via `aria-label`, `<label>`, or `placeholder`
attributes. No inputs are missing labels.

### Keyboard Navigation

- Sidebar navigation buttons are focusable and keyboard-activatable.
- All toolbar buttons (Save, Validate, Playtest, Export, Import) are
  focusable.
- Map tree buttons are focusable.
- Tile palette buttons are focusable.
- Database tab buttons are focusable.
- Form inputs are focusable.
- Disabled buttons correctly expose `disabled` attribute and are not
  keyboard-activatable.

### Focus States

- Interactive elements use the browser's default focus ring.
- Active navigation buttons are visually highlighted.
- Active layer/tool buttons use `pressed` state.
- Disabled buttons use `disabled` attribute.

### ARIA Roles and Attributes

- Navigation sidebar uses `<nav>` element.
- Active workspace button exposes `aria-current` (per CP-025).
- Expandable buttons use `expandable` and `expanded` states.
- Toggle buttons use `pressed` state.
- Status messages use `status` role with `live="polite"`.

## Files Changed

- `src/components/editor/MapCanvas.tsx` — added `aria-label` and `title` to
  zoom out and zoom in buttons.

## Screenshot Evidence

Browser-mode snapshot audit via Chrome DevTools MCP confirmed all 88 buttons
have accessible names after the fix.

## Integration

This audit validates accessibility claims in `docs/EDITOR_SCREENSHOT_AUDIT.md`
(CP-097) checklist item "Icon-only controls have `aria-label` or `title`
attributes".
