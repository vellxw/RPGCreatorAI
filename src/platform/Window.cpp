#include "platform/Window.h"
#include "core/Logger.h"
#include <SDL.h>

bool Window::initialize(int width, int height, const char* title) {
    if (SDL_Init(SDL_INIT_VIDEO) != 0) {
        Logger::error(std::string("SDL_Init Error: ") + SDL_GetError());
        return false;
    }

    window = SDL_CreateWindow(title,
                              SDL_WINDOWPOS_CENTERED,
                              SDL_WINDOWPOS_CENTERED,
                              width, height,
                              SDL_WINDOW_SHOWN);
    if (!window) {
        Logger::error(std::string("SDL_CreateWindow Error: ") + SDL_GetError());
        SDL_Quit();
        return false;
    }

    renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_ACCELERATED);
    if (!renderer) {
        Logger::error(std::string("SDL_CreateRenderer Error: ") + SDL_GetError());
        SDL_DestroyWindow(window);
        window = nullptr;
        SDL_Quit();
        return false;
    }

    return true;
}

void Window::shutdown() {
    if (renderer) {
        SDL_DestroyRenderer(renderer);
        renderer = nullptr;
    }
    if (window) {
        SDL_DestroyWindow(window);
        window = nullptr;
        SDL_Quit();
    }
}

void Window::processEvents(bool& quitOut) {
    SDL_Event e;
    while (SDL_PollEvent(&e)) {
        if (e.type == SDL_QUIT) {
            quitOut = true;
        }
    }
}

const unsigned char* Window::getKeyboardState() const {
    return SDL_GetKeyboardState(nullptr);
}
