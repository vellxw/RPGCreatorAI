# Phase 11 CP-054 — Asset Metadata Editor

CP-054 adds maintainable, editor-only metadata editing for cataloged assets.
The native runtime remains independent from the asset catalog and continues to
consume runtime project data directly.

## Implemented

- Assets detail panel edits mutable catalog metadata:
  - display name
  - source
  - tags
  - provenance
  - dimensions and frame metadata
  - runtime compatibility
  - runtime notes
  - protected status
  - notes
- Asset id, kind, and path remain immutable in the UI.
- The detail panel surfaces source, generated/protected/runtime status, and
  reference sources for the selected catalog asset.
- The shared reference index now reports catalog asset refs from animation
  clips, tileset tile metadata, and `system.audio` entries when those refs
  target cataloged assets.
- Project validation now rejects invalid editable metadata values, including
  blank or duplicate tags and wrong runtime/provenance/protected field types.
- Browser and desktop behavior remain local-first. No AI provider, network,
  cloud, or live API dependency was added.

## Reference Safety

CP-054 does not add an asset-id rename flow. The selected asset id is shown as
disabled/read-only so users cannot break animation, tileset, or audio
references by editing identity fields without a future repair workflow.

The reference index only records asset refs that match cataloged assets. This
keeps selected-asset impact visible while avoiding false broken-reference
reports for static generated keys that are not catalog entries.

## Validation

Commands used for CP-054 are recorded in `docs/VALIDATION_LOG.md`.
Screenshot evidence is stored under `docs/screenshots/phase11-cp054/`.
