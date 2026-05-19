#include "core/PlayerMotion.h"
#include <algorithm>

void PlayerMotion::snapToTile(int tileX, int tileY, int tileSize) {
    currentTileX_ = tileX;
    currentTileY_ = tileY;
    targetTileX_ = tileX;
    targetTileY_ = tileY;
    tileSize_ = tileSize > 0 ? tileSize : 32;
    visualX_ = static_cast<float>(tileX * tileSize_);
    visualY_ = static_cast<float>(tileY * tileSize_);
    startX_ = visualX_;
    startY_ = visualY_;
    targetX_ = visualX_;
    targetY_ = visualY_;
    elapsed_ = 0.0f;
    moving_ = false;
    completedStep_ = false;
}

void PlayerMotion::startMove(int targetTileX, int targetTileY, Direction dir, int tileSize, float tilesPerSecond) {
    if (moving_) return;

    direction_ = dir;
    targetTileX_ = targetTileX;
    targetTileY_ = targetTileY;
    tileSize_ = tileSize > 0 ? tileSize : 32;
    startX_ = visualX_;
    startY_ = visualY_;
    targetX_ = static_cast<float>(targetTileX_ * tileSize_);
    targetY_ = static_cast<float>(targetTileY_ * tileSize_);
    elapsed_ = 0.0f;
    duration_ = tilesPerSecond > 0.0f ? 1.0f / tilesPerSecond : 0.0f;
    completedStep_ = false;

    if (duration_ <= 0.0f || (startX_ == targetX_ && startY_ == targetY_)) {
        visualX_ = targetX_;
        visualY_ = targetY_;
        currentTileX_ = targetTileX_;
        currentTileY_ = targetTileY_;
        moving_ = false;
        completedStep_ = true;
        return;
    }

    moving_ = true;
}

void PlayerMotion::update(float dt) {
    if (!moving_) return;

    elapsed_ += std::max(0.0f, dt);
    const float t = duration_ > 0.0f ? std::min(1.0f, elapsed_ / duration_) : 1.0f;
    visualX_ = startX_ + (targetX_ - startX_) * t;
    visualY_ = startY_ + (targetY_ - startY_) * t;

    if (t >= 1.0f) {
        visualX_ = targetX_;
        visualY_ = targetY_;
        currentTileX_ = targetTileX_;
        currentTileY_ = targetTileY_;
        moving_ = false;
        completedStep_ = true;
    }
}

bool PlayerMotion::consumeCompletedStep() {
    const bool completed = completedStep_;
    completedStep_ = false;
    return completed;
}
