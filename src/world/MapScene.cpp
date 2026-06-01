#include "world/MapScene.h"

void MapScene::loadFromData(const MapData& data) {
    currentData = data;
    runtimeEvents.clear();
    for (const auto& event : currentData.events) {
        RuntimeEventState state;
        state.x = event.x;
        state.y = event.y;
        state.visualX = static_cast<float>(event.x);
        state.visualY = static_cast<float>(event.y);
        runtimeEvents[event.id] = state;
    }
}

int MapScene::getTileAt(const std::string& layerName, int x, int y) const {
    if (x < 0 || x >= currentData.width || y < 0 || y >= currentData.height) {
        return 0; // Out of bounds
    }

    for (const auto& layer : currentData.layers) {
        if (layer.name == layerName) {
            int index = y * currentData.width + x;
            if (index >= 0 && index < static_cast<int>(layer.tiles.size())) {
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

    // Events at a cell override the collision-layer tile. This lets
    // designers place doors / transfer tiles inside otherwise-solid
    // walls without having to edit the collision layer.
    const EventData* ev = getEventAt(x, y);
    if (ev) {
        return ev->solid;
    }

    int collisionTile = getTileAt("collision", x, y);
    if (collisionTile == 9) {
        return true;
    }

    return false;
}

const EventData* MapScene::getEventAt(int x, int y) const {
    for (const auto& ev : currentData.events) {
        const Vec2i pos = positionForEvent(ev);
        if (pos.x == x && pos.y == y) {
            return &ev;
        }
    }
    return nullptr;
}

const EventData* MapScene::getEventById(const std::string& eventId) const {
    for (const auto& ev : currentData.events) {
        if (ev.id == eventId) return &ev;
    }
    return nullptr;
}

std::optional<Vec2i> MapScene::getRuntimeEventPosition(const std::string& eventId) const {
    const auto it = runtimeEvents.find(eventId);
    if (it == runtimeEvents.end()) return std::nullopt;
    return Vec2i{it->second.x, it->second.y};
}

std::optional<RuntimeEventState> MapScene::getRuntimeEventState(const std::string& eventId) const {
    const auto it = runtimeEvents.find(eventId);
    if (it == runtimeEvents.end()) return std::nullopt;
    return it->second;
}

bool MapScene::setRuntimeEventPosition(const std::string& eventId,
                                       int x,
                                       int y,
                                       Direction direction) {
    const auto it = runtimeEvents.find(eventId);
    if (it == runtimeEvents.end()) return false;

    it->second.x = x;
    it->second.y = y;
    it->second.direction = direction;
    it->second.visualX = static_cast<float>(x);
    it->second.visualY = static_cast<float>(y);
    return true;
}

bool MapScene::setRuntimeEventDirection(const std::string& eventId, Direction direction) {
    const auto it = runtimeEvents.find(eventId);
    if (it == runtimeEvents.end()) return false;

    it->second.direction = direction;
    return true;
}

Vec2i MapScene::positionForEvent(const EventData& event) const {
    const auto it = runtimeEvents.find(event.id);
    if (it == runtimeEvents.end()) return Vec2i{event.x, event.y};
    return Vec2i{it->second.x, it->second.y};
}
