#pragma once

enum class KeyButton {
    Up,
    Down,
    Left,
    Right,
    Confirm, // E, Enter, Space
    Cancel,  // Escape (closes dialogue / cancels menu choice)
    Save,    // F5
    Load,    // F9
    Menu,    // Tab (opens runtime pause menu when no dialogue/battle is active)
    None
};

class InputManager {
public:
    void update(const unsigned char* keyboardState);

    bool isPressed(KeyButton key) const;
    bool isJustPressed(KeyButton key) const;

private:
    static constexpr int kKeyCount = 9;
    bool currentState[kKeyCount] = {false};
    bool previousState[kKeyCount] = {false};
};
