# Release Android reproducible

Este documento define el camino canónico para convertir el mismo
`GameBundleV1` usado por Windows/web en un APK Android offline. Preparar el
staging no equivale a compilar ni a probar un APK. Ningún paso puede declarar
un release si JDK, SDK, wrapper, gates, firma o QA real están ausentes.

## Fuente de verdad

- Toolchain: `src/platform/android/toolchain/android-toolchain.v1.json`.
- Fixture exacto del wrapper:
  `src/platform/android/toolchain/gradle-wrapper.properties.fixture`.
- Gates: `src/platform/android/toolchain/android-release-gates.v1.json`.
- Solicitud del capítulo:
  `templates/horror-bl/release-input/android-release-request.v1.json`.
- Evidencia de aceptación:
  `src/platform/android/toolchain/editor-acceptance-evidence.schema.json`.
- Manifiesto final:
  `src/platform/android/toolchain/android-release-manifest.schema.json`.
- QA que habilita estado `release`:
  `src/platform/android/toolchain/android-release-qa-evidence.schema.json`.

El target Android canónico es
`src/platform/android/native-scaffold`. El proyecto `android/` continúa como
referencia del editor y no debe mezclarse con este reproductor.

## Toolchain fijado

| Componente | Versión/paquete requerido |
| --- | --- |
| JDK | 17, con `JAVA_HOME` explícito |
| Android Gradle Plugin | 8.13.0 |
| Gradle Wrapper | 8.14.3 `bin` |
| Gradle ZIP SHA-256 | `bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531` |
| compile/target/min SDK | 36 / 36 / 24 |
| SDK packages | `platforms;android-36`, `build-tools;35.0.0`, `platform-tools` |

El verificador no ejecuta Gradle, `sdkmanager` ni ADB. Lee los archivos de
versión, verifica paquetes y hashes, inspecciona el scaffold y valida el
wrapper completo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\dev\verify-android-toolchain.ps1 `
  -JavaHome 'C:\ruta\al\jdk-17' `
  -AndroidSdkRoot 'C:\ruta\al\Android\Sdk'
```

El resultado se escribe en
`output/android-toolchain-readiness.v1.json`. Código `0` significa `ready` y
código `3`, `blocked`. El fingerprint `javaHomeSha256` se deriva de los hashes
de `release` y `bin/java.exe`; `sdkRootSha256` se deriva de revisiones de
paquetes y hashes de los archivos SDK requeridos. No depende del nombre local
de la carpeta.

### Wrapper completo o ninguno

La validación por defecto es de sólo lectura:

```powershell
.\scripts\dev\prepare-android-gradle-wrapper.ps1
```

La generación requiere una decisión explícita, JDK 17 y un ejecutable Gradle
8.14.3 conocido. Este comando es para ejecutar sólo cuando el toolchain esté
provisionado:

```powershell
.\scripts\dev\prepare-android-gradle-wrapper.ps1 `
  -Generate `
  -JavaHome 'C:\ruta\al\jdk-17' `
  -GradleExecutable 'C:\ruta\gradle-8.14.3\bin\gradle.bat'
```

El script genera los cuatro archivos (`gradlew`, `gradlew.bat`, JAR y
properties), reemplaza properties por el fixture byte a byte y crea
`gradle/wrapper/wrapper-files.sha256.json`. Un wrapper parcial falla; sólo
`-Force` autoriza reemplazar esos archivos exactos. No ejecuta una build
Android.

## Gates G1–G5

`scripts/dev/verify-android-release-gates.ps1` produce
`output/android-release-gates.v1.json` y falla con código `3` mientras exista
un bloqueo.

### G1 — personaje jugable

- Damián es el actor inicial y usa `playerAnimationSet = "damian"`.
- Existen 12 strips verificados técnicamente: `idle`, `walk`, `interact` × `down`, `left`,
  `right`, `up`.
- Cada strip tiene metadata de owner, acción, dirección y animation set.
- El `GameBundle` contiene exactamente un clip correspondiente por strip.

### G2 — fondos de los mapas

- `facility_lobby` usa `background.facility-lobby`.
- `archive_sublevel` usa `background.archive-sublevel`.
- `service_corridor` usa `background.service-corridor`.
- Cada imagen existe en bundle/manifiesto, está aprobada y sus bytes coinciden.

### G3 — VN, guardado y audio

- El diálogo VN está embebido en `GameBundle.dialogue` con escena y entry node
  válidos.
- El guardado usa schema v2 y la red está deshabilitada.
- Existen ocho assets offline: tres ambientes, stinger del Noveno Testigo,
  confirmación, cancelación, pasos y ending.
- Cualquier `assetId` de retrato, voz, fondo o audio usado por VN debe existir
  también en `bundle.assets`; no se permite una URL ni un archivo implícito.

### G4 — aceptación del editor/creador

- G1 y G3 son gates exclusivamente técnicos y no condicionan su resultado al
  estado de `humanAcceptance`; G4 es el único gate que exige `accepted`.
- Gate de assets release-ready, sin blockers.
- Cada asset del bundle tiene manifest aprobado/frozen y provenance con la
  misma ruta.
- `release-input/editor-acceptance-evidence.v1.json` debe registrar una
  aceptación por recurso, enlazada por SHA-256 a los bytes revisados.
- La generación automática no puede crear evidencia fingiendo aprobación del
  usuario. Un cambio de bytes invalida la decisión anterior.

### G5 — entrada offline reproducible

- G1–G4 están `ready`.
- El reporte de toolchain está `ready`.
- Están presentes los tres mapas.
- El GameBundle staged es idéntico a su fuente: esto cubre mapas, VN y datos.
- Todo asset de `bundle.assets` aparece en allowlist, staging e inventario con
  el mismo hash, incluidos sprites, fondos, diálogo referenciado y audio.
- El manifest no concede `INTERNET`; `assetBaseUrl` sigue siendo
  `/assets/www/`.
- Identidad y versión Gradle coinciden con la solicitud de release.

Ejemplo:

```powershell
.\scripts\dev\verify-android-release-gates.ps1
```

Después de cualquier cambio a runtime, bundle, diálogo, sprites, fondos,
audio, manifests o provenance hay que regenerar el web runtime y el staging
antes de volver a ejecutar G5. Nunca se parchea manualmente el staging.

El staging final debe ejecutarse con la evidencia G4 estricta; el switch es
deliberadamente explícito para que una build candidata no se confunda con un
release:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\dev\prepare-android-webview-package.ps1 `
  -GameBundlePath '.\templates\horror-bl\release-input\game-bundle.v1.json' `
  -AssetRoot '.\templates\horror-bl' `
  -WebDistPath '.\output\android-web-runtime' `
  -OutputPath '.\output\android-webview' `
  -Force `
  -RequireAcceptedHumanReview

.\scripts\dev\verify-android-release-gates.ps1
```

El comando estricto de este cierre terminó correctamente: G4 está aceptado por
delegación explícita y G5 exige/verifica el archivo de aceptación, el contrato
de versión y sus hashes tanto en el staging como en su inventario.

## Manifiesto de release

El generador se niega por defecto a escribir si toolchain o gates están
bloqueados. `-AllowBlocked` crea únicamente un diagnóstico con
`status: "blocked"`:

```powershell
.\scripts\dev\write-android-release-manifest.ps1 -AllowBlocked
```

Cuando haya APK, puede agregarse `-ApkPath`. Un APK debug o sin QA queda en
`candidate`. Sólo se emite `status: "release"` para un APK release cuyo hash
coincide con evidencia de firma verificada y smoke de lanzamiento offline en
dispositivo:

```powershell
.\scripts\dev\write-android-release-manifest.ps1 `
  -ApkPath 'C:\ruta\app-release.apk' `
  -Variant release `
  -QaEvidencePath 'C:\ruta\android-release-qa-evidence.v1.json'
```

El manifiesto enlaza por hash la solicitud, GameBundle, asset manifest,
allowlist, provenance, approval gate, evidencia G4 cuando ya existe, reportes,
inventario, APK y evidencia QA; además registra el commit exacto y sólo permite
`release` con worktree limpio. Las claves privadas, certificados
privados, `local.properties` y SDK nunca se guardan en el repositorio.

Aunque Gradle puede producir un AAB junto al APK, este contrato de QA sólo
verifica y promueve el APK; el AAB requiere una verificación equivalente antes
de publicarse.

## Estado real observado en este host (2026-08-14)

- Temurin 17.0.20, SDK Android 36, Build Tools 35.0.0, platform-tools,
  emulator y wrapper Gradle 8.14.3 están verificados como `ready`.
- El staging estricto contiene 27 assets, `game-release.v1.json` bloqueado en
  `1.0.0`, evidencia G4 y un inventario hash-bound. G1–G5 están `ready`.
- El APK release está en
  `output/android-webview/app/build/outputs/apk/release/app-release.apk`, mide
  17.026.720 bytes y su SHA-256 es
  `4b3e45a460a190dabef4c730e810eba539216d13d1cb0f1c0bd5bef57cf259e6`.
- `apksigner`, `aapt2`, alineación, ausencia de `INTERNET`, coincidencia de
  todos los recursos web inventariados, instalación y lanzamiento offline
  pasaron en el AVD `emulator-5554`, API 36. La evidencia es
  `output/android-release-qa-evidence.v1.json` con estado `verified`.
- El certificado público SHA-256 es
  `50420a371a9410f6171007e2c0ce1eb0e6ede052256477388e2b79da3984b324`.
  La clave está fuera del repo y su contraseña no se retuvo; el APK es un
  candidato firmado localmente para QA, no una clave de publicación estable.
- `output/android-release-manifest.v1.json` queda `candidate` únicamente por
  `worktreeClean=false`; no se fuerza `release` ocultando cambios locales.

Los APK debug y candidatos `0.1.0` documentados en historiales anteriores se
conservan sólo como evidencia histórica y no son la salida canónica.
