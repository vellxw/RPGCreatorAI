# La Novena Promesa — starter template

Starter vertical slice for adult psychological/body horror with an adult BL
romance thread. It is intentionally original and contains no third-party
artwork. Import it through Project Wizard, then review every generated asset
before packaging.

The slice is designed for 15–30 minutes:

- three connected exploration maps;
- two adult protagonists (Damian and Elian);
- one entity with readable telegraphs;
- four choices affecting `bond`, `lucidity`, and `evidence`;
- one environmental puzzle and one chase;
- two endings plus a checkpoint before the final choice;
- gore, flashing-light, reduced-motion, and romance-content settings.

The JSON files in `data/` are the machine-readable seed. The Markdown files
are the authoring source of truth and must be read before generating visible
assets. The current bundle has 27 assets: seven frozen PNG visual assets, 12
technical Damián animation strips (`idle`/`walk`/`interact` in four directions),
and eight original procedural WAVs for ambience, UI, footsteps, stinger and ending.
Three original GPT Image outputs exist for Damián, Elian, and The
Ninth Witness. Their prompts, dimensions, and hashes are recorded in
`assets/source/generated/generation-session-2026-08-14.v1.json`; the immutable
session preserves their initial candidate state. After delegated review, the
release gate and catalog mark the exact runtime bytes `frozen`. That approval
does not assert an independent copyright license or unrestricted public
redistribution right; external distribution remains subject to applicable
OpenAI terms and law. The WAVs are synthesized locally by the deterministic
audio generator, with no third-party recording or sample. Their technical
validation is complete but `humanAcceptance` remains pending, so they cannot
be used to claim creator acceptance for Android G4. The strips are registered
under `supplementalAnimation` with the same pending human-acceptance rule. No remote URL or provider
key belongs in a runtime bundle.

The Project Wizard copies the complete authored slice to
`game/data/content/vertical-slice.json` and its formal JSON Schema to
`game/data/schema/vertical-slice.schema.json`. These files remain design-time
content contracts: the renderer and save system must consume compiled project
state instead of mutating this source blueprint.

Release status and exact Windows/Android commands are documented in
`../../docs/HORROR_BL_RELEASE_HANDOFF.md`. Do not claim that an EXE or APK was
built from this template unless the corresponding exporter/build command was
actually run and its evidence was retained.
