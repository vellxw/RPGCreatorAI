#pragma once
#include "types/Vec2i.h"

class Camera2D {
public:
    void setViewport(int width, int height);
    void setPosition(int x, int y);
    void follow(int targetCenterX, int targetCenterY, int worldWidth, int worldHeight);
    void centerRoom(int worldWidth, int worldHeight);
    Vec2i getPosition() const { return position; }

private:
    Vec2i position = {0, 0};
    int viewportWidth = 800;
    int viewportHeight = 600;
};

inline void Camera2D::setViewport(int width, int height) {
    viewportWidth = width > 0 ? width : 1;
    viewportHeight = height > 0 ? height : 1;
}

inline void Camera2D::setPosition(int x, int y) {
    position.x = x;
    position.y = y;
}

inline void Camera2D::follow(int targetCenterX, int targetCenterY, int worldWidth, int worldHeight) {
    auto clampAxis = [](int desired, int world, int viewport) {
        if (world <= viewport) {
            return (world - viewport) / 2;
        }
        if (desired < 0) return 0;
        const int maxPosition = world - viewport;
        if (desired > maxPosition) return maxPosition;
        return desired;
    };

    position.x = clampAxis(targetCenterX - viewportWidth / 2, worldWidth, viewportWidth);
    position.y = clampAxis(targetCenterY - viewportHeight / 2, worldHeight, viewportHeight);
}

inline void Camera2D::centerRoom(int worldWidth, int worldHeight) {
    position.x = (worldWidth - viewportWidth) / 2;
    position.y = (worldHeight - viewportHeight) / 2;
}
