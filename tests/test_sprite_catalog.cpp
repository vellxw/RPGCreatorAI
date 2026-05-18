#include <doctest/doctest.h>
#include "renderer/SpriteCatalog.h"
#include "types/EventTypes.h"

TEST_CASE("SpriteCatalog resolves generated tile assets") {
    CHECK(SpriteCatalog::tileAssetFor(1, 0) == "tile_grass");
    CHECK(SpriteCatalog::tileAssetFor(2, 0) == "tile_path");
    CHECK(SpriteCatalog::tileAssetFor(3, 0) == "tile_water");
    CHECK(SpriteCatalog::tileAssetFor(4, 0) == "tile_snow");
    CHECK(SpriteCatalog::tileAssetFor(5, 0) == "tile_tree");
    CHECK(SpriteCatalog::tileAssetFor(6, 0) == "tile_interior_floor");
    CHECK(SpriteCatalog::tileAssetFor(7, 0) == "tile_interior_wall");
    CHECK(SpriteCatalog::tileAssetFor(1, 9) == "tile_wall");
    CHECK(SpriteCatalog::tileAssetFor(5, 9) == "tile_tree");
    CHECK(SpriteCatalog::tileAssetFor(7, 9) == "tile_interior_wall");
    CHECK(SpriteCatalog::tileAssetFor(0, 0) == "tile_void_warning");
    CHECK(SpriteCatalog::tileAssetFor(99, 0) == "tile_void_warning");
}

TEST_CASE("SpriteCatalog prefers explicit event sprites and falls back by type") {
    EventData explicitSprite;
    explicitSprite.type = "npc";
    explicitSprite.sprite = "npc_shopkeeper";
    CHECK(SpriteCatalog::eventAssetFor(explicitSprite) == "npc_shopkeeper");

    EventData chest;
    chest.type = "chest";
    CHECK(SpriteCatalog::eventAssetFor(chest) == "chest_closed");

    EventData transfer;
    transfer.type = "transfer";
    CHECK(SpriteCatalog::eventAssetFor(transfer) == "transfer_door");

    EventData unknown;
    unknown.type = "object";
    CHECK(SpriteCatalog::eventAssetFor(unknown) == "enemy_slime");
}

TEST_CASE("SpriteCatalog builds runtime bmp paths") {
    CHECK(SpriteCatalog::runtimePathFor("player_adventurer") ==
          "assets/generated/runtime/player_adventurer.bmp");
}
