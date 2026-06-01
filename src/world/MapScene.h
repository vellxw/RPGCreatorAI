#pragma once
#include "types/MapTypes.h"
#include "types/Vec2i.h"
#include <optional>
#include <string>
#include <unordered_map>

class MapScene {
public:
    void loadFromData(const MapData& data);
    
    const MapData& getData() const { return currentData; }
    int getWidth() const { return currentData.width; }
    int getHeight() const { return currentData.height; }
    int getTileSize() const { return currentData.tileSize; }
    
    int getTileAt(const std::string& layerName, int x, int y) const;
    bool isSolidAt(int x, int y) const;
    const EventData* getEventAt(int x, int y) const;
    const EventData* getEventById(const std::string& eventId) const;
    std::optional<Vec2i> getRuntimeEventPosition(const std::string& eventId) const;
    std::optional<RuntimeEventState> getRuntimeEventState(const std::string& eventId) const;
    bool setRuntimeEventPosition(const std::string& eventId, int x, int y, Direction direction);
    bool setRuntimeEventDirection(const std::string& eventId, Direction direction);

private:
    Vec2i positionForEvent(const EventData& event) const;

    MapData currentData;
    std::unordered_map<std::string, RuntimeEventState> runtimeEvents;
};
