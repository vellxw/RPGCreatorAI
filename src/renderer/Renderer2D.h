#pragma once
#include "renderer/IRenderer.h"
struct SDL_Renderer;
struct SDL_Texture;

#include <string>
#include <unordered_map>

class Renderer2D : public IRenderer {
public:
    bool initialize(Window& window) override;
    void beginFrame() override;
    void renderMap(const MapScene& scene, const Camera2D& camera) override;
    void renderEntities(const RenderEntitiesSnapshot& entities, const Camera2D& camera) override;
    void renderDialogue(const DialogueSystem& dialogue) override;
    void renderHUD(const GameState& state) override;
    void renderMenu(const rpg::MenuSystem::ViewModel& vm) override;
    void renderShop(const rpg::ShopSystem::ViewModel& vm) override;
    void renderBattleSummary(const rpg::BattleSummarySystem::ViewModel& vm) override;
    void endFrame() override;
    void shutdown() override;

private:
    SDL_Texture* textureFor(const std::string& assetKey);
    void renderSprite(const std::string& assetKey, int x, int y, int w, int h);
    void renderSprite(const std::string& assetKey, const SpriteSourceRect& src, int x, int y, int w, int h);

    SDL_Renderer* sdlRenderer = nullptr;
    int screenWidth = 800;
    int screenHeight = 600;
    std::unordered_map<std::string, SDL_Texture*> textures;
};
