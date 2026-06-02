#include <doctest/doctest.h>
#include "platform/AudioSystem.h"
#include "database/RpgDatabases.h"
#include "world/ProjectLoader.h"
#include <cstdio>
#include <fstream>
#include <memory>
#include <string>
#include <vector>

namespace {

struct FakeAudioCall {
    std::string path;
    bool loop = false;
};

class FakeAudioBackend final : public rpg::IAudioBackend {
public:
    bool initialize() override {
        ++initializeCalls;
        return initializeResult;
    }

    void shutdown() override {
        ++shutdownCalls;
    }

    bool playWav(const std::string& path, bool loop) override {
        playCalls.push_back({path, loop});
        return playResult;
    }

    void stopAll() override {
        ++stopCalls;
    }

    bool initializeResult = true;
    bool playResult = true;
    int initializeCalls = 0;
    int shutdownCalls = 0;
    int stopCalls = 0;
    std::vector<FakeAudioCall> playCalls;
};

std::string writeTempFile(const std::string& filename, const std::string& content) {
    const std::string path = "test_tmp_" + filename;
    std::ofstream out(path, std::ios::binary);
    out << content;
    return path;
}

void removeTempFile(const std::string& path) {
    std::remove(path.c_str());
}

} // namespace

TEST_CASE("AudioSystem default registry exposes MVP audio ids") {
    const auto registry = rpg::AudioSystem::defaultRegistry();

    CHECK(registry.count("confirm") == 1);
    CHECK(registry.count("cancel") == 1);
    CHECK(registry.count("chest") == 1);
    CHECK(registry.count("battle") == 1);
    CHECK(registry.count("town_bgm") == 1);
}

TEST_CASE("AudioSystem requests registered SFX and BGM through backend") {
    const std::string confirmPath = writeTempFile("confirm.wav", "fake wav bytes");
    const std::string bgmPath = writeTempFile("town_bgm.wav", "fake wav bytes");

    auto backend = std::make_unique<FakeAudioBackend>();
    auto* backendPtr = backend.get();
    rpg::AudioSystem audio(std::move(backend));

    CHECK(audio.initialize({
        {"confirm", confirmPath},
        {"town_bgm", bgmPath},
    }));

    const auto sfx = audio.playSound("confirm");
    CHECK(sfx.requested);
    CHECK(sfx.played);
    CHECK(sfx.id == "confirm");
    CHECK(sfx.path == confirmPath);

    const auto bgm = audio.playBgm("town_bgm");
    CHECK(bgm.requested);
    CHECK(bgm.played);

    REQUIRE(backendPtr->playCalls.size() == 2);
    CHECK(backendPtr->playCalls[0].path == confirmPath);
    CHECK(backendPtr->playCalls[0].loop == false);
    CHECK(backendPtr->playCalls[1].path == bgmPath);
    CHECK(backendPtr->playCalls[1].loop == true);

    audio.stopBgm();
    CHECK(backendPtr->stopCalls == 1);

    removeTempFile(confirmPath);
    removeTempFile(bgmPath);
}

TEST_CASE("AudioSystem requests imported audio ids through the mock backend") {
    const std::string sfxPath = writeTempFile("door_chime_imported.wav", "fake wav bytes");
    const std::string bgmPath = writeTempFile("town_loop_imported.wav", "fake wav bytes");

    auto backend = std::make_unique<FakeAudioBackend>();
    auto* backendPtr = backend.get();
    rpg::AudioSystem audio(std::move(backend));

    CHECK(audio.initialize({
        {"door_chime", sfxPath},
        {"town_loop", bgmPath},
    }));

    const auto sfx = audio.playSound("door_chime");
    const auto bgm = audio.playBgm("town_loop");

    CHECK(sfx.requested);
    CHECK(sfx.played);
    CHECK(sfx.path == sfxPath);
    CHECK(bgm.requested);
    CHECK(bgm.played);
    CHECK(bgm.path == bgmPath);
    REQUIRE(backendPtr->playCalls.size() == 2);
    CHECK(backendPtr->playCalls[0].path == sfxPath);
    CHECK(backendPtr->playCalls[0].loop == false);
    CHECK(backendPtr->playCalls[1].path == bgmPath);
    CHECK(backendPtr->playCalls[1].loop == true);

    removeTempFile(sfxPath);
    removeTempFile(bgmPath);
}

TEST_CASE("AudioSystem tolerates missing files and unavailable audio backend") {
    auto backend = std::make_unique<FakeAudioBackend>();
    auto* backendPtr = backend.get();
    backendPtr->initializeResult = false;
    rpg::AudioSystem audio(std::move(backend));

    CHECK_FALSE(audio.initialize({
        {"confirm", "missing_confirm.wav"},
    }));

    const auto missingFile = audio.playSound("confirm");
    CHECK(missingFile.requested);
    CHECK_FALSE(missingFile.played);
    CHECK(missingFile.id == "confirm");
    CHECK(missingFile.message.find("missing") != std::string::npos);
    CHECK(backendPtr->playCalls.empty());

    const auto unknown = audio.playSound("unknown_sound");
    CHECK(unknown.requested);
    CHECK_FALSE(unknown.played);
    CHECK(unknown.id == "unknown_sound");

    REQUIRE(audio.requestedIds().size() == 2);
    CHECK(audio.requestedIds()[0] == "confirm");
    CHECK(audio.requestedIds()[1] == "unknown_sound");
}

TEST_CASE("ProjectLoader loads optional database audio path") {
    const std::string projectPath = writeTempFile("with_audio_project.json", R"({
        "schemaVersion": 1,
        "title": "AudioProject",
        "startMapId": "town",
        "startPosition": { "x": 0, "y": 0, "direction": "down" },
        "maps": [{ "id": "town", "path": "maps/town.json" }],
        "database": {
            "items": "data/database/items.json",
            "audio": "data/database/audio.json"
        }
    })");

    auto project = ProjectLoader::load(projectPath);
    REQUIRE(project.has_value());
    CHECK(project->database.audioPath == "data/database/audio.json");

    removeTempFile(projectPath);
}

TEST_CASE("RpgDatabases loads system audio registry") {
    const std::string systemPath = writeTempFile("system_audio.json", R"({
        "schemaVersion": 1,
        "defaultBgm": "town_bgm",
        "audio": {
            "confirm": "assets/audio/ui_confirm.wav",
            "town_bgm": "assets/audio/town_theme.wav"
        }
    })");

    ProjectData project;
    project.database.systemPath = systemPath;

    rpg::RpgDatabases databases;
    CHECK(databases.loadAll(project));

    CHECK(databases.system().audioRegistry.at("confirm") == "assets/audio/ui_confirm.wav");
    CHECK(databases.system().audioRegistry.at("town_bgm") == "assets/audio/town_theme.wav");

    removeTempFile(systemPath);
}
