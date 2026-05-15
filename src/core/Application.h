#pragma once
#include "platform/Window.h"
#include "platform/InputManager.h"
#include "renderer/Renderer2D.h"
#include "core/Game.h"
#include <memory>
#include <string>

class Application {
public:
    Application();
    ~Application();

    bool initialize();
    void run();
    void shutdown();

    // Deterministic visual-verification harness used by `--smoke-shots`.
    // Writes a sequence of BMP screenshots to `outputDir`. Returns false
    // if any step (load, save, transfer, screenshot) fails.
    bool runSmokeShots(const std::string& outputDir);

private:
    void renderFrameOnce();           // one beginFrame/render/endFrame pair
    bool snapshot(const std::string& outputDir, const std::string& name);

    Window window;
    InputManager inputManager;
    Renderer2D renderer;
    std::unique_ptr<Game> game;
    
    bool isRunning = false;
};
