# Design Document

## Overview

Este documento describe el diseño técnico del bootstrap de Fase 1 del RPG Creator Runtime. El alcance cubre: configuración del sistema de build CMake con FetchContent, punto de entrada `main.cpp` → `Application`, carga y validación estricta de `project.json` vía `ProjectLoader`, apertura de ventana SDL condicionada a validación exitosa, bucle principal con separación de fases, costuras arquitectónicas sin comportamiento hardcodeado, logging uniforme y tests unitarios del bootstrap.

El diseño se apoya en la arquitectura existente del repositorio (clases ya declaradas en headers) y la formaliza para cumplir los requisitos de la Fase 1.

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                    RPG Creator Runtime                        │
│                                                              │
│  main.cpp ──► Application ──► ProjectLoader ──► project.json │
│                   │                                          │
│                   ├──► Window (SDL2)                          │
│                   ├──► Renderer2D (IRenderer)                 │
│                   └──► Game                                   │
│                         ├── GameState                         │
│                         ├── EventRunner                       │
│                         ├── DialogueSystem                    │
│                         ├── CollisionSystem                   │
│                         ├── MapLoader                         │
│                         └── ItemDatabase                      │
└─────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │                              │
    SDL2-static                  nlohmann/json v3.11.3
    (release-2.28.5)             doctest v2.4.11 (tests)
```

### Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ Build System (CMakeLists.txt)                                     │
│  ┌─────────────┐  ┌──────────┐  ┌──────────┐                    │
│  │nlohmann/json│  │  doctest  │  │   SDL2   │  ← FetchContent    │
│  └──────┬──────┘  └─────┬────┘  └─────┬────┘                    │
│         │                │             │                          │
│  ┌──────▼────────────────▼─────────────▼────┐                    │
│  │            RuntimeLib (STATIC)            │                    │
│  │  src/core/ src/platform/ src/renderer/    │                    │
│  │  src/world/ src/events/ src/dialogue/     │                    │
│  │  src/save/ src/database/                  │                    │
│  └──────────────────┬───────────────────────┘                    │
│         ┌───────────┼───────────┐                                │
│         ▼           ▼           ▼                                │
│  ┌─────────────┐ ┌──────────┐ ┌──────────┐                      │
│  │rpg_creator_ │ │rpg_tests │ │  (future  │                      │
│  │  runtime    │ │(doctest) │ │   tools)  │                      │
│  └─────────────┘ └──────────┘ └──────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

### Initialization Sequence

```
main()
  │
  ├─ Logger::info("RPG Creator Runtime starting...")
  ├─ Application app
  ├─ app.initialize()
  │    ├─ ProjectLoader::load("data/project.json")
  │    │    ├─ Read file → parse JSON
  │    │    ├─ Validate schemaVersion == 1
  │    │    ├─ Validate required fields
  │    │    ├─ Validate startPosition.direction ∈ {up,down,left,right}
  │    │    ├─ Validate maps non-empty & contains startMapId
  │    │    └─ Return std::optional<ProjectData>
  │    ├─ Logger::info("Project loaded: <title>")
  │    ├─ Window::initialize(800, 600, title)
  │    │    ├─ SDL_Init(SDL_INIT_VIDEO)
  │    │    ├─ SDL_CreateWindow(...)
  │    │    └─ SDL_CreateRenderer(...)
  │    ├─ Renderer2D::initialize(window)
  │    └─ Game::initialize(window, projectData)
  │         ├─ GameState.setCurrentMap(startMapId)
  │         ├─ GameState.setPlayerPosition(x, y, dir)
  │         └─ EventRunner(gameState, dialogueSystem)
  ├─ app.run()  [game loop]
  │    └─ while(isRunning):
  │         ├─ Window::processEvents(quit) → set isRunning=false on SDL_QUIT
  │         ├─ InputManager::update()
  │         ├─ dt = calculateDeltaTime()
  │         ├─ Game::update(input, dt)
  │         ├─ IRenderer::beginFrame()
  │         ├─ Game::render(renderer)
  │         ├─ IRenderer::endFrame()
  │         └─ SDL_Delay(frameDelay)
  ├─ app.shutdown()
  │    ├─ Renderer2D::shutdown()
  │    └─ Window::shutdown() → SDL_Quit
  └─ Logger::info("RPG Creator Runtime shut down.")
```

## Components and Interfaces

### 1. Build System (`CMakeLists.txt`)

**Responsibility:** Orquestar dependencias, compilación y tests.

**Design decisions:**
- `cmake_minimum_required(VERSION 3.15)` para compatibilidad con FetchContent.
- C++20 obligatorio con extensiones desactivadas. Se añade una guarda post-configuración que emite `FATAL_ERROR` si `CMAKE_CXX_EXTENSIONS` es sobrescrito externamente.
- Tres dependencias vía FetchContent: `nlohmann/json v3.11.3`, `doctest v2.4.11`, `SDL2 release-2.28.5` (estática).
- Verificación explícita de targets con `if(NOT TARGET ...)` + `message(FATAL_ERROR ...)` tras `FetchContent_MakeAvailable`.
- `RuntimeLib` como librería estática que agrega todos los `.cpp` de `src/` (excepto `main.cpp`).
- Ejecutable `rpg_creator_runtime` enlaza solo contra `RuntimeLib`.
- Web artifacts excluidos implícitamente (no se referencian en ningún target CMake).

**Requirement mapping:** Requirement 1 (AC 1–15)

### 2. Entry Point (`src/main.cpp`)

**Responsibility:** Única función `main` que delega en `Application`.

**Design decisions:**
- Patrón: instanciar `Application`, llamar `initialize()` → `run()` → `shutdown()`.
- Si `initialize()` retorna `false`, se omite `run()` y se sale con código ≠ 0.
- Bloque `try/catch(std::exception&)` envuelve todo; en catch se llama `Logger::error` y se retorna código ≠ 0.
- Mensajes de log: `Logger::info("RPG Creator Runtime starting...")` al inicio. `Logger::info("RPG Creator Runtime shut down.")` solo tras `run()` + `shutdown()` exitosos. No se emite mensaje de shutdown si `initialize()` falla.

**Requirement mapping:** Requirement 2 (AC 1–6)

### 3. `ProjectLoader` (`src/world/ProjectLoader.h/.cpp`)

**Responsibility:** Leer y validar estrictamente `project.json`.

**Interface:**
```cpp
class ProjectLoader {
public:
    static std::optional<ProjectData> load(const std::string& path);
};
```

**Validation pipeline (orden secuencial, falla en el primer error):**
1. Abrir archivo → si falla: `Logger::error` + `nullopt`
2. Parsear JSON → si falla: `Logger::error` con detalle de parseo + `nullopt`
3. Verificar campos obligatorios: `schemaVersion`, `title`, `startMapId`, `startPosition` (con `x`, `y`, `direction`), `maps`, `database.items` → si falta alguno: `Logger::error` identificando campo + `nullopt`
4. `schemaVersion` debe ser entero positivo → si no: error + `nullopt`
5. `schemaVersion` debe ser exactamente `1` → si no: error con versión soportada vs recibida + `nullopt`
6. `startPosition.direction` ∈ `{"up","down","left","right"}` → si no: error citando valor inválido + `nullopt`
7. `maps` no vacío y contiene entrada con `id == startMapId` → si no: error describiendo inconsistencia + `nullopt`
8. Construir y retornar `ProjectData` poblado.

**Design decisions:**
- No lanza excepciones al llamador; todo error retorna `nullopt`.
- Usa `nlohmann::json` con acceso por `.at()` dentro de bloques try internos para capturar `json::exception`.
- El campo `database.items` en el JSON se mapea a `ProjectData::database.itemsPath`.

**Requirement mapping:** Requirement 3 (AC 1–9)

### 4. `Window` (`src/platform/Window.h/.cpp`)

**Responsibility:** Encapsular la creación/destrucción de SDL_Window y SDL_Renderer.

**Interface (existente, se mantiene):**
```cpp
class Window {
public:
    bool initialize(int width, int height, const char* title);
    void shutdown();
    void processEvents(bool& quitOut);
    SDL_Window* getSDLWindow() const;
    SDL_Renderer* getSDLRenderer() const;
    const unsigned char* getKeyboardState() const;
private:
    SDL_Window* window = nullptr;
    SDL_Renderer* renderer = nullptr;
};
```

**Design decisions:**
- `initialize`: llama `SDL_Init(SDL_INIT_VIDEO)`, `SDL_CreateWindow`, `SDL_CreateRenderer`. Si cualquier paso falla, libera recursos parciales, loguea `SDL_GetError()` y retorna `false`.
- `shutdown`: destruye renderer, destruye window, llama `SDL_Quit`.
- `processEvents`: itera `SDL_PollEvent`; si detecta `SDL_QUIT`, marca `quitOut = true`.

**Requirement mapping:** Requirement 4 (AC 4–5, 7), Requirement 5 (AC 4)

### 5. `Application` (`src/core/Application.h/.cpp`)

**Responsibility:** Orquestar inicialización, bucle principal y apagado.

**Design decisions:**
- Posee por valor: `Window`, `InputManager`, `Renderer2D`.
- Posee por `unique_ptr`: `Game`.
- `initialize()`:
  1. `ProjectLoader::load("data/project.json")` → si `nullopt`, `Logger::error` + return false
  2. `Logger::info` indicando éxito de carga
  3. `window.initialize(800, 600, projectData.title.c_str())` → si false, return false
  4. `renderer.initialize(window)` → si false, return false
  5. `game = make_unique<Game>(); game->initialize(window, projectData)` → si false, return false
  6. `isRunning = true; return true`
- `run()`: bucle con delta-time, frame cap ~60fps vía `SDL_Delay`.
- `shutdown()`: idempotente/no-op safe. Llama `renderer.shutdown()` antes de `window.shutdown()`. Cada subsistema verifica internamente si fue inicializado antes de liberar recursos. Es seguro llamar `shutdown()` incluso si `initialize()` falló parcialmente.
- No accede a APIs SDL directamente; delega en `Window`, `InputManager`, `Renderer2D`.

**Requirement mapping:** Requirement 4 (AC 1–3, 6, 8), Requirement 5 (AC 1–6), Requirement 7 (AC 4–5)

### 6. Game Loop (dentro de `Application::run()`)

**Responsibility:** Iterar procesando ventana, input, lógica y render.

**Per-frame sequence:**
```
1. window.processEvents(quit)  → if quit: isRunning = false, skip render, break
2. inputManager.update(window)
3. dt = (SDL_GetTicks() - lastTick) / 1000.0f; lastTick = currentTick
4. game->update(inputManager, dt)
5. renderer.beginFrame()
6. game->render(renderer)
7. renderer.endFrame()
8. SDL_Delay(frameDelay)  // frameDelay ≈ 16ms para ~60fps
```

**Requirement mapping:** Requirement 5 (AC 1–6)

### 7. `Game` (`src/core/Game.h/.cpp`)

**Responsibility:** Propietario del estado de juego y costuras arquitectónicas.

**Design decisions:**
- Posee por valor: `GameState`, `DialogueSystem`, `MapScene`, `Camera2D`, `ProjectData`.
- Posee por `unique_ptr`: `EventRunner`.
- `initialize(window, projectData)`:
  - Almacena `projectData`.
  - Inicializa `GameState` con `startMapId` y `startPosition` del `ProjectData`.
  - Construye `EventRunner` con referencias a `gameState` y `dialogueSystem`.
  - No carga mapas ni items con valores literales; usa rutas de `ProjectData`.
- `update(input, dt)`: delega en subsistemas. Usa `CollisionSystem::canMoveTo` para movimiento.
- `render(IRenderer&)`: recibe interfaz abstracta, no tipo concreto SDL. Solo llama métodos de render (`renderMap`, `renderEntities`, `renderDialogue`). NO llama `beginFrame()`/`endFrame()` — eso es responsabilidad de `Application`.
- Carga de mapas vía `MapLoader::load(path)` usando rutas de `ProjectData::maps`.
- Carga de items vía `ItemDatabase::load(path)` usando `ProjectData::database.itemsPath`.

**Requirement mapping:** Requirement 6 (AC 1–9)

### 8. `EventRunner` (`src/events/EventRunner.h/.cpp`)

**Responsibility:** Ejecutar comandos de evento secuencialmente desde JSON.

**Design decisions:**
- Construido con referencias a `GameState` y `DialogueSystem`.
- Procesa solo `EventCommand` provenientes de `MapData` cargado desde JSON.
- Si encuentra un `type` no soportado: `Logger::warning` con el type desconocido, continúa con el siguiente comando.

**Requirement mapping:** Requirement 6 (AC 7–8)

### 9. `Logger` (`src/core/Logger.h/.cpp`)

**Responsibility:** Diagnóstico uniforme por consola.

**Interface (existente, se mantiene):**
```cpp
class Logger {
public:
    static void info(const std::string& message);    // → stdout, prefijo [INFO]
    static void warning(const std::string& message); // → stderr, prefijo [WARN]
    static void error(const std::string& message);   // → stderr, prefijo [ERROR]
};
```

**Requirement mapping:** Requirement 7 (AC 1–3)

### 10. Test Suite (`tests/`)

**Responsibility:** Verificación automatizada del bootstrap.

**Design decisions:**
- Ejecutable `rpg_tests` enlazado contra `RuntimeLib` y `doctest::doctest`.
- Registrado como `add_test(NAME RPGTests COMMAND rpg_tests)`.
- Archivo `tests/test_project_loader.cpp` con casos:
  - Carga exitosa de `data/project.json`: verifica `schemaVersion`, `title`, `startMapId`, `startPosition.x`, `startPosition.y`, `startPosition.direction`, cantidad de `maps`.
  - `schemaVersion` distinto de 1 → `nullopt`.
  - Campo obligatorio ausente → `nullopt`.
- Los tests de `ProjectLoader` no requieren SDL (no hay dependencia gráfica).

**Requirement mapping:** Requirement 8 (AC 1–5)

## Data Models

### `ProjectData` (existente en `src/types/ProjectTypes.h`)

```cpp
struct StartPosition {
    Vec2i pos;          // {x, y}
    Direction direction; // Up|Down|Left|Right
};

struct MapReference {
    std::string id;
    std::string path;
};

struct DatabaseReference {
    std::string itemsPath;
};

struct ProjectData {
    int schemaVersion;
    std::string title;
    std::string startMapId;
    StartPosition startPosition;
    std::vector<MapReference> maps;
    DatabaseReference database;
};
```

### `project.json` Schema (Fase 1, schemaVersion=1)

```json
{
  "schemaVersion": 1,
  "title": "string",
  "startMapId": "string (must match a maps[].id)",
  "startPosition": {
    "x": "integer",
    "y": "integer",
    "direction": "up|down|left|right"
  },
  "maps": [
    { "id": "string", "path": "string" }
  ],
  "database": {
    "items": "string (path to items.json)"
  }
}
```

## Error Handling

| Scenario | Handler | Behavior |
|----------|---------|----------|
| `project.json` not found | `ProjectLoader::load` | `Logger::error` con ruta, retorna `nullopt` |
| JSON syntax error | `ProjectLoader::load` | `Logger::error` con detalle de parseo, retorna `nullopt` |
| Campo obligatorio ausente | `ProjectLoader::load` | `Logger::error` identificando campo, retorna `nullopt` |
| `schemaVersion` ≠ 1 | `ProjectLoader::load` | `Logger::error` con versión soportada vs recibida, retorna `nullopt` |
| `direction` inválida | `ProjectLoader::load` | `Logger::error` citando valor, retorna `nullopt` |
| `startMapId` no en `maps` | `ProjectLoader::load` | `Logger::error` describiendo inconsistencia, retorna `nullopt` |
| `SDL_Init` falla | `Window::initialize` | Libera recursos parciales, `Logger::error` con `SDL_GetError()`, retorna `false` |
| `SDL_CreateWindow` falla | `Window::initialize` | Libera recursos parciales, `Logger::error` con `SDL_GetError()`, retorna `false` |
| `SDL_CreateRenderer` falla | `Window::initialize` | Destruye window, `Logger::error` con `SDL_GetError()`, retorna `false` |
| Excepción `std::exception` en main | `main()` | `Logger::error` con `e.what()`, exit code ≠ 0 |
| Tipo de evento no soportado | `EventRunner::processCommand` | `Logger::warning` con type desconocido, continúa ejecución |
| FetchContent falla | CMake configure | `message(FATAL_ERROR ...)` identificando dependencia |

**Principio general:** Ningún componente lanza excepciones a su llamador. Los errores se comunican mediante valores de retorno (`std::optional`, `bool`) y se diagnostican vía `Logger`.

## Correctness Properties

### Property 1: Ordered Initialization
La secuencia `ProjectLoader → Window → Renderer → Game` es estricta; si cualquier paso falla, los posteriores no se ejecutan y los recursos parciales se liberan.

**Validates: Requirements 4.2**

### Property 2: SDL Isolation
`Game`, `Application` (lógica), `EventRunner`, `GameState` no incluyen headers SDL ni llaman APIs SDL directamente. Solo `Window`, `InputManager` y `Renderer2D` acceden a APIs SDL.

**Validates: Requirements 4.8**

### Property 3: No Hardcoded Game Data
Ningún archivo `.cpp` contiene identificadores de mapa, evento, ítem o flag como literales de cadena (excepto la ruta por defecto `"data/project.json"`).

**Validates: Requirements 6.9**

### Property 4: Clear Ownership
Cada recurso tiene un único propietario que lo crea y destruye (RAII o destrucción explícita en `shutdown`).

**Validates: Requirements 4.6, 4.7**

### Property 5: Frame Ordering
Cada frame ejecuta exactamente: events → input → update → beginFrame → render → endFrame → delay.

**Validates: Requirements 5.2**

### Property 6: Graceful Shutdown
`SDL_QUIT` marca `isRunning = false`; el frame actual no renderiza; `shutdown()` se ejecuta siempre (incluso tras `initialize()` fallido, es no-op seguro).

**Validates: Requirements 5.4, 5.5**

## Testing Strategy

| Test Case | File | Validates |
|-----------|------|-----------|
| Carga válida de `project.json` | `tests/test_project_loader.cpp` | Campos `schemaVersion`, `title`, `startMapId`, `startPosition.x/y/direction`, `maps.size()` |
| `schemaVersion` distinto de 1 | `tests/test_project_loader.cpp` | Retorna `nullopt` |
| Campo obligatorio ausente | `tests/test_project_loader.cpp` | Retorna `nullopt` |
| `startMapId` no presente en `maps` | `tests/test_project_loader.cpp` | Retorna `nullopt` |
| `direction` inválida | `tests/test_project_loader.cpp` | Retorna `nullopt` |
| JSON inválido (syntax error) | `tests/test_project_loader.cpp` | Retorna `nullopt` |
| Archivo inexistente | `tests/test_project_loader.cpp` | Retorna `nullopt` |

**Framework:** doctest v2.4.11 vía FetchContent.
**Ejecución:** `ctest --test-dir build --output-on-failure` ejecuta `RPGTests`.
**Nota:** Los tests de `ProjectLoader` son puramente lógicos (no requieren SDL), lo que permite ejecutarlos en CI sin display.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| FetchContent para todas las dependencias | Elimina instalación manual; build reproducible con un solo comando |
| RuntimeLib como librería estática | Permite reutilizar el código compilado tanto en el ejecutable como en tests sin recompilar |
| Validación secuencial en ProjectLoader | Falla rápido en el primer error con mensaje claro; evita cascadas de errores confusos |
| `std::optional` como retorno de carga | Patrón idiomático C++17 que evita excepciones en la interfaz pública |
| Window encapsula todo SDL | Aísla dependencia de plataforma; `Game` y `Application` no tocan SDL directamente |
| IRenderer como interfaz abstracta | Permite futura implementación HD-2D sin modificar lógica de juego |
| Game posee subsistemas por composición | Evita singletons; facilita testing y razonamiento sobre ownership |
| Frame cap con SDL_Delay | Solución simple y suficiente para Fase 1; evitable en fases futuras con vsync o timer de alta resolución |
| No hardcodear datos de juego en C++ | Principio arquitectónico central: el engine interpreta datos, no los contiene |

## Requirement Traceability

| Requirement | Components | Key Files |
|-------------|-----------|-----------|
| Req 1: Build System | CMakeLists.txt, tests/CMakeLists.txt | `CMakeLists.txt`, `tests/CMakeLists.txt` |
| Req 2: Entry Point | main.cpp, Application | `src/main.cpp`, `src/core/Application.h/.cpp` |
| Req 3: ProjectLoader | ProjectLoader, ProjectData | `src/world/ProjectLoader.h/.cpp`, `src/types/ProjectTypes.h` |
| Req 4: SDL Window | Window, Application | `src/platform/Window.h/.cpp`, `src/core/Application.cpp` |
| Req 5: Game Loop | Application | `src/core/Application.cpp` |
| Req 6: Architectural Seams | Game, GameState, EventRunner, CollisionSystem, IRenderer | `src/core/Game.h/.cpp`, `src/events/`, `src/world/CollisionSystem.h/.cpp`, `src/renderer/IRenderer.h` |
| Req 7: Logging | Logger, Application | `src/core/Logger.h/.cpp`, `src/core/Application.cpp` |
| Req 8: Tests | test_project_loader | `tests/test_project_loader.cpp`, `tests/CMakeLists.txt` |

## File Changes

### Modified Files

| File | Change |
|------|--------|
| `CMakeLists.txt` | Añadir verificación de targets post-FetchContent (`if(NOT TARGET ...)`), guarda contra sobrescritura de `CMAKE_CXX_EXTENSIONS` |
| `src/main.cpp` | Reescribir con patrón Application + try/catch + Logger messages |
| `src/core/Application.cpp` | Implementar `initialize()` con pipeline ProjectLoader → Window → Renderer → Game; implementar `run()` con game loop y frame cap; implementar `shutdown()` |
| `src/core/Game.cpp` | Implementar `initialize()` inicializando GameState desde ProjectData sin literales; conectar EventRunner con GameState y DialogueSystem |
| `src/world/ProjectLoader.cpp` | Implementar validación estricta completa (pipeline de 8 pasos) |
| `src/platform/Window.cpp` | Implementar `initialize` con SDL_Init + creación + cleanup parcial en error; `shutdown` con destrucción ordenada; `processEvents` con detección SDL_QUIT |
| `src/core/Logger.cpp` | Implementar `info` → stdout con `[INFO]`, `warning` → stderr con `[WARN]`, `error` → stderr con `[ERROR]` |
| `src/renderer/Renderer2D.cpp` | Implementar `initialize`, `beginFrame` (clear), `endFrame` (present), `shutdown` |
| `src/events/EventRunner.cpp` | Añadir `Logger::warning` para tipos de comando no soportados |
| `tests/test_project_loader.cpp` | Añadir/actualizar casos: carga válida, schemaVersion inválido, campo ausente |

### New Files

| File | Purpose |
|------|---------|
| Ninguno | Todos los archivos necesarios ya existen en el repositorio |

### Unchanged Files (referenced but not modified)

| File | Reason |
|------|--------|
| `src/core/Application.h` | Declaración ya correcta |
| `src/core/Game.h` | Declaración ya correcta |
| `src/types/ProjectTypes.h` | Estructura ya correcta |
| `src/renderer/IRenderer.h` | Interfaz ya correcta |
| `src/world/ProjectLoader.h` | Firma ya correcta |
| `src/platform/Window.h` | Declaración ya correcta |
| `src/core/Logger.h` | Declaración ya correcta |
| `src/world/CollisionSystem.h` | API ya correcta |
| `src/events/EventRunner.h` | Declaración ya correcta |
| `src/events/GameState.h` | Declaración ya correcta |
| `src/types/Direction.h` | Helpers ya correctos |
| `src/types/Vec2i.h` | Struct ya correcta |
| `data/project.json` | Archivo de datos válido existente |
| `tests/CMakeLists.txt` | Configuración ya correcta |
