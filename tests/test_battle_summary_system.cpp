#include <array>
#include <doctest/doctest.h>
#include <SDL.h>

#include "database/RpgDatabases.h"
#include "events/GameState.h"
#include "platform/InputManager.h"
#include "runtime/BattleSummarySystem.h"
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

TEST_CASE("BattleSummarySystem builds a visible victory reward view") {
    auto project = ProjectLoader::load("data/project.json");
    REQUIRE(project.has_value());

    rpg::RpgDatabases dbs;
    REQUIRE(dbs.loadAll(*project));

    GameState state;
    state.setParty({"arc"});
    state.setActorHp("arc", 12);

    BattleResult result;
    result.outcome = BattleResult::Outcome::Victory;
    result.goldAwarded = 16;
    result.expAwarded = 8;
    result.itemsAwarded = {{"potion", 1}};

    rpg::BattleSummarySystem summary;
    summary.open("slime_pair", result, dbs, state);

    const auto vm = summary.snapshot();
    REQUIRE(vm.active);
    CHECK(vm.title == "Slime x2");
    CHECK(vm.outcomeLabel == "VICTORY");
    CHECK(vm.goldAwarded == 16);
    CHECK(vm.expAwarded == 8);
    REQUIRE(vm.enemies.size() == 1);
    CHECK(vm.enemies[0].name == "Slime");
    CHECK(vm.enemies[0].count == 2);
    REQUIRE(vm.party.size() == 1);
    CHECK(vm.party[0].name == "Arc");
    CHECK(vm.party[0].hp == 12);
    REQUIRE(vm.rewards.size() == 1);
    CHECK(vm.rewards[0].name == "Potion");
    CHECK(vm.rewards[0].amount == 1);
}

TEST_CASE("BattleSummarySystem closes on confirm") {
    rpg::BattleSummarySystem summary;
    GameState state;
    rpg::RpgDatabases dbs;
    summary.open("missing", BattleResult{}, dbs, state);

    InputManager input;
    std::array<unsigned char, SDL_NUM_SCANCODES> keys{};
    tap(input, keys, SDL_SCANCODE_RETURN);
    CHECK(summary.handleInput(input));
    CHECK_FALSE(summary.isOpen());
}
