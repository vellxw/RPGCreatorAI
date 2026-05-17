#pragma once

#include <string>

struct EventData;

class SpriteCatalog {
public:
    static std::string tileAssetFor(int groundTile, int collisionTile);
    static std::string eventAssetFor(const EventData& event);
    static std::string runtimePathFor(const std::string& assetKey);
};
