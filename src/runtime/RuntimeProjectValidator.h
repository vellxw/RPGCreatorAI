#pragma once

#include <filesystem>
#include <string>
#include <vector>

namespace rpg {

enum class RuntimeValidationSeverity {
    Warning,
    Error
};

struct RuntimeValidationMessage {
    RuntimeValidationSeverity severity = RuntimeValidationSeverity::Error;
    std::string source;
    std::string message;
};

struct RuntimeValidationReport {
    std::vector<RuntimeValidationMessage> messages;

    bool hasErrors() const;
    int errorCount() const;
    int warningCount() const;
};

class RuntimeProjectValidator {
public:
    RuntimeValidationReport validateProjectFile(const std::filesystem::path& projectPath) const;
};

} // namespace rpg
