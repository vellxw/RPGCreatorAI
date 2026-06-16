# 05 - MAGIC NUMBERS CATALOG

## Resumen
Catálogo completo de todos los magic numbers encontrados en el codebase.

---

## Tile & Map Constants

| Valor | Archivo(s) | Línea(s) | Uso |
|-------|------------|----------|-----|
| 32 | PlayerMotion.h | 28 | Default tileSize |
| 32 | PlayerMotion.cpp | 9, 27 | Default tileSize fallback |
| 32 | Renderer2D.cpp | 64 | Default tileSize fallback |
| 32 | RpgDatabases.cpp | 238 | tileSize default |
| 9 | MapScene.cpp | 55 | Collision tile ID |
| 9 | SpriteCatalog.cpp | 5 | Collision tile ID |
| 9 | Game.cpp | 342 | Collision check |
| 9 | RuntimeProjectValidator.cpp | 1428 | Collision tile check |
| 5 | SpriteCatalog.cpp | 6 | Ground tile para tree |
| 7 | SpriteCatalog.cpp | 7 | Ground tile para interior wall |

---

## Timing Constants

| Valor | Archivo(s) | Línea(s) | Uso |
|-------|------------|----------|-----|
| 125 | Game.cpp | 28, 29 | Ms por defecto por tile |
| 1000 | Application.cpp | 91 | Divisor ms a segundos |
| 1000 | EventRunner.cpp | 119, 405, 542 | Conversión ms a segundos |
| 16 | Application.cpp | 107 | SDL_Delay para ~60fps |
| 0.25f | PlayerMotion.h | 38 | Default movement duration |
| 0.25f | Application.cpp | 14 | Debug snapshot interval |

---

## Movement Speed Values

**Archivo**: `src/core/MovementSpeed.cpp`

| Valor | Línea | Velocidad |
|-------|-------|-----------|
| 0.5f | 4 | oneEighth |
| 1.0f | 5 | normal |
| 2.0f | 6 | double |
| 4.0f | 7 | fast |
| 8.0f | 8, 10 | quadruple, default |
| 16.0f | 9 | instant |

---

## UI/Dimension Constants

| Valor | Archivo(s) | Línea(s) | Uso |
|-------|------------|----------|-----|
| 800 | Game.h | 141 | Default viewport width |
| 600 | Game.h | 142 | Default viewport height |
| 16:9 | ProjectTypes.h | 49 | Default aspect ratio |
| 1.5f | Game.cpp | 139, 989 | Default character height tiles |

---

## Battle System Constants

| Valor | Archivo(s) | Línea(s) | Uso |
|-------|------------|----------|-----|
| 2 | BattleSystem.cpp | 14 | Multiplicador de ataque |
| 1 | BattleSystem.cpp | 15 | Daño mínimo |
| 64 | BattleSystem.cpp | 92 | Máximo de rondas |

---

## Menu System Constants

| Valor | Archivo(s) | Línea(s) | Uso |
|-------|------------|----------|-----|
| 3 | MenuSystem.h | 16, 155 | Max save slots |
| 6 | MenuSystem.cpp | 153 | Root menu item count |
| 3 | MenuSystem.cpp | 222 | Save index |
| 4 | MenuSystem.cpp | 255 | Load index |

---

## Animation Constants

**Archivo**: `src/database/AnimationDatabase.cpp`

| Valor | Línea | Uso |
|-------|-------|-----|
| 64 | 30, 31 | Default frameSize |
| 1.0f | 34 | Default fps |
| 1 | 33 | Default frameCount |

---

## Audio System Constants

**Archivo**: `src/platform/AudioSystem.cpp`

| Valor | Línea | Uso |
|-------|-------|-----|
| 44100 | 22 | Frecuencia sampleo |
| 2 | 24 | Canales (estéreo) |
| 4096 | 25 | Sample buffer size |
| 4 | 92 | Repeat count para loop |

---

## Renderer Constants

**Archivo**: `src/renderer/Renderer2D.cpp`

| Valor | Línea(s) | Uso |
|-------|----------|-----|
| 32 | 64 | tileSize fallback |
| 16 | 140, 307, 469, 587 | Margins/padding |
| 120 | 141 | Dialogue box height |
| 14 | 149, 308, 481 | Text offsets |
| 2 | 151 | Text scale |
| 8 | 158, 169, 181 | Spacing |
| 280 | 447 | Dialog box width |
| 110 | 448 | Dialog box height |

---

## Save System Constants

**Archivo**: `src/save/SaveManager.cpp`

| Valor | Línea | Uso |
|-------|-------|-----|
| 2 | 13, 126 | Schema version, JSON indent |

---

## Game System Constants

**Archivo**: `src/core/Game.cpp`

| Valor | Línea | Uso |
|-------|-------|-----|
| 64 | 19 | Max repeated route steps |
| 125 | 28, 29 | Default move step ms |
| 32 | 303, 809, 883 | Tile size fallback |
| 9 | 342 | Collision tile |
| 1.5f | 989, 1026 | Character height, aspect ratio |

---

## Project Constants

**Archivo**: `src/world/ProjectLoader.cpp`

| Valor | Línea | Uso |
|-------|-------|-----|
| 1 | 82 | Schema version válida |

---

## Propuesta de Archivo de Constantes

Crear `src/core/GameConstants.h`:

```cpp
#pragma once
#include <cstdint>

namespace GameConstants {
    // Tiles
    constexpr int kDefaultTileSize = 32;
    constexpr int kCollisionTileId = 9;
    constexpr int kMaxMovementRouteSteps = 64;

    // Timing
    constexpr int kDefaultMoveStepMs = 125;
    constexpr int kTargetFrameRate = 60;
    constexpr int kFrameDelayMs = 16;
    constexpr float kDefaultMovementDuration = 0.25f;

    // Viewport
    constexpr int kDefaultViewportWidth = 800;
    constexpr int kDefaultViewportHeight = 600;
    constexpr float kDefaultCharacterHeightTiles = 1.5f;
    constexpr const char* kDefaultAspectRatio = "16:9";

    // Battle
    constexpr int kAttackMultiplier = 2;
    constexpr int kMinDamage = 1;
    constexpr int kMaxBattleRounds = 64;

    // Save
    constexpr int kCurrentSaveSchemaVersion = 2;
    constexpr int kMaxSaveSlots = 3;

    // UI
    constexpr int kDialogueBoxHeight = 120;
    constexpr int kDialogueBoxWidth = 280;
    constexpr int kDefaultTextScale = 2;

    // Movement speeds (tiles per second)
    constexpr float kSpeedOneEighth = 0.5f;
    constexpr float kSpeedNormal = 1.0f;
    constexpr float kSpeedDouble = 2.0f;
    constexpr float kSpeedFast = 4.0f;
    constexpr float kSpeedQuadruple = 8.0f;
    constexpr float kSpeedInstant = 16.0f;
}
```

---

## Checklist de Constantes Extraídas

- [ ] kDefaultTileSize = 32
- [ ] kCollisionTileId = 9
- [ ] kDefaultMoveStepMs = 125
- [ ] kTargetFrameRate = 60
- [ ] kFrameDelayMs = 16
- [ ] kDefaultViewportWidth = 800
- [ ] kDefaultViewportHeight = 600
- [ ] kAttackMultiplier = 2
- [ ] kMinDamage = 1
- [ ] kMaxBattleRounds = 64
- [ ] kCurrentSaveSchemaVersion = 2
- [ ] kMaxSaveSlots = 3