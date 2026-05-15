#include "core/Application.h"
#include "world/ProjectLoader.h"
#include "core/Logger.h"
#include <SDL.h>
#include <filesystem>
#include <string>

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
        bool quit = false;
        window.processEvents(quit);
        if (quit) {
            isRunning = false;
            break;
        }

        inputManager.update(window.getKeyboardState());

        Uint32 currentTime = SDL_GetTicks();
        float dt = (currentTime - lastTime) / 1000.0f;
        lastTime = currentTime;

        game->update(inputManager, dt);

        renderer.beginFrame();
        game->render(renderer);
        renderer.endFrame();

        SDL_Delay(16);
    }
}

void Application::shutdown() {
    renderer.shutdown();
    window.shutdown();
}

void Application::renderFrameOnce() {
    // Pump SDL events so the OS keeps the window responsive during the
    // smoke run. We ignore the quit flag — smoke completes regardless.
    bool ignored = false;
    window.processEvents(ignored);

    renderer.beginFrame();
    if (game) game->render(renderer);
    renderer.endFrame();
}

bool Application::snapshot(const std::string& outputDir, const std::string& name) {
    std::filesystem::create_directories(outputDir);
    std::string path = outputDir + "/" + name + ".bmp";
    // Render twice: first to ensure the latest game state is in the
    // backbuffer, then read back. SDL's accelerated backbuffer is
    // single-buffered for read purposes after RenderPresent — rendering
    // a second time guarantees stable contents for ReadPixels.
    renderFrameOnce();
    if (!window.saveScreenshot(path.c_str())) {
        Logger::error("Failed to save screenshot: " + path);
        return false;
    }
    Logger::info("Screenshot: " + path);
    return true;
}

bool Application::runSmokeShots(const std::string& outputDir) {
    if (!game) {
        Logger::error("runSmokeShots: game not initialized");
        return false;
    }
    const float dt = 1.0f / 60.0f;

    // 01 — Town initial
    game->pumpEvents(dt);
    if (!snapshot(outputDir, "01-town-initial")) return false;

    // 02 — Walk to NPC and interact (NPC at (6,4), player starts at (4,4))
    game->stepMove(1, 0, Direction::Right);   // (4,4) -> (5,4)
    game->pumpEvents(dt);
    game->stepMove(1, 0, Direction::Right);   // blocked by NPC, direction updates
    game->pumpEvents(dt);
    game->stepInteract();                     // opens dialogue
    game->pumpEvents(dt);
    if (!snapshot(outputDir, "02-npc-dialogue")) return false;

    game->stepDismissDialogue();
    game->pumpEvents(dt);

    // 03 — Walk back left x2 then up to door (3,3) → transfer to house at (3,4)
    game->stepMove(-1, 0, Direction::Left);   // (5,4) -> (4,4)
    game->pumpEvents(dt);
    game->stepMove(-1, 0, Direction::Left);   // (4,4) -> (3,4)
    game->pumpEvents(dt);
    game->stepMove(0, -1, Direction::Up);     // (3,4) -> (3,3) → triggers transferMap
    game->pumpEvents(dt);                     // event runner produces request
    game->pumpEvents(dt);                     // game applies transfer
    if (!snapshot(outputDir, "03-house-arrived")) return false;

    // 04 — In house: from (3,4) go up x3 to (3,1), face right, interact with chest at (4,1)
    game->stepMove(0, -1, Direction::Up);  game->pumpEvents(dt);  // (3,3)
    game->stepMove(0, -1, Direction::Up);  game->pumpEvents(dt);  // (3,2)
    game->stepMove(0, -1, Direction::Up);  game->pumpEvents(dt);  // (3,1)
    game->stepMove(1, 0, Direction::Right); game->pumpEvents(dt); // blocked by chest, faces right
    game->stepInteract();                  game->pumpEvents(dt);
    if (!snapshot(outputDir, "04-chest-first-open")) return false;

    // Drain any remaining commands while dialogue is up. The chest opens
    // a showText, then on dismiss should run addItem + setFlag.
    game->stepDismissDialogue();           game->pumpEvents(dt);
    game->pumpEvents(dt);                  // process post-dialogue commands

    // 05 — Re-interact: ifFlag chest_001_opened == false fails → else "El cofre esta vacio."
    game->stepInteract();                  game->pumpEvents(dt);
    if (!snapshot(outputDir, "05-chest-already-opened")) return false;
    game->stepDismissDialogue();           game->pumpEvents(dt);

    // 06 — Save (F5 equivalent)
    game->stepSave();                      game->pumpEvents(dt);
    if (!snapshot(outputDir, "06-save-feedback")) return false;
    game->stepDismissDialogue();           game->pumpEvents(dt);

    // 07 — Walk back to door (3,5) and transfer to town. We are at
    // (3,1) facing right after interacting with the chest at (4,1).
    game->stepMove(0, 1, Direction::Down);  game->pumpEvents(dt); // (3,1)→(3,2)
    game->stepMove(0, 1, Direction::Down);  game->pumpEvents(dt); // (3,2)→(3,3)
    game->stepMove(0, 1, Direction::Down);  game->pumpEvents(dt); // (3,3)→(3,4)
    game->stepMove(0, 1, Direction::Down);  game->pumpEvents(dt); // (3,4)→(3,5) touch transfer
    game->pumpEvents(dt);                                         // apply transfer
    if (!snapshot(outputDir, "07-back-in-town")) return false;

    // 08 — Load (F9 equivalent) — restores save (we were in house)
    game->stepLoad();                      game->pumpEvents(dt);
    if (!snapshot(outputDir, "08-load-feedback")) return false;
    game->stepDismissDialogue();           game->pumpEvents(dt);

    // 09 — Final after-load state
    if (!snapshot(outputDir, "09-after-load")) return false;

    Logger::info("Smoke shots complete.");
    return true;
}
