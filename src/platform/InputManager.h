#pragma once

enum class KeyButton {
    Up,
    Down,
    Left,
    Right,
    Confirm, // E, Enter, Space
    Cancel,  // Escape
    Save,    // F5
    Load,    // F9
    None
};

class InputManager {
public:
    void update(const unsigned char* keyboardState);
    
    bool isPressed(KeyButton key) const;
    bool isJustPressed(KeyButton key) const;

private:
    bool currentState[8] = {false};
    bool previousState[8] = {false};
};
