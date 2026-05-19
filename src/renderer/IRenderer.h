#pragma once
#include "platform/Window.h"
#include "world/MapScene.h"
#include "renderer/Camera2D.h"
#include "dialogue/DialogueSystem.h"
#include "events/GameState.h"
#include "renderer/RenderSnapshot.h"
#include "runtime/MenuSystem.h"
#include "runtime/ShopSystem.h"
#include "runtime/BattleSummarySystem.h"

class IRenderer {
public:
    virtual ~IRenderer() = default;
    virtual bool initialize(Window& window) = 0;
    virtual void beginFrame() = 0;
    virtual void renderMap(const MapScene& scene, const Camera2D& camera) = 0;
    virtual void renderEntities(const RenderEntitiesSnapshot& entities, const Camera2D& camera) = 0;
    virtual void renderDialogue(const DialogueSystem& dialogue) = 0;
    virtual void renderHUD(const GameState& state) = 0;
    virtual void renderMenu(const rpg::MenuSystem::ViewModel& vm) = 0;
    virtual void renderShop(const rpg::ShopSystem::ViewModel& vm) = 0;
    virtual void renderBattleSummary(const rpg::BattleSummarySystem::ViewModel& vm) = 0;
    virtual void endFrame() = 0;
    virtual void shutdown() = 0;
};
