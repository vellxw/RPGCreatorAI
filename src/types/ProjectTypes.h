#pragma once
#include <string>
#include <vector>
#include "types/Vec2i.h"
#include "types/Direction.h"

struct StartPosition {
    Vec2i pos;
    Direction direction;
};

struct MapReference {
    std::string id;
    std::string path;
};

struct DatabaseReference {
    std::string itemsPath;
};

struct ProjectData {
    int schemaVersion;
    std::string title;
    std::string startMapId;
    StartPosition startPosition;
    std::vector<MapReference> maps;
    DatabaseReference database;
};
