#include <doctest/doctest.h>
#include "core/PlayerMotion.h"
#include "core/MovementSpeed.h"

TEST_CASE("PlayerMotion interpolates one tile at four tiles per second") {
    PlayerMotion motion;
    motion.snapToTile(2, 3, 32);

    CHECK(motion.visualX() == doctest::Approx(64.0f));
    CHECK(motion.visualY() == doctest::Approx(96.0f));

    motion.startMove(3, 3, Direction::Right, 32, 4.0f);
    CHECK(motion.isMoving());
    CHECK(motion.targetTileX() == 3);
    CHECK(motion.targetTileY() == 3);

    motion.update(0.125f);
    CHECK(motion.isMoving());
    CHECK(motion.visualX() == doctest::Approx(80.0f));
    CHECK(motion.visualY() == doctest::Approx(96.0f));

    motion.update(0.125f);
    CHECK_FALSE(motion.isMoving());
    CHECK(motion.consumeCompletedStep());
    CHECK_FALSE(motion.consumeCompletedStep());
    CHECK(motion.visualX() == doctest::Approx(96.0f));
    CHECK(motion.visualY() == doctest::Approx(96.0f));
}

TEST_CASE("MovementSpeed maps RPG Maker-style speed tiers to tile durations") {
    CHECK(movementSpeedToTilesPerSecond("normal") == doctest::Approx(4.0f));
    CHECK(movementSpeedToTilesPerSecond("double") == doctest::Approx(8.0f));
    CHECK(movementSpeedToTilesPerSecond("quadruple") == doctest::Approx(16.0f));
    CHECK(movementSpeedToTilesPerSecond("half") == doctest::Approx(2.0f));
    CHECK(movementSpeedToTilesPerSecond("oneQuarter") == doctest::Approx(1.0f));
    CHECK(movementSpeedToTilesPerSecond("oneEighth") == doctest::Approx(0.5f));
    CHECK(movementSpeedToTilesPerSecond("bogus") == doctest::Approx(8.0f));
}

TEST_CASE("PlayerMotion double speed completes a tile in 125ms") {
    PlayerMotion motion;
    motion.snapToTile(2, 3, 32);

    motion.startMove(3, 3, Direction::Right, 32, movementSpeedToTilesPerSecond("double"));
    motion.update(0.124f);
    CHECK(motion.isMoving());
    CHECK_FALSE(motion.consumeCompletedStep());

    motion.update(0.001f);
    CHECK_FALSE(motion.isMoving());
    CHECK(motion.consumeCompletedStep());
    CHECK(motion.visualX() == doctest::Approx(96.0f));
}

TEST_CASE("PlayerMotion can be snapped after transfers and clears pending completion") {
    PlayerMotion motion;
    motion.snapToTile(1, 1, 32);
    motion.startMove(2, 1, Direction::Right, 32, 4.0f);
    motion.update(1.0f);
    CHECK(motion.consumeCompletedStep());

    motion.snapToTile(20, 19, 32);
    CHECK_FALSE(motion.isMoving());
    CHECK_FALSE(motion.consumeCompletedStep());
    CHECK(motion.currentTileX() == 20);
    CHECK(motion.currentTileY() == 19);
    CHECK(motion.visualX() == doctest::Approx(640.0f));
    CHECK(motion.visualY() == doctest::Approx(608.0f));
}
