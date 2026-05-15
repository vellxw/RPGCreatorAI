#include "core/Application.h"
#include "world/ProjectLoader.h"
#include "core/Logger.h"
#include <SDL.h>

Application::Application() {}
Application::~Application() {}

bool Application::initialize() {
    auto projectData = ProjectLoader::load("data/project.json");
    if (!projectData) {
        Logger::error("Failed to load project");
        return false;
    }

    Logger::info("Project loaded: " + projectData->title);

    if (!window.initialize(800, 600, projectData->title.c_str())) {
        return false;
    }

    if (!renderer.initialize(window)) {
        Logger::error("Failed to initialize renderer");
        return false;
    }

    game = std::make_unique<Game>();
    if (!game->initialize(window, *projectData)) {
        Logger::error("Failed to initialize game");
        return false;
    }

    isRunning = true;
    return true;
}

void Application::run() {
    Uint32 lastTime = SDL_GetTicks();

    while (isRunning) {
        // 1. Process window events — quit skips render and breaks
        bool quit = false;
        window.processEvents(quit);
        if (quit) {
            isRunning = false;
            break;
        }

        // 2. Update input state
        inputManager.update(window.getKeyboardState());

        // 3. Calculate delta time
        Uint32 currentTime = SDL_GetTicks();
        float dt = (currentTime - lastTime) / 1000.0f;
        lastTime = currentTime;

        // 4. Update game logic
        game->update(inputManager, dt);

        // 5-7. Render frame
        renderer.beginFrame();
        game->render(renderer);
        renderer.endFrame();

        // 8. Frame cap ~60fps
        SDL_Delay(16);
    }
}

void Application::shutdown() {
    renderer.shutdown();
    window.shutdown();
}
