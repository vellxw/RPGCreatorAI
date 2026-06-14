#pragma once

namespace GameConstants {
    // Tiles
    constexpr int kDefaultTileSize = 32;
    constexpr int kCollisionTileId = 9;
    constexpr int kMaxMovementRouteSteps = 64;

    // Timing
    constexpr int kDefaultMoveStepMs = 125;
    constexpr int kTargetFrameRate = 60;
    constexpr int kFrameDelayMs = 16;
    constexpr float kDefaultMovementDuration = 0.25f;

    // Viewport
    constexpr int kDefaultViewportWidth = 800;
    constexpr int kDefaultViewportHeight = 600;
    constexpr float kDefaultCharacterHeightTiles = 1.5f;
    constexpr const char* kDefaultAspectRatio = "16:9";

    // Battle
    constexpr int kAttackMultiplier = 2;
    constexpr int kMinDamage = 1;
    constexpr int kMaxBattleRounds = 64;

    // Save
    constexpr int kCurrentSaveSchemaVersion = 2;
    constexpr int kMaxSaveSlots = 3;

    // UI
    constexpr int kDialogueBoxHeight = 120;
    constexpr int kDialogueBoxWidth = 280;
    constexpr int kDefaultTextScale = 2;

    // Movement speeds (tiles per second)
    constexpr float kSpeedOneEighth = 0.5f;
    constexpr float kSpeedNormal = 1.0f;
    constexpr float kSpeedDouble = 2.0f;
    constexpr float kSpeedFast = 4.0f;
    constexpr float kSpeedQuadruple = 8.0f;
    constexpr float kSpeedInstant = 16.0f;
}
