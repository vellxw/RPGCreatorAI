#include "database/AnimationDatabase.h"
#include "platform/FileSystem.h"
#include "core/Logger.h"
#include <nlohmann/json.hpp>
#include <fstream>
#include <optional>

using json = nlohmann::json;

namespace {

std::optional<std::string> readText(const std::string& path) {
    if (auto content = FileSystem::readFile(path)) {
        return content;
    }

    std::ifstream in(path);
    if (!in) return std::nullopt;
    return std::string((std::istreambuf_iterator<char>(in)),
                       std::istreambuf_iterator<char>());
}

AnimationClip parseClip(const json& j) {
    AnimationClip clip;
    clip.action = j.at("action").get<std::string>();
    clip.direction = j.value("direction", std::string{"any"});
    clip.asset = j.at("asset").get<std::string>();
    if (j.contains("frameSize")) {
        const auto& fs = j.at("frameSize");
        clip.frameSize.width = fs.value("width", 64);
        clip.frameSize.height = fs.value("height", 64);
    }
    clip.frameCount = j.value("frameCount", 1);
    clip.fps = j.value("fps", 1.0f);
    clip.loop = j.value("loop", true);
    if (j.contains("anchor")) {
        const auto& anchor = j.at("anchor");
        clip.anchor.x = anchor.value("x", clip.frameSize.width / 2);
        clip.anchor.y = anchor.value("y", clip.frameSize.height);
    }
    return clip;
}

} // namespace

bool AnimationDatabase::load(const std::string& path) {
    sets_.clear();
    auto content = readText(path);
    if (!content) {
        Logger::warning("Animation database missing: " + path);
        return false;
    }

    try {
        const json root = json::parse(*content);
        if (root.value("schemaVersion", 1) != 1) {
            Logger::error("Unsupported animation database schemaVersion: " + path);
            return false;
        }

        for (const auto& setJson : root.at("sets")) {
            AnimationSet set;
            set.id = setJson.at("id").get<std::string>();
            for (const auto& clipJson : setJson.at("clips")) {
                set.clips.push_back(parseClip(clipJson));
            }
            sets_.push_back(std::move(set));
        }
        return true;
    } catch (const json::exception& e) {
        Logger::error(std::string("Error parsing animation database: ") + e.what());
        sets_.clear();
        return false;
    }
}

const AnimationClip* AnimationDatabase::findClip(const std::string& setId,
                                                 const std::string& action,
                                                 Direction direction) const {
    return findClip(setId, action, directionToString(direction));
}

const AnimationClip* AnimationDatabase::findClip(const std::string& setId,
                                                 const std::string& action,
                                                 const std::string& direction) const {
    const AnimationClip* anyDirection = nullptr;
    for (const auto& set : sets_) {
        if (set.id != setId) continue;
        for (const auto& clip : set.clips) {
            if (clip.action != action) continue;
            if (clip.direction == direction) return &clip;
            if (clip.direction == "any") anyDirection = &clip;
        }
    }
    return anyDirection;
}
