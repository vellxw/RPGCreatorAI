# Android WebView Offline Scaffold

This source-only scaffold packages one compiled `GameBundleV1`, its allowlisted
local assets, and a dedicated Phaser web runtime into an Android WebView shell.
It has no editor, provider, credential, server, or network dependency at run
time. The manifest deliberately omits Android's `INTERNET` permission.

For the current factual release status, GPT Image provenance, and the shared
Windows/Android gates, see `docs/HORROR_BL_RELEASE_HANDOFF.md`. A staged source
tree is not an APK and must never be reported as one.
The reproducible toolchain, G1-G5 gate, wrapper, and release-manifest contracts
are documented in `docs/ANDROID_REPRODUCIBLE_RELEASE.md`.

## Source layout

- `src/platform/android/gameBundleHost.ts` loads the packaged GameBundle,
  creates `ExplorationSimulation`, mounts Phaser, forwards touch input through
  `AndroidTouchController`, applies `AndroidLifecycleController` effects, and
  mirrors the autosave through `AndroidSaveBridgeCoordinator`.
- `src/platform/android/web/` is the dedicated mobile entry document, touch
  overlay, and Vite config. It is separate from the React editor.
- `src/platform/android/offlineWrapper.ts` remains the policy source for the
  synthetic HTTPS origin and fail-closed WebView settings.
- `src/platform/android/native-scaffold/` is a minimal Java/Gradle Android
  project. Its WebView serves only packaged APK assets at
  `https://appassets.androidplatform.net/assets/www/`, blocks external
  navigation, disables file/content access and cookies, and exposes only a
  bounded save mirror bridge.
- `scripts/dev/prepare-android-webview-package.ps1` stages a buildable Android
  source tree. It does not invoke Gradle or the Android SDK.

## Preparation workflow

First create the dedicated web distribution when frontend validation is green:

```powershell
npm exec vite -- build --config src/platform/android/web/vite.config.ts
```

That build uses Vite base `./` and emits
`data/android-runtime-contract.v1.json`. Staging rejects the editor build, a
root-absolute build, an unknown contract, or an `index.html` whose local
`src`/`href` dependencies are missing. This prevents accidentally wrapping the
React editor or a web bundle that cannot resolve below `/assets/www/`.
The contract also pins `assetBaseUrl` to `/assets/www/`; the GameBundle itself
continues to use the same project-relative asset paths as Windows and web.

Then stage a compiled GameBundle and the project directory that contains every
asset path referenced by `bundle.assets.assets[].path`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/prepare-android-webview-package.ps1 `
  -GameBundlePath C:\path\to\game-bundle.v1.json `
  -AssetRoot C:\path\to\project-root `
  -WebDistPath output\android-web-runtime
```

For La Novena Promesa, first require a release-ready asset gate:

```powershell
.\scripts\dev\validate-horror-bl-asset-gate.ps1 -RequireReleaseReady
```

Only after that command and the combined preflight return `0`, the canonical
staging invocation is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\dev\prepare-android-webview-package.ps1 `
  -GameBundlePath '.\templates\horror-bl\release-input\game-bundle.v1.json' `
  -AssetRoot '.\templates\horror-bl' `
  -WebDistPath '.\output\android-web-runtime'
```

Staging automatically reads
`data/assets/assets-manifest.json` below `AssetRoot`. A nonstandard project can
pass `-AssetManifestPath 'data/assets/assets-manifest.json'` explicitly (the
path is resolved relative to `AssetRoot`), but the manifest must still live
inside the project root. Every bundled asset must match its catalog entry and belong
to exactly one non-overlapping `policy.runtimeRoots` directory. Candidate or
source-only paths outside those roots are rejected. Catalog entries must also
be in an `approved`/`frozen` policy state with `releaseEligible` and
`runtimeCompatible` set to `true`; declared byte size and SHA-256 must match the
source file. The copy is hashed again after staging. All input checks finish
before the output directory is created or replaced.

The default result is `output/android-webview`. The script copies the native
template, web runtime, canonical GameBundle v1, and exact local
assets. It rejects traversal, rooted paths, missing assets, asset collisions,
wrong bundle versions, unsupported package extensions, and accidental
replacement of unmarked directories. It also emits
`assets/www/data/package-allowlist.json`; the native request interceptor fails
closed unless a requested path appears there. A versioned SHA-256 file
inventory is generated beside the project. It binds the canonical/staged
GameBundle hashes, project asset-manifest hash, runtime roots, packaged asset
IDs, Android asset base URL, and every staged file. The inventory deliberately
excludes only its own self-referential hash.

The staged GameBundle remains semantically equivalent to the canonical
GameBundle v1: asset paths stay project-relative below `assets/`. The Android
runtime passes `/assets/www/` as Phaser's asset base URL, while the packager
copies each referenced file to the same relative location under APK
`assets/www/`. This keeps renderer concerns out of the portable bundle and
does not modify the editor's source GameBundle.

`GameBundle.dialogue` is embedded inside `data/game-bundle.v1.json`; it is not
a separate allowlist entry. Byte-identical source/staged bundle hashes protect
the complete VN graph. Every image, portrait, voice, music, ambience, SFX, or
other file referenced by dialogue or runtime data must also be declared in
`bundle.assets`. The packager copies only those declared, approved assets and
the native allowlist must contain every resulting path. Consequently, any
change to dialogue, sprites, backgrounds, audio, asset metadata, or their bytes
requires rebuilding the dedicated web runtime when applicable and always
regenerating staging before release validation.

The player refuses caller-selected or remote GameBundle URLs. The only accepted
path is `/assets/www/data/game-bundle.v1.json`, fetched without credentials,
redirects, or cache. CSP permits scripts and fetches only from the synthetic
same origin, while the native request interceptor additionally requires an
exact package-allowlist match.

The resulting runtime boundary is deterministic:

```text
app/src/main/assets/www/
├── index.html
├── assets/                         # Vite chunks and canonical game assets
└── data/
    ├── android-runtime-contract.v1.json
    ├── game-bundle.v1.json
    └── package-allowlist.json      # loaded natively; not web-requestable
```

## Future APK build

The template targets SDK 36, minimum SDK 24, AGP 8.13.0, and Java 17. It does
not yet include a generated Gradle Wrapper binary. Once Android SDK 36 and JDK
17 are available, use `scripts/dev/prepare-android-gradle-wrapper.ps1` to
generate the complete checksum-bound Gradle 8.14.3 wrapper in the canonical
source scaffold, restage, and run `scripts/dev/verify-android-toolchain.ps1`
and `scripts/dev/verify-android-release-gates.ps1` before any build. Then build
`assembleDebug`, or configure a private release keystore outside the project
and build `assembleRelease`.

Release signing material must remain outside the repository and staged output.
Keep the same release key for updates. No Play account is required for direct
APK sideloading.

## Intentional limits

- `mirror.read` and `mirror.write` are implemented in app-private storage.
  Storage Access Framework import/export remains unavailable in this scaffold.
- The shell locks to sensor landscape; change the manifest only with matching
  mobile layout QA.
- There is no network fallback. A missing bundle or asset is a packaging error,
  not a reason to contact a server.
- Renderer-process recovery, Android audio focus, accessibility preferences,
  and lifecycle policies already have TypeScript contracts; native behavior
  should continue to mirror those contracts as the shell matures.

No SDK install, Gradle sync, build, test, emulator, browser, or device command
was run while creating this scaffold.
