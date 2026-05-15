#pragma once
#include "renderer/IRenderer.h"
struct SDL_Renderer;

class Renderer2D : public IRenderer {
public:
    bool initialize(Window& window) override;
    void beginFrame() override;
    void renderMap(const MapScene& scene, const Camera2D& camera) override;
    void renderEntities(const MapScene& scene, const GameState& state, const Camera2D& camera) override;
    void renderDialogue(const DialogueSystem& dialogue) override;
    void endFrame() override;
    void shutdown() override;

private:
    SDL_Renderer* sdlRenderer = nullptr;
    int screenWidth = 800;
    int screenHeight = 600;
};
