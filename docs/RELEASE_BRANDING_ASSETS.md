# Release Branding Assets

CP-012 / FRA-47 defines the tracked app icon and desktop branding source for
RPGCreatorAI release packaging.

## Source And Provenance

The source asset is `src-tauri/icons/icon-source.svg`.

It is a locally authored deterministic SVG made from geometric shapes: a
tile-map frame, block `R` monogram, and authoring spark. No AI image generation,
stock image, external logo file, remote font, or untracked design source is
required to regenerate the release icons.

The SVG is committed to the repository and is the provenance source for the
generated Tauri icon files.

## Generated Icon Set

Run this from the repository root to regenerate desktop/release icons:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File src-tauri/scripts/generate-icons.ps1
```

The generator uses the local Tauri CLI (`npx tauri icon`) in a temporary
directory, then copies only the desktop and Windows release files used by the
project:

- `src-tauri/icons/32x32.png`
- `src-tauri/icons/64x64.png`
- `src-tauri/icons/128x128.png`
- `src-tauri/icons/128x128@2x.png`
- `src-tauri/icons/icon.png`
- `src-tauri/icons/icon.ico`
- `src-tauri/icons/icon.icns`
- `src-tauri/icons/StoreLogo.png`
- `src-tauri/icons/Square30x30Logo.png`
- `src-tauri/icons/Square44x44Logo.png`
- `src-tauri/icons/Square71x71Logo.png`
- `src-tauri/icons/Square89x89Logo.png`
- `src-tauri/icons/Square107x107Logo.png`
- `src-tauri/icons/Square142x142Logo.png`
- `src-tauri/icons/Square150x150Logo.png`
- `src-tauri/icons/Square284x284Logo.png`
- `src-tauri/icons/Square310x310Logo.png`

Mobile-specific `android/` and `ios/` outputs from the Tauri icon command are
not committed because Phase 11 release packaging targets desktop.

## Desktop Metadata

`src-tauri/tauri.conf.json` owns release branding metadata:

- `productName`: `RPGCreatorAI`
- primary window title: `RPGCreatorAI`
- app identifier: `com.rpgcreatorai.editor`
- bundle category: `DeveloperTool`
- release version: aligned with npm and Cargo at `0.5.0`
- bundle icons: the generated desktop icon files under `src-tauri/icons/`
- browser/Tauri document title: `RPGCreatorAI`
- browser/Tauri favicon source: `/src-tauri/icons/icon-source.svg`

Technical package names remain intentionally distinct from the human-facing
product name: npm uses `rpgcreator-ai-editor` and Cargo produces
`rpgcreator-shell`. The branding check validates those names, version alignment,
the Tauri identifier/title, and the HTML title/favicon reference together.

## Validation

Run the focused branding check after regenerating icons or changing Tauri
branding metadata:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-branding-assets.ps1
```

After a package build, capture the executable-associated icon for visual
inspection:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-branding-assets.ps1 -CaptureIconPath docs/screenshots/phase11-branding/packaged-exe-icon.png
```

CP-012 validation also runs the packaged Windows prototype so the desktop shell
binary is rebuilt with the intended icon metadata.
