# Security Policy

RPGCreatorAI is an alpha-stage local editor/runtime project. The current runtime does not require network access or cloud credentials.

## Supported Versions

Security fixes target the latest code on the default branch until formal releases begin.

The currently supported desktop/runtime target is Windows. Linux desktop packaging is experimental until the Tauri GTK/WebKit dependency stack is validated and covered by CI.

## Reporting A Vulnerability

Do not open a public issue for a vulnerability.

Please contact the maintainer through GitHub profile contact methods or by opening a minimal private advisory if GitHub enables advisories for this repository.

Include:

- affected commit or release
- reproduction steps
- expected and actual impact
- whether any secret, local file, project data, or generated output can be exposed

## Secrets

Never commit API keys, provider tokens, `.env` files, generated credentials, or private project saves. The repository ignores `.env*` and local save JSON files by default.

## Threat Model

Current focus:

- local project files
- desktop shell file access
- runtime process launch boundaries
- project import/export validation

Out of scope for the current alpha:

- hosted multi-user collaboration
- public API server deployment
- account systems
