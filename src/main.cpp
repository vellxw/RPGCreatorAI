#include "core/Application.h"
#include "core/Logger.h"
#include <exception>

int main(int argc, char* argv[]) {
    Logger::info("RPG Creator Runtime starting...");

    try {
        Application app;

        if (!app.initialize()) {
            app.shutdown();
            return 1;
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
