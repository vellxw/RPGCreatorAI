#include <array>
#include <doctest/doctest.h>
#include <SDL.h>

#include "platform/InputManager.h"
#include "world/ProjectLoader.h"
#include "database/RpgDatabases.h"
#include "events/GameState.h"
#include "runtime/MenuSystem.h"

namespace {

void tap(InputManager& input, std::array<unsigned char, SDL_NUM_SCANCODES>& keys, SDL_Scancode code) {
    keys.fill(0);
    input.update(keys.data());
    keys[code] = 1;
    input.update(keys.data());
}

} // namespace

TEST_CASE("MenuSystem opens, navigates, and closes from the root screen") {
    rpg::MenuSystem menu;
    InputManager input;
    std::array<unsigned char, SDL_NUM_SCANCODES> keys{};

    CHECK_FALSE(menu.isOpen());
    menu.open();
    CHECK(menu.isOpen());
    CHECK(menu.current() == rpg::MenuSystem::Screen::Root);
    CHECK(menu.selection() == 0);

    tap(input, keys, SDL_SCANCODE_DOWN);
    CHECK(menu.handleInput(input));
    CHECK(menu.selection() == 1);

    tap(input, keys, SDL_SCANCODE_UP);
    CHECK(menu.handleInput(input));
    CHECK(menu.selection() == 0);

    tap(input, keys, SDL_SCANCODE_ESCAPE);
    CHECK(menu.handleInput(input));
    CHECK_FALSE(menu.isOpen());
}

TEST_CASE("MenuSystem enters a selected sub-screen from the root") {
    rpg::MenuSystem menu;
    InputManager input;
    std::array<unsigned char, SDL_NUM_SCANCODES> keys{};

    menu.open();
    menu.setSelectionForTest(2);

    tap(input, keys, SDL_SCANCODE_RETURN);
    CHECK(menu.handleInput(input));
    CHECK(menu.current() == rpg::MenuSystem::Screen::Quests);
}

TEST_CASE("MenuSystem snapshots inventory, party, and quest data for rendering") {
    auto project = ProjectLoader::load("data/project.json");
    REQUIRE(project.has_value());

    rpg::RpgDatabases dbs;
    REQUIRE(dbs.loadAll(*project));

    GameState state;
    state.addItem("potion", 2);
    state.addItem("mystery_orb", 1);
    state.setParty({"arc"});
    state.setActorHp("arc", 12);
    state.startQuest("lost_chest", {"open_chest", "talk_back"});
    state.updateQuestObjective("lost_chest", "open_chest", "done");

    rpg::MenuSystem menu;
    menu.open();

    auto vm = menu.snapshot(state, dbs);
    REQUIRE(vm.inventory.size() == 2);
    CHECK(vm.inventory[0].itemId == "mystery_orb");
    CHECK(vm.inventory[0].unknown);
    CHECK(vm.inventory[1].itemId == "potion");
    CHECK(vm.inventory[1].name == "Potion");
    CHECK(vm.inventory[1].description == "Restores 20 HP when used.");

    REQUIRE(vm.party.size() == 1);
    CHECK(vm.party[0].name == "Arc");
    CHECK(vm.party[0].className == "Hero");
    CHECK(vm.party[0].hp == 12);
    CHECK(vm.party[0].attack == 9); // base 6 + iron sword 3

    REQUIRE(vm.quests.size() == 1);
    CHECK(vm.quests[0].title == "The Lost Chest");
    REQUIRE(vm.quests[0].objectives.size() == 2);
    CHECK(vm.quests[0].objectives[0].done);
    CHECK_FALSE(vm.quests[0].objectives[1].done);
}
