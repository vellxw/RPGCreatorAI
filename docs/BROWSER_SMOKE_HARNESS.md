# Desktop Browser Smoke Harness

Date: 2026-06-04

Issue: CP-108 / FRA-143

## Result

PASS. Chrome DevTools MCP serves as the equivalent browser automation smoke
harness for high-value editor workflows. No Playwright installation is
required. The harness is optional — it works when Chrome DevTools MCP is
available and gracefully documents limitations when it is not.

## Approach

Playwright is not installed in this project. Instead, Chrome DevTools MCP
provides equivalent browser automation capabilities:

- **Page navigation:** `navigate_page`, `new_page`, `close_page`
- **Element interaction:** `click`, `fill`, `fill_form`, `type_text`, `press_key`
- **State inspection:** `take_snapshot`, `take_screenshot`, `evaluate_script`
- **Viewport control:** `resize_page`, `emulate`
- **Network monitoring:** `list_network_requests`, `get_network_request`
- **Console monitoring:** `list_console_messages`, `get_console_message`
- **Performance:** `performance_start_trace`, `lighthouse_audit`

## Smoke Harness Workflow

### Prerequisites

1. Start the editor dev server: `npm run dev`
2. Chrome DevTools MCP must be connected to a Chrome instance

### Automated Smoke Steps

1. **Navigate to editor:** `new_page http://localhost:3000`
2. **Load bundled sample:** `click` on "Use My First RPG"
3. **Verify Maps workspace:** `take_snapshot` confirms Map Tree, Tile Palette, Map Settings
4. **Navigate to each workspace:** `click` on Events, Database, Assets, Playtest, Settings
5. **Verify each workspace:** `take_snapshot` confirms expected elements
6. **Run accessibility audit:** `evaluate_script` checks buttons for accessible names
7. **Run responsive audit:** `resize_page` to multiple sizes, `evaluate_script` checks overflow
8. **Capture screenshots:** `take_screenshot` for each workspace at each viewport size
9. **Check console errors:** `list_console_messages` for unexpected errors

### Evidence Storage

Screenshots are stored under `docs/screenshots/phase11-cp{issue-id}/`.

### Limitations

- Chrome DevTools MCP requires a running Chrome instance and MCP connection.
- The dev server must be running before automation starts.
- Desktop/Tauri-specific features (filesystem, native runtime launch) cannot
  be tested through browser automation.
- The harness is manual (driven by agent tool calls) rather than a scripted
  test file — this is intentional for an audit workflow that benefits from
  visual inspection at each step.

## Integration

This harness was used for:
- CP-097 (Editor Screenshot Audit) — 8 screenshots captured
- CP-099 (Responsive Layout Audit) — 7 screenshots at 4 viewport sizes
- CP-100 (Accessibility Audit) — automated button audit via JS evaluation

## Alternative: Playwright Installation

If scripted Playwright tests are desired in the future:

```powershell
npm install --save-dev @playwright/test
npx playwright install chromium
```

Then create `playwright.config.ts` and test files under `tests/e2e/`. This
is a future enhancement, not required for the current audit workflow.
