#pragma once

#include "types/Direction.h"

class PlayerMotion {
public:
    void snapToTile(int tileX, int tileY, int tileSize);
    void startMove(int targetTileX, int targetTileY, Direction dir, int tileSize, float tilesPerSecond);
    void update(float dt);

    bool isMoving() const { return moving_; }
    bool consumeCompletedStep();

    int currentTileX() const { return currentTileX_; }
    int currentTileY() const { return currentTileY_; }
    int targetTileX() const { return targetTileX_; }
    int targetTileY() const { return targetTileY_; }
    Direction direction() const { return direction_; }

    float visualX() const { return visualX_; }
    float visualY() const { return visualY_; }

private:
    int currentTileX_ = 0;
    int currentTileY_ = 0;
    int targetTileX_ = 0;
    int targetTileY_ = 0;
    int tileSize_ = 32;
    Direction direction_ = Direction::Down;

    float startX_ = 0.0f;
    float startY_ = 0.0f;
    float targetX_ = 0.0f;
    float targetY_ = 0.0f;
    float visualX_ = 0.0f;
    float visualY_ = 0.0f;
    float elapsed_ = 0.0f;
    float duration_ = 0.25f;
    bool moving_ = false;
    bool completedStep_ = false;
};
