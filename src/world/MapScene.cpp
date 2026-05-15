#include "world/MapScene.h"

void MapScene::loadFromData(const MapData& data) {
    currentData = data;
}

int MapScene::getTileAt(const std::string& layerName, int x, int y) const {
    if (x < 0 || x >= currentData.width || y < 0 || y >= currentData.height) {
        return 0; // Out of bounds
    }
    
    for (const auto& layer : currentData.layers) {
        if (layer.name == layerName) {
            int index = y * currentData.width + x;
            if (index >= 0 && index < layer.tiles.size()) {
                return layer.tiles[index];
            }
        }
    }
    return 0;
}

bool MapScene::isSolidAt(int x, int y) const {
    if (x < 0 || x >= currentData.width || y < 0 || y >= currentData.height) {
        return true; // Boundaries are solid
    }
    
    int collisionTile = getTileAt("collision", x, y);
    if (collisionTile == 9) {
        return true;
    }
    
    const EventData* ev = getEventAt(x, y);
    if (ev && ev->solid) {
        return true;
    }
    
    return false;
}

const EventData* MapScene::getEventAt(int x, int y) const {
    for (const auto& ev : currentData.events) {
        if (ev.x == x && ev.y == y) {
            return &ev;
        }
    }
    return nullptr;
}
