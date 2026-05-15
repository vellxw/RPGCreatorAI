#pragma once
#include "types/MapTypes.h"
#include <optional>
#include <string>

class MapLoader {
public:
    static std::optional<MapData> load(const std::string& path);
};
