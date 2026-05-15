#pragma once
#include <string>
struct SDL_Renderer;

// Minimal 5x7 embedded bitmap font for placeholder UI text. Each glyph is
// stored as a 7-row bitmap, 5 bits per row (LSB = leftmost pixel). This
// avoids an asset pipeline while still producing visible text in Phase 2.
class BitmapFont {
public:
    static constexpr int GlyphWidth  = 5;
    static constexpr int GlyphHeight = 7;

    // Renders `text` at pixel position (x, y) in the given color, scaled
    // by `scale` (1 = native 5x7). Unknown glyphs render as blank space.
    static void drawText(SDL_Renderer* renderer,
                         int x, int y,
                         const std::string& text,
                         int scale,
                         unsigned char r,
                         unsigned char g,
                         unsigned char b,
                         unsigned char a);

    // Returns the pixel width that drawText would produce for `text`.
    static int measureWidth(const std::string& text, int scale);
};
