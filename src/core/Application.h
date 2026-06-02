#pragma once
#include "platform/Window.h"
#include "platform/InputManager.h"
#include "platform/AudioSystem.h"
#include "renderer/Renderer2D.h"
#include "core/Game.h"
#include <cstdint>
#include <filesystem>
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
    void configureRuntimeDebugSnapshot();
    void writeRuntimeDebugSnapshot();
    void renderDebugOverlayIfEnabled();

    Window window;
    InputManager inputManager;
    rpg::AudioSystem audioSystem;
    Renderer2D renderer;
    std::unique_ptr<Game> game;
    std::filesystem::path runtimeDebugSnapshotFile;
    std::uint64_t runtimeDebugFrame = 0;
    float runtimeDebugSnapshotAccumulator = 0.0f;
    bool runtimeDebugOverlayEnabled = false;
    
    bool isRunning = false;
};
