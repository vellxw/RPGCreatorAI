# La Novena Promesa — asset register rules

Every image, portrait, sprite, sound, voice, video, and reference enters the
pipeline as `requested → quarantined → normalized → review → approved → frozen
→ packaged`. Rejected candidates remain in history but never replace an
approved revision.

Required fields per asset:

- stable ID and kind;
- source path and SHA-256;
- provider/model/prompt or `owned`/`commissioned` basis;
- reference hashes and consent record when relevant;
- license, attribution, commercial-use and redistribution status;
- technical dimensions, alpha, frame order, FPS, anchor and runtime path;
- reviewer, decision timestamp, warnings and preview paths.

Only `approved`/`frozen` entries are eligible for a GameBundle. Source masters,
prompts, rejected images, credentials and request IDs stay outside release
staging.

## Chapter 1 release gate

The release contract currently has 27 assets: seven frozen PNG visual assets
(two portraits, threat, Damián full-body seed and three backgrounds), twelve
technical Damián animation strips (`idle`/`walk`/`interact` in four directions),
plus eight offline procedural WAV assets. The original three GPT Image portrait/threat
outputs fill `portrait.damian`, `portrait.elian`, and `threat.ninth-witness`. The
immutable generation record is
`assets/source/generated/generation-session-2026-08-14.v1.json`; it contains
the exact prompts, source/runtime paths, dimensions, byte sizes, SHA-256 values,
dates, and the absence of input images or real-person references.

The built-in tool exposed no model identifier. Provenance therefore records
the provider/tool and an explicit undisclosed/null model instead of guessing a
model name. The generation session retains the initial `candidate` state. The
creator later authorized delegated visual and technical review, after which
the release gate and catalog promoted the exact bytes to `frozen`.

This approval is deliberately narrow. It does not assert an independent
copyright license or unrestricted public redistribution right. External
distribution remains subject to applicable OpenAI terms and law. The gate,
allowlist, provenance sidecar, catalog, GameBundle, and local PNG bytes must
remain exact one-to-one matches.

Validate the contract and local hashes before materialization or export:

```powershell
.\scripts\dev\validate-horror-bl-asset-gate.ps1 -RequireReleaseReady
```

Exit code `0` is required. Exit code `3` means the release gate is still
blocked even if its JSON is syntactically valid. File presence or a
`releaseReady` field alone is not sufficient evidence.

The 2026-08-14 delegated promotion was checked with this command: it returned
`0` with 0 issues, the gate validated against its JSON Schema, and the
manifest/gate/provenance cross-check reported 0 drift. Any later byte or
metadata change invalidates that evidence and requires a new run.

The 12 Damián strips are registered under `supplementalAnimation`, use the
`actor.damian` AnimationPackage v1, and have generated-verified hashes with
`humanAcceptance: pending/not-recorded`. The WAV files are generated deterministically with
`scripts/dev/generate-horror-bl-audio.mjs` and checked with
`scripts/dev/validate-horror-bl-audio.mjs`. Their provenance stores recipe,
seed, duration and SHA-256, but their `humanAcceptance` is deliberately
`pending`: technical validation is not a substitute for creator approval.

The complete Windows/Android handoff is in
`../../docs/HORROR_BL_RELEASE_HANDOFF.md`.
