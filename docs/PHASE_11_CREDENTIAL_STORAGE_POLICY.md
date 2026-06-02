# Phase 11 Credential Storage Policy

CP-058 / FRA-93 implements the Windows v1 credential boundary for optional
provider tooling. This issue does not add live provider calls.

## Windows V1 Decision

Provider credentials are stored only in the desktop shell and only after a
user explicitly enters a value in Settings.

- Storage mechanism: Windows DPAPI via Tauri/Rust.
- Storage path: `%APPDATA%\RPGCreatorAI\provider-credentials\<providerId>.bin`
  with `%LOCALAPPDATA%` / `$HOME\.rpgcreatorai` fallback through the existing
  app-data policy.
- Stored file contents: DPAPI-protected binary blob, not plaintext JSON.
- Renderer return values: metadata only (`configured`, `storage`,
  `providerId`, optional redacted error).
- Project data: no credential values, no credential blobs, no provider keys.
- Browser mode: credential storage unavailable and clearly reported.

The renderer may send a credential value to the Tauri command when the user
clicks `Save Credential`. The value is cleared from component state after the
write attempt. Raw credentials are not returned to the renderer by any command.

## Redaction

Redaction is centralized for renderer feedback and Rust credential errors.
Security tests cover explicit secret values, common `apiKey`, `token`,
`secret`, `credential`, and bearer authorization shapes, and bridge errors
that include a fixture secret value.

## Commands

The desktop bridge exposes a small `credentials` namespace:

- `getStatus(providerId)` returns configured/unavailable metadata.
- `list()` returns configured provider metadata.
- `set(providerId, secret)` stores a DPAPI-protected credential and returns
  metadata only.
- `delete(providerId)` removes the protected credential file.

Provider ids are validated to ASCII `a-z`, `0-9`, `.`, `_`, and `-` before
they can affect the credential path. Path traversal ids are rejected.

## Runtime Boundary

The native C++ runtime remains independent of provider settings, provider
credentials, AI, network access, cloud services, and live APIs. Credential
storage is desktop editor tooling only.

## Validation

Security-focused validation covers:

- renderer redaction helpers
- browser credential-storage unavailable behavior
- desktop bridge error redaction
- Settings credential input clearing after save
- no raw credential value in rendered feedback after save
- Rust provider-id path safety
- Windows DPAPI encrypted file write under app data
- no raw credential value in Rust command return JSON
- no raw credential value in the stored credential blob
