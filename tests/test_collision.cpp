#include <doctest/doctest.h>
#include "world/CollisionSystem.h"
#include "world/MapScene.h"

TEST_CASE("CollisionSystem logic") {
    MapData data;
    data.width = 5;
    data.height = 5;
    
    MapLayer colLayer;
    colLayer.name = "collision";
    colLayer.tiles = {
        0, 0, 0, 0, 0,
        0, 9, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0
    };
    data.layers.push_back(colLayer);
    
    EventData solidEv;
    solidEv.x = 2;
    solidEv.y = 2;
    solidEv.solid = true;
    data.events.push_back(solidEv);
    
    MapScene scene;
    scene.loadFromData(data);
    
    SUBCASE("Out of bounds is blocked") {
        CHECK(CollisionSystem::canMoveTo(scene, -1, 0) == false);
        CHECK(CollisionSystem::canMoveTo(scene, 5, 0) == false);
        CHECK(CollisionSystem::canMoveTo(scene, 0, -1) == false);
        CHECK(CollisionSystem::canMoveTo(scene, 0, 5) == false);
    }
    
    SUBCASE("Empty tile is walkable") {
        CHECK(CollisionSystem::canMoveTo(scene, 0, 0) == true);
        CHECK(CollisionSystem::canMoveTo(scene, 4, 4) == true);
    }
    
    SUBCASE("Collision tile is blocked") {
        CHECK(CollisionSystem::canMoveTo(scene, 1, 1) == false);
    }
    
    SUBCASE("Solid event is blocked") {
        CHECK(CollisionSystem::canMoveTo(scene, 2, 2) == false);
    }
}
