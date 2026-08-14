# {{PROJECT_TITLE}} — Assets, Rights, and Provenance

Status: `{{draft|approved|needs-review}}`  
Asset owner: `{{OWNER}}`  
Last rights review: `{{YYYY-MM-DD_OR_NOT_REVIEWED}}`

## Purpose and sources of truth

This file is the human review register for asset intent, rights, attribution,
and shipping readiness. `data/assets/catalog.json` is the machine-readable
authoring catalog; `data/project.json#generationHistory` records generation
operations and review links. All three must agree for runtime-facing assets.

This document is not legal advice. Verify the actual license and provider
terms that apply to the project, territory, distribution model, and review
date before commercial release.

## Allowed sources

| Source class | Minimum evidence | Default runtime eligibility |
| --- | --- | --- |
| Original/local | Creator/owner and creation date | Eligible after QA |
| Commissioned | Contract or permission scope and attribution | Blocked until verified |
| Third-party licensed | Source URL/file, author, exact license/version, modifications | Blocked until verified |
| Public domain/CC0 | Source and public-domain/CC0 basis | Eligible after verification and QA |
| Generated | Provider/model, terms review, prompt lineage, inputs, review and QA | Pending until accepted |
| Unknown | None or incomplete | Never eligible |

Do not include secrets, tokens, raw private provider responses, personal
information, or unsupported ownership claims. A file being downloadable is
not evidence that it may be redistributed.

## Asset register

Use the catalog asset id as the stable id. One row may link to a detailed
sidecar when the full provenance is too large for this table.

| Asset id | Kind/path | Source/creator | License or terms basis | Attribution | Modifications/lineage | Review state | Runtime state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| {{ASSET_ID}} | {{KIND}} / `{{PROJECT_RELATIVE_PATH}}` | {{SOURCE_AND_CREATOR}} | {{LICENSE_VERSION_URL_OR_INTERNAL_BASIS}} | {{NONE_OR_EXACT_CREDIT}} | {{PARENT_IDS_AND_EDITS}} | {{pending|accepted|rejected|blocked}} | {{editor-only|runtime-ready|not-shipping}} |

Allowed runtime state requires all of the following:

- the source file exists at its catalog path;
- license/terms and attribution requirements are reviewable;
- ownership is not overstated;
- imported/generated lineage is preserved;
- visual/animation/audio QA is accepted;
- runtime compatibility and references validate;
- the asset is explicitly intended to ship.

## Generated asset provenance

For every generated or refined asset, preserve the supported fields in the
catalog/history instead of inventing a parallel runtime schema:

- generation operation, timestamp, provider id, and model id;
- prompt-template id, version, kind, and non-secret prompt summary/inputs;
- source, mask, and reference asset ids/paths where applicable;
- owner kind/id and parent/refinement lineage;
- image/animation settings needed to understand the output;
- cost availability/estimate metadata without billing secrets;
- visual or animation QA, review state, acceptance history, and linked output;
- visual context source/version, normally this project's `GAME_STYLE.md` plus
  the engine `docs/GAME_VISUAL_DESIGN.md` contract.

If the current catalog cannot represent a required license, attribution, or
request identifier, keep the shipping state `blocked`, record the detail here
or in a project-local sidecar, and raise a schema decision. Do not silently
discard it or place it in a generic `notes` field without a stable convention.

## Reference inputs and personality rights

| Input id/path | Used by asset(s) | Owner/source | Permission and limits | Sensitive-person/trademark review |
| --- | --- | --- | --- | --- |
| {{REFERENCE}} | {{ASSET_IDS}} | {{SOURCE}} | {{PERMISSION}} | {{RESULT}} |

Do not use an input asset merely because it appears in a mood board. Confirm
permission for generation/editing as well as final redistribution. Reject
outputs that reproduce protected characters, logos, recognizable people,
watermarks, or substantial reference composition without permission.

## Attribution and notices

Record exact release-ready credit text and where it must appear.

| Asset/license | Required text | Placement | Included |
| --- | --- | --- | --- |
| {{ASSET_OR_LICENSE}} | {{CREDIT_TEXT}} | {{CREDITS_DOC_UI_PACKAGE}} | {{yes|no|n/a}} |

## Asset directory policy

- `assets/imported/images/`, `spritesheets/`, `audio/`, `tilesets/` contain
  project-owned copies of verified imported sources.
- `assets/generated/source/` contains generation/provenance inputs and
  deterministic source manifests.
- `assets/generated/web/` contains editor-ready outputs.
- `assets/generated/runtime/` contains deterministic runtime exports.
- Pending and rejected candidates stay outside runtime-facing references.
- Protected/generated outputs are changed through their owning workflow, not
  hand-edited in place.

## Release rights checklist

- [ ] Every shipping file has a stable catalog id and project-relative path.
- [ ] Every non-original asset has a verified license/permission record.
- [ ] Provider terms were reviewed for the intended distribution and date.
- [ ] Required attribution and notices are present exactly as required.
- [ ] Generated/edit lineage and non-secret provenance are preserved.
- [ ] No credentials, personal data, watermarks, or raw provider responses ship.
- [ ] Pending, rejected, unknown-source, and blocked assets are excluded.
- [ ] Runtime export and relevant visual/animation/audio QA passed.

## Risks and unresolved rights decisions

| Asset/risk | Severity | Release impact | Owner | Resolution evidence |
| --- | --- | --- | --- | --- |
| {{RISK}} | {{low|medium|high}} | {{IMPACT}} | {{OWNER}} | {{LINK_OR_PENDING}} |

