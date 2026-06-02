#include <doctest/doctest.h>
#include "runtime/RuntimeDebugSnapshot.h"
#include <nlohmann/json.hpp>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <sstream>

namespace {

std::string readTextFile(const std::filesystem::path& path) {
    std::ifstream in(path);
    std::ostringstream out;
    out << in.rdbuf();
    return out.str();
}

std::string numberedId(const std::string& prefix, int index) {
    std::ostringstream out;
    out << prefix << "_" << std::setw(3) << std::setfill('0') << index;
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
    snapshot.mapWidth = 32;
    snapshot.mapHeight = 18;
    snapshot.tileSize = 32;
    snapshot.mapEventCount = 4;
    snapshot.eventTraceEntryCount = 2;
    snapshot.eventTraceCapacity = 256;

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
    CHECK(json["map"]["width"] == 32);
    CHECK(json["map"]["height"] == 18);
    CHECK(json["map"]["tileSize"] == 32);
    CHECK(json["diagnostics"]["limits"]["collectionEntries"] ==
          rpg::kRuntimeDebugSnapshotCollectionLimit);
    CHECK(json["diagnostics"]["limits"]["runningEvents"] ==
          rpg::kRuntimeDebugSnapshotRunningEventLimit);
    CHECK(json["diagnostics"]["counts"]["mapEvents"] == 4);
    CHECK(json["diagnostics"]["counts"]["eventTraceEntries"] == 2);
    CHECK(json["diagnostics"]["counts"]["eventTraceCapacity"] == 256);
}

TEST_CASE("RuntimeDebugSnapshot bounds serialized collections and reports omitted counts") {
    rpg::RuntimeDebugSnapshot snapshot;
    snapshot.mapId = "large_map";

    for (std::size_t i = 0; i < rpg::kRuntimeDebugSnapshotCollectionLimit + 3; ++i) {
        snapshot.switches[numberedId("switch", static_cast<int>(i))] = true;
        snapshot.variables[numberedId("variable", static_cast<int>(i))] = static_cast<int>(i);
        snapshot.inventory[numberedId("item", static_cast<int>(i))] = 1;
    }
    for (std::size_t i = 0; i < rpg::kRuntimeDebugSnapshotRunningEventLimit + 2; ++i) {
        snapshot.runningEventIds.push_back(numberedId("event", static_cast<int>(i)));
    }

    const auto json = nlohmann::json::parse(rpg::serializeRuntimeDebugSnapshot(snapshot));

    CHECK(json["switches"].size() == rpg::kRuntimeDebugSnapshotCollectionLimit);
    CHECK(json["variables"].size() == rpg::kRuntimeDebugSnapshotCollectionLimit);
    CHECK(json["inventory"].size() == rpg::kRuntimeDebugSnapshotCollectionLimit);
    CHECK(json["runningEventIds"].size() == rpg::kRuntimeDebugSnapshotRunningEventLimit);
    CHECK(json["switches"].contains("switch_000"));
    CHECK_FALSE(json["switches"].contains("switch_066"));
    CHECK(json["diagnostics"]["counts"]["switches"] ==
          rpg::kRuntimeDebugSnapshotCollectionLimit + 3);
    CHECK(json["diagnostics"]["omitted"]["switches"] == 3);
    CHECK(json["diagnostics"]["counts"]["runningEvents"] ==
          rpg::kRuntimeDebugSnapshotRunningEventLimit + 2);
    CHECK(json["diagnostics"]["omitted"]["runningEvents"] == 2);
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
