#include <array>
#include <doctest/doctest.h>
#include <SDL.h>

#include "platform/InputManager.h"
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
