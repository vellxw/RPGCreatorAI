#include <doctest/doctest.h>
#include "database/AnimationDatabase.h"
#include <filesystem>
#include <fstream>

TEST_CASE("AnimationDatabase loads directional clips and resolves fallback directions") {
    const auto path = std::filesystem::temp_directory_path() / "rpgcreatorai_animation_test.json";
    std::ofstream out(path);
    out << R"({
      "schemaVersion": 1,
      "sets": [
        {
          "id": "player_adventurer",
          "clips": [
            {
              "action": "walk",
              "direction": "down",
              "asset": "player_adventurer_walk_down",
              "frameSize": { "width": 64, "height": 64 },
              "frameCount": 4,
              "fps": 8,
              "loop": true,
              "anchor": { "x": 32, "y": 54 }
            },
            {
              "action": "idle",
              "direction": "any",
              "asset": "player_adventurer_idle_down",
              "frameSize": { "width": 64, "height": 64 },
              "frameCount": 4,
              "fps": 4,
              "loop": true,
              "anchor": { "x": 32, "y": 54 }
            }
          ]
        }
      ]
    })";
    out.close();

    AnimationDatabase db;
    REQUIRE(db.load(path.string()));

    const AnimationClip* walk = db.findClip("player_adventurer", "walk", Direction::Down);
    REQUIRE(walk != nullptr);
    CHECK(walk->asset == "player_adventurer_walk_down");
    CHECK(walk->frameSize.width == 64);
    CHECK(walk->frameCount == 4);
    CHECK(walk->fps == doctest::Approx(8.0f));
    CHECK(walk->loop);
    CHECK(walk->anchor.x == 32);
    CHECK(walk->anchor.y == 54);

    const AnimationClip* idle = db.findClip("player_adventurer", "idle", Direction::Left);
    REQUIRE(idle != nullptr);
    CHECK(idle->direction == "any");
    CHECK(idle->asset == "player_adventurer_idle_down");
}
