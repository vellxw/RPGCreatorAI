#include <array>
#include <doctest/doctest.h>
#include <SDL.h>

#include "platform/InputManager.h"
#include "world/ProjectLoader.h"
#include "database/RpgDatabases.h"
#include "events/GameState.h"
#include "runtime/MenuSystem.h"

#include <cstdio>
#include <fstream>
#include <optional>
#include <utility>

namespace {

void tap(InputManager& input, std::array<unsigned char, SDL_NUM_SCANCODES>& keys, SDL_Scancode code) {
    keys.fill(0);
    input.update(keys.data());
    keys[code] = 1;
    input.update(keys.data());
}

std::optional<std::string> readExisting(const std::string& path) {
    std::ifstream in(path);
    if (!in) return std::nullopt;
    return std::string((std::istreambuf_iterator<char>(in)),
                       std::istreambuf_iterator<char>());
}

void restoreFile(const std::string& path, const std::optional<std::string>& previous) {
    if (previous) {
        std::ofstream out(path);
        out << *previous;
    } else {
        std::remove(path.c_str());
    }
}

class ScopedFileRestore {
public:
    explicit ScopedFileRestore(std::string path)
        : path_(std::move(path)), previous_(readExisting(path_)) {}

    ~ScopedFileRestore() {
        restoreFile(path_, previous_);
    }

private:
    std::string path_;
    std::optional<std::string> previous_;
};

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

TEST_CASE("MenuSystem load screen reports empty disabled slots") {
    const std::string slotPath = "saves/slot_1.json";
    ScopedFileRestore slotGuard(slotPath);
    restoreFile(slotPath, std::nullopt);

    rpg::MenuSystem menu;
    InputManager input;
    std::array<unsigned char, SDL_NUM_SCANCODES> keys{};

    menu.open();
    menu.setSelectionForTest(4);
    tap(input, keys, SDL_SCANCODE_RETURN);
    CHECK(menu.handleInput(input));
    REQUIRE(menu.current() == rpg::MenuSystem::Screen::Load);

    tap(input, keys, SDL_SCANCODE_RETURN);
    CHECK(menu.handleInput(input));
    CHECK(menu.pendingAction() == rpg::MenuSystem::Action::None);

    GameState state;
    rpg::RpgDatabases dbs;
    const auto vm = menu.snapshot(state, dbs);
    REQUIRE(vm.message.has_value());
    CHECK(*vm.message == "Slot 1 is empty");
}

TEST_CASE("MenuSystem load screen blocks corrupt slots with actionable feedback") {
    const std::string slotPath = "saves/slot_1.json";
    ScopedFileRestore slotGuard(slotPath);
    {
        std::ofstream out(slotPath);
        out << "{ bad save";
    }

    rpg::MenuSystem menu;
    InputManager input;
    std::array<unsigned char, SDL_NUM_SCANCODES> keys{};

    menu.open();
    menu.setSelectionForTest(4);
    tap(input, keys, SDL_SCANCODE_RETURN);
    CHECK(menu.handleInput(input));
    REQUIRE(menu.current() == rpg::MenuSystem::Screen::Load);

    GameState state;
    rpg::RpgDatabases dbs;
    auto before = menu.snapshot(state, dbs);
    REQUIRE(before.slots.size() >= 1);
    CHECK(before.slots[0].exists);
    CHECK_FALSE(before.slots[0].loadable);
    CHECK(before.slots[0].corrupt);
    CHECK(before.slots[0].summary.find("Corrupt") != std::string::npos);

    tap(input, keys, SDL_SCANCODE_RETURN);
    CHECK(menu.handleInput(input));
    CHECK(menu.pendingAction() == rpg::MenuSystem::Action::None);

    const auto after = menu.snapshot(state, dbs);
    REQUIRE(after.message.has_value());
    CHECK(after.message->find("Slot 1 cannot be loaded") != std::string::npos);
}
