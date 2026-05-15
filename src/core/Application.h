#pragma once
#include "platform/Window.h"
#include "platform/InputManager.h"
#include "renderer/Renderer2D.h"
#include "core/Game.h"
#include <memory>

class Application {
public:
    Application();
    ~Application();

    bool initialize();
    void run();
    void shutdown();

private:
    Window window;
    InputManager inputManager;
    Renderer2D renderer;
    std::unique_ptr<Game> game;
    
    bool isRunning = false;
};
