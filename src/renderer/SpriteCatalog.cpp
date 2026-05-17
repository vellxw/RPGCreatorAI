#include "renderer/SpriteCatalog.h"
#include "types/EventTypes.h"

std::string SpriteCatalog::tileAssetFor(int groundTile, int collisionTile) {
    if (collisionTile == 9) return "tile_wall";
    switch (groundTile) {
        case 2:
            return "tile_path";
        case 3:
            return "tile_water";
        case 1:
        default:
            return "tile_grass";
    }
}

std::string SpriteCatalog::eventAssetFor(const EventData& event) {
    if (!event.sprite.empty()) return event.sprite;
    if (event.type == "npc") return "npc_old_man";
    if (event.type == "chest") return "chest_closed";
    if (event.type == "transfer") return "transfer_door";
    return "enemy_slime";
}

std::string SpriteCatalog::runtimePathFor(const std::string& assetKey) {
    return "assets/generated/runtime/" + assetKey + ".bmp";
}
