# Requirements Document

## Introduction

Este documento define los requisitos del **bootstrap de la Fase 1** del *RPG Creator Runtime*, un ejecutable nativo en C++20 que interpreta proyectos definidos íntegramente en JSON. El alcance del entregable de hoy se limita a poner en pie la columna vertebral del runtime: configurar el sistema de build con CMake y FetchContent, levantar el punto de entrada (`src/main.cpp` → `Application` → bucle principal), cargar y validar de forma estricta `project.json` mediante `ProjectLoader`, abrir una ventana nativa SDL al validarse el proyecto, y conectar los puntos de costura arquitectónicos (`GameState`, `EventRunner`, `CollisionSystem`, `IRenderer`) sin codificar a mano comportamiento de mapa o de eventos.

Quedan **explícitamente fuera de este entregable**: la implementación concreta del renderizado de tiles/entidades, el bucle de input/movimiento del jugador, la ejecución de comandos de evento (`showText`, `transferMap`, etc.), el `SaveManager`, el sistema de diálogos visual, la base de datos de items y cualquier capa web/React presente en el repositorio por iteraciones previas (que debe ser ignorada).

## Glossary

- **Runtime**: Ejecutable nativo `rpg_creator_runtime` resultante del build CMake.
- **Build_System**: Configuración CMake raíz que orquesta dependencias, librería estática `RuntimeLib`, ejecutable `rpg_creator_runtime` y suite de tests.
- **Application**: Clase `Application` (en `src/core/`) que orquesta inicialización, bucle principal y apagado.
- **Game_Loop**: Bucle implementado en `Application::run()` que itera procesando eventos de ventana, input, lógica y render hasta recibir señal de salida.
- **Game**: Clase `Game` (en `src/core/`) propietaria del estado de juego, escena activa, dialogue system y `EventRunner`; recibe `IRenderer` por interfaz al renderizar.
- **Project_Loader**: Componente estático `ProjectLoader::load(path)` que lee y valida `project.json`.
- **Project_Data**: Estructura `ProjectData` (en `src/types/ProjectTypes.h`) que representa el `project.json` parseado.
- **Project_File**: Archivo de entrada `data/project.json` conforme al esquema descrito en `docs/DATA_FORMAT.md`.
- **SDL_Window**: Ventana nativa creada vía SDL2 a través de la clase `Window` (en `src/platform/`).
- **IRenderer**: Interfaz abstracta de renderizado (`src/renderer/IRenderer.h`); su implementación concreta para Fase 1 es `Renderer2D` sobre SDL.
- **Game_State**: Clase `GameState` que aloja `flags`, `variables`, `inventory`, mapa actual y posición del jugador.
- **Event_Runner**: Clase `EventRunner` que procesa secuencialmente listas de `EventCommand`.
- **Collision_System**: Clase `CollisionSystem` con la API `canMoveTo(scene, x, y)`.
- **Logger**: Clase `Logger` (`info`, `warning`, `error`) para diagnóstico por consola.
- **FetchContent**: Mecanismo de CMake para descargar dependencias en tiempo de configuración.
- **Schema_Version**: Campo entero `schemaVersion` presente en `project.json`; valor soportado en Fase 1 es `1`.
- **Web_Artifacts**: Archivos del prototipo previo en AI Studio (`index.html`, `package.json`, `vite.config.ts`, `tsconfig.json`, `src/App.tsx`, `src/main.tsx`, `src/index.css`) que no forman parte del runtime nativo.

## Requirements

### Requirement 1: Configuración del sistema de build con CMake y FetchContent

**User Story:** Como desarrollador, quiero un `CMakeLists.txt` raíz que descargue dependencias automáticamente, para poder compilar el runtime y los tests con un único comando sin instalación manual previa.

#### Acceptance Criteria

1. THE Build_System SHALL declarar `cmake_minimum_required(VERSION 3.15)` o superior.
2. THE Build_System SHALL fijar el estándar a C++20 con `CMAKE_CXX_STANDARD_REQUIRED` activo y `CMAKE_CXX_EXTENSIONS` desactivado.
2a. IF un `CMakeLists.txt` padre o configuración externa intenta sobrescribir `CMAKE_CXX_EXTENSIONS` a un valor distinto de `OFF` después de la configuración del Build_System, THEN THE Build_System SHALL detener la configuración con `message(FATAL_ERROR ...)` identificando el conflicto.
3. THE Build_System SHALL declarar la dependencia `nlohmann/json` versión `v3.11.3` mediante `FetchContent_Declare` y exponerla con `FetchContent_MakeAvailable` bajo el target `nlohmann_json::nlohmann_json`.
4. THE Build_System SHALL declarar la dependencia `doctest` versión `v2.4.11` mediante `FetchContent_Declare` y exponerla con `FetchContent_MakeAvailable` bajo el target `doctest::doctest`.
5. THE Build_System SHALL declarar la dependencia `SDL2` en el tag `release-2.28.5` mediante `FetchContent_Declare` y exponerla como librería estática `SDL2-static`.
6. THE Build_System SHALL definir una librería estática `RuntimeLib` que agregue los archivos `.cpp` de `src/core/`, `src/platform/`, `src/renderer/`, `src/world/`, `src/events/`, `src/dialogue/`, `src/save/` y `src/database/`.
7. THE Build_System SHALL exponer `src/` como directorio de includes públicos del target `RuntimeLib`.
8. THE Build_System SHALL enlazar `RuntimeLib` con `nlohmann_json::nlohmann_json` y `SDL2-static` como dependencias públicas.
9. THE Build_System SHALL definir un ejecutable `rpg_creator_runtime` cuyo único `.cpp` directo sea `src/main.cpp` y que enlace contra `RuntimeLib`.
10. THE Build_System SHALL habilitar `enable_testing()` e incluir `tests/` mediante `add_subdirectory(tests)`.
11. THE Build_System SHALL excluir de la compilación nativa todos los Web_Artifacts del repositorio.
12. WHEN se ejecuta `cmake -S . -B build` seguido de `cmake --build build` en un entorno con compilador C++20 disponible, THE Build_System SHALL completar la configuración y la compilación sin errores.
13. WHEN se ejecuta `ctest --test-dir build --output-on-failure` tras una compilación exitosa, THE Build_System SHALL ejecutar la suite `RPGTests` definida en `tests/CMakeLists.txt`.
14. IF `FetchContent` no logra descargar alguna dependencia declarada, THEN THE Build_System SHALL detener la configuración con un mensaje de error de CMake que identifique la dependencia afectada, sin considerar la disponibilidad de dicha dependencia en paquetes del sistema o instalaciones locales.
15. WHEN finalizan las llamadas a `FetchContent_MakeAvailable` para `nlohmann/json`, `doctest` y `SDL2`, THE Build_System SHALL verificar de forma explícita que los targets `nlohmann_json::nlohmann_json`, `doctest::doctest` y `SDL2-static` existen, mediante `if(NOT TARGET ...)` seguido de `message(FATAL_ERROR ...)`, antes de declarar `RuntimeLib`.

### Requirement 2: Punto de entrada del ejecutable

**User Story:** Como desarrollador, quiero un `main.cpp` mínimo que delegue toda la lógica en `Application`, para mantener una única ruta de inicialización y apagado del runtime.

#### Acceptance Criteria

1. THE Runtime SHALL exponer una única función `int main(int argc, char* argv[])` definida en `src/main.cpp`.
2. WHEN el proceso arranca, THE Runtime SHALL instanciar exactamente un objeto `Application` y delegar el ciclo de vida en sus métodos `initialize()`, `run()` y `shutdown()`, en ese orden.
3. IF `Application::initialize()` retorna `false`, THEN THE Runtime SHALL omitir la invocación de `Application::run()` y SHALL terminar el proceso con un código de salida distinto de cero, sin excepciones.
4. WHEN `Application::initialize()` retorna `true` y `Application::run()` finaliza por solicitud de cierre del usuario, THE Runtime SHALL invocar `Application::shutdown()` y terminar el proceso con código de salida cero.
5. IF una excepción derivada de `std::exception` propaga hasta `main`, THEN THE Runtime SHALL registrar el mensaje de la excepción mediante `Logger::error` y terminar el proceso con un código de salida distinto de cero.
6. THE Runtime SHALL emitir mediante `Logger::info` un mensaje de inicio antes de instanciar `Application` y un mensaje de cierre tras `Application::shutdown()`.

### Requirement 3: Carga estricta de `project.json`

**User Story:** Como desarrollador del engine, quiero que `ProjectLoader` valide estrictamente `project.json` y falle de forma explícita ante errores, para evitar estados inconsistentes en tiempo de ejecución.

#### Acceptance Criteria

1. THE Project_Loader SHALL exponer la firma estática `std::optional<ProjectData> load(const std::string& path)`.
2. WHEN se invoca `Project_Loader::load(path)` con una ruta a un Project_File válido, THE Project_Loader SHALL retornar un `std::optional<ProjectData>` con valor presente y los campos `schemaVersion`, `title`, `startMapId`, `startPosition` (`x`, `y`, `direction`), `maps` (lista de pares `id`/`path`) y `database.items` poblados conforme al contenido del archivo.
3. IF el archivo indicado no existe o no puede leerse, THEN THE Project_Loader SHALL retornar `std::nullopt` y registrar un mensaje de error mediante `Logger::error` que incluya la ruta solicitada.
4. IF el contenido del archivo no es JSON sintácticamente válido, THEN THE Project_Loader SHALL retornar `std::nullopt` y registrar un mensaje de error mediante `Logger::error` que incluya la descripción del fallo de parseo.
5. IF falta cualquiera de los campos obligatorios `schemaVersion`, `title`, `startMapId`, `startPosition.x`, `startPosition.y`, `startPosition.direction`, `maps` o `database.items` en el JSON, THEN THE Project_Loader SHALL retornar `std::nullopt` y registrar un mensaje de error mediante `Logger::error` que identifique el campo ausente.
6. IF el campo `schemaVersion` del Project_File no es un entero positivo (es decir, es menor o igual a cero o no es un entero), THEN THE Project_Loader SHALL retornar `std::nullopt` y registrar un mensaje de error mediante `Logger::error` indicando que `schemaVersion` debe ser un entero positivo.
6a. IF el campo `schemaVersion` del Project_File es un entero positivo distinto de `1`, THEN THE Project_Loader SHALL retornar `std::nullopt` y registrar un mensaje de error mediante `Logger::error` indicando la versión soportada y la versión recibida.
7. IF el campo `startPosition.direction` está ausente del Project_File, THEN THE Project_Loader SHALL retornar `std::nullopt` y registrar un mensaje de error mediante `Logger::error` que identifique el campo ausente, conforme al criterio 5.
7a. IF el campo `startPosition.direction` está presente y contiene un valor distinto de `"up"`, `"down"`, `"left"` o `"right"`, THEN THE Project_Loader SHALL retornar `std::nullopt` y registrar un mensaje de error mediante `Logger::error` que cite el valor inválido.
8. IF la lista `maps` está vacía o no contiene una entrada cuyo `id` coincida con `startMapId`, THEN THE Project_Loader SHALL retornar `std::nullopt` y registrar un mensaje de error mediante `Logger::error` que describa la inconsistencia.
9. THE Project_Loader SHALL operar sin lanzar excepciones al llamador para ninguno de los casos de error definidos en los criterios 3 a 8, retornando siempre `std::nullopt` ante cualquier condición de fallo.

### Requirement 4: Apertura de la ventana nativa SDL tras la validación

**User Story:** Como jugador, quiero que el runtime abra una ventana nativa solo cuando el proyecto se haya cargado correctamente, para no ver una ventana huérfana ante un proyecto inválido.

#### Acceptance Criteria

1. WHEN `Application::initialize()` se ejecuta, THE Application SHALL invocar `Project_Loader::load("data/project.json")` antes de inicializar la ventana.
2. IF `Project_Loader::load` retorna `std::nullopt`, O IF `Window::initialize` retorna `false`, O IF `Renderer2D::initialize` retorna `false`, O IF `Game::initialize` retorna `false`, THEN THE Application SHALL retornar `false` desde `Application::initialize()` y SHALL no proceder con la siguiente etapa de inicialización.
3. WHEN `Project_Loader::load` retorna un `ProjectData` válido, THE Application SHALL invocar `Window::initialize(width, height, title)` con dimensiones por defecto `800` × `600` y `title` igual al campo `ProjectData::title` antes de invocar `Renderer2D::initialize` y `Game::initialize`.
3a. WHERE existan validaciones intermedias adicionales entre la carga del proyecto y la creación de la SDL_Window, THE Application SHALL ejecutarlas antes de invocar `Window::initialize` y SHALL abortar la inicialización si alguna falla.
4. WHEN `Window::initialize` se invoca, THE Window SHALL crear una SDL_Window y un `SDL_Renderer` reales mediante SDL2 y retornar `true` solo si ambos recursos se crearon con éxito, y SHALL retornar `false` en cualquier otro caso, garantizando que el valor de retorno refleja con exactitud el estado de creación de ambos recursos SDL.
5. IF `SDL_Init` o la creación de la SDL_Window o del `SDL_Renderer` falla, THEN THE Window SHALL liberar cualquier recurso parcial adquirido, registrar el error mediante `Logger::error` con el detalle de `SDL_GetError()` y retornar `false`.
6. WHEN `Application::shutdown()` se ejecuta, THE Application SHALL invocar `Renderer2D::shutdown()` antes de `Window::shutdown()`.
7. WHEN `Window::shutdown` se ejecuta, THE Window SHALL destruir el `SDL_Renderer` y la SDL_Window y finalizar SDL mediante `SDL_Quit`.
8. THE Application SHALL evitar cualquier acceso a APIs de SDL fuera de las clases `Window`, `InputManager` y `Renderer2D`.

### Requirement 5: Ciclo de vida del bucle principal

**User Story:** Como desarrollador, quiero un bucle principal estable que separe procesamiento de ventana, input, actualización y render, para sostener la arquitectura de Fase 1 sobre fundamentos correctos.

#### Acceptance Criteria

1. WHEN `Application::run()` se ejecuta, THE Game_Loop SHALL iterar mientras una bandera interna `isRunning` sea verdadera.
2. ON cada iteración del Game_Loop, THE Game_Loop SHALL ejecutar en este orden: procesado de eventos de ventana, actualización de `InputManager`, llamada a `Game::update`, llamada a `IRenderer::beginFrame`, llamada a `Game::render(IRenderer&)`, llamada a `IRenderer::endFrame`.
3. ON cada iteración del Game_Loop, THE Game_Loop SHALL calcular el delta-time `dt` en segundos a partir de `SDL_GetTicks()` y pasarlo a `Game::update`.
4. WHEN el usuario solicita el cierre de la SDL_Window (evento `SDL_QUIT` o cierre de la ventana del sistema operativo), THE Window SHALL marcar la bandera `isRunning` como falsa antes de la siguiente iteración del Game_Loop.
5. WHILE la bandera `isRunning` sea falsa, THE Game_Loop SHALL no ejecutar la fase de render de la iteración actual y SHALL salir del bucle.
6. THE Game_Loop SHALL operar a un objetivo aproximado de 60 fotogramas por segundo mediante un mecanismo de espera explícito (por ejemplo `SDL_Delay`).

### Requirement 6: Costuras arquitectónicas sin comportamiento hardcodeado

**User Story:** Como arquitecto del runtime, quiero que `GameState`, `EventRunner`, `CollisionSystem` e `IRenderer` queden conectados al `Game` por composición, para mantener la regla de que ningún mapa o evento esté codificado en C++.

#### Acceptance Criteria

1. THE Game SHALL poseer una instancia de `GameState` y exponerla a `EventRunner` por referencia.
2. THE Game SHALL poseer una instancia de `EventRunner` construida con referencias a `GameState` y al `DialogueSystem`.
3. THE Game SHALL invocar a `Collision_System::canMoveTo` como única vía para evaluar si una posición destino es transitable.
4. THE Game SHALL recibir una referencia a `IRenderer` en su método `render` y SHALL no depender de tipos concretos de SDL en su firma pública.
5. WHEN `Game::initialize` se invoca con un `ProjectData` válido, THE Game SHALL inicializar `GameState` con el `startMapId` y la `startPosition` provenientes de `ProjectData` y SHALL no asignar ningún mapa, evento, ítem o flag con valores literales codificados en C++.
6. THE Game SHALL cargar los datos de cada mapa exclusivamente a través de `MapLoader::load` usando las rutas declaradas en `ProjectData::maps`, los datos de items exclusivamente a través de `ItemDatabase::load` usando la ruta declarada en `ProjectData::database.itemsPath`, y los textos de diálogo exclusivamente a partir de `EventCommand` provenientes de JSON.
7. THE Event_Runner SHALL ejecutar comandos exclusivamente a partir de las listas `EventCommand` provenientes de `MapData` cargado desde JSON.
8. IF un comando de evento contiene un `type` no soportado por la Fase 1, THEN THE Event_Runner SHALL registrar una advertencia mediante `Logger::warning` que incluya el `type` desconocido y SHALL continuar con el siguiente comando.
9. THE Runtime SHALL no contener literales de cadena en archivos `.cpp` que representen identificadores de mapa, identificadores de evento, identificadores de ítem o nombres de flag de juego, exceptuando la ruta por defecto del Project_File `"data/project.json"`.

### Requirement 7: Diagnóstico mediante logging

**User Story:** Como desarrollador, quiero un canal de log uniforme para los eventos del bootstrap, para diagnosticar fallos de carga, inicialización SDL o configuración de proyecto desde la consola.

#### Acceptance Criteria

1. THE Logger SHALL exponer las funciones estáticas `info`, `warning` y `error`, cada una recibiendo un `std::string`.
2. WHEN `Logger::info` se invoca, THE Logger SHALL escribir el mensaje en `stdout` precedido de una etiqueta de nivel reconocible (por ejemplo `[INFO]`).
3. WHEN `Logger::warning` o `Logger::error` se invoca, THE Logger SHALL escribir el mensaje en `stderr` precedido de una etiqueta de nivel reconocible (`[WARN]` o `[ERROR]` respectivamente).
4. THE Application SHALL emitir un mensaje `Logger::info` indicando éxito tras la carga del Project_File, antes de la creación de la SDL_Window.
5. THE Application SHALL emitir un mensaje `Logger::error` con causa identificable ante cualquier fallo de inicialización (carga de proyecto, ventana o renderer).

### Requirement 8: Verificación automatizada del bootstrap

**User Story:** Como desarrollador, quiero pruebas unitarias que blinden el contrato de `ProjectLoader` y la presencia del bootstrap, para detectar regresiones en cuanto se introduzcan.

#### Acceptance Criteria

1. THE Build_System SHALL incluir un ejecutable de pruebas `rpg_tests` enlazado contra `RuntimeLib` y `doctest::doctest`.
2. WHEN `ctest` ejecuta `rpg_tests`, THE Project_Loader SHALL ser ejercitado por al menos un caso de prueba que cargue el `Project_File` válido `data/project.json` y verifique los campos `schemaVersion`, `title`, `startMapId`, `startPosition.x`, `startPosition.y`, `startPosition.direction` y la cantidad de entradas en `maps`.
3. WHEN `ctest` ejecuta `rpg_tests` sobre un Project_File con `schemaVersion` distinto de `1`, THE Project_Loader SHALL retornar `std::nullopt` y el caso de prueba correspondiente SHALL aprobar la verificación.
4. WHEN `ctest` ejecuta `rpg_tests` sobre un Project_File con un campo obligatorio ausente, THE Project_Loader SHALL retornar `std::nullopt` y el caso de prueba correspondiente SHALL aprobar la verificación.
5. THE Build_System SHALL registrar el ejecutable de pruebas mediante `add_test(NAME RPGTests COMMAND rpg_tests)` para integración con `ctest`.
