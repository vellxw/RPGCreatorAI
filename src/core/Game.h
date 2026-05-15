#pragma once
#include "platform/Window.h"
#include "platform/InputManager.h"
#include "renderer/Renderer2D.h"
#include "world/MapScene.h"
#include "events/GameState.h"
#include "events/EventRunner.h"
#include "dialogue/DialogueSystem.h"
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

private:
    void handlePlayerInput(const InputManager& input);
    bool tryMove(int dx, int dy, Direction dir);
    void interact();
    void loadMap(const std::string& mapId);

    ProjectData project;
    MapScene currentScene;
    GameState state;
    DialogueSystem dialogue;
    std::unique_ptr<EventRunner> eventRunner;
    Camera2D camera;
};
