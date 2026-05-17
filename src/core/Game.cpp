#include "core/Game.h"
#include "core/Logger.h"
#include "world/MapLoader.h"
#include "world/CollisionSystem.h"
#include "save/SaveManager.h"
#include "renderer/IRenderer.h"
#include <SDL.h>

Game::Game() = default;
Game::~Game() = default;

bool Game::initialize(Window& window, const ProjectData& projectData) {
    project = projectData;

    // Cache viewport dimensions for camera centering.
    if (window.getSDLWindow()) {
        SDL_GetWindowSize(window.getSDLWindow(), &viewportW, &viewportH);
    }

    state.setCurrentMap(project.startMapId);
    state.setPlayerPosition(
        project.startPosition.pos.x,
        project.startPosition.pos.y,
        project.startPosition.direction
    );

    eventRunner = std::make_unique<EventRunner>(state, dialogue);

    // Load item database (optional; missing/invalid is logged but not fatal).
    if (!project.database.itemsPath.empty()) {
        if (!itemDatabase.load(project.database.itemsPath)) {
            Logger::warning("Item database failed to load: " + project.database.itemsPath);
        }
    }

    // Phase 6 — load every database shard. Missing files are tolerated; the
    // resulting empty defaults keep the runtime alive so we never crash on
    // a partially-authored project.
    databases.loadAll(project);

    // Seed runtime state from the system database when a save isn't loaded.
    if (state.getParty().empty()) {
        state.setParty(databases.system().startingParty);
    }
    if (state.getGold() == 0 && databases.system().startingGold > 0) {
        state.setGold(databases.system().startingGold);
    }

    battleSystem = std::make_unique<rpg::BattleSystem>(databases, state);
    hookEventRunnerResolvers();

    // Load the start map.
    if (!loadMap(project.startMapId)) {
        Logger::error("Failed to load start map: " + project.startMapId);
        return false;
    }

    updateCamera();
    return true;
}

std::string Game::getMapPath(const std::string& mapId) const {
    for (const auto& m : project.maps) {
        if (m.id == mapId) return m.path;
    }
    return {};
}

bool Game::loadMap(const std::string& mapId) {
    std::string path = getMapPath(mapId);
    if (path.empty()) {
        Logger::error("Map id not declared in project: " + mapId);
        return false;
    }

    auto mapData = MapLoader::load(path);
    if (!mapData) {
        Logger::error("Failed to parse map: " + path);
        return false;
    }

    currentScene.loadFromData(*mapData);
    state.setCurrentMap(mapId);
    Logger::info("Map loaded: " + mapId);
    return true;
}

void Game::update(const InputManager& input, float dt) {
    // Save / load shortcuts always available (even during dialogue).
    if (input.isJustPressed(KeyButton::Save)) {
        saveGame();
    }
    if (input.isJustPressed(KeyButton::Load)) {
        loadGameFromDisk();
    }

    // Modal systems take exclusive ownership of gameplay input while open.
    if (battleSummarySystem.isOpen()) {
        battleSummarySystem.handleInput(input);
        return;
    }

    if (shopSystem.isOpen()) {
        shopSystem.handleInput(input, state, databases);
        return;
    }

    if (menuSystem.isOpen()) {
        menuSystem.handleInput(input);
        const auto menuAction = menuSystem.pendingAction();
        const int menuSlot = menuSystem.pendingActionSlot();
        menuSystem.consumeAction();
        switch (menuAction) {
            case rpg::MenuSystem::Action::Save: {
                bool ok = saveGame(menuSlot, false);
                menuSystem.notifySaveResult(ok, menuSlot);
                break;
            }
            case rpg::MenuSystem::Action::Load: {
                bool ok = loadGameFromDisk(menuSlot, false);
                menuSystem.notifyLoadResult(ok, menuSlot);
                break;
            }
            case rpg::MenuSystem::Action::Close:
            case rpg::MenuSystem::Action::None:
                break;
        }
        return;
    }

    // Escape / Tab open the pause menu only when gameplay is otherwise idle.
    if (!dialogue.isActive() &&
        (!eventRunner || !eventRunner->isRunning()) &&
        (input.isJustPressed(KeyButton::Cancel) ||
         input.isJustPressed(KeyButton::Menu))) {
        menuSystem.open();
        return;
    }

    // Drive the event runner; it self-pauses while dialogue is active.
    eventRunner->update(dt);

    // Apply any transfer requested by an event command.
    applyTransferIfPending();

    if (auto battleSummary = eventRunner->consumeBattleSummaryRequest();
        battleSummary.active) {
        battleSummarySystem.open(battleSummary.troopId, battleSummary.result,
                                 databases, state);
        return;
    }

    // Open requested shops as a real modal UI.
    if (auto shopReq = eventRunner->consumeShopRequest(); shopReq.active) {
        const auto* shop = databases.findShop(shopReq.shopId);
        if (shop) {
            Logger::info("Shop opened: " + shop->name + " with " +
                         std::to_string(shop->listings.size()) + " listings");
            shopSystem.open(shopReq.shopId, databases);
        } else {
            Logger::warning("openShop: unknown shop '" + shopReq.shopId + "'");
        }
    }

    // If a dialogue is active, only the dismiss/advance keys are handled.
    if (dialogue.isActive()) {
        if (input.isJustPressed(KeyButton::Confirm) ||
            input.isJustPressed(KeyButton::Cancel)) {
            dialogue.close();
        }
        return;
    }

    // If the runner is still busy (e.g. a wait), block player input.
    if (eventRunner->isRunning()) {
        return;
    }

    handlePlayerInput(input);
    updateCamera();
}

void Game::handlePlayerInput(const InputManager& input) {
    if (input.isJustPressed(KeyButton::Confirm)) {
        interact();
        return;
    }

    int dx = 0, dy = 0;
    Direction dir = state.getPlayerDirection();
    if (input.isJustPressed(KeyButton::Up))    { dx = 0;  dy = -1; dir = Direction::Up; }
    else if (input.isJustPressed(KeyButton::Down))  { dx = 0;  dy = 1;  dir = Direction::Down; }
    else if (input.isJustPressed(KeyButton::Left))  { dx = -1; dy = 0;  dir = Direction::Left; }
    else if (input.isJustPressed(KeyButton::Right)) { dx = 1;  dy = 0;  dir = Direction::Right; }
    else {
        return;
    }

    tryMove(dx, dy, dir);
}

bool Game::tryMove(int dx, int dy, Direction dir) {
    int curX = state.getPlayerX();
    int curY = state.getPlayerY();
    int targetX = curX + dx;
    int targetY = curY + dy;

    // Direction always updates, even when blocked.
    state.setPlayerPosition(curX, curY, dir);

    if (!CollisionSystem::canMoveTo(currentScene, targetX, targetY)) {
        return false;
    }

    state.setPlayerPosition(targetX, targetY, dir);

    // Touch-trigger events fire when stepping onto the destination cell.
    if (const EventData* ev = currentScene.getEventAt(targetX, targetY)) {
        if (ev->trigger == "touch") {
            runEventCommands(*ev);
        }
    }

    return true;
}

void Game::interact() {
    int dx = 0, dy = 0;
    switch (state.getPlayerDirection()) {
        case Direction::Up:    dy = -1; break;
        case Direction::Down:  dy = 1;  break;
        case Direction::Left:  dx = -1; break;
        case Direction::Right: dx = 1;  break;
    }
    int tx = state.getPlayerX() + dx;
    int ty = state.getPlayerY() + dy;

    const EventData* ev = currentScene.getEventAt(tx, ty);
    if (ev && ev->trigger == "interact") {
        runEventCommands(*ev);
    }
}

void Game::runEventCommands(const EventData& event) {
    if (!eventRunner) return;
    eventRunner->runCommandList(event.commands);
}

void Game::applyTransferIfPending() {
    if (!eventRunner) return;
    auto req = eventRunner->consumeTransferRequest();
    if (!req.active) return;

    if (!loadMap(req.mapId)) {
        Logger::error("Map transfer failed; staying on current map.");
        return;
    }
    state.setPlayerPosition(req.targetX, req.targetY, stringToDirection(req.direction));
    updateCamera();
}

void Game::hookEventRunnerResolvers() {
    if (!eventRunner) return;
    eventRunner->setCommonEventResolver(
        [this](const std::string& id) -> std::vector<std::shared_ptr<EventCommand>> {
            const auto* ce = databases.findCommonEvent(id);
            return ce ? ce->commands : std::vector<std::shared_ptr<EventCommand>>{};
        });
    eventRunner->setQuestObjectiveResolver(
        [this](const std::string& qid) -> std::vector<std::string> {
            const auto* q = databases.findQuest(qid);
            std::vector<std::string> out;
            if (q) for (const auto& obj : q->objectives) out.push_back(obj.id);
            return out;
        });
    eventRunner->setBattleRunner([this](const std::string& troopId) {
        if (!battleSystem) return BattleResult{};
        return battleSystem->run(troopId);
    });
}

void Game::updateCamera() {
    int tileSize = currentScene.getTileSize();
    if (tileSize <= 0) tileSize = 32;
    int px = state.getPlayerX() * tileSize + tileSize / 2;
    int py = state.getPlayerY() * tileSize + tileSize / 2;
    camera.setPosition(px - viewportW / 2, py - viewportH / 2);
}

std::string Game::slotIdFor(int slotIndex) {
    return "slot_" + std::to_string(slotIndex);
}

bool Game::saveGame(int slotIndex, bool showDialogueFeedback) {
    bool ok = SaveManager::save(slotIdFor(slotIndex), state);
    if (showDialogueFeedback) {
        dialogue.showText("", ok ? "Partida guardada." : "Error al guardar.");
    }
    return ok;
}

bool Game::loadGameFromDisk(int slotIndex, bool showDialogueFeedback) {
    auto loaded = SaveManager::load(slotIdFor(slotIndex));
    if (!loaded) {
        if (showDialogueFeedback) dialogue.showText("", "No hay partida guardada.");
        return false;
    }
    state = *loaded;
    if (!loadMap(state.getCurrentMapId())) {
        Logger::error("Loaded save references unknown map: " + state.getCurrentMapId());
        if (showDialogueFeedback) dialogue.showText("", "Error al cargar mapa.");
        return false;
    }
    updateCamera();
    if (showDialogueFeedback) dialogue.showText("", "Partida cargada.");
    return true;
}

void Game::render(IRenderer& renderer) {
    renderer.renderMap(currentScene, camera);
    renderer.renderEntities(currentScene, state, camera);
    renderer.renderHUD(state);
    renderer.renderDialogue(dialogue);
    renderer.renderMenu(menuSystem.snapshot(state, databases));
    renderer.renderShop(shopSystem.snapshot(state, databases));
    renderer.renderBattleSummary(battleSummarySystem.snapshot());
}

// ---- Public verbs ---------------------------------------------------------

void Game::stepMove(int dx, int dy, Direction dir) {
    if (dialogue.isActive() || (eventRunner && eventRunner->isRunning())) return;
    tryMove(dx, dy, dir);
    updateCamera();
}

void Game::stepInteract() {
    if (dialogue.isActive() || (eventRunner && eventRunner->isRunning())) return;
    interact();
}

void Game::stepDismissDialogue() {
    if (dialogue.isActive()) dialogue.close();
}

void Game::stepSave() { saveGame(); }
void Game::stepLoad() { loadGameFromDisk(); }

void Game::pumpEvents(float dt) {
    if (!eventRunner) return;
    eventRunner->update(dt);
    applyTransferIfPending();
    if (auto battleSummary = eventRunner->consumeBattleSummaryRequest();
        battleSummary.active) {
        battleSummarySystem.open(battleSummary.troopId, battleSummary.result,
                                 databases, state);
    }
    if (auto shopReq = eventRunner->consumeShopRequest(); shopReq.active) {
        const auto* shop = databases.findShop(shopReq.shopId);
        if (shop) {
            Logger::info("Shop opened (pump): " + shop->name);
            shopSystem.open(shopReq.shopId, databases);
        }
    }
}

bool Game::isEventRunnerRunning() const {
    return eventRunner && eventRunner->isRunning();
}
