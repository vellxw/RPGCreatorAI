#include "core/MovementSpeed.h"

float movementSpeedToTilesPerSecond(const std::string& speed) {
    if (speed == "oneEighth") return 0.5f;
    if (speed == "oneQuarter") return 1.0f;
    if (speed == "half") return 2.0f;
    if (speed == "normal") return 4.0f;
    if (speed == "double" || speed.empty()) return 8.0f;
    if (speed == "quadruple") return 16.0f;
    return 8.0f;
}

