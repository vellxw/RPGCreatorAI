#include "core/Game.h"
#include "core/Logger.h"
#include "renderer/IRenderer.h"

Game::Game() = default;
Game::~Game() = default;

bool Game::initialize(Window& window, const ProjectData& projectData) {
    project = projectData;

    state.setCurrentMap(project.startMapId);
    state.setPlayerPosition(
        project.startPosition.pos.x,
        project.startPosition.pos.y,
        project.startPosition.direction
    );

    eventRunner = std::make_unique<EventRunner>(state, dialogue);

    return true;
}

void Game::update(const InputManager& input, float dt) {
    // Delegate to event runner only; player movement/input handling is future phase
    eventRunner->update(dt);
}

void Game::render(IRenderer& renderer) {
    // Application owns frame boundaries (beginFrame/endFrame) — Game only renders content
    renderer.renderMap(currentScene, camera);
    renderer.renderEntities(currentScene, state, camera);
    renderer.renderDialogue(dialogue);
}

// --- Stubs for future phases ---

void Game::handlePlayerInput(const InputManager& input) {
    // Future phase: player movement and interaction input
}

bool Game::tryMove(int dx, int dy, Direction dir) {
    // Future phase: collision-checked movement via CollisionSystem::canMoveTo
    return false;
}

void Game::interact() {
    // Future phase: trigger events at facing tile
}

void Game::loadMap(const std::string& mapId) {
    // Future phase: load map data via MapLoader using ProjectData::maps paths
}
