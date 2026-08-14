# Android offline WebView wrapper

Status: source scaffold only; not built or device-tested.

## Audit result

The repository had no `android/` project, Capacitor configuration,
`AndroidManifest.xml`, or native activity. The only Android-specific code was
the renderer-neutral TypeScript policy under `src/platform/android/` for
lifecycle, touch, save-message correlation, and bounded renderer fallback.
There was therefore no native `WebViewClient` capable of handling provider
failure, local asset errors, or renderer termination.

The new `android/` directory is a direct native WebView scaffold. It does not
claim to be a generated Capacitor project and does not vendor an Android SDK,
Gradle distribution, signing key, generated web bundle, or build output.

## Runtime boundary

The activity loads only:

```text
https://appassets.androidplatform.net/assets/www/index.html
```

`WebViewAssetLoader` maps that URL to packaged `assets/www`. Navigation and
subresources are restricted to the same HTTPS host and path. The manifest
does not request `INTERNET` or storage permissions, cleartext is disabled,
file/content access is disabled, cookies are disabled, mixed content is
blocked, media requires a gesture, and WebView debugging follows
`BuildConfig.DEBUG`.

The Gradle staging task copies `../dist` into generated Android assets. It
fails before packaging when `dist/index.html` is missing or contains
root-absolute `src`/`href` paths. The Android bundle must therefore be
produced with a relative Vite base, for example by passing `--base=./` to the
existing web build. Generated `dist` and Android build directories remain
untracked.

## Native failure behavior

The fallback screen is composed from Android views and never depends on the
renderer that failed. It covers:

- no enabled Android System WebView provider;
- exception or linkage failure while constructing WebView;
- main-frame local asset error or non-success response;
- a local start page that does not commit within 15 seconds;
- WebView renderer termination.

`onRenderProcessGone` always disposes the dead WebView and returns `true`, so
the framework does not terminate the Activity for an unhandled renderer
loss. It permits two automatic reloads within a 30-second window, with a
short exponential delay. A third failure stops automatic recovery and shows
a native Retry/Close screen. The failure budget clears only after the new
renderer remains visible for ten seconds, preventing an immediate
commit/crash loop from masquerading as recovery.

Native lifecycle events are emitted as:

- `rpgcreator:native-host-ready`
- `rpgcreator:native-lifecycle`
- `rpgcreator:native-memory`

The web runtime must route these into the pure controllers in
`src/platform/android/`. Audio resumption remains gesture-gated by that
contract.

## Save boundary

The source scaffold intentionally exposes no `addJavascriptInterface`.
Unrestricted JavaScript interfaces are unnecessary for startup and expand
the attack surface. The versioned/size-bounded save protocol already exists
in `src/platform/android/saveBridge.ts`; a future native persistence adapter
should implement it with origin-scoped WebMessage APIs or a narrowly scoped
Capacitor plugin, private app storage for the mirror, and Android's Storage
Access Framework for explicit import/export.

Until that adapter exists, renderer recovery can reload durable WebView
storage but cannot promise a separate native mirror. Distribution must not
claim process-independent save recovery yet.

## Toolchain and validation status

This change deliberately did not install or invoke Android SDK, Gradle,
Android Studio, an emulator, a browser, or a server. The scaffold has not
been compiled. Before release:

1. provision a pinned JDK 17, Android SDK 36, Build Tools, and Gradle wrapper;
2. produce a relative-path Vite bundle;
3. compile and run Android lint/unit checks;
4. verify first launch in airplane mode on API 26 and current Android;
5. disable/update the system WebView to verify the native unavailable state;
6. force renderer termination and confirm two recoveries followed by the
   anti-loop fallback;
7. corrupt or remove the packaged `index.html` in a debug fixture and confirm
   the native asset-error screen;
8. inspect logcat for uncaught exceptions and confirm no external requests.

No APK, AAB, signing configuration, or release-readiness claim is produced by
this scaffold.
