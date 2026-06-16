# 02 - HIGH PRIORITY BUGS

## Resumen
10 bugs altos que afectan correctness pero no causan crash inmediato.

---

## HIGH-001: Recursion sin Límite parseCommand

**Archivo**: `src/world/MapLoader.cpp`
**Línea**: 49

### Código Problemático
```cpp
} else if (type == "showChoices") {
    // ...
    for (const auto& inner : choiceJson.at("commands")) {
        ch.commands.push_back(parseCommand(inner)); // RECURSIVO
    }
}
```

### Problema
No hay límite de profundidad para la recursión. JSON malicioso con comandos anidados profundamente causaría stack overflow.

### Fix Sugerido
Agregar contador de profundidad:
```cpp
static std::shared_ptr<EventCommand> parseCommand(const json& j, int depth = 0) {
    if (depth > 100) {
        Logger::warning("Max command nesting depth exceeded");
        return nullptr;
    }
    // ... usar depth+1 en llamadas recursivas
}
```

### Severidad: ALTA

---

## HIGH-002: Sin Validación Dimensiones Mapa

**Archivo**: `src/world/MapLoader.cpp`
**Líneas**: 271-273

### Código Problemático
```cpp
map.width = j.at("width").get<int>();
map.height = j.at("height").get<int>();
map.tileSize = j.at("tileSize").get<int>();
```

### Problema
No hay validación de que sean valores positivos. Un valor de 0 o negativo causaría división por cero o comportamiento incorrecto.

### Fix Sugerido
```cpp
map.width = j.at("width").get<int>();
map.height = j.at("height").get<int>();
map.tileSize = j.at("tileSize").get<int>();

if (map.width <= 0 || map.height <= 0 || map.tileSize <= 0) {
    Logger::error("Invalid map dimensions in " + path);
    return std::nullopt;
}
```

### Severidad: ALTA

---

## HIGH-003: Integer Overflow addItem

**Archivo**: `src/events/GameState.cpp`
**Líneas**: 78-81

### Código Problemático
```cpp
void GameState::addItem(const std::string& itemId, int amount) {
    if (amount <= 0) return;
    inventory[itemId] += amount;
}
```

### Problema
Si `inventory[itemId]` ya tiene un valor grande y se suma, puede overflow.

### Fix Sugerido
```cpp
void GameState::addItem(const std::string& itemId, int amount) {
    if (amount <= 0) return;
    int64_t newValue = static_cast<int64_t>(inventory[itemId]) + amount;
    inventory[itemId] = static_cast<int>(std::min<int64_t>(newValue, INT_MAX));
}
```

### Severidad: ALTA

---

## HIGH-004: Integer Overflow addGold

**Archivo**: `src/events/GameState.cpp`
**Líneas**: 98-101

### Código Problemático
```cpp
void GameState::addGold(int amount) {
    if (amount <= 0) return;
    gold += amount;
}
```

### Problema
`gold` es `int`, puede overflow fácilmente.

### Fix Sugerido
```cpp
void GameState::addGold(int amount) {
    if (amount <= 0) return;
    int64_t newGold = static_cast<int64_t>(gold) + amount;
    gold = static_cast<int>(std::min<int64_t>(newGold, INT_MAX));
}
```

### Severidad: ALTA

---

## HIGH-005: Out-of-Bounds SaveManager String

**Archivo**: `src/save/SaveManager.cpp`
**Línea**: 188

### Código Problemático
```cpp
const std::string mapId = key.substr(0, first);
const std::string eventId = key.substr(first + 1, last - first - 1);
```

### Problema
`last + 1 >= key.size()` check es incorrecto. Si `last + 1 == key.size()`, `key[last + 1]` es out-of-bounds.

### Fix Sugerido
```cpp
if (first == std::string::npos || last == std::string::npos || first >= last) {
    continue; // Invalid format
}
if (last + 1 >= key.size()) {
    continue; // Invalid
}
```

### Severidad: ALTA

---

## HIGH-006: size_t Underflow SaveManager

**Archivo**: `src/save/SaveManager.cpp`
**Línea**: 193

### Código Problemático
```cpp
key.substr(first + 1, last - first - 1)
```

### Problema
Si `first + 1 > last - 1`, el tamaño del substr es negativo (size_t underflow).

### Fix Sugerido
Verificar antes:
```cpp
if (first + 1 >= last) continue;
key.substr(first + 1, last - first - 1)
```

### Severidad: ALTA

---

## HIGH-007: SDL_Quit Cierra Todos los Subsystems

**Archivo**: `src/platform/Window.cpp`
**Línea**: 42

### Código Problemático
```cpp
void Window::shutdown() {
    if (window) {
        SDL_DestroyWindow(window);
        window = nullptr;
        SDL_Quit(); // <-- Cierra TODOS los subsystems SDL
    }
}
```

### Problema
`SDL_Quit()` cierra audio, video, y todos los subsystems. Si AudioSystem aún está activo, fallará.

### Fix Sugerido
No llamar SDL_Quit() aquí, delegar a una función centralizada:
```cpp
// Crear una función centralizada en Application o un Singleton de cleanup
void Application::shutdownAllSubsystems() {
    // order de shutdown: audio primero, luego video
    AudioSystem::shutdown();
    Window::shutdown();
    SDL_Quit();
}
```

### Severidad: ALTA

---

## HIGH-008: Magic Number Collision = 9

**Archivo**: `src/world/MapScene.cpp`
**Línea**: 55

### Código Problemático
```cpp
int collisionTile = getTileAt("collision", x, y);
if (collisionTile == 9) {
    return true;
}
```

### Problema
El valor `9` está hardcodeado. No está documentado ni extraído como constante.

### Fix Sugerido
Crear constantes:
```cpp
// En MapScene.h o un archivo de constantes
static constexpr int kCollisionTileId = 9;

// Usar:
if (collisionTile == kCollisionTileId) {
    return true;
}
```

### Severidad: MEDIA (pero crítico porque aparece en múltiples lugares)

---

## HIGH-009: Integer Overflow EventRunner Operaciones

**Archivo**: `src/events/EventRunner.cpp`
**Líneas**: 349-351

### Código Problemático
```cpp
int current = state.getVariable(cmd->variableId, 0);
int rhs = cmd->varValue;
int next = 0;
switch (cmd->varOp) {
    case VariableOp::Add: next = current + rhs; break;
    case VariableOp::Sub: next = current - rhs; break;
    case VariableOp::Mul: next = current * rhs; break;
```

### Problema
Las operaciones pueden overflow fácilmente.

### Fix Sugerido
```cpp
int64_t current = state.getVariable(cmd->variableId, 0);
int64_t rhs = cmd->varValue;
int64_t next = 0;
switch (cmd->varOp) {
    case VariableOp::Add: next = current + rhs; break;
    case VariableOp::Sub: next = current - rhs; break;
    case VariableOp::Mul: next = current * rhs; break;
    // ...
}
next = std::max(std::min(next, static_cast<int64_t>(INT_MAX)), static_cast<int64_t>(INT_MIN));
state.setVariable(cmd->variableId, static_cast<int>(next));
```

### Severidad: ALTA

---

## HIGH-010: SDL_LoadBMP Sin Verificación

**Archivo**: `src/renderer/Renderer2D.cpp`
**Línea**: 239

### Código Problemático
```cpp
SDL_Surface* surface = SDL_LoadBMP(SpriteCatalog::runtimePathFor(assetKey).c_str());
```

### Problema
Si el archivo no existe, `SDL_LoadBMP` retorna NULL y el código continúa, causando undefined behavior.

### Fix Sugerido
```cpp
SDL_Surface* surface = SDL_LoadBMP(SpriteCatalog::runtimePathFor(assetKey).c_str());
if (!surface) {
    Logger::warning("Failed to load sprite: " + assetKey);
    textures[assetKey] = nullptr;
    return nullptr;
}
```

### Severidad: MEDIA

---

## Checklist de Fix Aplicados

- [ ] HIGH-001: Recursion parseCommand
- [ ] HIGH-002: Validación dimensiones mapa
- [ ] HIGH-003: Integer overflow addItem
- [ ] HIGH-004: Integer overflow addGold
- [ ] HIGH-005: Out-of-bounds SaveManager
- [ ] HIGH-006: size_t underflow SaveManager
- [ ] HIGH-007: SDL_Quit global
- [ ] HIGH-008: Magic number collision=9
- [ ] HIGH-009: Integer overflow EventRunner
- [ ] HIGH-010: SDL_LoadBMP sin verificación