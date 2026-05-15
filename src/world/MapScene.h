#pragma once
#include "types/MapTypes.h"
#include <optional>

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

private:
    MapData currentData;
};
