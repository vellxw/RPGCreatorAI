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

    // ---- Public verbs (used by both the input-driven path and the
    // visual verification harness). These exercise the same underlying
    // logic as keyboard input, so rendered behavior matches a real
    // session.
    void stepMove(int dx, int dy, Direction dir);
    void stepInteract();
    void stepDismissDialogue();
    void stepSave();
    void stepLoad();
    void pumpEvents(float dt);                  // drains EventRunner + applies transfers
    bool isDialogueActive() const { return dialogue.isActive(); }
    bool isEventRunnerRunning() const;

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

    std::string getMapPath(const std::string& mapId) const;

    ProjectData project;
    MapScene currentScene;
    GameState state;
    DialogueSystem dialogue;
    std::unique_ptr<EventRunner> eventRunner;
    Camera2D camera;
    ItemDatabase itemDatabase;

    int viewportW = 800;
    int viewportH = 600;

    static constexpr const char* kDefaultSaveSlot = "slot_1";
};
