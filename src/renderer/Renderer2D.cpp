#include "renderer/Renderer2D.h"
#include <SDL.h>

bool Renderer2D::initialize(Window& window) {
    sdlRenderer = window.getSDLRenderer();
    if (sdlRenderer) {
        SDL_GetWindowSize(window.getSDLWindow(), &screenWidth, &screenHeight);
    }
    return sdlRenderer != nullptr;
}

void Renderer2D::beginFrame() {
    SDL_SetRenderDrawColor(sdlRenderer, 0, 0, 0, 255);
    SDL_RenderClear(sdlRenderer);
}

void Renderer2D::renderMap(const MapScene& /*scene*/, const Camera2D& /*camera*/) {
    // No-op stub for bootstrap phase
}

void Renderer2D::renderEntities(const MapScene& /*scene*/, const GameState& /*state*/, const Camera2D& /*camera*/) {
    // No-op stub for bootstrap phase
}

void Renderer2D::renderDialogue(const DialogueSystem& /*dialogue*/) {
    // No-op stub for bootstrap phase
}

void Renderer2D::endFrame() {
    SDL_RenderPresent(sdlRenderer);
}

void Renderer2D::shutdown() {
    sdlRenderer = nullptr;
}
