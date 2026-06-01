#include <doctest/doctest.h>
#include "runtime/RuntimeDebugSnapshot.h"
#include <nlohmann/json.hpp>
#include <filesystem>
#include <fstream>
#include <sstream>

namespace {

std::string readTextFile(const std::filesystem::path& path) {
    std::ifstream in(path);
    std::ostringstream out;
    out << in.rdbuf();
    return out.str();
}

} // namespace

TEST_CASE("RuntimeDebugSnapshot serializes deterministic runtime state JSON") {
    rpg::RuntimeDebugSnapshot snapshot;
    snapshot.frameNumber = 42;
    snapshot.mapId = "town";
    snapshot.playerX = 10;
    snapshot.playerY = 12;
    snapshot.playerDirection = "up";
    snapshot.gold = 125;
    snapshot.party = {"hero", "mage"};
    snapshot.switches["intro_done"] = true;
    snapshot.variables["visit_count"] = 3;
    snapshot.selfSwitches["town:npc_1:A"] = true;
    snapshot.inventory["potion"] = 2;
    snapshot.activeDialogue = true;
    snapshot.activeMenu = false;
    snapshot.activeShop = true;
    snapshot.activeBattle = false;
    snapshot.runningEventIds = {"map:town:npc_1", "common:intro"};

    const auto json = nlohmann::json::parse(rpg::serializeRuntimeDebugSnapshot(snapshot));

    CHECK(json["frameNumber"] == 42);
    CHECK(json["mapId"] == "town");
    CHECK(json["player"]["x"] == 10);
    CHECK(json["player"]["y"] == 12);
    CHECK(json["player"]["direction"] == "up");
    CHECK(json["gold"] == 125);
    CHECK(json["party"][1] == "mage");
    CHECK(json["switches"]["intro_done"] == true);
    CHECK(json["variables"]["visit_count"] == 3);
    CHECK(json["selfSwitches"]["town:npc_1:A"] == true);
    CHECK(json["inventory"]["potion"] == 2);
    CHECK(json["active"]["dialogue"] == true);
    CHECK(json["active"]["shop"] == true);
    CHECK(json["runningEventIds"][0] == "map:town:npc_1");
}

TEST_CASE("RuntimeDebugSnapshot writes atomically to a stable snapshot path") {
    const auto root = std::filesystem::temp_directory_path() / "rpgcreatorai_snapshot_test";
    std::filesystem::remove_all(root);
    std::filesystem::create_directories(root);
    const auto path = rpg::runtimeDebugSnapshotPath(root);

    rpg::RuntimeDebugSnapshot snapshot;
    snapshot.frameNumber = 1;
    snapshot.mapId = "town";

    std::string error;
    CHECK(rpg::writeRuntimeDebugSnapshotAtomic(path, snapshot, &error));
    CHECK(error.empty());
    CHECK(path.filename().string() == "runtime-state-snapshot.json");
    CHECK(std::filesystem::is_regular_file(path));
    CHECK(!std::filesystem::exists(path.string() + ".tmp"));

    const auto json = nlohmann::json::parse(readTextFile(path));
    CHECK(json["mapId"] == "town");

    std::filesystem::remove_all(root);
}
