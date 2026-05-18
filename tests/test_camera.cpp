#include <doctest/doctest.h>
#include "renderer/Camera2D.h"

TEST_CASE("Camera follow clamps to wider map bounds") {
    Camera2D camera;
    camera.setViewport(1280, 720);
    camera.follow(96, 96, 1920, 1080);
    CHECK(camera.getPosition().x == 0);
    CHECK(camera.getPosition().y == 0);

    camera.follow(1824, 984, 1920, 1080);
    CHECK(camera.getPosition().x == 640);
    CHECK(camera.getPosition().y == 360);
}

TEST_CASE("Camera centers an intentionally smaller fixed room") {
    Camera2D camera;
    camera.setViewport(1280, 720);
    camera.centerRoom(640, 384);
    CHECK(camera.getPosition().x == -320);
    CHECK(camera.getPosition().y == -168);
}
