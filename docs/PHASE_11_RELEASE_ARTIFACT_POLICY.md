# Phase 11 Release Artifact Policy

CP-011 / FRA-46 defines the Windows installer and release artifact strategy
for Phase 11. It is a policy document, not a signing approval.

## Current Repo State

- `src-tauri/tauri.conf.json` product name: `RPGCreatorAI`.
- App identifier: `com.rpgcreatorai.editor`.
- Release version: `0.5.0`.
- `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, and
  `src-tauri/Cargo.toml` must use the same release version.
- `src-tauri/tauri.conf.json` has `bundle.active = true` and
  `bundle.targets = []`.
- `package.json` `desktop:build` runs `tauri build --debug --no-bundle`.
- Local Tauri CLI help lists Windows bundle values `msi` and `nsis`.
- CP-010 introduced `npm run desktop:package:windows`, which builds a local
  unsigned no-bundle prototype and smoke-launches the produced executable.

## Decision

Phase 11 uses a two-level Windows artifact strategy:

1. Local unsigned package prototype for development and QA.
2. Future unsigned installer candidate, with signing explicitly deferred until
   credentials and certificates are available.

The current shippable developer artifact is the CP-010 local package
prototype. It is not an installer and is not a signed release. It verifies that
the frontend bundle loads without a dev server, the Tauri executable starts,
and the native runtime executable is colocated where the runtime bridge can
find it.

For future Windows installer work, the preferred first installer target is
NSIS. The local Tauri CLI supports both `nsis` and `msi`, but NSIS is the
default Phase 11 installer direction because it produces a familiar `.exe`
installer/uninstaller flow for non-enterprise users. MSI remains a secondary
target for later enterprise/distribution needs if a specific issue requires it.

No signed artifact is required for normal Phase 11 validation. If a task needs
a code-signing certificate, hardware token, store account, publisher identity,
or other external release credential, stop and ask the user.

## Runtime Packaging Policy

The native runtime is packaged as a colocated executable:

```text
<tauri-output-dir>\
  rpgcreator-shell.exe
  rpg_creator_runtime.exe
```

The runtime remains a separate process. It is not embedded into the editor,
loaded as a plugin, or made part of a runtime network/cloud dependency.

The desktop bridge already searches for `rpg_creator_runtime.exe` beside the
Tauri shell binary. CP-010 validates this packaging shape by copying the
runtime into the Tauri output directory and smoke-launching the shell.

## Version Naming

Release versions use semantic version strings without a leading `v` inside
metadata files. Human-facing artifact names prefix the version with `v`.

The source of truth is the aligned version in:

- `package.json`
- `package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Artifact naming convention:

```text
RPGCreatorAI-v<version>-windows-x64-<kind>[-<qualifier>].<ext>
```

Examples:

- `RPGCreatorAI-v0.5.0-windows-x64-portable-dev.zip`
- `RPGCreatorAI-v0.5.0-windows-x64-setup-unsigned.exe`
- `RPGCreatorAI-v0.5.0-windows-x64-msi-unsigned.msi`

Use `-dev` only for local debug/no-bundle prototypes. Use `-unsigned` for
installer candidates that intentionally skip signing.

## Storage And Cleanup

Generated release artifacts must stay out of the repository unless a future
issue explicitly defines a committed metadata file.

Current local output locations:

- Native build: `%LOCALAPPDATA%\RPGCreatorAI\build`
- Tauri/package prototype: `%LOCALAPPDATA%\RPGCreatorAI\tauri-target\debug`
- Future curated release artifacts:
  `%LOCALAPPDATA%\RPGCreatorAI\release-artifacts`

Cleanup commands:

```cmd
rmdir /s /q "%LOCALAPPDATA%\RPGCreatorAI\build"
rmdir /s /q "%LOCALAPPDATA%\RPGCreatorAI\tauri-target"
rmdir /s /q "%LOCALAPPDATA%\RPGCreatorAI\release-artifacts"
```

Do not stage:

- `build/`
- `dist/`
- Cargo/Tauri target directories
- installer outputs
- portable archives
- `.pdb` files
- signing certificates
- credentials or secrets

## Validation Policy

For docs-only release policy changes, run:

```powershell
git diff --check
```

For package config, version metadata, runtime packaging, or artifact location
changes, run:

```powershell
npm test -- --run src/e2e/__tests__/verifyScript.test.ts
npm run desktop:package:windows
```

If only the package wrapper path is being checked after a successful full
package run, this focused command is acceptable:

```cmd
scripts\dev\package-windows.bat -SkipNativeBuild -SkipSmoke
```

Always record major packaging validation in `docs/VALIDATION_LOG.md`.

## Future Work Boundaries

- CP-012 owns release icon and branding assets.
- CP-015 owns user-facing build/run/package docs refresh.
- CP-016 owns the packaging integration gate.
- CP-122 and CP-128 must re-check release docs, artifact names, and final
  validation evidence.
- Signing, notarization, store upload, release account setup, and publisher
  identity are outside autonomous repo-local work until the user provides the
  required credentials and explicit permission.
