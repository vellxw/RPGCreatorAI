#pragma once
#include "types/ProjectTypes.h"
#include <optional>
#include <string>

class ProjectLoader {
public:
    static std::optional<ProjectData> load(const std::string& path);
};
