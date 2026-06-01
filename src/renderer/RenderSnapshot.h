#pragma once

#include "types/Direction.h"
#include <algorithm>
#include <string>
#include <vector>

struct SpriteSourceRect {
    bool active = false;
    int x = 0;
    int y = 0;
    int w = 0;
    int h = 0;
};

enum class EntityRenderPriority {
    Below,
    Same,
    Above
};

enum class EntityRenderPass {
    BelowAndSame,
    Above
};

struct EntityRenderSprite {
    std::string id;
    std::string assetKey;
    float worldX = 0.0f;
    float worldY = 0.0f;
    int worldW = 32;
    int worldH = 32;
    Direction direction = Direction::Down;
    EntityRenderPriority renderPriority = EntityRenderPriority::Same;
    bool showDirectionDot = false;
    SpriteSourceRect source;
};

struct RenderEntitiesSnapshot {
    std::vector<EntityRenderSprite> events;
    EntityRenderSprite player;
};

inline float entityRenderFootY(const EntityRenderSprite& sprite) {
    return sprite.worldY + static_cast<float>(std::max(1, sprite.worldH));
}

inline std::string entityRenderStableId(const EntityRenderSprite& sprite) {
    if (!sprite.id.empty()) return sprite.id;
    return sprite.assetKey;
}

inline std::vector<EntityRenderSprite> buildEntityRenderOrder(const RenderEntitiesSnapshot& entities) {
    std::vector<EntityRenderSprite> ordered;
    ordered.reserve(entities.events.size() + 1);

    auto appendBucket = [&](EntityRenderPriority priority) {
        std::vector<EntityRenderSprite> bucket;
        for (const auto& event : entities.events) {
            if (event.renderPriority == priority) bucket.push_back(event);
        }
        if (entities.player.renderPriority == priority) {
            bucket.push_back(entities.player);
        }

        std::sort(bucket.begin(), bucket.end(),
                  [priority](const EntityRenderSprite& lhs, const EntityRenderSprite& rhs) {
                      if (priority == EntityRenderPriority::Same) {
                          const float lhsFoot = entityRenderFootY(lhs);
                          const float rhsFoot = entityRenderFootY(rhs);
                          if (lhsFoot < rhsFoot) return true;
                          if (rhsFoot < lhsFoot) return false;
                      }
                      return entityRenderStableId(lhs) < entityRenderStableId(rhs);
                  });
        ordered.insert(ordered.end(), bucket.begin(), bucket.end());
    };

    appendBucket(EntityRenderPriority::Below);
    appendBucket(EntityRenderPriority::Same);
    appendBucket(EntityRenderPriority::Above);
    return ordered;
}

inline bool entityRenderPassIncludes(EntityRenderPass pass, const EntityRenderSprite& sprite) {
    if (pass == EntityRenderPass::Above) {
        return sprite.renderPriority == EntityRenderPriority::Above;
    }
    return sprite.renderPriority != EntityRenderPriority::Above;
}
