#include "world/ProjectLoader.h"
#include "core/Logger.h"
#include <fstream>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

std::optional<ProjectData> ProjectLoader::load(const std::string& path) {
    // Step 1: Open file
    std::ifstream file(path);
    if (!file.is_open()) {
        Logger::error("Failed to open project file: " + path);
        return std::nullopt;
    }

    // Step 2: Parse JSON
    json j;
    try {
        j = json::parse(file);
    } catch (const json::parse_error& e) {
        Logger::error("JSON parse error in '" + path + "': " + std::string(e.what()));
        return std::nullopt;
    }

    // Step 3: Check required fields
    if (!j.contains("schemaVersion")) {
        Logger::error("Missing required field 'schemaVersion' in " + path);
        return std::nullopt;
    }
    if (!j.contains("title")) {
        Logger::error("Missing required field 'title' in " + path);
        return std::nullopt;
    }
    if (!j.contains("startMapId")) {
        Logger::error("Missing required field 'startMapId' in " + path);
        return std::nullopt;
    }
    if (!j.contains("startPosition")) {
        Logger::error("Missing required field 'startPosition' in " + path);
        return std::nullopt;
    }
    const auto& startPos = j["startPosition"];
    if (!startPos.contains("x")) {
        Logger::error("Missing required field 'startPosition.x' in " + path);
        return std::nullopt;
    }
    if (!startPos.contains("y")) {
        Logger::error("Missing required field 'startPosition.y' in " + path);
        return std::nullopt;
    }
    if (!startPos.contains("direction")) {
        Logger::error("Missing required field 'startPosition.direction' in " + path);
        return std::nullopt;
    }
    if (!j.contains("maps")) {
        Logger::error("Missing required field 'maps' in " + path);
        return std::nullopt;
    }
    if (!j.contains("database")) {
        Logger::error("Missing required field 'database' in " + path);
        return std::nullopt;
    }
    const auto& database = j["database"];
    if (!database.contains("items")) {
        Logger::error("Missing required field 'database.items' in " + path);
        return std::nullopt;
    }

    // Step 4: schemaVersion must be positive integer
    try {
        if (!j["schemaVersion"].is_number_integer()) {
            Logger::error("Field 'schemaVersion' must be a positive integer in " + path);
            return std::nullopt;
        }
        int schemaVersion = j["schemaVersion"].get<int>();
        if (schemaVersion <= 0) {
            Logger::error("Field 'schemaVersion' must be a positive integer in " + path);
            return std::nullopt;
        }

        // Step 5: schemaVersion must equal 1
        if (schemaVersion != 1) {
            Logger::error("Unsupported schemaVersion: received " + std::to_string(schemaVersion) +
                         ", supported version is 1 in " + path);
            return std::nullopt;
        }

        // Step 6: startPosition.direction must be one of "up", "down", "left", "right"
        std::string dirStr = startPos["direction"].get<std::string>();
        if (dirStr != "up" && dirStr != "down" && dirStr != "left" && dirStr != "right") {
            Logger::error("Invalid startPosition.direction value '" + dirStr +
                         "' in " + path + ". Must be one of: up, down, left, right");
            return std::nullopt;
        }

        // Step 7: maps non-empty and contains entry with id == startMapId
        const auto& maps = j["maps"];
        if (!maps.is_array() || maps.empty()) {
            Logger::error("Field 'maps' must be a non-empty array in " + path);
            return std::nullopt;
        }

        std::string startMapId = j["startMapId"].get<std::string>();
        bool foundStartMap = false;
        for (const auto& map : maps) {
            if (map.contains("id") && map["id"].get<std::string>() == startMapId) {
                foundStartMap = true;
                break;
            }
        }
        if (!foundStartMap) {
            Logger::error("startMapId '" + startMapId +
                         "' not found in maps array in " + path);
            return std::nullopt;
        }

        // Step 8: Build and return populated ProjectData
        ProjectData project;
        project.schemaVersion = schemaVersion;
        project.title = j["title"].get<std::string>();
        project.startMapId = startMapId;
        project.startPosition.pos.x = startPos["x"].get<int>();
        project.startPosition.pos.y = startPos["y"].get<int>();
        project.startPosition.direction = stringToDirection(dirStr);

        for (const auto& map : maps) {
            MapReference mr;
            mr.id = map.at("id").get<std::string>();
            mr.path = map.at("path").get<std::string>();
            project.maps.push_back(mr);
        }

        project.database.itemsPath = database["items"].get<std::string>();

        auto pickPath = [&](const char* key, std::string& out) {
            if (database.contains(key) && database[key].is_string()) {
                out = database[key].get<std::string>();
            }
        };
        pickPath("actors", project.database.actorsPath);
        pickPath("classes", project.database.classesPath);
        pickPath("skills", project.database.skillsPath);
        pickPath("weapons", project.database.weaponsPath);
        pickPath("armors", project.database.armorsPath);
        pickPath("states", project.database.statesPath);
        pickPath("types", project.database.typesPath);
        pickPath("terms", project.database.termsPath);
        pickPath("enemies", project.database.enemiesPath);
        pickPath("troops", project.database.troopsPath);
        pickPath("quests", project.database.questsPath);
        pickPath("shops", project.database.shopsPath);
        pickPath("system", project.database.systemPath);
        pickPath("switches", project.database.switchesPath);
        pickPath("variables", project.database.variablesPath);
        pickPath("commonEvents", project.database.commonEventsPath);
        pickPath("animations", project.database.animationsPath);
        pickPath("tilesets", project.database.tilesetsPath);
        pickPath("audio", project.database.audioPath);

        if (j.contains("visualProfile") && j["visualProfile"].is_object()) {
            const auto& visual = j["visualProfile"];
            project.visualProfile.aspectRatio =
                visual.value("aspectRatio", project.visualProfile.aspectRatio);
            if (visual.contains("baseResolution") && visual["baseResolution"].is_object()) {
                const auto& baseResolution = visual["baseResolution"];
                project.visualProfile.baseResolution.width =
                    baseResolution.value("width", project.visualProfile.baseResolution.width);
                project.visualProfile.baseResolution.height =
                    baseResolution.value("height", project.visualProfile.baseResolution.height);
            }
            project.visualProfile.tileSize =
                visual.value("tileSize", project.visualProfile.tileSize);
            project.visualProfile.cameraMode =
                visual.value("cameraMode", project.visualProfile.cameraMode);
            project.visualProfile.mapPresentation =
                visual.value("mapPresentation", project.visualProfile.mapPresentation);
            project.visualProfile.zoom =
                visual.value("zoom", project.visualProfile.zoom);
            project.visualProfile.integerScale =
                visual.value("integerScale", project.visualProfile.integerScale);
        }

        return project;

    } catch (const json::exception& e) {
        Logger::error("Error reading project data from '" + path + "': " + std::string(e.what()));
        return std::nullopt;
    }
}
