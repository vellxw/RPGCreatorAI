# Open Source Maintenance

This document summarizes why RPGCreatorAI is being opened and what ongoing maintenance work needs support.

## Maintainer Role

The current maintainer owns product direction, implementation, testing, release preparation, and repository operations.

## Why The Project Qualifies

RPGCreatorAI is an open source RPG creation toolkit with a React/Tauri editor and native C++ runtime. It is designed around a data-driven JSON project format so creators and automation tools can author, validate, and run RPG projects locally. The project can become useful infrastructure for AI-assisted game creation workflows without requiring closed runtime services.

## Maintenance Load

Active maintenance includes:

- reviewing code and generated changes across TypeScript, Rust/Tauri, C++, CMake, JSON data, and generated assets
- keeping editor and runtime behavior aligned
- validating project data migrations
- triaging issues from Windows build tooling, desktop shell behavior, and runtime rendering
- maintaining release notes, screenshots, and docs as the project moves through phases

## API Credit Use

Credits would be used for maintainer automation and core open source work:

- Codex-assisted pull request review
- issue triage and duplicate detection
- release note drafting
- data-format migration checks
- test generation for runtime/editor regressions
- security review of import/export, desktop bridge, and runtime launch boundaries

## Application Short Answers

These are draft answers for maintainer-support forms.

### Why does this repository qualify?

RPGCreatorAI is an active open source RPG creation toolkit with a React/Tauri editor, native C++ runtime, JSON project format, generated assets, tests, docs, and a phased maintenance history. It targets local-first AI-assisted game creation where the runtime stays deterministic and open.

### How will API credits be used?

API credits will support Codex-driven maintenance: PR review, issue triage, release notes, test generation, JSON migration checks, and security review for project import/export, Tauri desktop bridge, and native runtime launch boundaries.
