# PX-183 — Legal Provenance Constraints

Issue: PX-183 / FRA-617
Milestone: M08 — Generated Asset And Animation Research
Date: 2026-06-15
Status: research docs-only, source-cited, no live paid provider calls.

## Purpose

Document legal, license, provenance, and attribution constraints for
generated RPG assets and animations so the review-gated candidate
pipeline, the project save/load boundary, and the export/runner can
preserve a verifiable provenance trail and avoid unsupported claims.

## Scope (in / out)

In scope:
- Provider terms of service and acceptable use policies (generic
  summary, not a legal opinion)
- Generated asset ownership and license notes
- Project export implications (what is exported, what is not)
- Provenance metadata that must travel with each candidate

Out of scope:
- Live provider calls (none performed; research only)
- Legal advice or specific jurisdiction analysis
- Pricing and quota (covered separately in M04 / M10)

## Sources reviewed

- `output/autoprompt/catalog/files_by_area.json`
- `docs/PHASE_12_AI_PIPELINE_INVENTORY.md`
- `docs/PHASE_12_RISK_REGISTER.md`
- `docs/PHASE_12_CREATOR_FIRST_AI_UX_PRINCIPLES.md`
- `src/providers/generationHistory.ts` (the existing history
  store; it stores metadata only, not provider secrets)
- `src/providers/providerRegistry.ts`
- `src/adapters/CredentialStoreAdapter.ts` (credential boundary)

External provider terms were not fetched live during this run.
Generic observations below are based on the public knowledge that
provider terms typically include: (a) generated content is
typically owned by the user who generated it, with provider-specific
exceptions; (b) commercial use may have additional requirements;
(c) attribution may or may not be required. Specific terms must be
verified by the user for each provider before commercial release.

## Findings

### 1. Generated asset ownership

Most major providers state in their terms that the user owns the
output of their generations, subject to:
- compliance with the provider's acceptable use policy
- compliance with applicable law (no illegal content, no
  impersonation, no copyrighted input)
- provider-specific carve-outs (some providers reserve rights for
  model improvement, but most offer opt-out)

These are not legal conclusions. They are general observations to
help the pipeline make safe default choices; the user must
verify the specific provider's terms before commercial release.

### 2. License notes in the project

The project save format (`data/project.json` and friends) should
not store provider secrets, raw provider responses, or anything
that would re-create the candidate outside the project context.
The asset catalog stores:
- a reference to the generated image (the bytes)
- provenance metadata: provider id, model id, request id, prompt
  summary, generation timestamp
- license note: free-text field, defaulting to "see provider terms"
- attribution note: optional, defaulting to none

This way the runtime can render the asset, the user can see where
it came from, and an export of the project does not accidentally
leak provider-side material.

### 3. Project export implications

When a project is exported (e.g., as a runtime game bundle):
- The generated images are included as part of the asset catalog.
- The provenance metadata is included as a sidecar JSON so the
  receiving party (or the user years later) can audit origin.
- Provider credentials are explicitly NOT included.
- Provider request logs are NOT included.

If a downstream user wants to redistribute the project, they are
responsible for verifying that the generated content is licensed
appropriately for the redistribution. RPGCreatorAI does not grant
or imply any license beyond what the original provider terms
grant.

### 4. Attribution

Attribution requirements vary by provider and by license. The
default is no attribution required (when the user owns the output).
Some providers may require a credit line; the project metadata
exposes a free-text attribution field that the user can fill in if
their provider requires it.

The pipeline should never auto-add attribution to a project; that
is the user's choice based on their provider's terms.

### 5. Risk mitigations for the pipeline

- **Never store provider secrets in project data.** Already
  enforced by `CredentialStoreAdapter.ts`; the pipeline should not
  bypass it.
- **Never log raw provider responses that may contain billing or
  PII details.** Log only the metadata fields listed above.
- **Always attach provenance metadata to candidates.** Required for
  the review inbox; covered by PX-108 in M05.
- **Treat rejected candidates as having no runtime impact.**
  Already covered by PX-220 in M10.
- **Treat the runtime asset catalog as the source of truth for what
  the game ships.** Candidates are pre-runtime; accepted candidates
  become runtime assets via explicit user action.

## Implications for downstream issues

- M05 (review inbox) should attach provenance metadata to every
  candidate (PX-108).
- M05 should expose license and attribution fields for user
  editing.
- M10 (refinement pipeline) should preserve provenance metadata
  across refinement rounds; the lineage should be visible.
- M12 (final gate) should verify that no provider secrets appear
  in any tracked file.

## Citations

In-repo sources only. External provider terms not fetched live;
this document is a starting baseline for the user to extend with
specific provider URLs and terms.

## Known limitations of this document

- No legal advice is given or implied.
- No specific provider terms are cited. The user must verify
  provider terms before commercial use.
- The provenance metadata schema is recommended, not finalized.
  Final schema work belongs to M05 / PX-108.
- Jurisdiction-specific analysis is not in scope and not provided.
