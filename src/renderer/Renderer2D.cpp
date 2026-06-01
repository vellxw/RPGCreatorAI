#include "renderer/Renderer2D.h"
#include "renderer/BitmapFont.h"
#include "renderer/SpriteCatalog.h"
#include <SDL.h>
#include <algorithm>
#include <cmath>

namespace {

struct Color {
    Uint8 r, g, b, a;
};

// Palette is constant in C++ — it's renderer styling, not game data.
constexpr Color kColorGround   {  72, 132,  82, 255 };
constexpr Color kColorWall     {  52,  52,  68, 255 };
constexpr Color kColorUnknown  {  20,  20,  20, 255 };

constexpr Color kColorPlayer   { 240, 220,  60, 255 };
constexpr Color kColorPlayerEye{  20,  20,  20, 255 };

constexpr Color kColorNPC      { 220,  90,  90, 255 };
constexpr Color kColorChest    { 200, 140,  40, 255 };
constexpr Color kColorTransfer {  90, 160, 230, 255 };
constexpr Color kColorEvent    { 180, 120, 220, 255 };

constexpr Color kColorDlgFill  {   0,   0,   0, 220 };
constexpr Color kColorDlgEdge  { 230, 230, 230, 255 };
constexpr Color kColorDlgText  { 240, 240, 240, 255 };

void fillRect(SDL_Renderer* r, int x, int y, int w, int h, Color c) {
    SDL_SetRenderDrawColor(r, c.r, c.g, c.b, c.a);
    SDL_Rect rect{ x, y, w, h };
    SDL_RenderFillRect(r, &rect);
}

void drawRect(SDL_Renderer* r, int x, int y, int w, int h, Color c) {
    SDL_SetRenderDrawColor(r, c.r, c.g, c.b, c.a);
    SDL_Rect rect{ x, y, w, h };
    SDL_RenderDrawRect(r, &rect);
}

} // namespace

bool Renderer2D::initialize(Window& window) {
    sdlRenderer = window.getSDLRenderer();
    if (sdlRenderer) {
        SDL_SetHint(SDL_HINT_RENDER_SCALE_QUALITY, "0");
        SDL_GetWindowSize(window.getSDLWindow(), &screenWidth, &screenHeight);
        SDL_SetRenderDrawBlendMode(sdlRenderer, SDL_BLENDMODE_BLEND);
    }
    return sdlRenderer != nullptr;
}

void Renderer2D::beginFrame() {
    SDL_SetRenderDrawColor(sdlRenderer, 12, 14, 20, 255);
    SDL_RenderClear(sdlRenderer);
}

void Renderer2D::renderMap(const MapScene& scene, const Camera2D& camera, MapRenderPass pass) {
    if (!sdlRenderer) return;
    int tileSize = scene.getTileSize();
    if (tileSize <= 0) tileSize = 32;

    Vec2i cam = camera.getPosition();
    int width  = scene.getWidth();
    int height = scene.getHeight();

    // Determine visible tile range (cull a couple of tiles outside the viewport).
    int firstX = std::max(0, cam.x / tileSize - 1);
    int firstY = std::max(0, cam.y / tileSize - 1);
    int lastX  = std::min(width  - 1, (cam.x + screenWidth)  / tileSize + 1);
    int lastY  = std::min(height - 1, (cam.y + screenHeight) / tileSize + 1);

    for (const MapLayer* layer : scene.getRenderLayers(pass)) {
        const std::string role = layer->role.empty() ? layer->name : layer->role;
        const bool transparentZero = role != "ground";

        for (int y = firstY; y <= lastY; ++y) {
            for (int x = firstX; x <= lastX; ++x) {
                const int index = y * width + x;
                if (index < 0 || index >= static_cast<int>(layer->tiles.size())) continue;

                const int tileId = layer->tiles[index];
                if (transparentZero && tileId == 0) continue;

                int screenX = x * tileSize - cam.x;
                int screenY = y * tileSize - cam.y;
                renderSprite(SpriteCatalog::tileAssetFor(tileId, 0),
                             screenX, screenY, tileSize, tileSize);
            }
        }
    }
}

void Renderer2D::renderEntities(const RenderEntitiesSnapshot& entities,
                                const Camera2D& camera,
                                EntityRenderPass pass) {
    if (!sdlRenderer) return;
    Vec2i cam = camera.getPosition();

    auto drawEntity = [&](const EntityRenderSprite& sprite) {
        const int sx = static_cast<int>(std::round(sprite.worldX)) - cam.x;
        const int sy = static_cast<int>(std::round(sprite.worldY)) - cam.y;
        const int w = std::max(1, sprite.worldW);
        const int h = std::max(1, sprite.worldH);
        if (sprite.source.active) {
            renderSprite(sprite.assetKey, sprite.source, sx, sy, w, h);
        } else {
            renderSprite(sprite.assetKey, sx, sy, w, h);
        }

        if (!sprite.showDirectionDot) return;

        const int dotSize = std::max(3, std::min(w, h) / 6);
        const int pad = std::max(2, std::min(w, h) / 8);
        int cx = sx + w / 2 - dotSize / 2;
        int cy = sy + h / 2 - dotSize / 2;
        switch (sprite.direction) {
            case Direction::Up:    cy = sy + pad + 1; break;
            case Direction::Down:  cy = sy + h - pad - dotSize - 1; break;
            case Direction::Left:  cx = sx + pad + 1; break;
            case Direction::Right: cx = sx + w - pad - dotSize - 1; break;
        }
        fillRect(sdlRenderer, cx, cy, dotSize, dotSize, kColorPlayerEye);
    };

    for (const auto& sprite : buildEntityRenderOrder(entities)) {
        if (!entityRenderPassIncludes(pass, sprite)) continue;
        drawEntity(sprite);
    }
}

void Renderer2D::renderDialogue(const DialogueSystem& dialogue) {
    if (!sdlRenderer) return;
    if (!dialogue.isActive()) return;

    // Box at the bottom of the screen.
    const int margin = 16;
    const int boxH = 120;
    int boxX = margin;
    int boxY = screenHeight - boxH - margin;
    int boxW = screenWidth - 2 * margin;

    fillRect(sdlRenderer, boxX, boxY, boxW, boxH, kColorDlgFill);
    drawRect(sdlRenderer, boxX, boxY, boxW, boxH, kColorDlgEdge);

    int textX = boxX + 14;
    int textY = boxY + 14;
    int scale = 2;

    if (!dialogue.getSpeaker().empty()) {
        BitmapFont::drawText(sdlRenderer, textX, textY,
                             dialogue.getSpeaker() + ":",
                             scale,
                             kColorDlgText.r, kColorDlgText.g, kColorDlgText.b, kColorDlgText.a);
        textY += BitmapFont::GlyphHeight * scale + 8;
    }

    if (dialogue.isChoiceActive()) {
        const int lineH = BitmapFont::GlyphHeight * scale + 6;
        BitmapFont::drawText(sdlRenderer, textX, textY, dialogue.getText(), scale,
                             kColorDlgText.r, kColorDlgText.g, kColorDlgText.b, kColorDlgText.a);
        int choiceY = textY + lineH + 8;
        const auto& labels = dialogue.getChoiceLabels();
        const int selected = dialogue.getSelectedChoiceIndex();
        for (int i = 0; i < static_cast<int>(labels.size()); ++i) {
            if (choiceY + lineH > boxY + boxH - 24) break;
            const bool isSelected = i == selected;
            const std::string line = std::string(isSelected ? "> " : "  ") + labels[static_cast<size_t>(i)];
            BitmapFont::drawText(sdlRenderer, textX, choiceY, line, scale,
                                 isSelected ? 240 : kColorDlgText.r,
                                 isSelected ? 220 : kColorDlgText.g,
                                 isSelected ? 60 : kColorDlgText.b,
                                 kColorDlgText.a);
            choiceY += lineH;
        }

        std::string hint = "[Up/Down] [Enter] [Esc]";
        int hintX = boxX + boxW - BitmapFont::measureWidth(hint, 1) - 12;
        int hintY = boxY + boxH - BitmapFont::GlyphHeight - 8;
        BitmapFont::drawText(sdlRenderer, hintX, hintY, hint, 1,
                             kColorDlgText.r, kColorDlgText.g, kColorDlgText.b, kColorDlgText.a);
        return;
    }

    // Wrap the body text to fit the dialogue box width.
    const int charW = (BitmapFont::GlyphWidth + 1) * scale;
    int maxChars = std::max(8, (boxW - 28) / charW);
    const std::string& body = dialogue.getText();
    std::string line;
    int yCursor = textY;
    int lineH = BitmapFont::GlyphHeight * scale + 4;

    auto flush = [&](const std::string& s) {
        BitmapFont::drawText(sdlRenderer, textX, yCursor, s, scale,
                             kColorDlgText.r, kColorDlgText.g, kColorDlgText.b, kColorDlgText.a);
        yCursor += lineH;
    };

    for (size_t i = 0; i < body.size(); ) {
        size_t end = std::min(body.size(), i + static_cast<size_t>(maxChars));
        // Try to break at a space if we cut mid-word.
        if (end < body.size() && body[end] != ' ') {
            size_t back = body.rfind(' ', end);
            if (back != std::string::npos && back > i) end = back;
        }
        flush(body.substr(i, end - i));
        i = end;
        while (i < body.size() && body[i] == ' ') ++i;
        if (yCursor + lineH > boxY + boxH - 14) break;
    }

    // Hint
    std::string hint = "[Enter/Esc]";
    int hintX = boxX + boxW - BitmapFont::measureWidth(hint, 1) - 12;
    int hintY = boxY + boxH - BitmapFont::GlyphHeight - 8;
    BitmapFont::drawText(sdlRenderer, hintX, hintY, hint, 1,
                         kColorDlgText.r, kColorDlgText.g, kColorDlgText.b, kColorDlgText.a);
}

void Renderer2D::endFrame() {
    SDL_RenderPresent(sdlRenderer);
}

void Renderer2D::shutdown() {
    for (auto& [_, texture] : textures) {
        if (texture) SDL_DestroyTexture(texture);
    }
    textures.clear();
    sdlRenderer = nullptr;
}

SDL_Texture* Renderer2D::textureFor(const std::string& assetKey) {
    auto it = textures.find(assetKey);
    if (it != textures.end()) return it->second;

    SDL_Surface* surface = SDL_LoadBMP(SpriteCatalog::runtimePathFor(assetKey).c_str());
    if (!surface) {
        textures[assetKey] = nullptr;
        return nullptr;
    }
    SDL_SetColorKey(surface, SDL_TRUE, SDL_MapRGB(surface->format, 255, 0, 255));
    SDL_Texture* texture = SDL_CreateTextureFromSurface(sdlRenderer, surface);
    SDL_FreeSurface(surface);
    textures[assetKey] = texture;
    return texture;
}

void Renderer2D::renderSprite(const std::string& assetKey, int x, int y, int w, int h) {
    if (SDL_Texture* texture = textureFor(assetKey)) {
        SDL_Rect dst{x, y, w, h};
        SDL_RenderCopy(sdlRenderer, texture, nullptr, &dst);
        return;
    }

    fillRect(sdlRenderer, x, y, w, h, kColorEvent);
    drawRect(sdlRenderer, x, y, w, h, kColorDlgEdge);
}

void Renderer2D::renderSprite(const std::string& assetKey, const SpriteSourceRect& src, int x, int y, int w, int h) {
    if (SDL_Texture* texture = textureFor(assetKey)) {
        SDL_Rect dst{x, y, w, h};
        SDL_Rect source{src.x, src.y, src.w, src.h};
        SDL_RenderCopy(sdlRenderer, texture, &source, &dst);
        return;
    }

    fillRect(sdlRenderer, x, y, w, h, kColorEvent);
    drawRect(sdlRenderer, x, y, w, h, kColorDlgEdge);
}


// ---------------------------------------------------------------------------
// Phase 7 — runtime UI overlays (HUD, menu, shop, battle)
// ---------------------------------------------------------------------------

namespace {

constexpr Color kPanelFill   {  10,  12,  18, 230 };
constexpr Color kPanelBorder { 230, 230, 230, 255 };
constexpr Color kPanelHeader { 240, 220,  60, 255 };
constexpr Color kPanelText   { 240, 240, 240, 255 };
constexpr Color kPanelDim    { 160, 160, 160, 255 };
constexpr Color kPanelOK     {  90, 200, 120, 255 };
constexpr Color kPanelBad    { 220,  90,  90, 255 };

void drawTextLine(SDL_Renderer* r, int x, int y, const std::string& text,
                  int scale, Color c) {
    BitmapFont::drawText(r, x, y, text, scale, c.r, c.g, c.b, c.a);
}

struct PanelLayout {
    int x;
    int y;
    int w;
    int h;
    int textX;
    int titleY;
    int rowsY;
    int rowHeight;
    int rowsPerPanel;
};

PanelLayout computePanelLayout(int screenW, int screenH) {
    constexpr int margin = 32;
    constexpr int padding = 14;
    PanelLayout p;
    p.x = margin;
    p.y = margin;
    p.w = screenW - margin * 2;
    p.h = screenH - margin * 2;
    p.textX = p.x + padding + 4;
    p.titleY = p.y + padding;
    p.rowsY = p.titleY + (BitmapFont::GlyphHeight * 2) + 14;
    p.rowHeight = (BitmapFont::GlyphHeight * 2) + 6;
    int usableH = p.h - (p.rowsY - p.y) - padding - p.rowHeight;
    p.rowsPerPanel = std::max(1, usableH / p.rowHeight);
    return p;
}

void drawPanel(SDL_Renderer* r, const PanelLayout& p, const std::string& title) {
    fillRect(r, p.x, p.y, p.w, p.h, kPanelFill);
    drawRect(r, p.x, p.y, p.w, p.h, kPanelBorder);
    drawTextLine(r, p.textX, p.titleY, title, 2, kPanelHeader);
}

void drawHint(SDL_Renderer* r, const PanelLayout& p, const std::string& hint) {
    int hintY = p.y + p.h - BitmapFont::GlyphHeight - 12;
    drawTextLine(r, p.textX, hintY, hint, 1, kPanelDim);
}

} // namespace

void Renderer2D::renderHUD(const GameState& state) {
    if (!sdlRenderer) return;
    // A small top-left HUD strip showing gold while playing.
    std::string text = "Gold: " + std::to_string(state.getGold()) + "g";
    int padX = 8, padY = 6;
    int textW = BitmapFont::measureWidth(text, 2);
    int textH = BitmapFont::GlyphHeight * 2;
    int boxW = textW + padX * 2;
    int boxH = textH + padY * 2;
    int boxX = 12, boxY = 12;
    fillRect(sdlRenderer, boxX, boxY, boxW, boxH, kPanelFill);
    drawRect(sdlRenderer, boxX, boxY, boxW, boxH, kPanelBorder);
    drawTextLine(sdlRenderer, boxX + padX, boxY + padY, text, 2, kPanelHeader);
}

void Renderer2D::renderMenu(const rpg::MenuSystem::ViewModel& vm) {
    if (!sdlRenderer) return;
    if (vm.screen == rpg::MenuSystem::Screen::Closed) return;

    PanelLayout p = computePanelLayout(screenWidth, screenHeight);

    auto drawList = [&](const std::string& title,
                        const std::vector<std::string>& rows,
                        const std::vector<bool>& enabled,
                        const std::string& hint) {
        drawPanel(sdlRenderer, p, title);
        int total = static_cast<int>(rows.size());
        int sel = vm.selectionIndex;
        if (sel < 0) sel = 0;
        if (sel >= total) sel = std::max(0, total - 1);

        int firstRow = 0;
        if (total > p.rowsPerPanel) {
            int half = p.rowsPerPanel / 2;
            firstRow = std::max(0, sel - half);
            if (firstRow + p.rowsPerPanel > total) {
                firstRow = std::max(0, total - p.rowsPerPanel);
            }
        }
        int rowsToDraw = std::min(p.rowsPerPanel, total - firstRow);

        for (int i = 0; i < rowsToDraw; ++i) {
            int idx = firstRow + i;
            int y = p.rowsY + i * p.rowHeight;
            bool selected = (idx == sel);
            Color color = enabled.empty() || enabled[idx]
                              ? (selected ? kPanelHeader : kPanelText)
                              : kPanelDim;
            std::string prefix = selected ? "> " : "  ";
            drawTextLine(sdlRenderer, p.textX, y, prefix + rows[idx], 2, color);
        }
        drawHint(sdlRenderer, p, hint);
    };

    auto drawMessage = [&]() {
        if (!vm.message.has_value()) return;
        int msgY = p.y + p.h - BitmapFont::GlyphHeight * 2 - 14 - 12;
        drawTextLine(sdlRenderer, p.textX, msgY, *vm.message, 2, kPanelOK);
    };

    auto drawOverwriteConfirm = [&]() {
        if (!vm.overwriteConfirmActive) return;
        int boxW = 280;
        int boxH = 110;
        int bx = (screenWidth - boxW) / 2;
        int by = (screenHeight - boxH) / 2;
        fillRect(sdlRenderer, bx, by, boxW, boxH, kPanelFill);
        drawRect(sdlRenderer, bx, by, boxW, boxH, kPanelBorder);
        std::string title = "Overwrite Slot " +
                            std::to_string(vm.overwriteConfirmSlotIndex) + " ?";
        drawTextLine(sdlRenderer, bx + 16, by + 14, title, 2, kPanelHeader);
        drawTextLine(sdlRenderer, bx + 16, by + 60, "[Enter] yes   [Esc] no", 1,
                     kPanelText);
    };

    switch (vm.screen) {
        case rpg::MenuSystem::Screen::Closed:
            return;

        case rpg::MenuSystem::Screen::Root: {
            std::vector<bool> enabled(vm.rootItems.size(), true);
            drawList("MENU", vm.rootItems, enabled,
                     "[Up/Down] navigate   [Enter] select   [Esc/Tab] close");
            std::string gold = "Gold: " + std::to_string(vm.playerGold) + "g";
            int gx = p.x + p.w - BitmapFont::measureWidth(gold, 2) - 16;
            drawTextLine(sdlRenderer, gx, p.titleY, gold, 2, kPanelOK);
            drawMessage();
            return;
        }

        case rpg::MenuSystem::Screen::Inventory: {
            std::vector<std::string> rows;
            for (const auto& it : vm.inventory) {
                std::string line = it.name;
                line.append(40 - std::min<int>(40, (int)line.size()), ' ');
                line += "x" + std::to_string(it.amount);
                if (it.unknown) line += "  (unknown item)";
                rows.push_back(line);
            }
            if (rows.empty()) rows.push_back("(empty)");
            drawList("INVENTORY", rows, {}, "[Esc] back");
            // Selected description below
            if (!vm.inventory.empty()) {
                int sel = vm.selectionIndex;
                if (sel < 0) sel = 0;
                if (sel >= (int)vm.inventory.size()) sel = (int)vm.inventory.size() - 1;
                const auto& row = vm.inventory[sel];
                if (!row.description.empty()) {
                    int descY = p.y + p.h - BitmapFont::GlyphHeight * 2 - 14 - 12;
                    drawTextLine(sdlRenderer, p.textX, descY,
                                 row.description, 1, kPanelDim);
                }
            }
            return;
        }

        case rpg::MenuSystem::Screen::Party: {
            std::vector<std::string> rows;
            if (vm.party.empty()) {
                rows.push_back("No party members");
            } else {
                for (const auto& a : vm.party) {
                    std::string line = a.name + "  " + a.className +
                                       "  Lv " + std::to_string(a.level);
                    rows.push_back(line);
                    rows.push_back("    HP " + std::to_string(a.hp) + "/" +
                                   std::to_string(a.maxHp) + "   MP " +
                                   std::to_string(a.mp) + "/" +
                                   std::to_string(a.maxMp));
                    rows.push_back("    ATK " + std::to_string(a.attack) +
                                   "  DEF " + std::to_string(a.defense) +
                                   "  AGI " + std::to_string(a.agility) +
                                   "  LUK " + std::to_string(a.luck));
                    rows.push_back("    Wpn " +
                                   (a.weapon.empty() ? std::string{"-"} : a.weapon) +
                                   "  Arm " +
                                   (a.armor.empty() ? std::string{"-"} : a.armor) +
                                   "  Acc " +
                                   (a.accessory.empty() ? std::string{"-"} : a.accessory));
                    rows.push_back("");
                }
            }
            drawList("PARTY", rows, {}, "[Esc] back");
            return;
        }

        case rpg::MenuSystem::Screen::Quests: {
            std::vector<std::string> rows;
            std::string lastGroup;
            auto labelFor = [](const std::string& s) {
                if (s == "active")    return std::string{"ACTIVE"};
                if (s == "completed") return std::string{"COMPLETED"};
                if (s == "failed")    return std::string{"FAILED"};
                return s;
            };
            for (const auto& q : vm.quests) {
                std::string group = labelFor(q.state);
                if (group != lastGroup) {
                    if (!lastGroup.empty()) rows.push_back("");
                    rows.push_back(group);
                    lastGroup = group;
                }
                rows.push_back("  " + q.title +
                               (q.unknown ? "  (unknown quest)" : ""));
                if (!q.summary.empty()) rows.push_back("    " + q.summary);
                for (const auto& obj : q.objectives) {
                    rows.push_back(std::string{"    "} +
                                   (obj.done ? "[x] " : "[ ] ") +
                                   obj.description);
                }
            }
            if (rows.empty()) rows.push_back("No quests yet.");
            drawList("QUEST JOURNAL", rows, {}, "[Esc] back");
            return;
        }

        case rpg::MenuSystem::Screen::Save:
        case rpg::MenuSystem::Screen::Load: {
            std::vector<std::string> rows;
            std::vector<bool> enabled;
            bool isLoad = (vm.screen == rpg::MenuSystem::Screen::Load);
            for (const auto& s : vm.slots) {
                rows.push_back(s.summary);
                enabled.push_back(isLoad ? s.exists : true);
            }
            if (rows.empty()) {
                rows.push_back("(no slots configured)");
                enabled.push_back(false);
            }
            std::string title = isLoad ? "LOAD" : "SAVE";
            drawList(title, rows, enabled,
                     "[Up/Down] navigate   [Enter] confirm   [Esc] back");
            drawMessage();
            drawOverwriteConfirm();
            return;
        }
    }
}

void Renderer2D::renderShop(const rpg::ShopSystem::ViewModel& vm) {
    if (!sdlRenderer || !vm.active) return;

    PanelLayout p = computePanelLayout(screenWidth, screenHeight);
    drawPanel(sdlRenderer, p, vm.shopName.empty() ? "SHOP" : vm.shopName);

    std::string gold = "Gold: " + std::to_string(vm.gold) + "g";
    int gx = p.x + p.w - BitmapFont::measureWidth(gold, 2) - 16;
    drawTextLine(sdlRenderer, gx, p.titleY, gold, 2, kPanelOK);

    if (vm.listings.empty()) {
        drawTextLine(sdlRenderer, p.textX, p.rowsY, "No items for sale.", 2, kPanelDim);
    } else {
        int rowsToDraw = std::min(p.rowsPerPanel, static_cast<int>(vm.listings.size()));
        for (int i = 0; i < rowsToDraw; ++i) {
            const auto& row = vm.listings[i];
            bool selected = (i == vm.selectionIndex);
            Color color = selected ? kPanelHeader :
                          (row.affordable ? kPanelText : kPanelDim);
            std::string line = selected ? "> " : "  ";
            line += row.name;
            line.append(std::max(1, 26 - static_cast<int>(row.name.size())), ' ');
            line += std::to_string(row.price) + "g";
            line += "   owned " + std::to_string(row.owned);
            if (row.unknown) line += "  (unknown item)";
            drawTextLine(sdlRenderer, p.textX, p.rowsY + i * p.rowHeight, line, 2, color);
        }

        const auto& selected = vm.listings[vm.selectionIndex];
        if (!selected.description.empty()) {
            int descY = p.y + p.h - BitmapFont::GlyphHeight * 2 - 14 - 12;
            drawTextLine(sdlRenderer, p.textX, descY, selected.description, 1, kPanelDim);
        }
    }

    if (vm.message.has_value()) {
        int msgY = p.y + p.h - BitmapFont::GlyphHeight * 3 - 22;
        const bool bad = (*vm.message == "Not enough gold");
        drawTextLine(sdlRenderer, p.textX, msgY, *vm.message, 2,
                     bad ? kPanelBad : kPanelOK);
    }

    drawHint(sdlRenderer, p, "[Up/Down] navigate   [Enter] buy   [Esc] leave");
}

void Renderer2D::renderBattleSummary(const rpg::BattleSummarySystem::ViewModel& vm) {
    if (!sdlRenderer || !vm.active) return;

    PanelLayout p = computePanelLayout(screenWidth, screenHeight);
    drawPanel(sdlRenderer, p, vm.title.empty() ? "BATTLE" : vm.title);

    Color outcomeColor = vm.outcomeLabel == "VICTORY" ? kPanelOK :
                         vm.outcomeLabel == "DEFEAT" ? kPanelBad : kPanelHeader;
    std::string outcome = vm.outcomeLabel.empty() ? "RESULT" : vm.outcomeLabel;
    int ox = p.x + p.w - BitmapFont::measureWidth(outcome, 2) - 16;
    drawTextLine(sdlRenderer, ox, p.titleY, outcome, 2, outcomeColor);

    int y = p.rowsY;
    drawTextLine(sdlRenderer, p.textX, y, "Enemies", 2, kPanelHeader);
    y += p.rowHeight;
    if (vm.enemies.empty()) {
        drawTextLine(sdlRenderer, p.textX + 18, y, "(unknown troop)", 2, kPanelDim);
        y += p.rowHeight;
    } else {
        for (const auto& enemy : vm.enemies) {
            std::string line = enemy.name + " x" + std::to_string(enemy.count);
            drawTextLine(sdlRenderer, p.textX + 18, y, line, 2, kPanelText);
            y += p.rowHeight;
        }
    }

    drawTextLine(sdlRenderer, p.textX, y, "Party", 2, kPanelHeader);
    y += p.rowHeight;
    if (vm.party.empty()) {
        drawTextLine(sdlRenderer, p.textX + 18, y, "No party members", 2, kPanelDim);
        y += p.rowHeight;
    } else {
        for (const auto& member : vm.party) {
            std::string line = member.name + "   HP " + std::to_string(member.hp) +
                               "/" + std::to_string(member.maxHp);
            drawTextLine(sdlRenderer, p.textX + 18, y, line, 2, kPanelText);
            y += p.rowHeight;
        }
    }

    drawTextLine(sdlRenderer, p.textX, y, "Rewards", 2, kPanelHeader);
    y += p.rowHeight;
    drawTextLine(sdlRenderer, p.textX + 18, y,
                 "Gold " + std::to_string(vm.goldAwarded) + "g   EXP " +
                     std::to_string(vm.expAwarded),
                 2, kPanelText);
    y += p.rowHeight;
    if (vm.rewards.empty()) {
        drawTextLine(sdlRenderer, p.textX + 18, y, "No item drops", 2, kPanelDim);
    } else {
        for (const auto& reward : vm.rewards) {
            drawTextLine(sdlRenderer, p.textX + 18, y,
                         reward.name + " x" + std::to_string(reward.amount),
                         2, kPanelText);
            y += p.rowHeight;
        }
    }

    drawHint(sdlRenderer, p, "[Enter/Esc] continue");
}
