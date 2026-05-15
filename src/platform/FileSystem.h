#pragma once
#include <string>
#include <optional>

class FileSystem {
public:
    static std::optional<std::string> readFile(const std::string& path);
    static bool writeFile(const std::string& path, const std::string& content);
    static bool exists(const std::string& path);
};
