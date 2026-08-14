# Auditoría de preparación para APK Android

Fecha de observación: 2026-08-14. Esta auditoría fue revalidada después de
provisionar un toolchain local reproducible: se ejecutaron `sdkmanager`, el
wrapper Gradle, el build release, ADB y un AVD API 36 offline. G4 quedó
registrado como revisión `delegated-by-creator` (27/27 recursos) y la firma
release se mantiene fuera del repositorio.

El handoff de assets GPT Image y la secuencia de gates compartida con Windows
está en `docs/HORROR_BL_RELEASE_HANDOFF.md`.
El contrato ejecutable de toolchain, wrapper, gates y manifiesto está en
`docs/ANDROID_REPRODUCIBLE_RELEASE.md`.

## Veredicto

El repositorio **produjo un APK release real en este host**. El toolchain,
wrapper, staging y `assembleRelease` terminaron correctamente; el APK se
instaló y arrancó en un AVD API 36 sin red. El manifiesto queda `candidate`
únicamente porque el worktree tiene cambios locales sin commit.

## Toolchain observado

| Componente | Estado local | Requisito de este proyecto | Resultado |
| --- | --- | --- | --- |
| Java | Temurin 17.0.20 local, fijado mediante `JAVA_HOME` en la sesión de build | JDK 17 para AGP 8.13 | Listo |
| Gradle | Wrapper 8.14.3 generado en el scaffold y atado al fixture/checksum | Wrapper 8.14.3 con checksum fijado | Listo |
| Android Gradle Plugin | 8.13.0 declarado y su artefacto está en caché | 8.13.0 | Preparado |
| Android SDK | SDK local con `platforms;android-36`, `build-tools;35.0.0` y `platform-tools` | Platform 36 y Build Tools 35.0.0 o compatibles | Listo |
| Herramientas Android | Command-line tools 22.0, `adb` 37.0.1 y emulator 37.1.11 | Command-line tools; `adb` para instalar/verificar | Listo |
| AndroidX WebKit | `androidx.webkit:webkit:1.16.0` y dependencias directas en caché | Sólo lo usa `android/` | Preparado para resolución offline parcial |
| Node web | Node 24.14.0 y npm 11.9.0 disponibles | Vite/TypeScript del repositorio | Disponible |
| Firma | Keystore local fuera del repositorio, certificado público registrado; la contraseña fue efímera | QA release/sideload; nueva clave estable para publicación futura | APK release candidato verificado |

AGP 8.13 admite API 36.1, requiere Gradle 8.13 como mínimo y declara JDK 17
y Build Tools 35.0.0 como valores compatibles. La matriz oficial de Gradle
indica que Java 25 sólo puede ejecutar Gradle desde 9.1; por eso el Java 25
actual no puede ejecutar la distribución 8.14.3 cacheada.

Fuentes primarias:

- <https://developer.android.com/build/releases/agp-8-13-0-release-notes>
- <https://developer.android.com/build/releases/about-agp>
- <https://docs.gradle.org/current/userguide/compatibility.html>

## Hay dos shells distintos

### `android/`: wrapper del editor

Este proyecto tiene la actividad nativa más completa: usa
`WebViewAssetLoader`, pantalla de error nativa, timeout y recuperación acotada
ante muerte del renderer. Sin embargo, su `syncOfflineWeb` copia `../dist`,
que es el editor React completo, no el capítulo jugable dedicado.

Su build está bloqueado incluso después de instalar el toolchain porque el
`dist/index.html` observado contiene referencias como
`/assets/index-....js` y `/assets/index-....css`. El task las rechaza para
evitar que fallen dentro de `appassets`. Ese bundle debe regenerarse con base
relativa si se decide distribuir el editor.

También usa el evento `rpgcreator:native-lifecycle`, mientras que el host del
reproductor escucha `rpgcreator:android-lifecycle`. No deben combinarse sin
unificar ese contrato.

### `src/platform/android/native-scaffold/`: reproductor del GameBundle

Este es el objetivo correcto para un APK del juego. Está conectado con:

- `src/platform/android/web/`, entrada móvil Phaser y controles táctiles;
- `src/platform/android/gameBundleHost.ts`, carga y ejecución de GameBundle;
- `NativeSaveBridge`, espejo de guardado en almacenamiento privado;
- `scripts/dev/prepare-android-webview-package.ps1`, staging del runtime, el
  GameBundle y únicamente sus assets allowlisted.

Las declaraciones principales son compatibles entre sí: AGP 8.13.0,
`compileSdk = 36`, Java 17, `minSdk = 24` y `targetSdk = 36`. El manifest no
pide `INTERNET`, por lo que el juego empaquetado queda fail-closed en runtime.

Estado material observado el 2026-08-14:

1. `output/android-web-runtime/index.html` **existe** y referencia sus chunks
   con rutas relativas `./assets/...`; fue reconstruido con el contrato fuente
   actual antes del staging.
2. `templates/horror-bl/release-input/game-bundle.v1.json` **existe**, es
   schema v1, contiene los tres mapas, 27 assets (7 PNG visuales, 12 strips
   técnicos de Damián y 8 WAV procedurales) y una escena VN de 16 nodos.
   El hash del staging coincide byte a byte con esta fuente.
3. Ya existen outputs GPT Image originales para `portrait.damian`,
   `portrait.elian` y `threat.ninth-witness`, todos PNG RGB de 1254 x 1254. La
   sesión de generación registra prompts, hashes y que la herramienta integrada
   no expuso un modelo (`model: null`). La sesión conserva su estado inicial de
   candidatos y, tras la revisión visual/técnica delegada por el creador, gate y
   catálogo marcan los bytes exactos `frozen`. La nota jurídica no inventa una
   licencia independiente ni redistribución pública irrestricta: la distribución
   externa continúa sujeta a términos de OpenAI y ley aplicable.
4. `output/android-webview` ya fue regenerado después de rematerializar el
   GameBundle: conserva byte a byte la escena VN, los 27 assets y el
   inventario/allowlist offline. Debe volver a generarse si cambian datos,
   runtime web o provenance.
5. El scaffold protege `setSafeBrowsingEnabled` con API 26, registra el
   callback predictivo de Android 13+ y recupera una vez ante `renderer gone`;
   el fallback para API 24/25 sigue compilando.
6. El inventario excluye únicamente `.gradle/`, `build/` y `app/build/`, que
   son caches/salidas de Gradle y no forman parte del paquete fuente. G5 ya no
   tiene un error de inventario después del build.

## Wrapper y SDK mínimos

El scaffold canónico ahora contiene `gradlew`, `gradlew.bat`,
`gradle/wrapper/gradle-wrapper.jar`, `gradle/wrapper/gradle-wrapper.properties`
y su inventario SHA-256. No se debe versionar un wrapper parcial. La
distribución 8.14.3 cacheada generó el wrapper completo con JDK 17. Su checksum oficial para
`gradle-8.14.3-bin.zip` es:

```text
bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531
```

Ese valor debe quedar en `distributionSha256Sum`.

La versión, el URL y el checksum ya están fijados en
`src/platform/android/toolchain/android-toolchain.v1.json`; el contenido exacto
de properties está en
`src/platform/android/toolchain/gradle-wrapper.properties.fixture`. El script
`scripts/dev/prepare-android-gradle-wrapper.ps1` valida sin mutar por defecto y
sólo genera al recibir `-Generate`, JDK 17 y un ejecutable Gradle explícito. El
script `scripts/dev/verify-android-toolchain.ps1` no invoca Gradle, SDK manager
ni ADB y produce un reporte machine-readable.

El SDK mínimo que debe provisionarse en una ubicación explícita es:

```text
cmdline-tools
platforms;android-36
build-tools;35.0.0
platform-tools        # necesario para adb/instalación y QA en teléfono
```

Después debe definirse `ANDROID_SDK_ROOT` (o un `local.properties` local con
`sdk.dir=...`) y fijarse un JDK 17 mediante `JAVA_HOME` o
`org.gradle.java.home`. `local.properties`, SDKs y claves privadas no se
versionan.

## Secuencia de build cuando se autorice

La siguiente secuencia fue ejecutada serialmente en esta auditoría; las rutas
locales sólo son ejemplos del host y no se versionan:

1. Provisionar JDK 17 y el SDK anterior, aceptar licencias y validar sus rutas.
2. Validar todos los assets release-eligible actuales y materializar nuevamente
   el `GameBundleV1` con allowlist y provenance cerrados. El staging actual ya
   contiene 27 assets: siete visuales `frozen`, doce strips de Damián y ocho WAV
   procedurales con validación técnica; repetir este paso si cambia el catálogo.
3. Generar/versionar el Gradle Wrapper 8.14.3 en
   `src/platform/android/native-scaffold/`, incluyendo el checksum anterior.
4. Reconstruir serialmente `output/android-web-runtime` desde el contrato
   fuente actual mediante la configuración Vite Android.
5. Ejecutar `prepare-android-webview-package.ps1` con el GameBundle, el root de
   assets y el `output/android-web-runtime` ya generado.
6. Verificar estáticamente el inventario y el allowlist de
   `output/android-webview`.
7. Ejecutar `assembleRelease` dentro de `output/android-webview`.
8. Instalar el APK release por ADB y verificar arranque sin red en un AVD API
   36. La evidencia actual está en `output/android-release-qa-evidence.v1.json`;
   el smoke no sustituye un playtest completo de audio, guardado, process death
   o renderer gone.
9. Para una publicación pública, reemplazar la clave QA efímera por una clave
   release estable custodiada fuera del repositorio.

## Decisiones de distribución futuras (no bloquean el QA de este APK)

- Para una publicación en tienda, confirmar que el APK distribuible sigue siendo
  el reproductor del capítulo y no el editor React.
- Para una publicación en tienda, revisar application ID, icono, branding y
  orientación; el QA actual usa `ai.rpgcreator.player`, versión `1.0.0`.
- Integrar en el reproductor la recuperación nativa de renderer del proyecto
  `android/`, o documentar explícitamente la degradación.
- Mantener una sola implementación Android canónica para evitar que seguridad,
  lifecycle y packaging diverjan entre ambos shells.

El APK release ya fue generado, instalado y ejecutado en el AVD. La evidencia
G4 y el QA release están registrados; los bullets anteriores sólo describen
endurecimiento posterior para distribución pública.

## Gates del contenido actual

G1–G5 están `ready`: G2 cubre los tres fondos, G3 VN/save/audio, G4 contiene
27/27 decisiones hash-bound `accepted` bajo revisión delegada y G5 comprueba
staging, inventario, bundle idéntico y ausencia de `INTERNET`. El APK release
que consume esos gates está verificado en AVD API 36.

## Evidencia release observada en este host

El toolchain ya está listo. Para reproducir el build release, usar el JDK 17 y
SDK locales (o sus equivalentes):

```powershell
$env:JAVA_HOME = 'C:\Users\franc\AppData\Local\RPGCreatorAI\toolchains\jdk-17.0.20+8'
$env:ANDROID_SDK_ROOT = 'C:\Users\franc\AppData\Local\RPGCreatorAI\android-sdk'
Set-Location 'output\android-webview'
.\gradlew.bat --no-daemon --offline :app:assembleRelease
```

El APK release actual está en
`output/android-webview/app/build/outputs/apk/release/app-release.apk`, mide
17.026.720 bytes y su SHA-256 es
`4b3e45a460a190dabef4c730e810eba539216d13d1cb0f1c0bd5bef57cf259e6`.
Su certificado público SHA-256 es
`50420a371a9410f6171007e2c0ce1eb0e6ede052256477388e2b79da3984b324` y la
evidencia QA es `output/android-release-qa-evidence.v1.json`.
