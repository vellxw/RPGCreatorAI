# Animation persistence contract

`AnimationPackageV1` is the canonical description of a real source grid and
its authored clips. Every clip carries structured `action` and `direction`
fields; consumers never parse those values from a display id.

The package may be created before normalization, but
`persistAnimationPackageV1()` only succeeds when every clip has exactly one
approved horizontal-strip artifact with:

- a project-relative runtime path;
- a lowercase SHA-256;
- exact frame geometry;
- a shared normalization scale and ground-contact anchor;
- transparency confirmation;
- a project-relative provenance record.

Successful persistence returns the package snapshot, a hash-bearing
persistence manifest, `AssetCatalogEntry` records and the merged
`AnimationSetData`. `applyAnimationPackagePersistenceToProject()` applies
those catalog/database changes to a clone of editor state.

An approved character seed is not an animation. Use
`registerAnimationSeedReference()` to retain its path, hash, dimensions and
provenance with the explicit `seed-ready-awaiting-strips` status. It never
creates frames, clips or runtime-compatible assets.
