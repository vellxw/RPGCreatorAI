#include <doctest/doctest.h>
#include "renderer/RenderSnapshot.h"

namespace {

EntityRenderSprite sprite(const std::string& id,
                          EntityRenderPriority priority,
                          float y,
                          int h = 32) {
    EntityRenderSprite s;
    s.id = id;
    s.assetKey = id;
    s.renderPriority = priority;
    s.worldY = y;
    s.worldH = h;
    return s;
}

std::vector<std::string> idsFor(const std::vector<EntityRenderSprite>& sprites) {
    std::vector<std::string> ids;
    for (const auto& s : sprites) ids.push_back(s.id);
    return ids;
}

} // namespace

TEST_CASE("Render snapshot orders below, y-sorted same bucket, then above") {
    RenderEntitiesSnapshot snapshot;
    snapshot.events = {
        sprite("above_lamp", EntityRenderPriority::Above, 0.0f),
        sprite("same_front", EntityRenderPriority::Same, 64.0f),
        sprite("below_shadow", EntityRenderPriority::Below, 96.0f),
        sprite("same_back", EntityRenderPriority::Same, 8.0f),
    };
    snapshot.player = sprite("player", EntityRenderPriority::Same, 32.0f);

    const auto ordered = buildEntityRenderOrder(snapshot);

    CHECK(idsFor(ordered) == std::vector<std::string>{
        "below_shadow",
        "same_back",
        "player",
        "same_front",
        "above_lamp",
    });
}

TEST_CASE("Render snapshot uses stable id tie breaker for equal foot Y") {
    RenderEntitiesSnapshot snapshot;
    snapshot.events = {
        sprite("same_b", EntityRenderPriority::Same, 32.0f),
        sprite("same_a", EntityRenderPriority::Same, 32.0f),
    };
    snapshot.player = sprite("player", EntityRenderPriority::Same, 32.0f);

    const auto ordered = buildEntityRenderOrder(snapshot);

    CHECK(idsFor(ordered) == std::vector<std::string>{
        "player",
        "same_a",
        "same_b",
    });
}

