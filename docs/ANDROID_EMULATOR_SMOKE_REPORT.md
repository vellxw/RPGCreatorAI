# Smoke técnico Android — La Novena Promesa, capítulo 1

Fecha: 2026-08-14 12:16 UTC (host Windows).

Este informe registra la comprobación técnica automatizada del APK release
Android canónico. La aceptación G4 es delegada explícitamente por el creador y
no se describe como inspección humana personal.

La build pasó `assembleRelease` offline; `apksigner`, `aapt2`, alineación,
permisos y hashes de recursos también pasaron.

## Entorno

- AVD: `rpgcreatorai-api36`.
- Imagen: `system-images;android-36;google_apis;x86_64` (API 36 / Android 16).
- Emulator: 37.1.11.
- `adb`: platform-tools 37.0.1.
- Instalación: sin red, con `adb install -r`.
- Paquete: `ai.rpgcreator.player`.
- Actividad: `ai.rpgcreator.player/.MainActivity`.

## Artefacto probado

| Campo | Valor |
| --- | --- |
| Variante | `release` |
| Ruta | `output/android-webview/app/build/outputs/apk/release/app-release.apk` |
| Bytes | `17,026,720` |
| SHA-256 | `4b3e45a460a190dabef4c730e810eba539216d13d1cb0f1c0bd5bef57cf259e6` |
| Firma | v2 presente; certificado `50420a371a9410f6171007e2c0ce1eb0e6ede052256477388e2b79da3984b324` |
| Permisos | no se declaró `INTERNET`; `aapt2 dump permissions` no mostró permisos adicionales |

## Pasos y resultado

1. Arranque del AVD y espera hasta `sys.boot_completed=1`: **OK**.
2. `adb install -r app-release.apk`: **OK**, `Success`.
3. Lanzamiento con `monkey -p ai.rpgcreator.player 1`: **OK**.
4. `dumpsys activity` mantuvo `MainActivity` como `ResumedActivity` y el
   proceso `ai.rpgcreator.player` permaneció vivo.
5. La vista mostró el fondo del capítulo, la caja de diálogo y los controles
   táctiles direccionales/A/B: **OK**.
6. Se verificó lanzamiento offline; el proceso permaneció vivo y no aparecieron
   `FATAL EXCEPTION` ni `AndroidRuntime` en el recorte de logcat: **OK**.
7. El APK reconstruido incluye la guardia de `Safe Browsing` para API 24/25 y
   la recuperación acotada ante `renderer gone`; el smoke API 36 confirma que
   el camino normal no se vio afectado.

Capturas conservadas:

- `output/android-emulator-smoke-lint-clean.png` — SHA-256
  `e063426c8b585858e4de29165ca22aa66f5ca713f24ba99dc9ce7ed69aecf616`.

Durante el arranque headless el entorno mostró durante unos segundos
un diálogo de Android `System UI isn't responding`. El proceso del juego no
crasheó; al esperar y descartar el diálogo la captura final mostró el juego
renderizado. Se registra como incidencia del entorno AVD/headless, no como
fallo del APK. No se usa este smoke para afirmar QA completo de audio,
pausa/reanudación, process death, renderer gone o guardado.

## Estado de release

El manifiesto `output/android-release-manifest.v1.json` enlaza este APK release,
su evidencia QA y los gates G1–G5. Mantiene `status: candidate` únicamente
porque el worktree tiene cambios locales sin commit. La clave está fuera del
repositorio y su contraseña no se retuvo; antes de publicar actualizaciones se
debe generar y custodiar una identidad de firma estable.
