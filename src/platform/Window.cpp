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

bool Window::saveScreenshot(const char* path) const {
    if (!renderer || !path) return false;
    int w = 0, h = 0;
    if (SDL_GetRendererOutputSize(renderer, &w, &h) != 0) {
        Logger::error(std::string("SDL_GetRendererOutputSize: ") + SDL_GetError());
        return false;
    }
    SDL_Surface* surf = SDL_CreateRGBSurfaceWithFormat(0, w, h, 32, SDL_PIXELFORMAT_ARGB8888);
    if (!surf) {
        Logger::error(std::string("SDL_CreateRGBSurfaceWithFormat: ") + SDL_GetError());
        return false;
    }
    int rc = SDL_RenderReadPixels(renderer, nullptr, SDL_PIXELFORMAT_ARGB8888, surf->pixels, surf->pitch);
    if (rc != 0) {
        Logger::error(std::string("SDL_RenderReadPixels: ") + SDL_GetError());
        SDL_FreeSurface(surf);
        return false;
    }
    rc = SDL_SaveBMP(surf, path);
    SDL_FreeSurface(surf);
    if (rc != 0) {
        Logger::error(std::string("SDL_SaveBMP: ") + SDL_GetError());
        return false;
    }
    return true;
}
