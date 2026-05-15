#pragma once
#include "world/MapScene.h"

class CollisionSystem {
public:
    static bool canMoveTo(const MapScene& scene, int targetX, int targetY);
};
