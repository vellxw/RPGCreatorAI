#include "platform/FileSystem.h"
#include <fstream>
#include <sstream>

std::optional<std::string> FileSystem::readFile(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        return std::nullopt;
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

bool FileSystem::writeFile(const std::string& path, const std::string& content) {
    std::ofstream file(path);
    if (!file.is_open()) {
        return false;
    }
    file << content;
    return true;
}

bool FileSystem::exists(const std::string& path) {
    std::ifstream file(path);
    return file.good();
}
