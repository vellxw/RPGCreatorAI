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

// Phase 6 — every database shard the runtime knows about. Empty paths
// indicate the file is not declared; callers should treat that as "use the
// safe empty default".
struct DatabaseReference {
    std::string itemsPath;
    std::string actorsPath;
    std::string classesPath;
    std::string skillsPath;
    std::string enemiesPath;
    std::string troopsPath;
    std::string questsPath;
    std::string shopsPath;
    std::string systemPath;
    std::string switchesPath;
    std::string variablesPath;
    std::string commonEventsPath;
};

struct ProjectData {
    int schemaVersion = 0;
    std::string title;
    std::string startMapId;
    StartPosition startPosition;
    std::vector<MapReference> maps;
    DatabaseReference database;
};
