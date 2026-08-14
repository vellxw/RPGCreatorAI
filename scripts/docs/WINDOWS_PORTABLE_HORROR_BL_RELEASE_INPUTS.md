# La Novena Promesa: entrada reproducible para Windows portable

El estado vigente lo determina siempre el preflight de esta página. El árbol
nativo y el `GameBundle v1` del capítulo ya tienen un materializador
reproducible. Los siete PNG visuales fueron promovidos a `frozen` mediante
revisión delegada, las 12 tiras de Damián pasan verificación técnica y ocho WAV
procedurales fueron verificados técnicamente. La evidencia G4 hash-bound registra
27/27 recursos `accepted` bajo revisión `delegated-by-creator`. El bundle actual
contiene 27 assets, y el release sólo se habilita cuando gate, allowlist,
provenance, catálogo, GameBundle y bytes coinciden y el preflight devuelve `0`.
El binario x64 existente en
`build/rpg_creator_runtime.exe` puede reutilizarse cuando todos los gates estén
verdes.

El gate aislado de assets pasó el 2026-08-14 con 0 issues y 0 drift entre
manifest, gate y provenance. El GameBundle actual fue rematerializado con los
27 assets allowlisted (7 visuales + 12 tiras + 8 WAV). El exporter estricto
hizo el export canónico con código `0` y dejó el portable unsigned `1.0.0` en
`%LOCALAPPDATA%\RPGCreatorAI\release-artifacts\canonical-20260814-fixed\La-Novena-Promesa-v1.0.0-windows-x64-portable-unsigned`.
El reporte final declara `ok: true`, sin errores ni warnings, e incluye los 27
assets, evidencia G4 y el contrato `game-release.v1.json`.

El estado factual de los assets GPT Image y la secuencia completa para ambos
targets se documenta en `docs/HORROR_BL_RELEASE_HANDOFF.md`.

## Contrato real del runtime

El runtime nativo inicia desde la raíz del portable y lee
`data/project.json`. No interpreta `data/game-bundle.v1.json`. El bundle sigue
siendo necesario para el gate y como entrada portable común, pero no reemplaza
el árbol nativo de datos.

`templates/horror-bl/data/content/vertical-slice.json` sigue siendo el
blueprint canónico. El árbol de `data/` contiene la materialización nativa y
`scripts/dev/materialize-horror-bl-release.mjs` compila ese estado al
`GameBundle` y a su evidencia de `release-input/`; por eso cualquier cambio de
blueprint, proyecto, assets o allowlist exige volver a materializar y a
ejecutar el preflight antes de exportar.

El plan reproducible y legible por máquina vive en
`scripts/docs/fixtures/windows-portable/horror-bl-release-input.v1.json`.

## Artefactos que deben existir

La raíz de proyecto preparada debe contener, como mínimo:

```text
<project-root>/
  data/
    project.json
    maps/
      facility_lobby.json
      archive_sublevel.json
      service_corridor.json
    database/
      items.json
  release-input/
    game-bundle.v1.json
    asset-allowlist.json
    asset-provenance.v1.json
    asset-approval-gate.v1.json
    compiler-warnings.json
    materialization-report.v1.json
```

Requisitos adicionales:

- `game-bundle.v1.json` debe provenir del mismo estado materializado y contener
  los tres mapas declarados por el blueprint.
- `materialization-report.v1.json` debe enlazar el blueprint, el estado
  materializado y el bundle mediante hashes SHA-256, e identificar los tres
  mapas. El contrato mínimo que inspecciona el preflight es:

  ```json
  {
    "schemaVersion": 1,
    "mapIds": ["facility_lobby", "archive_sublevel", "service_corridor"],
    "blueprint": { "sha256": "<64 hex minúsculas>" },
    "project": { "sha256": "<64 hex minúsculas>" },
    "gameBundle": { "sha256": "<64 hex minúsculas>" }
  }
  ```

  Los hashes se comparan contra los bytes actuales. El reporte queda inválido
  si cualquiera de las tres entradas cambia.
- El allowlist debe ser explícito y coincidir uno a uno con los 27 assets del
  bundle: los dos retratos, la amenaza, el seed RGBA, los tres fondos, las 12
  tiras `sprite.damian.*` y los ocho WAV offline. Las tiras viven en
  `supplementalAnimationAssetAllowlist` y no alteran los siete slots visuales.
- El contrato actual de esos siete slots vive en
  `templates/horror-bl/release-input/asset-approval-gate.v1.json`. Ya existen
  outputs originales GPT Image para Damián, Elian y The Ninth Witness, con
  prompts, hashes y dimensiones registrados en
  `assets/source/generated/generation-session-2026-08-14.v1.json`. La sesión
  conserva el estado inicial de candidato y el gate registra la promoción de
  los bytes exactos a `frozen`; su presencia por sí sola no autoriza un export.
- Cada asset debe tener bytes locales runtime-compatible y una entrada de
  provenance con origen, nota explícita de derechos/términos aplicables, ruta
  portable y SHA-256. Para
  assets generados también se requieren provider, tool, modelo expuesto o
  `null` documentado, prompt, referencias, consentimiento de identidad, fecha
  y hash de salida. No se guardan credenciales.
 - Los WAV procedurales registran semilla, receta, duración, hash y verificación
  técnica. Su `humanAcceptance` está `accepted` y enlazado a la evidencia G4
  delegada; cambiar cualquier byte obliga a repetir la revisión hash-bound.
- Los PNG aprobados deben vivir bajo una ruta portable `assets/.../*.png` en la
  raíz del proyecto. El mismo `assetId`, `runtimePath`, `source`, tamaño y hash
  debe aparecer en el catálogo compilado y en el registro de aprobación. El
  exporter copia solamente esa intersección exacta.
- `compiler-warnings.json` debe corresponder a la compilación exitosa exacta
  del bundle. Puede ser un array o `{ "warnings": [...] }`.
- El exporter incorpora una copia estrictamente allowlisted de
  `data/project.json`, los mapas declarados y únicamente los shards de base de
  datos que reconoce el runtime. Rechaza referencias fuera de `data/maps/` o
  `data/database/`, JSON vacío/inválido, duplicados por mayúsculas, rutas UNC,
  traversal, reparse points, archivos extra y roles de release incorrectos.

No se deben usar los archivos actuales de `data/`: pertenecen al proyecto de
muestra “My First RPG”, no a La Novena Promesa.

## Preflight seguro y repetible

Desde la raíz del repositorio:

```powershell
.\scripts\dev\prepare-windows-portable-release-inputs.ps1
```

El comando es de sólo lectura si se omite `-OutputPath`: inspecciona el PE,
calcula su hash y reporta artefactos faltantes en JSON. Cada check incluye el
gate, los targets bloqueados, evidencia, mensaje, acción correctiva y, cuando
es seguro, el próximo comando sugerido. Sale con código `0` sólo cuando el
target seleccionado está preparado, o `3` cuando hay bloqueos. Para conservar
un reporte nuevo sin sobrescribir otro:

```powershell
.\scripts\dev\prepare-windows-portable-release-inputs.ps1 `
  -ProjectRoot 'C:\ruta\al\proyecto-materializado' `
  -OutputPath 'C:\ruta\nueva\horror-bl-readiness.json'
```

El wrapper equivalente es
`scripts/dev/prepare-windows-portable-release-inputs.bat`.

El mismo preflight informa el estado del staging Android sin construirlo:

```powershell
.\scripts\dev\prepare-windows-portable-release-inputs.ps1 -Target AndroidWebView
.\scripts\dev\prepare-windows-portable-release-inputs.ps1 -Target All
```

Puede apuntarse a ubicaciones no predeterminadas con `-AndroidWebDistPath` y
`-AndroidStagingPath`. `targets.windowsPortable` y `targets.androidWebView`
mantienen listas independientes de checks bloqueantes, para que la falta de
SDK/Gradle o staging Android no oculte el progreso real del portable Windows.

El gate específico de assets se valida, sin promover ni copiar candidatos, con:

```powershell
.\scripts\dev\validate-horror-bl-asset-gate.ps1
.\scripts\dev\validate-horror-bl-asset-gate.ps1 -RequireReleaseReady
```

El primer comando comprueba el contrato y los hashes. El segundo agrega el gate
de release y devuelve código `3` mientras algún slot no esté aprobado/frozen,
allowlisted y cubierto por provenance.

## Único paso pesado, sólo después de resolver los bloqueos

La capacidad de shards nativos ya está implementada. Una vez que el preflight
devuelva `releaseReady: true`, el export real puede reutilizar exactamente el
mismo PE como launcher y runtime:

```powershell
.\scripts\dev\export-windows-portable.ps1 `
  -ProjectRoot 'C:\ruta\al\proyecto-materializado' `
  -GameBundlePath 'C:\ruta\al\proyecto-materializado\release-input\game-bundle.v1.json' `
  -ProvenancePath 'C:\ruta\al\proyecto-materializado\release-input\asset-provenance.v1.json' `
  -AssetAllowlistPath 'C:\ruta\al\proyecto-materializado\release-input\asset-allowlist.json' `
  -AssetApprovalGatePath 'C:\ruta\al\proyecto-materializado\release-input\asset-approval-gate.v1.json' `
  -CompilerWarningsPath 'C:\ruta\al\proyecto-materializado\release-input\compiler-warnings.json' `
  -PackagedExe '.\build\rpg_creator_runtime.exe' `
  -RuntimeExe '.\build\rpg_creator_runtime.exe' `
  -ArtifactName 'La Novena Promesa' `
  -Version '1.0.0' `
  -Architecture x64 `
  -Qualifier unsigned
```

El exporter vuelve a verificar el gate de aprobación aunque se invoque fuera
del preflight: exige `releaseReady=true`, slots approved/frozen, evidencia de
revisión, correspondencia uno a uno con el allowlist y bytes distintos de los
fixtures marcados `fixtureOnly`. Crea una carpeta única fuera del repositorio,
no sobrescribe un release existente y conserva el staging si falla. No debe
ejecutarse hasta que el preflight esté verde.
