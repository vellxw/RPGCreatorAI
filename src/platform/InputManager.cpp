#include "platform/InputManager.h"
#include <SDL_scancode.h>

void InputManager::update(const unsigned char* keyboardState) {
    for (int i = 0; i < kKeyCount; ++i) {
        previousState[i] = currentState[i];
    }

    currentState[(int)KeyButton::Up]      = keyboardState[SDL_SCANCODE_W] || keyboardState[SDL_SCANCODE_UP];
    currentState[(int)KeyButton::Down]    = keyboardState[SDL_SCANCODE_S] || keyboardState[SDL_SCANCODE_DOWN];
    currentState[(int)KeyButton::Left]    = keyboardState[SDL_SCANCODE_A] || keyboardState[SDL_SCANCODE_LEFT];
    currentState[(int)KeyButton::Right]   = keyboardState[SDL_SCANCODE_D] || keyboardState[SDL_SCANCODE_RIGHT];
    currentState[(int)KeyButton::Confirm] = keyboardState[SDL_SCANCODE_E] || keyboardState[SDL_SCANCODE_RETURN] || keyboardState[SDL_SCANCODE_SPACE];
    currentState[(int)KeyButton::Cancel]  = keyboardState[SDL_SCANCODE_ESCAPE] || keyboardState[SDL_SCANCODE_BACKSPACE];
    currentState[(int)KeyButton::Save]    = keyboardState[SDL_SCANCODE_F5];
    currentState[(int)KeyButton::Load]    = keyboardState[SDL_SCANCODE_F9];
    currentState[(int)KeyButton::Menu]    = keyboardState[SDL_SCANCODE_TAB];
}

bool InputManager::isPressed(KeyButton key) const {
    if (key == KeyButton::None) return false;
    return currentState[(int)key];
}

bool InputManager::isJustPressed(KeyButton key) const {
    if (key == KeyButton::None) return false;
    return currentState[(int)key] && !previousState[(int)key];
}
