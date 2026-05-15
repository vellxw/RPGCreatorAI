#pragma once
#include <string>

enum class Direction {
    Up,
    Down,
    Left,
    Right
};

inline std::string directionToString(Direction dir) {
    switch (dir) {
        case Direction::Up: return "up";
        case Direction::Down: return "down";
        case Direction::Left: return "left";
        case Direction::Right: return "right";
        default: return "down";
    }
}

inline Direction stringToDirection(const std::string& str) {
    if (str == "up") return Direction::Up;
    if (str == "left") return Direction::Left;
    if (str == "right") return Direction::Right;
    return Direction::Down;
}
