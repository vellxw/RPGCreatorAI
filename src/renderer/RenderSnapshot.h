#pragma once

#include "types/Direction.h"
#include <string>
#include <vector>

struct SpriteSourceRect {
    bool active = false;
    int x = 0;
    int y = 0;
    int w = 0;
    int h = 0;
};

struct EntityRenderSprite {
    std::string assetKey;
    float worldX = 0.0f;
    float worldY = 0.0f;
    int worldW = 32;
    int worldH = 32;
    Direction direction = Direction::Down;
    bool showDirectionDot = false;
    SpriteSourceRect source;
};

struct RenderEntitiesSnapshot {
    std::vector<EntityRenderSprite> events;
    EntityRenderSprite player;
};
