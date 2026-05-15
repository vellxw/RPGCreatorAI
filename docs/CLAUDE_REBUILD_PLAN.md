# Claude Rebuild Plan (C++ Real)

Este documento es una guía destinada a **Claude Opus** (o cualquier otro asistente futuro) para reconstruir el verdadero Runtime MVP de este RPG Creator de manera nativa en C++.

## 1. Ideas a Conservar (El "Core")
- **Arquitectura Data-Driven:** Nada de hardcoding en las escenas, mapas, items o eventos. TODO fluye de la lectura del `.json`.
- **Estructura Modular:**
  - `Engine` parsea, actualiza y gestiona subsystems.
  - `IRenderer` asegura que la lógica del juego (cuadrículas, tiles, bounding boxes) esté desconectada de la librería gráfica final (SDL, Vulkan, OpenGL, HD-2D proxy).
  - `EventRunner` procesa un array de comandos secuencialmente, bloqueando el input general durante "waits" o diálogos.
  - `GameState` aloja todo mutador: `flags`, `variables`, `inventory`, `playerPos`.

## 2. Archivos e Ideas a IGNORAR
Al comenzar el proyecto en un entorno C++ de escritorio real, DEBES **ELIMINAR / IGNORAR** lo siguiente:
- Todo archivo `package.json`, `vite.config.ts`, `.html` y scripts web generados en el prototipo de AI Studio.
- Todo framework front-end: `React`, `Tailwind`, `.tsx`, `.css`. No existe "dashboard auxiliar de React" en la arquitectura definitiva base.
- Archivos de mockeo de estado para visualización UI (el visualizador de consola web, etc.).

## 3. Arquitectura a Rehacer
Deberás construir el núcleo nativo de C++20 utilizando:
- **CMake** como sistema de build.
- **nlohmann/json** de forma extensiva en cargadores (`ProjectLoader`, `MapLoader`, etc.).
- **doctest / Catch2** para garantizar los tests unitarios. (Asegúrate de que los loaders fallan graciosamente en vez de crashear).
- **SDL2 / SDL3** (según estabilidad) instanciado a través de una clase concreta `SDLRenderer` implementando la interfaz `IRenderer`.

## 4. Formatos JSON que se mantienen (La Verdad Absoluta)
Debes adherirte por completo a las estructuras JSON definidas en los siguientes documentos del directorio `/docs/`:
- `DATA_FORMAT.md`
- `EVENT_SYSTEM.md`
Mantengan las `schemaVersion` y parseen los arrays 1D de tiles.

## 5. Errores Graves a Evitar
1. **NO MEZCLES lógica de Input o Colisión dentro de tu Renderer.** El renderer dibuja variables del `GameState` y `MapScene`. No evalúa tiles para detener movimiento, eso lo hace el `CollisionSystem`.
2. **Evitar acoples estrechos con SDL.** SDL solo debe asomarse en la capa de ventana (`Window.cpp`), input polling (`InputManager.cpp`) y su implementación concreta de renderizado. 
3. **No avances de Fase.** Esta es la *Fase 1*: no construyas un editor Qt/ImGui todavía, no armes un sistema de sprites complejos ni animaciones ni plugins de Lua. Es solo rectángulos y lógica de colisión moviéndose en una consola o ventana nativa simple base.

## 6. Ejecución de "Fase 1" Real
Tu meta como IA será clonar el set de archivos descritos en la Fase 1 original (con el `src/` folder que divide `core`, `platform`, `world`, `renderer`, `events`, `entities` y `save`) y lograr que se compile el ejecutable `rpg_creator_runtime.exe` desde consola sin fallos.
