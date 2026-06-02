# Empty States

CP-023 defines the local-first empty-state policy for the editor. Empty states
must guide the next real authoring action without marketing copy or future AI
promises.

## Policy

- Keep copy dense and editor-like: title, one recovery/action sentence, optional
  existing action button.
- Show buttons only when the action already exists in the current surface.
- Explain where data will appear: maps, events, database records, runtime logs,
  traces, and snapshots.
- Browser-only surfaces must stay honest about unavailable desktop/runtime
  capabilities.
- Empty-state UI must not generate project content, call providers, access the
  network, or imply AI tooling is available.

## CP-023 Coverage

| Surface | Empty-state behavior |
| --- | --- |
| Startup | Browser mode explains memory-backed creation and export; desktop paths expose open/create/import/sample actions. |
| Map tree | A project with no maps points to the real Create map action and explains that a scene is required before painting or playtest. |
| Canvas / Inspector / Tile palette | Missing map selection points back to Map Tree before layer, brush, template, viewport, or start-position editing. |
| Event editor | Projects with no events point users to the Events layer in the main editor palette and list the supported event types. |
| Database lists and detail panes | Empty tabs keep the New action visible and explain what the first record enables. |
| Items, tilesets, animations | Standalone database tabs explain the first Add action and the metadata each record controls. |
| Playtest and debug panels | Runtime log, event trace, and runtime state panels explain how to generate the first native evidence and remain honest in browser mode. |

Screenshot evidence for CP-023 lives under
`docs/screenshots/phase11-cp023/`.
