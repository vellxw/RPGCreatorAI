#include <doctest/doctest.h>
#include "world/MapScene.h"
#include <string>
#include <utility>
#include <vector>

namespace {

MapLayer layer(const std::string& name,
               const std::string& type,
               const std::string& role,
               std::vector<int> tiles) {
    MapLayer out;
    out.name = name;
    out.type = type;
    out.role = role;
    out.tiles = std::move(tiles);
    return out;
}

MapData makeMap(std::vector<MapLayer> layers) {
    MapData map;
    map.schemaVersion = 1;
    map.id = "layers";
    map.name = "Layers";
    map.width = 2;
    map.height = 1;
    map.tileSize = 32;
    map.layers = std::move(layers);
    return map;
}

std::vector<std::string> namesFor(const std::vector<const MapLayer*>& layers) {
    std::vector<std::string> names;
    for (const auto* l : layers) names.push_back(l->name);
    return names;
}

} // namespace

TEST_CASE("MapScene selects background and foreground visual render layers by role") {
    MapScene scene;
    scene.loadFromData(makeMap({
        layer("ground", "visual", "ground", {1, 1}),
        layer("decor", "visual", "decoration", {0, 2}),
        layer("front", "visual", "foreground", {0, 5}),
        layer("collision", "collision", "collision", {9, 0}),
        layer("region", "region", "region", {1, 0}),
    }));

    CHECK(namesFor(scene.getRenderLayers(MapRenderPass::Background)) ==
          std::vector<std::string>{"ground", "decor"});
    CHECK(namesFor(scene.getRenderLayers(MapRenderPass::Foreground)) ==
          std::vector<std::string>{"front"});
}

TEST_CASE("MapScene treats empty foreground as a no-op render pass") {
    MapScene scene;
    scene.loadFromData(makeMap({
        layer("ground", "visual", "ground", {1, 1}),
        layer("foreground", "visual", "foreground", {0, 0}),
    }));

    CHECK(scene.getRenderLayers(MapRenderPass::Foreground).empty());
}
