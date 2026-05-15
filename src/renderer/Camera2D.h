#pragma once
#include "types/Vec2i.h"

class Camera2D {
public:
    void setPosition(int x, int y);
    Vec2i getPosition() const { return position; }

private:
    Vec2i position = {0, 0};
};

inline void Camera2D::setPosition(int x, int y) {
    position.x = x;
    position.y = y;
}
