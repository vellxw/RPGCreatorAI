#pragma once
#include <string>
#include <vector>
#include <memory>
#include "types/EventTypes.h"

struct MapLayer {
    std::string name;
    std::string type;
    std::string role;
    bool visible = true;
    bool locked = false;
    std::vector<int> tiles;
};

struct MapData {
    int schemaVersion;
    std::string id;
    std::string name;
    std::string displayName;
    std::string tilesetId;
    int width;
    int height;
    int tileSize;
    std::vector<MapLayer> layers;
    std::vector<EventData> events;
};
