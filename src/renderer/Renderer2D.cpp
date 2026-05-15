#include "renderer/Renderer2D.h"
#include "renderer/BitmapFont.h"
#include <SDL.h>
#include <algorithm>

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

Color colorForEvent(const EventData& e) {
    if (e.type == "npc")      return kColorNPC;
    if (e.type == "chest")    return kColorChest;
    if (e.type == "transfer") return kColorTransfer;
    return kColorEvent;
}

} // namespace

bool Renderer2D::initialize(Window& window) {
    sdlRenderer = window.getSDLRenderer();
    if (sdlRenderer) {
        SDL_GetWindowSize(window.getSDLWindow(), &screenWidth, &screenHeight);
        SDL_SetRenderDrawBlendMode(sdlRenderer, SDL_BLENDMODE_BLEND);
    }
    return sdlRenderer != nullptr;
}

void Renderer2D::beginFrame() {
    SDL_SetRenderDrawColor(sdlRenderer, 12, 14, 20, 255);
    SDL_RenderClear(sdlRenderer);
}

void Renderer2D::renderMap(const MapScene& scene, const Camera2D& camera) {
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

    for (int y = firstY; y <= lastY; ++y) {
        for (int x = firstX; x <= lastX; ++x) {
            int screenX = x * tileSize - cam.x;
            int screenY = y * tileSize - cam.y;

            // Ground first
            int groundTile = scene.getTileAt("ground", x, y);
            Color groundColor = (groundTile == 0) ? kColorUnknown : kColorGround;
            fillRect(sdlRenderer, screenX, screenY, tileSize, tileSize, groundColor);

            // Wall overlay (collision tile == 9 means wall)
            int collisionTile = scene.getTileAt("collision", x, y);
            if (collisionTile == 9) {
                fillRect(sdlRenderer, screenX, screenY, tileSize, tileSize, kColorWall);
            }
        }
    }
}

void Renderer2D::renderEntities(const MapScene& scene, const GameState& state, const Camera2D& camera) {
    if (!sdlRenderer) return;
    int tileSize = scene.getTileSize();
    if (tileSize <= 0) tileSize = 32;
    Vec2i cam = camera.getPosition();

    // Events
    for (const auto& ev : scene.getData().events) {
        int sx = ev.x * tileSize - cam.x;
        int sy = ev.y * tileSize - cam.y;
        Color c = colorForEvent(ev);
        // Inset a bit so the underlying tile shows around the event sprite.
        int pad = std::max(2, tileSize / 8);
        fillRect(sdlRenderer, sx + pad, sy + pad, tileSize - 2 * pad, tileSize - 2 * pad, c);
        drawRect(sdlRenderer, sx + pad, sy + pad, tileSize - 2 * pad, tileSize - 2 * pad, kColorDlgEdge);
    }

    // Player
    int psx = state.getPlayerX() * tileSize - cam.x;
    int psy = state.getPlayerY() * tileSize - cam.y;
    int pad = std::max(2, tileSize / 8);
    fillRect(sdlRenderer, psx + pad, psy + pad, tileSize - 2 * pad, tileSize - 2 * pad, kColorPlayer);

    // Direction indicator (small dot on the facing edge)
    int dotSize = std::max(3, tileSize / 6);
    int cx = psx + tileSize / 2 - dotSize / 2;
    int cy = psy + tileSize / 2 - dotSize / 2;
    switch (state.getPlayerDirection()) {
        case Direction::Up:    cy = psy + pad + 1; break;
        case Direction::Down:  cy = psy + tileSize - pad - dotSize - 1; break;
        case Direction::Left:  cx = psx + pad + 1; break;
        case Direction::Right: cx = psx + tileSize - pad - dotSize - 1; break;
    }
    fillRect(sdlRenderer, cx, cy, dotSize, dotSize, kColorPlayerEye);
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
    sdlRenderer = nullptr;
}
