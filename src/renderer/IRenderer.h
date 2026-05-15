#pragma once
#include "platform/Window.h"
#include "world/MapScene.h"
#include "renderer/Camera2D.h"
#include "dialogue/DialogueSystem.h"
#include "events/GameState.h"

class IRenderer {
public:
    virtual ~IRenderer() = default;
    virtual bool initialize(Window& window) = 0;
    virtual void beginFrame() = 0;
    virtual void renderMap(const MapScene& scene, const Camera2D& camera) = 0;
    virtual void renderEntities(const MapScene& scene, const GameState& state, const Camera2D& camera) = 0;
    virtual void renderDialogue(const DialogueSystem& dialogue) = 0;
    virtual void endFrame() = 0;
    virtual void shutdown() = 0;
};
