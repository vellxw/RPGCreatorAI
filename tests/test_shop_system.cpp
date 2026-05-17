#include <array>
#include <doctest/doctest.h>
#include <SDL.h>

#include "database/RpgDatabases.h"
#include "events/GameState.h"
#include "platform/InputManager.h"
#include "runtime/ShopSystem.h"
#include "world/ProjectLoader.h"

namespace {

void tap(InputManager& input,
         std::array<unsigned char, SDL_NUM_SCANCODES>& keys,
         SDL_Scancode code) {
    keys.fill(0);
    input.update(keys.data());
    keys[code] = 1;
    input.update(keys.data());
}

} // namespace

TEST_CASE("ShopSystem snapshots listings and buys affordable items") {
    auto project = ProjectLoader::load("data/project.json");
    REQUIRE(project.has_value());

    rpg::RpgDatabases dbs;
    REQUIRE(dbs.loadAll(*project));

    GameState state;
    state.setGold(50);

    rpg::ShopSystem shop;
    REQUIRE(shop.open("town_shop", dbs));

    auto vm = shop.snapshot(state, dbs);
    REQUIRE(vm.active);
    CHECK(vm.shopName == "Town Shop");
    REQUIRE(vm.listings.size() == 1);
    CHECK(vm.listings[0].name == "Potion");
    CHECK(vm.listings[0].price == 25);
    CHECK(vm.listings[0].affordable);

    InputManager input;
    std::array<unsigned char, SDL_NUM_SCANCODES> keys{};
    tap(input, keys, SDL_SCANCODE_RETURN);
    CHECK(shop.handleInput(input, state, dbs));

    CHECK(state.getGold() == 25);
    CHECK(state.hasItem("potion", 1));
    vm = shop.snapshot(state, dbs);
    REQUIRE(vm.message.has_value());
    CHECK(*vm.message == "Bought Potion");
}

TEST_CASE("ShopSystem blocks unaffordable purchases and closes on cancel") {
    auto project = ProjectLoader::load("data/project.json");
    REQUIRE(project.has_value());

    rpg::RpgDatabases dbs;
    REQUIRE(dbs.loadAll(*project));

    GameState state;
    state.setGold(10);

    rpg::ShopSystem shop;
    REQUIRE(shop.open("town_shop", dbs));

    InputManager input;
    std::array<unsigned char, SDL_NUM_SCANCODES> keys{};
    tap(input, keys, SDL_SCANCODE_RETURN);
    CHECK(shop.handleInput(input, state, dbs));

    CHECK(state.getGold() == 10);
    CHECK_FALSE(state.hasItem("potion", 1));
    auto vm = shop.snapshot(state, dbs);
    REQUIRE(vm.message.has_value());
    CHECK(*vm.message == "Not enough gold");

    tap(input, keys, SDL_SCANCODE_ESCAPE);
    CHECK(shop.handleInput(input, state, dbs));
    CHECK_FALSE(shop.isOpen());
}
