#pragma once
struct SDL_Window;
struct SDL_Renderer;

class Window {
public:
    bool initialize(int width, int height, const char* title);
    void shutdown();

    void processEvents(bool& quitOut);

    SDL_Window* getSDLWindow() const { return window; }
    SDL_Renderer* getSDLRenderer() const { return renderer; }

    const unsigned char* getKeyboardState() const;

    // Saves the current backbuffer as a 24-bit BMP. Used for the visual
    // verification harness; not part of the gameplay loop.
    bool saveScreenshot(const char* path) const;

private:
    SDL_Window* window = nullptr;
    SDL_Renderer* renderer = nullptr;
};
