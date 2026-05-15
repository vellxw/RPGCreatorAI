#include "core/Application.h"
#include "core/Logger.h"
#include <exception>
#include <string>

int main(int argc, char* argv[]) {
    Logger::info("RPG Creator Runtime starting...");

    // Parse minimal CLI: --smoke-shots <dir> runs the deterministic
    // visual-verification harness (no input loop), then exits.
    std::string smokeDir;
    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--smoke-shots" && i + 1 < argc) {
            smokeDir = argv[++i];
        }
    }

    try {
        Application app;
        if (!app.initialize()) {
            app.shutdown();
            return 1;
        }
        if (!smokeDir.empty()) {
            bool ok = app.runSmokeShots(smokeDir);
            app.shutdown();
            Logger::info("RPG Creator Runtime shut down.");
            return ok ? 0 : 1;
        }
        app.run();
        app.shutdown();
        Logger::info("RPG Creator Runtime shut down.");
        return 0;
    } catch (const std::exception& e) {
        Logger::error(e.what());
        return 1;
    }
}
