#pragma once
#include <string>
#include <algorithm>
#include <cctype>

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
    std::string lower = str;
    std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char c) {
        return std::tolower(c);
    });
    if (lower == "up") return Direction::Up;
    if (lower == "left") return Direction::Left;
    if (lower == "right") return Direction::Right;
    return Direction::Down;
}
