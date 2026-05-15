#include "world/CollisionSystem.h"

bool CollisionSystem::canMoveTo(const MapScene& scene, int targetX, int targetY) {
    // Bounds check: reject positions outside the map dimensions
    if (targetX < 0 || targetX >= scene.getWidth() ||
        targetY < 0 || targetY >= scene.getHeight()) {
        return false;
    }

    // Collision layer check: delegate to MapScene's solid check for in-bounds positions
    return !scene.isSolidAt(targetX, targetY);
}
