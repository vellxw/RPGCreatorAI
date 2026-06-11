# Phase 12 Desktop Startup Screenshot Evidence

Issue: PX-026 / FRA-460
Date: 2026-06-11

## Scope

This evidence records the current packaged Windows startup experience after the
Phase 12 M01 launcher work. The capture used the packaged shell directly and a
fresh temporary app-data home, so no existing project, account, browser, or
provider state was involved.

Computer Use was not used. Windows capture was performed with PowerShell/.NET:
the harness launched `rpgcreator-shell.exe`, selected the largest visible
top-level window owned by that process, resolved its client rectangle with
`GetClientRect` and `ClientToScreen`, and copied only that client area with
`System.Drawing.Graphics.CopyFromScreen`.

## Captured States

| State | Evidence | Dimensions | SHA-256 |
| --- | --- | --- | --- |
| Branded startup splash | `docs/screenshots/phase12-px026/01-packaged-desktop-splash.png` | 1440 x 900 | `C4C72F0AB3B3CDD5EA0038EA5079C1134D4CAA87A431B04316D3610759D42796` |
| Stable project selection | `docs/screenshots/phase12-px026/02-packaged-desktop-project-selection.png` | 1440 x 900 | `7A7131220615ABC367AB254BD827FD15C3B6379C3C818F6729AA39006F85D11A` |

The splash frame was captured 1,265 ms after process launch and shows the
branded `Preparing your workspace` loading state. The project-selection frame
was captured 1,392 ms after process launch and shows Open Project Folder,
Import Project Bundle, Create Project, the bundled sample, and the native
runtime-ready status.

The clean first-run path did not enter a recovery state, so no recovery
screenshot was fabricated or forced for this issue. Recovery behavior remains
covered by the PX-022 focused tests and documentation.

## Capture Integrity And Privacy

- The executable under test was
  `C:\Users\franc\AppData\Local\RPGCreatorAI\tauri-target\debug\rpgcreator-shell.exe`.
- The native runtime remained colocated as `rpg_creator_runtime.exe`.
- Temporary `APPDATA`, `LOCALAPPDATA`, and `HOME` directories isolated the run
  from the user's normal RPGCreatorAI state.
- Only the packaged window client area was retained. An initial frame captured
  before WebView painted contained background desktop content and was
  discarded; it is not present in the repository.
- White and black compositor-transition frames were also discarded because
  they did not represent a product state.
- Both committed PNGs were visually inspected after capture.

## Result

PX-026 has current desktop evidence for the two applicable startup states:
the branded splash and the stable project-selection screen. The screenshots
are tied to a real packaged launch and contain no browser, chat, credential,
account, or unrelated application content.
