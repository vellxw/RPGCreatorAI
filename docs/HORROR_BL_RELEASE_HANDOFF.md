# Handoff de release — La Novena Promesa, capítulo 1

Última actualización factual: 2026-08-14.

Este documento separa recursos creados, recursos aprobados, staging y builds.
La presencia de un PNG, un `GameBundle` o código Android **no prueba** que
exista un EXE/APK distribuible. Un artefacto sólo puede anunciarse cuando su
comando de export/build terminó con código `0` y se conservaron sus evidencias.

## Estado comprobado de esta fase

La versión canónica del juego está bloqueada en `1.0.0` mediante
`templates/horror-bl/release-input/game-release.v1.json`.

| Área | Estado verificado |
| --- | --- |
| Assets, provenance y allowlist | 27/27 recursos (7 visuales, 12 strips y 8 WAV) con hashes coincidentes. |
| G4 | 27/27 decisiones `accepted` en evidencia hash-bound; `reviewer.kind=delegated-by-creator`, no inspección humana personal inventada. Evidencia SHA-256 `fce6b49a4bd12f0a9387a77e38de3f0db22c6f463fc13eb0c5a6e5fc0fe4d102`. |
| G1–G5 Android | Todos `ready`; staging estricto contiene GameBundle, contrato `game-release.v1.json` y evidencia G4. |
| Windows portable | Export canónico `1.0.0`, x64, 42 archivos/27 assets, `ok:true`, 0 errores y 0 warnings. |
| Android APK | Release firmado localmente, 17.026.720 bytes, SHA-256 `4b3e45a460a190dabef4c730e810eba539216d13d1cb0f1c0bd5bef57cf259e6`; instalado y lanzado offline en AVD API 36. |
| Promoción | El manifiesto Android queda `candidate` únicamente porque el worktree tiene cambios locales sin commit (`worktreeClean=false`). |

Artefactos canónicos actuales:

- Windows: `%LOCALAPPDATA%\RPGCreatorAI\release-artifacts\canonical-20260814-fixed\La-Novena-Promesa-v1.0.0-windows-x64-portable-unsigned`.
- Android: `output/android-webview/app/build/outputs/apk/release/app-release.apk`.
- QA Android: `output/android-release-qa-evidence.v1.json` (`verified`, AVD `emulator-5554`, API 36).

La clave Android está fuera del repositorio en
`%LOCALAPPDATA%\RPGCreatorAI\release-signing\la-novena-promesa-release.jks`.
Su contraseña fue efímera y no se retuvo: este APK es un candidato firmado
localmente para QA, no una identidad de publicación reutilizable. Antes de
distribuir actualizaciones hay que generar una clave estable y custodiar el
secreto fuera del repositorio.

### Candidatos históricos

Los portables Windows `1.0.0`–`1.0.4`, los APK Android `0.1.0` y los APK debug
anteriores son históricos y no representan la salida canónica. El portable
`canonical-20260814-fixed` es el único que incluye contrato de versión y G4.

## Assets GPT Image y provenance

La sesión canónica está en
`templates/horror-bl/assets/source/generated/generation-session-2026-08-14.v1.json`.
Registra herramienta, proveedor, prompts completos, fecha, dimensiones, bytes,
SHA-256 y ausencia de imágenes de referencia. La herramienta integrada no
expuso un identificador de modelo, por lo que el campo `model` es `null`; no se
debe inventar ni inferir un nombre de modelo.

Los personajes son adultos y las imágenes fueron solicitadas como diseños
originales, sin referencias visuales de terceros ni de personas reales. El
registro de sesión conserva honestamente su estado inicial `candidate`; la
promoción vigente se registra por separado en la evidencia hash-bound de G4:

| ID estable | Fuente maestra | Ruta runtime | SHA-256 |
| --- | --- | --- | --- |
| `portrait.damian` | `assets/source/generated/portrait-damian.png` | `assets/generated/runtime/portraits/damian.png` | `f4058bc626339285ca6c22c249dac32af92d24d3821ac859fd5f65d38be9e304` |
| `portrait.elian` | `assets/source/generated/portrait-elian.png` | `assets/generated/runtime/portraits/elian.png` | `b7e5e7a5410bd293b6a8fced8fa768f9f6210c611bae7a2a27571a8cb6128245` |
| `threat.ninth-witness` | `assets/source/generated/threat-ninth-witness.png` | `assets/generated/runtime/sprites/ninth-witness.png` | `b3a4b1cdbb0158623c8fb995a4d526dd960ab75241b563e1b6783fa03b164a64` |
| `seed.damian.full-body` | `assets/source/generated/character-damian-fullbody-seed-v1-chroma.png` | `assets/generated/runtime/characters/damian-fullbody-seed-v1.png` | `b3b44f3b5b8958ec18f9d95637bc00e4843b5032a2a48bb7052a433afb862dc3` |
| `background.facility-lobby` | `assets/source/generated/background-facility-lobby-v1.png` | `assets/generated/runtime/backgrounds/facility-lobby-v1.png` | `31bd655743e88d3eab275ba77588c888833cb09ad4000f61f3cc2b097a91062e` |
| `background.archive-sublevel` | `assets/source/generated/background-archive-sublevel-v1.png` | `assets/generated/runtime/backgrounds/archive-sublevel-v1.png` | `1c44ec66e4d95b9e8b94051a2d0f48da16bb105b8e6cf632d8f48bf304337c97` |
| `background.service-corridor` | `assets/source/generated/background-service-corridor-v1.png` | `assets/generated/runtime/backgrounds/service-corridor-v1.png` | `9be0963d60138ad7535a843bb8ce6e1669fd060a00d8dc4f3759dc9bf3ab3ca8` |

Los retratos y la amenaza son PNG RGB de 1254 x 1254; el seed es RGBA y los
fondos son PNG 1664 x 936 (16:9). En esta revisión, la
copia runtime de cada recurso tiene los mismos bytes que su fuente maestra. El
gate conserva la revisión técnica de personaje adulto, originalidad y
legibilidad runtime. La evidencia G4 vigente registra 27/27 recursos como
`accepted` bajo revisión `delegated-by-creator`; no constituye una afirmación
de inspección humana personal del creador. La promoción no inventa una licencia
independiente ni un derecho de redistribución pública irrestricto: la
distribución externa sigue sujeta a los términos de OpenAI y a la ley aplicable.

Los contratos que tienen que coincidir uno a uno son:

- `templates/horror-bl/data/assets/assets-manifest.json`;
- `templates/horror-bl/release-input/asset-approval-gate.v1.json`;
- `templates/horror-bl/release-input/asset-allowlist.json`;
- `templates/horror-bl/release-input/asset-provenance.v1.json`;
- `templates/horror-bl/release-input/game-bundle.v1.json`.

## Audio procedural y aceptación humana

Los ocho WAV son recursos originales sintetizados offline con
`scripts/dev/generate-horror-bl-audio.mjs`, sin voces, muestras ni grabaciones
de terceros. Sus recetas, semillas, hashes, duración y revisión técnica se
registran en `asset-provenance.v1.json` bajo `supplementalAudio`. Forman parte
del catálogo, allowlist, `GameBundle` y staging como los PNG; por tanto el
bundle actual contiene **27 assets: 7 visuales, 12 tiras de Damián y 8 WAV**.

Las tiras de Damián están registradas bajo `supplementalAnimation` y el
`AnimationPackage v1` `actor.damian`. Son strips horizontales de cuatro frames
(1024×384, frames 256×384), con idle/walk/interact en las cuatro direcciones,
anchor común y hash por archivo. La revisión técnica pasa y la evidencia G4
hash-bound registra su aceptación delegada junto con el resto del bundle.

La revisión técnica confirma formato y bytes. `release-input/editor-acceptance-
evidence.v1.json` enlaza los hashes exactos de los ocho WAV; los 27 recursos
quedaron `accepted` bajo revisión `delegated-by-creator`. Esto no debe
describirse como inspección humana personal del creador.

Para facilitar esa revisión se generó un paquete read-only en
`output/g4-review/`: `draft.json` vuelve a calcular los bytes y SHA-256 de los
27 recursos; `contact-sheet.html` muestra las 19 imágenes/tiras animadas y reproductores
locales para los 8 WAV. La misma página permite marcar cada decisión como
`pending`, `accepted`, `rejected` o `needs-edit`, añadir notas, filtrar e
importar/exportar `review-checklist.json`; la copia local es auxiliar y nunca
es evidencia canónica. El checklist final conserva las 27 decisiones
`accepted`. El paquete enlaza los hashes de
`game-bundle.v1.json` (`76e6275477ff2c51f9a74461fd30458857342f5b6abf02c12d378c56f3597358`)
y `assets-manifest.json`
(`58b0d99d00eb3427ea517175ed3493395f79a7d40532c52531195e829d2e75ab`). La
evidencia canónica se escribe únicamente mediante el aplicador hash-bound,
nunca desde la vista interactiva.

Si cambia cualquier byte hay que regenerar el packet: el navegador conserva las
decisiones auxiliares ligadas al hash del GameBundle, pero no puede aprobar un
archivo nuevo. `needs-edit` debe llevar una nota y no es aceptable para release.

El aplicador guardado es
`scripts/dev/apply-g4-review-decisions.mjs`. Exige una decisión `accepted`
explícita para cada ID, vuelve a calcular el hash de cada byte y sólo entonces
escribe la evidencia canónica y los estados `humanAcceptance: accepted` de
audio/animación. En el cierre actual produjo 27/27 decisiones aceptadas.

G1, G4 y G5 están `ready`; el staging offline contiene los 27 assets
allowlisted, el contrato de juego y la evidencia G4.

Los primeros masters 4×7 de Damián se conservaron como candidatos rechazados;
la revisión vigente usa el master v2 normalizado y sus 12 strips completos,
registrados en `data/assets/animation-packages/` y promovidos técnicamente al
catálogo/runtime sin borrar el historial rechazado.

No se promueve un recurso sólo porque el archivo exista. El gate debe contener
el mismo ID, ruta runtime, media type, dimensiones, tamaño y SHA-256 que los
bytes locales. Para una generación también debe conservar provider, tool,
model explícito o `null` documentado, prompt, referencias, consentimiento de
identidad y decisión de revisión. Nunca se agregan credenciales ni claves al
provenance o al juego exportado.

## Secuencia canónica de gates

Ejecutar desde la raíz del repositorio y detenerse ante el primer código de
salida distinto de `0`.

### 1. Gate de assets

```powershell
.\scripts\dev\validate-horror-bl-asset-gate.ps1 -RequireReleaseReady
```

El código `3` significa que el contrato puede ser válido pero el release sigue
bloqueado. No se continúa con materialización, staging ni export mientras esto
ocurra. Que el JSON declare `releaseReady: true` no reemplaza esta validación
contra los bytes reales.

### 2. Rematerialización coherente

Cuando manifest, gate, allowlist y provenance estén cerrados:

```powershell
node .\scripts\dev\materialize-horror-bl-release.mjs --force
```

El comando debe producir el `GameBundle` con exactamente los 27 assets
allowlisted y actualizar `materialization-report.v1.json` con el hash nuevo.
Después se inspecciona que los IDs, rutas y hashes coincidan; una ejecución que
vuelva a dejar `assets: []` no habilita el release.

### 3. Preflight conjunto, sin exportar ni compilar

```powershell
.\scripts\dev\prepare-windows-portable-release-inputs.ps1 -Target All
```

El preflight devuelve `0` sólo si ambos targets seleccionados están
preparados; `3` conserva bloqueos accionables. Para diagnosticar por separado:

```powershell
.\scripts\dev\prepare-windows-portable-release-inputs.ps1 -Target WindowsPortable
.\scripts\dev\prepare-windows-portable-release-inputs.ps1 -Target AndroidWebView
```

## Windows portable

Primero ejecutar el mismo gate del exporter en modo de validación. Este modo
crea evidencia candidata fuera del repositorio, pero no publica el portable:

```powershell
.\scripts\dev\export-windows-portable.ps1 `
  -ProjectRoot '.\templates\horror-bl' `
  -GameBundlePath '.\templates\horror-bl\release-input\game-bundle.v1.json' `
  -ProvenancePath '.\templates\horror-bl\release-input\asset-provenance.v1.json' `
  -AssetAllowlistPath '.\templates\horror-bl\release-input\asset-allowlist.json' `
  -AssetApprovalGatePath '.\templates\horror-bl\release-input\asset-approval-gate.v1.json' `
  -CompilerWarningsPath '.\templates\horror-bl\release-input\compiler-warnings.json' `
  -PackagedExe '.\build\rpg_creator_runtime.exe' `
  -RuntimeExe '.\build\rpg_creator_runtime.exe' `
  -ArtifactName 'La Novena Promesa' `
  -Architecture x64 `
  -Qualifier unsigned `
  -OutputRoot "$env:LOCALAPPDATA\RPGCreatorAI\release-artifacts\canonical-20260814-fixed" `
  -RequireAcceptedHumanReview `
  -ValidateOnly
```

Sólo si termina con `WINDOWS PORTABLE PREFLIGHT PASSED`, repetir sin
`-ValidateOnly`. El resultado predeterminado se publica en
`%LOCALAPPDATA%\RPGCreatorAI\release-artifacts`, junto con
`*.release-manifest.v1.json` y `*.validation-report.json`. Esas tres salidas,
no la mera existencia de `build/rpg_creator_runtime.exe`, son la evidencia de
un export real. El directorio canónico creado en este cierre es:

```text
C:\Users\franc\AppData\Local\RPGCreatorAI\release-artifacts\canonical-20260814-fixed\La-Novena-Promesa-v1.0.0-windows-x64-portable-unsigned
```

Su entrada es `La-Novena-Promesa.exe`; contiene el runtime, 27 assets, los
tres mapas, shards nativos, `GameBundle v1`, provenance, evidencia G4,
`game-release.v1.json`, README y licencia. La validación quedó `ok:true`, sin
errores ni warnings. Es una build unsigned/portable: Windows puede mostrar una
advertencia de SmartScreen.

El flujo estricto se ejecutó con `-RequireAcceptedHumanReview` tanto en el
preflight como en el exporter. Exigió `release-input/editor-acceptance-
evidence.v1.json`, validó sus 27 decisiones y la incorporó al portable como
`data/editor-acceptance-evidence.v1.json` junto con
`data/game-release.v1.json`.

## Android WebView y APK

Si cambió el runtime web, el bundle, los diálogos o su contrato desde el
staging anterior, hay que reconstruir el runtime web Android antes de volver a
empaquetar:

```powershell
npm exec vite -- build --config src/platform/android/web/vite.config.ts
```

Ese comando es un build frontend; debe ejecutarse serialmente y registrarse.
No produce un APK.

El staging offline es un paso de packaging de fuentes, no un build APK. Para
reemplazar el staging marcado actual se usa `-Force` (o, de forma equivalente,
un `-OutputPath` nuevo fuera del repositorio):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\dev\prepare-android-webview-package.ps1 `
  -GameBundlePath '.\templates\horror-bl\release-input\game-bundle.v1.json' `
  -AssetRoot '.\templates\horror-bl' `
  -WebDistPath '.\output\android-web-runtime' `
  -OutputPath '.\output\android-webview' `
  -Force
```

El paquete final de este cierre se ejecutó con `-RequireAcceptedHumanReview`;
el staging incluye la evidencia canónica como
`data/editor-acceptance-evidence.v1.json`, el contrato
`data/game-release.v1.json` y sus hashes en `package-files.sha256.json`.

Después del staging estricto hay que volver a ejecutar el reporte de gates para
que G5 compruebe también la evidencia G4 embebida:

```powershell
.\scripts\dev\verify-android-release-gates.ps1
```

Un staging válido debe contener, entre otros:

- `output/android-webview/package-files.sha256.json`;
- `output/android-webview/app/src/main/assets/www/data/game-bundle.v1.json`;
- `output/android-webview/app/src/main/assets/www/data/package-allowlist.json`;
- `output/android-webview/app/src/main/assets/www/data/game-release.v1.json`;
- `output/android-webview/app/src/main/assets/www/data/editor-acceptance-evidence.v1.json`;
- los 19 PNG (7 visuales + 12 strips de Damián) y los 8 WAV bajo sus rutas
  canónicas `assets/...`.

El staging ya puede compilarse en este host: usa JDK 17, Android SDK con
platform 36, Build Tools 35.0.0, platform-tools y el Gradle Wrapper 8.14.3
completo con checksum fijado. Java 25 no sustituye JDK 17 para el AGP/Gradle
declarados. Las rutas locales del SDK y las claves privadas no se versionan.

Con el toolchain validado, el build release canónico se hace
desde el staging con su wrapper, nunca con un `gradle` global no fijado:

```powershell
$env:JAVA_HOME = 'C:\Users\franc\AppData\Local\RPGCreatorAI\toolchains\jdk-17.0.20+8'
$env:ANDROID_SDK_ROOT = 'C:\Users\franc\AppData\Local\RPGCreatorAI\android-sdk'
Push-Location .\output\android-webview
try {
  .\gradlew.bat --offline :app:assembleRelease
} finally {
  Pop-Location
}
```

Ese comando devolvió `0`; el APK release pasó inspección de firma, contenido,
alineación, instalación y arranque offline en un AVD Android 36.

El scaffold Android deja el release firmado fail-closed. Antes de ejecutar
`assembleRelease` o `bundleRelease`, definir sólo en el entorno local las cuatro
variables de signing (nunca en Git ni en un JSON del juego):

```powershell
$env:RPGCREATORAI_RELEASE_STORE_FILE = 'D:\claves\rpgcreatorai-upload.jks'
$env:RPGCREATORAI_RELEASE_STORE_PASSWORD = '<secreto local>'
$env:RPGCREATORAI_RELEASE_KEY_ALIAS = 'rpgcreatorai'
$env:RPGCREATORAI_RELEASE_KEY_PASSWORD = '<secreto local>'
$env:JAVA_HOME = 'C:\Users\franc\AppData\Local\RPGCreatorAI\toolchains\jdk-17.0.20+8'
$env:ANDROID_SDK_ROOT = 'C:\Users\franc\AppData\Local\RPGCreatorAI\android-sdk'
Push-Location .\output\android-webview
try {
  .\gradlew.bat --offline :app:assembleRelease :app:bundleRelease
} finally {
  Pop-Location
}
```

Si falta una variable o el keystore no existe, Gradle aborta explícitamente.
La clave usada para este QA está fuera del repositorio, pero su contraseña fue
efímera y no se retuvo; el APK queda clasificado como candidato firmado
localmente, no como identidad estable de publicación. Al terminar, cerrar esa
sesión local o limpiar las variables de signing; nunca se guardan en el repo.

El comando puede producir también un AAB, pero el QA y el manifiesto actuales
atan la promoción únicamente al APK release verificado; el AAB queda como
artefacto adicional hasta tener un verificador equivalente.

Con el APK release ya firmado, la evidencia QA no se redacta a mano. El serial
debe ser un identificador real de `adb devices`; en este cierre fue el AVD
`emulator-5554` (API 36):

```powershell
.\scripts\dev\verify-android-release-qa.ps1 `
  -ApkPath '.\output\android-webview\app\build\outputs\apk\release\app-release.apk' `
  -ExpectedCertificateSha256 '50420a371a9410f6171007e2c0ce1eb0e6ede052256477388e2b79da3984b324' `
  -ExpectedVersionName '1.0.0' `
  -ExpectedVersionCode 1 `
  -StagingRoot '.\output\android-webview' `
  -ReleaseRequestPath '.\templates\horror-bl\release-input\android-release-request.v1.json' `
  -DeviceSerial 'emulator-5554'
```

El script exige el fingerprint público de la clave release, versión/package no
debuggable, `apksigner`, `aapt2`, ausencia de `INTERNET`, coincidencia del
GameBundle/allowlist/evidencia G4 dentro del APK con el staging, instalación ADB y un
proceso que permanezca vivo tras el lanzamiento offline. Es un smoke de
lanzamiento offline, no un playtest completo de guardado, pausa o gameplay.
Sólo después de esas observaciones escribe `android-release-qa-evidence.v1.json`.

Con la evidencia QA creada, volver a ejecutar los gates y generar el manifiesto
(queda `candidate` mientras el worktree tenga cambios locales; no se debe
forzar `release` borrando u ocultando esos cambios):

```powershell
.\scripts\dev\verify-android-release-gates.ps1
.\scripts\dev\write-android-release-manifest.ps1 `
  -ApkPath '.\output\android-webview\app\build\outputs\apk\release\app-release.apk' `
  -Variant release `
  -QaEvidencePath '.\output\android-release-qa-evidence.v1.json'
```

## Regla de comunicación del release

Usar estas frases de forma literal según la evidencia:

- “assets generados”: existen los candidatos y su sesión de provenance;
- “assets aprobados”: el gate con `-RequireReleaseReady` devolvió `0`;
- “staging Android preparado”: el script de staging devolvió `0` y existe su
  inventario;
- “Windows portable exportado”: el exporter sin `-ValidateOnly` devolvió `0` y
  existen directorio, manifest y reporte;
- “APK compilado”: Gradle devolvió `0` y el APK existe;
- “APK funciona”: además fue instalado y arrancó en un dispositivo ADB físico o
  AVD, indicando cuál; este cierre verificó `emulator-5554` en API 36. Esto no
  sustituye un playtest completo de gameplay/lifecycle en un teléfono físico.

No se reemplaza una categoría por otra ni se afirma un build que no se ejecutó.
