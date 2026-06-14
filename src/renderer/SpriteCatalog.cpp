#include "renderer/SpriteCatalog.h"
#include "types/EventTypes.h"
#include "core/GameConstants.h"

std::string SpriteCatalog::tileAssetFor(int groundTile, int collisionTile) {
    if (collisionTile == GameConstants::kCollisionTileId) {
        if (groundTile == 5) return "tile_tree";
        if (groundTile == 7) return "tile_interior_wall";
        return "tile_wall";
    }
    switch (groundTile) {
        case 0:
            return "tile_void_warning";
        case 2:
            return "tile_path";
        case 3:
            return "tile_water";
        case 4:
            return "tile_snow";
        case 5:
            return "tile_tree";
        case 6:
            return "tile_interior_floor";
        case 7:
            return "tile_interior_wall";
        case 1:
            return "tile_grass";
        default:
            return "tile_void_warning";
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
