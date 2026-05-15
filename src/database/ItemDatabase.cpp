#include "database/ItemDatabase.h"
#include "platform/FileSystem.h"
#include "core/Logger.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

bool ItemDatabase::load(const std::string& path) {
    auto content = FileSystem::readFile(path);
    if (!content) {
        Logger::error("Failed to read items file: " + path);
        return false;
    }

    try {
        json j = json::parse(*content);
        for (const auto& item : j.at("items")) {
            ItemData idata;
            idata.id = item.at("id").get<std::string>();
            idata.name = item.at("name").get<std::string>();
            idata.description = item.at("description").get<std::string>();
            idata.type = item.at("type").get<std::string>();
            items.push_back(idata);
        }
        return true;
    } catch (const json::exception& e) {
        Logger::error(std::string("JSON parsing error in items: ") + e.what());
        return false;
    }
}

const ItemData* ItemDatabase::getItem(const std::string& id) const {
    for (const auto& item : items) {
        if (item.id == id) {
            return &item;
        }
    }
    return nullptr;
}
