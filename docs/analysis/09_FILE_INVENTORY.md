# 09 - FILE INVENTORY

## Resumen
Inventario completo de todos los archivos analizados.

---

## Archivos Core (src/core/)

| Archivo | Líneas | Estado | Issues |
|---------|--------|--------|--------|
| Application.cpp | 381 | Analizado | 6 issues |
| Application.h | 44 | Analizado | OK |
| Game.cpp | 1129 | Analizado | 8 issues |
| Game.h | 145 | Analizado | 2 issues |
| PlayerMotion.cpp | 71 | Analizado | 4 issues |
| PlayerMotion.h | 41 | Analizado | 2 issues |
| Logger.cpp | 14 | Analizado | 4 issues |
| Logger.h | 9 | Analizado | 3 issues |
| MovementSpeed.cpp | 12 | Analizado | 2 issues |
| MovementSpeed.h | 14 | Analizado | OK |

---

## Archivos Renderer (src/renderer/)

| Archivo | Líneas | Estado | Issues |
|---------|--------|--------|--------|
| Renderer2D.cpp | ~700 | Analizado | 10+ issues |
| Renderer2D.h | ~50 | Analizado | 3 issues |
| BitmapFont.cpp | 147 | Analizado | 6 issues |
| BitmapFont.h | 26 | Analizado | OK |
| SpriteCatalog.cpp | ~60 | Analizado | 2 issues |
| SpriteCatalog.h | ~30 | Analizado | OK |

---

## Archivos Platform (src/platform/)

| Archivo | Líneas | Estado | Issues |
|---------|--------|--------|--------|
| AudioSystem.cpp | 262 | Analizado | 5 issues |
| AudioSystem.h | 63 | Analizado | 2 issues |
| Window.cpp | 84 | Analizado | 4 issues |
| Window.h | 24 | Analizado | 2 issues |
| FileSystem.cpp | 27 | Analizado | 5 issues |
| FileSystem.h | 10 | Analizado | 2 issues |

---

## Archivos Events (src/events/)

| Archivo | Líneas | Estado | Issues |
|---------|--------|--------|--------|
| EventRunner.cpp | 618 | Analizado | 10+ issues |
| EventRunner.h | 157 | Analizado | 4 issues |
| GameState.cpp | 155 | Analizado | 8 issues |
| GameState.h | 105 | Analizado | 3 issues |
| EventScheduler.cpp | 135 | Analizado | 5 issues |
| EventScheduler.h | 55 | Analizado | 2 issues |

---

## Archivos World (src/world/)

| Archivo | Líneas | Estado | Issues |
|---------|--------|--------|--------|
| MapScene.cpp | 148 | Analizado | 7 issues |
| MapScene.h | 35 | Analizado | 1 issue |
| MapLoader.cpp | 327 | Analizado | 10+ issues |
| MapLoader.h | 9 | Analizado | 1 issue |
| ProjectLoader.cpp | 189 | Analizado | 6 issues |
| ProjectLoader.h | 9 | Analizado | OK |
| CollisionSystem.cpp | ~20 | Analizado | 2 issues |
| CollisionSystem.h | ~15 | Analizado | OK |

---

## Archivos Dialogue (src/dialogue/)

| Archivo | Líneas | Estado | Issues |
|---------|--------|--------|--------|
| DialogueSystem.cpp | 71 | Analizado | 4 issues |
| DialogueSystem.h | 39 | Analizado | 2 issues |

**Nota**: DialogueRenderer.cpp, ChoiceDialogueRenderer.cpp NO EXISTEN.

---

## Archivos Database (src/database/)

| Archivo | Líneas | Estado | Issues |
|---------|--------|--------|--------|
| RpgDatabases.cpp | 439 | Analizado | 8 issues |
| RpgDatabases.h | 179 | Analizado | 5 issues |
| ItemDatabase.cpp | 39 | Analizado | 2 issues |
| ItemDatabase.h | 19 | Analizado | 3 issues |
| AnimationDatabase.cpp | 115 | Analizado | 5 issues |
| AnimationDatabase.h | 48 | Analizado | 5 issues |

---

## Archivos Runtime (src/runtime/)

| Archivo | Líneas | Estado | Issues |
|---------|--------|--------|--------|
| BattleSystem.cpp | 148 | Analizado | 6 issues |
| BattleSystem.h | 27 | Analizado | 1 issue |
| MenuSystem.cpp | 463 | Analizado | 7 issues |
| MenuSystem.h | 172 | Analizado | 3 issues |
| ShopSystem.cpp | 138 | Analizado | 5 issues |
| ShopSystem.h | 50 | Analizado | 2 issues |
| BattleSummarySystem.cpp | 102 | Analizado | 3 issues |
| BattleSummarySystem.h | 57 | Analizado | 2 issues |
| RuntimeProjectValidator.cpp | 1658 | Analizado | 11 issues |
| RuntimeProjectValidator.h | 33 | Analizado | OK |
| RuntimeDebugSnapshot.cpp | 164 | Analizado | 6 issues |
| RuntimeDebugSnapshot.h | 52 | Analizado | 2 issues |

---

## Archivos Save (src/save/)

| Archivo | Líneas | Estado | Issues |
|---------|--------|--------|--------|
| SaveManager.cpp | 294 | Analizado | 8 issues |
| SaveManager.h | 52 | Analizado | 3 issues |

---

## Archivos Types (src/types/)

| Archivo | Líneas | Estado | Issues |
|---------|--------|--------|--------|
| Direction.h | 26 | Analizado | 4 issues |
| Vec2i.h | 14 | Analizado | 4 issues |
| EventTypes.h | 166 | Analizado | 10+ issues |

**Nota**: CommandTypes.h, GameCommand.h NO EXISTEN.

---

## Archivos de Documentación (docs/)

| Archivo | Estado | Issues |
|---------|--------|--------|
| README.md | OK | Ninguno crítico |
| AGENTS.md | OK | Ninguno |
| GAME_VISUAL_DESIGN.md | OK | Ninguno |
| PHASE_12_ROADMAP_SUCCESS_METRICS.md | OK | M08-M11 sin ejecución |
| PHASE_12_RISK_REGISTER.md | OK | Ninguno |
| VALIDATION_LOG.md | OK | Muy largo, sin índice |
| GOAL_STACK.md | OK | Subgoals poco detallados |
| ROADMAP.md | **DESACTUALIZADO** | Phase 11 cuando es 12 |
| AI_WORKFLOWS.md | OK | Falta AI Studio |
| ARCHITECTURE.md | OK | Falta AI Studio |
| DATA_FORMAT.md | OK | Consistente |
| EVENT_SYSTEM.md | OK | Consistente |
| BUILD_AND_RUN.md | OK | Missing smoke script |
| DIAGNOSTICS.md | OK | Consistente |

---

## Archivos de Build

| Archivo | Estado | Issues |
|---------|--------|--------|
| CMakeLists.txt | OK | GLOB_RECURSE para dir inexistente |
| tests/CMakeLists.txt | OK | OK |
| CMakePresets.json | OK | OK |

---

## Archivos No Encontrados (referenciados pero no existen)

1. `src/dialogue/DialogueRenderer.cpp`
2. `src/dialogue/DialogueRenderer.h`
3. `src/dialogue/ChoiceDialogueRenderer.cpp`
4. `src/types/CommandTypes.h`
5. `src/types/GameCommand.h`
6. `src/core/Player.cpp` (posible)
7. `src/core/MovementSystem.cpp` (posible)

---

## Resumen Estadístico

| Categoría | Archivos | Total Líneas |
|-----------|----------|--------------|
| src/core/ | 10 | ~1,800 |
| src/renderer/ | 6 | ~930 |
| src/platform/ | 6 | ~470 |
| src/events/ | 6 | ~1,130 |
| src/world/ | 8 | ~740 |
| src/dialogue/ | 2 | ~110 |
| src/database/ | 6 | ~840 |
| src/runtime/ | 12 | ~2,800 |
| src/save/ | 2 | ~350 |
| src/types/ | 3 | ~210 |
| **Total src/** | **61** | **~9,380** |