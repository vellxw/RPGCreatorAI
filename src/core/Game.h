#pragma once
#include "platform/Window.h"
#include "platform/InputManager.h"
#include "renderer/Renderer2D.h"
#include "world/MapScene.h"
#include "events/GameState.h"
#include "events/EventRunner.h"
#include "dialogue/DialogueSystem.h"
#include "database/ItemDatabase.h"
#include "types/ProjectTypes.h"
#include <memory>
#include <string>

class Game {
public:
    Game();
    ~Game();

    bool initialize(Window& window, const ProjectData& projectData);
    void update(const InputManager& input, float dt);
    void render(IRenderer& renderer);

    // Test/inspection helpers
    const GameState& getGameState() const { return state; }
    const MapScene& getCurrentScene() const { return currentScene; }

private:
    bool loadMap(const std::string& mapId);
    void handlePlayerInput(const InputManager& input);
    bool tryMove(int dx, int dy, Direction dir);
    void interact();
    void runEventCommands(const EventData& event);
    void applyTransferIfPending();
    void updateCamera();
    void saveGame();
    void loadGameFromDisk();

    // Returns the path declared in ProjectData::maps for the given mapId.
    // Empty string if not found.
    std::string getMapPath(const std::string& mapId) const;

    ProjectData project;
    MapScene currentScene;
    GameState state;
    DialogueSystem dialogue;
    std::unique_ptr<EventRunner> eventRunner;
    Camera2D camera;
    ItemDatabase itemDatabase;

    // Window dimensions (cached at init for camera centering).
    int viewportW = 800;
    int viewportH = 600;

    // Save slot label is a technical default per AGENTS.md.
    static constexpr const char* kDefaultSaveSlot = "slot_1";
};
