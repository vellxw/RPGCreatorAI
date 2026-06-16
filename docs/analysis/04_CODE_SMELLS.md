# 04 - CODE SMELLS

## Resumen
Code smells principales encontrados en el codebase.

---

## SMELL-001: ~50 Magic Numbers Hardcodeados

### Ubicaciones Principales
| Valor | Archivo | Línea | Contexto |
|-------|---------|-------|----------|
| 32 | PlayerMotion.h | 28 | Default tileSize |
| 32 | Renderer2D.cpp | 64 | Default tileSize |
| 32 | MapScene.cpp | 55 | Collision tile (también 9) |
| 9 | MapScene.cpp | 55 | Collision tile ID |
| 125 | Game.cpp | 28, 29 | Ms por defecto |
| 64 | Game.cpp | 19 | Max route steps |
| 1.5f | Game.cpp | 139, 989 | Character height tiles |
| 800, 600 | Game.h | 141-142 | Viewport dimensions |

### Solución
Crear archivo de constantes:
```cpp
// src/core/Constants.h
namespace GameConstants {
    constexpr int kDefaultTileSize = 32;
    constexpr int kCollisionTileId = 9;
    constexpr int kDefaultMoveStepMs = 125;
    constexpr float kDefaultCharacterHeightTiles = 1.5f;
    constexpr int kMaxMovementRouteSteps = 64;
    constexpr int kDefaultViewportWidth = 800;
    constexpr int kDefaultViewportHeight = 600;
}
```

---

## SMELL-002: Raw Pointers Sin Ownership Clar

### Ubicaciones
| Archivo | Línea | Tipo |
|---------|-------|------|
| Game.h | 124 | `AudioSystem*` |
| Renderer2D.h | 31 | `SDL_Renderer*` |
| Renderer2D.h | 34 | `SDL_Texture*` |
| Window.h | 22-23 | `SDL_Window*`, `SDL_Renderer*` |
| EventRunner.h | 129 | `EventTraceBuffer*` |

### Solución
- Para ownership: usar `std::unique_ptr` o `std::shared_ptr`
- Para non-ownership: usar `std::weak_ptr` o referencias
- Para interfaces SDL:可以考虑 `gsl::not_null<>`

---

## SMELL-003: stringToDirection No Case-Insensitive

**Archivo**: `src/types/Direction.h`
**Líneas**: 21-25

### Código Actual
```cpp
inline Direction stringToDirection(const std::string& str) {
    if (str == "up") return Direction::Up;
    if (str == "down") return Direction::Down;
    if (str == "left") return Direction::Left;
    if (str == "right") return Direction::Right;
    return Direction::Down;
}
```

### Problema
Si el JSON tiene "Up" o "UP", no se convierte correctamente.

### Solución
```cpp
inline Direction stringToDirection(const std::string& str) {
    std::string lower;
    lower.reserve(str.size());
    std::transform(str.begin(), str.end(), std::back_inserter(lower),
                   [](char c) { return std::tolower(static_cast<unsigned char>(c)); });

    if (lower == "up") return Direction::Up;
    if (lower == "down") return Direction::Down;
    if (lower == "left") return Direction::Left;
    if (lower == "right") return Direction::Right;
    return Direction::Down;
}
```

---

## SMELL-004: EventCommand "God Struct"

**Archivo**: `src/types/EventTypes.h`
**Líneas**: 12-117

### Problema
50+ campos para todos los tipos de comandos posibles:
- `text`, `prompt`, `speaker`
- `flag`, `switchId`, `selfSwitchLetter`
- `itemId`, `amount`, `goldAmount`
- `mapId`, `x`, `y`, `direction`
- `commonEventId`, `questId`
- `victoryBranch`, `defeatBranch`
- etc.

### Solución
Usar `std::variant`:
```cpp
struct ShowTextCommand { std::string text; std::string speaker; };
struct ShowChoicesCommand { std::string prompt; std::vector<Choice> choices; };
struct SetFlagCommand { std::string flag; bool value; };
// ...

using EventCommand = std::variant<
    ShowTextCommand,
    ShowChoicesCommand,
    SetFlagCommand,
    // ... todos los tipos
>;
```

**Nota**: Esto requiere cambios significativos en parsing y procesamiento.

---

## SMELL-005: Lambda Capturando `this`

**Archivo**: `src/core/Game.cpp`
**Líneas**: 790-804

### Problema
```cpp
eventRunner->setCommonEventResolver([this](const std::string& id) {
    return this->resolveCommonEvent(id);
});
```

Si Game se destruye mientras EventRunner vive, hay dangling reference.

### Solución
Usar `weak_ptr`:
```cpp
std::weak_ptr<Game> weakGame = shared_from_this();
eventRunner->setCommonEventResolver([weakGame](const std::string& id) {
    if (auto game = weakGame.lock()) {
        return game->resolveCommonEvent(id);
    }
    return std::vector<std::shared_ptr<EventCommand>>{};
});
```

---

## SMELL-006: writeFile No Verifica Éxito

**Archivo**: `src/platform/FileSystem.cpp`
**Línea**: 20

### Código Actual
```cpp
bool FileSystem::writeFile(const std::string& path, const std::string& content) {
    std::ofstream file(path);
    if (!file.is_open()) return false;
    file << content;
    return true; // Siempre true aunque write falle
}
```

### Problema
No verifica `file.fail()` después de escribir.

### Solución
```cpp
file << content;
return !file.fail();
```

---

## SMELL-007: Inconsistencia de Estilos

### Ejemplos
| Patrón | Archivo | Ejemplo |
|--------|---------|---------|
| `playerTilesPerSecond` | Game.h | camelCase |
| `movementRouteMoveStepMs` | Game.cpp | camelCase |
| `kRuntimeDebugSnapshotIntervalSeconds` | Application.cpp | k prefix |
| `CommonEventResolver` | EventRunner.h | PascalCase |
| `stringToDirection` | Direction.h | camelCase |

### Solución
Crear style guide y aplicar clang-format o similar.

---

## SMELL-008: Logger Usando std::cout/std::cerr Directamente

**Archivo**: `src/core/Logger.cpp`

### Problema
No hay niveles de log configurables, no hay output a archivo, no hay timestamps.

### Solución
Implementar sistema de logging con:
```cpp
enum class LogLevel { Debug, Info, Warning, Error };

class Logger {
public:
    static void setLevel(LogLevel level);
    static void setOutput(const std::string& filepath);
    static void debug(const std::string& msg);
    static void info(const std::string& msg);
    // ...
};
```

---

## Checklist de Fix Aplicados

- [ ] SMELL-001: Extraer magic numbers a constantes
- [ ] SMELL-002: Clarificar ownership de punteros
- [ ] SMELL-003: Hacer stringToDirection case-insensitive
- [ ] SMELL-004: Considerar std::variant para EventCommand
- [ ] SMELL-005: Usar weak_ptr en lambdas
- [ ] SMELL-006: Verificar writeFile success
- [ ] SMELL-007: Estandarizar estilo
- [ ] SMELL-008: Mejorar Logger