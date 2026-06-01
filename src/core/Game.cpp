#include "core/Game.h"
#include "core/Logger.h"
#include "core/MovementSpeed.h"
#include "events/EventPageEvaluator.h"
#include "world/MapLoader.h"
#include "world/CollisionSystem.h"
#include "save/SaveManager.h"
#include "renderer/IRenderer.h"
#include "renderer/SpriteCatalog.h"
#include "platform/AudioSystem.h"
#include <SDL.h>
#include <algorithm>
#include <cmath>
#include <cstdint>

namespace {

constexpr int kMaxRepeatedRouteSteps = 64;

bool isMovementRouteMoveStep(const std::string& type) {
    return type == "moveUp" || type == "moveDown" ||
           type == "moveLeft" || type == "moveRight";
}

int movementRouteMoveStepMs(float tilesPerSecond) {
    return tilesPerSecond > 0.0f
        ? std::max(1, static_cast<int>(std::ceil(1000.0f / tilesPerSecond)))
        : 125;
}

EntityRenderPriority renderPriorityFromEventPriority(const std::string& priority) {
    if (priority == "below" || priority == "belowCharacters") {
        return EntityRenderPriority::Below;
    }
    if (priority == "above" || priority == "aboveCharacters") {
        return EntityRenderPriority::Above;
    }
    return EntityRenderPriority::Same;
}

} // namespace

Game::Game() = default;
Game::~Game() = default;

bool Game::initialize(Window& window, const ProjectData& projectData,
                      rpg::AudioSystem* audioSystemIn) {
    project = projectData;
    audioSystem = audioSystemIn;

    // Cache viewport dimensions for camera centering.
    if (window.getSDLWindow()) {
        SDL_GetWindowSize(window.getSDLWindow(), &viewportW, &viewportH);
    }
    camera.setViewport(viewportW, viewportH);

    state.setCurrentMap(project.startMapId);
    state.setPlayerPosition(
        project.startPosition.pos.x,
        project.startPosition.pos.y,
        project.startPosition.direction
    );

    eventRunner = std::make_unique<EventRunner>(state, dialogue);
    eventScheduler = std::make_unique<EventScheduler>(state, dialogue);
    eventTraceBuffer.clear();
    eventRunner->setTraceBuffer(&eventTraceBuffer);

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
    if (audioSystem) {
        audioSystem->registerSounds(databases.system().audioRegistry);
    }
    if (!project.database.animationsPath.empty()) {
        if (!animationDatabase.load(project.database.animationsPath)) {
            Logger::warning("Animation database failed to load: " + project.database.animationsPath);
        }
    }
    if (!databases.system().playerAnimationSet.empty()) {
        playerAnimationSet = databases.system().playerAnimationSet;
    }
    playerTilesPerSecond = movementSpeedToTilesPerSecond(databases.system().playerMovementSpeed);
    defaultCharacterHeightTiles =
        databases.system().defaultCharacterHeightTiles > 0.0f
            ? databases.system().defaultCharacterHeightTiles
            : 1.5f;

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

    playerMotion.snapToTile(state.getPlayerX(), state.getPlayerY(), currentScene.getTileSize());
    updateCamera();
    return true;
}

std::string Game::getMapPath(const std::string& mapId) const {
    for (const auto& m : project.maps) {
        if (m.id == mapId) return m.path;
    }
    return {};
}

bool Game::loadMap(const std::string& mapId, bool clearScheduledRunners) {
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
    eventAnimations.clear();
    if (clearScheduledRunners && eventScheduler) eventScheduler->clear();
    state.setCurrentMap(mapId);
    Logger::info("Map loaded: " + mapId);
    requestBgmForCurrentMap();
    return true;
}

void Game::update(const InputManager& input, float dt) {
    playerMotion.update(dt);
    finalizeSmoothStepIfNeeded();
    updateAnimationStates(dt);
    updateCamera();

    if (dialogue.isChoiceActive()) {
        if (input.isJustPressed(KeyButton::Up)) {
            dialogue.moveChoiceSelection(-1);
        } else if (input.isJustPressed(KeyButton::Down)) {
            dialogue.moveChoiceSelection(1);
        } else if (input.isJustPressed(KeyButton::Confirm)) {
            dialogue.confirmChoice();
        } else if (input.isJustPressed(KeyButton::Cancel)) {
            dialogue.cancelChoice();
        }
        return;
    }

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
        !hasBlockingScheduledRunner() &&
        (input.isJustPressed(KeyButton::Cancel) ||
         input.isJustPressed(KeyButton::Menu))) {
        menuSystem.open();
        return;
    }

    // Drive the event runner; it self-pauses while dialogue is active.
    eventRunner->update(dt);

    if (applyRunnerRequests(*eventRunner)) return;

    if (battleSummarySystem.isOpen() || shopSystem.isOpen()) return;

    updateScheduledEvents(dt);

    if (battleSummarySystem.isOpen() || shopSystem.isOpen()) return;

    // If a dialogue is active, only the dismiss/advance keys are handled.
    if (dialogue.isActive()) {
        if (input.isJustPressed(KeyButton::Confirm) ||
            input.isJustPressed(KeyButton::Cancel)) {
            dialogue.close();
        }
        return;
    }

    // If the runner is still busy (e.g. a wait), block player input.
    if (eventRunner->isRunning() || hasBlockingScheduledRunner()) {
        return;
    }

    handlePlayerInput(input);
    updateCamera();
}

void Game::handlePlayerInput(const InputManager& input) {
    if (playerMotion.isMoving()) return;

    if (input.isJustPressed(KeyButton::Confirm)) {
        interact();
        return;
    }

    int dx = 0, dy = 0;
    Direction dir = state.getPlayerDirection();
    if (input.isPressed(KeyButton::Up))    { dx = 0;  dy = -1; dir = Direction::Up; }
    else if (input.isPressed(KeyButton::Down))  { dx = 0;  dy = 1;  dir = Direction::Down; }
    else if (input.isPressed(KeyButton::Left))  { dx = -1; dy = 0;  dir = Direction::Left; }
    else if (input.isPressed(KeyButton::Right)) { dx = 1;  dy = 0;  dir = Direction::Right; }
    else {
        return;
    }

    tryStartSmoothMove(dx, dy, dir);
}

bool Game::tryStartSmoothMove(int dx, int dy, Direction dir) {
    const int curX = state.getPlayerX();
    const int curY = state.getPlayerY();
    const int targetX = curX + dx;
    const int targetY = curY + dy;

    // Direction updates immediately even if the destination is blocked.
    state.setPlayerPosition(curX, curY, dir);

    if (!canPlayerMoveTo(targetX, targetY)) {
        return false;
    }

    int tileSize = currentScene.getTileSize();
    if (tileSize <= 0) tileSize = 32;
    playerMotion.startMove(targetX, targetY, dir, tileSize, playerTilesPerSecond);
    return true;
}

bool Game::tryMove(int dx, int dy, Direction dir) {
    int curX = state.getPlayerX();
    int curY = state.getPlayerY();
    int targetX = curX + dx;
    int targetY = curY + dy;

    // Direction always updates, even when blocked.
    state.setPlayerPosition(curX, curY, dir);

    if (!canPlayerMoveTo(targetX, targetY)) {
        return false;
    }

    state.setPlayerPosition(targetX, targetY, dir);
    playerMotion.snapToTile(targetX, targetY, currentScene.getTileSize());

    // Touch-trigger events fire when stepping onto the destination cell.
    triggerTouchEventAt(targetX, targetY);

    return true;
}

bool Game::canPlayerMoveTo(int targetX, int targetY) const {
    if (targetX < 0 || targetX >= currentScene.getWidth() ||
        targetY < 0 || targetY >= currentScene.getHeight()) {
        return false;
    }

    if (const EventData* ev = currentScene.getEventAt(targetX, targetY)) {
        if (rpg::eventHasActivePage(*ev, state, state.getCurrentMapId())) {
            return !rpg::activeEventBlocksMovement(*ev, state, state.getCurrentMapId());
        }
    }

    return currentScene.getTileAt("collision", targetX, targetY) != 9;
}

void Game::finalizeSmoothStepIfNeeded() {
    if (!playerMotion.consumeCompletedStep()) return;

    const int targetX = playerMotion.currentTileX();
    const int targetY = playerMotion.currentTileY();
    const Direction dir = playerMotion.direction();
    state.setPlayerPosition(targetX, targetY, dir);

    triggerTouchEventAt(targetX, targetY);
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
    if (ev && rpg::activeEventTrigger(*ev, state, state.getCurrentMapId()) == "interact") {
        runEventCommands(*ev);
    }
}

void Game::runEventCommands(const EventData& event) {
    if (!eventRunner) return;
    eventRunner->runCommandList(
        rpg::activeEventCommands(event, state, state.getCurrentMapId()),
        event.id);
}

std::vector<ScheduledEventCandidate> Game::buildScheduledEventCandidates() const {
    std::vector<ScheduledEventCandidate> candidates;
    const std::string mapId = state.getCurrentMapId();

    for (const auto& event : currentScene.getData().events) {
        const std::string trigger = rpg::activeEventTrigger(event, state, mapId);
        if (trigger != "autorun" && trigger != "parallel") continue;

        const auto& commands = rpg::activeEventCommands(event, state, mapId);
        if (commands.empty()) continue;

        ScheduledEventCandidate candidate;
        candidate.key = "map:" + mapId + ":" + event.id;
        candidate.trigger = trigger;
        candidate.ownerMapId = mapId;
        candidate.ownerEventId = event.id;
        candidate.commands = commands;
        candidates.push_back(std::move(candidate));
    }

    for (const auto& commonEvent : databases.commonEvents()) {
        if (commonEvent.trigger != "autorun" && commonEvent.trigger != "parallel") continue;
        if (commonEvent.switchId.empty() || !state.getSwitch(commonEvent.switchId)) continue;
        if (commonEvent.commands.empty()) continue;

        ScheduledEventCandidate candidate;
        candidate.key = "common:" + commonEvent.id;
        candidate.trigger = commonEvent.trigger;
        candidate.ownerMapId = mapId;
        candidate.ownerCommonEventId = commonEvent.id;
        candidate.commands = commonEvent.commands;
        candidates.push_back(std::move(candidate));
    }

    return candidates;
}

void Game::updateScheduledEvents(float dt) {
    if (!eventScheduler) return;

    eventScheduler->sync(buildScheduledEventCandidates());
    eventScheduler->update(dt);

    for (EventRunner* runner : eventScheduler->runners()) {
        if (runner && applyRunnerRequests(*runner)) return;
        if (battleSummarySystem.isOpen() || shopSystem.isOpen()) return;
    }
}

bool Game::hasBlockingScheduledRunner() const {
    return eventScheduler && eventScheduler->hasBlockingRunner();
}

void Game::applyTransferIfPending() {
    if (!eventRunner) return;
    applyRunnerRequests(*eventRunner);
}

bool Game::applyRunnerRequests(EventRunner& runner) {
    auto req = runner.consumeTransferRequest();
    if (req.active) {
        const bool scheduledRunner = eventScheduler && eventScheduler->ownsRunner(&runner);
        if (scheduledRunner) {
            eventScheduler->preserveOnly(&runner);
        }
        if (!loadMap(req.mapId, !scheduledRunner)) {
            Logger::error("Map transfer failed; staying on current map.");
            return false;
        }
        state.setPlayerPosition(req.targetX, req.targetY, stringToDirection(req.direction));
        playerMotion.snapToTile(state.getPlayerX(), state.getPlayerY(), currentScene.getTileSize());
        updateCamera();
        return true;
    }

    auto animReq = runner.consumeAnimationRequest();
    if (animReq.active) {
        applyAnimationRequest(animReq);
    }

    auto soundReq = runner.consumeSoundRequest();
    if (soundReq.active) {
        requestSound(soundReq.soundId);
    }

    auto movementReq = runner.consumeMovementRouteRequest();
    if (movementReq.active) {
        const int waitMs = applyMovementRouteRequest(movementReq);
        if (movementReq.wait && waitMs > 0) {
            runner.waitForMs(waitMs);
        }
    }

    if (auto battleSummary = runner.consumeBattleSummaryRequest();
        battleSummary.active) {
        battleSummarySystem.open(battleSummary.troopId, battleSummary.result,
                                 databases, state);
    }

    if (auto shopReq = runner.consumeShopRequest(); shopReq.active) {
        const auto* shop = databases.findShop(shopReq.shopId);
        if (shop) {
            Logger::info("Shop opened: " + shop->name + " with " +
                         std::to_string(shop->listings.size()) + " listings");
            shopSystem.open(shopReq.shopId, databases);
        } else {
            Logger::warning("openShop: unknown shop '" + shopReq.shopId + "'");
        }
    }

    return false;
}

void Game::requestSound(const std::string& soundId) {
    if (!audioSystem) {
        Logger::warning("Audio requested with no AudioSystem: " + soundId);
        return;
    }
    audioSystem->playSound(soundId);
}

void Game::requestBgmForCurrentMap() {
    if (!audioSystem) return;

    const std::string mapBgm = currentScene.getData().bgm;
    const std::string bgmId =
        !mapBgm.empty() ? mapBgm : databases.system().defaultBgm;
    if (bgmId.empty()) {
        audioSystem->stopBgm();
        return;
    }
    audioSystem->playBgm(bgmId);
}

void Game::applyAnimationIfPending() {
    if (!eventRunner) return;
    applyRunnerRequests(*eventRunner);
}

int Game::applyMovementRouteRequest(const MovementRouteRequest& request) {
    const std::string target = request.target.empty() ? "player" : request.target;
    const bool targetPlayer = target == "player";
    const std::string targetEventId = targetPlayer ? std::string{} : resolveMovementRouteEventId(request);
    if (!targetPlayer && targetEventId.empty()) return 0;
    if (!targetPlayer && !currentScene.getEventById(targetEventId)) {
        Logger::warning("setMovementRoute: target event not found: " + targetEventId);
        return 0;
    }
    if (request.steps.empty()) return 0;

    int waitMs = 0;
    const int moveStepMs = movementRouteMoveStepMs(playerTilesPerSecond);
    int executedSteps = 0;
    bool keepRunning = true;

    do {
        for (const auto& step : request.steps) {
            if (executedSteps >= kMaxRepeatedRouteSteps) {
                Logger::warning("setMovementRoute: repeat route stopped by deterministic step guard");
                keepRunning = false;
                break;
            }

            if (isMovementRouteMoveStep(step.type)) {
                waitMs += moveStepMs;
            } else if (step.type == "wait" && step.ms > 0) {
                waitMs += step.ms;
            }

            keepRunning = targetPlayer
                ? applyPlayerMovementRouteStep(step, request.skippable)
                : applyEventMovementRouteStep(targetEventId, step, request.skippable);
            ++executedSteps;
            if (!keepRunning) break;
        }
    } while (request.repeat && keepRunning);

    updateCamera();
    return waitMs;
}

bool Game::applyPlayerMovementRouteStep(const MovementRouteRequest::Step& step, bool skippable) {
    auto turn = [this](Direction direction) {
        state.setPlayerPosition(state.getPlayerX(), state.getPlayerY(), direction);
    };
    auto move = [this, skippable](int dx, int dy, Direction direction) {
        const int curX = state.getPlayerX();
        const int curY = state.getPlayerY();
        const int targetX = curX + dx;
        const int targetY = curY + dy;
        state.setPlayerPosition(curX, curY, direction);
        if (!canPlayerMoveTo(targetX, targetY)) {
            return skippable;
        }
        state.setPlayerPosition(targetX, targetY, direction);
        playerMotion.snapToTile(targetX, targetY, currentScene.getTileSize());
        return !triggerTouchEventAt(targetX, targetY);
    };

    if (step.type == "moveUp") return move(0, -1, Direction::Up);
    if (step.type == "moveDown") return move(0, 1, Direction::Down);
    if (step.type == "moveLeft") return move(-1, 0, Direction::Left);
    if (step.type == "moveRight") return move(1, 0, Direction::Right);
    if (step.type == "turnUp") { turn(Direction::Up); return true; }
    if (step.type == "turnDown") { turn(Direction::Down); return true; }
    if (step.type == "turnLeft") { turn(Direction::Left); return true; }
    if (step.type == "turnRight") { turn(Direction::Right); return true; }
    if (step.type == "wait") return true;

    Logger::warning("setMovementRoute: unsupported route step '" + step.type + "'");
    return skippable;
}

bool Game::applyEventMovementRouteStep(const std::string& eventId,
                                       const MovementRouteRequest::Step& step,
                                       bool skippable) {
    auto turn = [this, &eventId](Direction direction) {
        currentScene.setRuntimeEventDirection(eventId, direction);
    };
    auto move = [this, &eventId, skippable](int dx, int dy, Direction direction) {
        const auto runtimeState = currentScene.getRuntimeEventState(eventId);
        if (!runtimeState) return false;

        const int targetX = runtimeState->x + dx;
        const int targetY = runtimeState->y + dy;
        currentScene.setRuntimeEventDirection(eventId, direction);
        if (!canEventMoveTo(eventId, targetX, targetY)) {
            return skippable;
        }
        currentScene.setRuntimeEventPosition(eventId, targetX, targetY, direction);
        return true;
    };

    if (step.type == "moveUp") return move(0, -1, Direction::Up);
    if (step.type == "moveDown") return move(0, 1, Direction::Down);
    if (step.type == "moveLeft") return move(-1, 0, Direction::Left);
    if (step.type == "moveRight") return move(1, 0, Direction::Right);
    if (step.type == "turnUp") { turn(Direction::Up); return true; }
    if (step.type == "turnDown") { turn(Direction::Down); return true; }
    if (step.type == "turnLeft") { turn(Direction::Left); return true; }
    if (step.type == "turnRight") { turn(Direction::Right); return true; }
    if (step.type == "wait") return true;

    Logger::warning("setMovementRoute: unsupported route step '" + step.type + "'");
    return skippable;
}

bool Game::canEventMoveTo(const std::string& eventId, int targetX, int targetY) const {
    if (targetX < 0 || targetX >= currentScene.getWidth() ||
        targetY < 0 || targetY >= currentScene.getHeight()) {
        return false;
    }

    const EventData* movingEvent = currentScene.getEventById(eventId);
    if (!movingEvent) return false;

    const EventPage* activeMovingPage = movingEvent->pages.empty()
        ? nullptr
        : rpg::selectActiveEventPage(*movingEvent, state, state.getCurrentMapId());
    if (!movingEvent->pages.empty() && !activeMovingPage) return false;

    const bool through = activeMovingPage && activeMovingPage->options.through;
    if (through) return true;

    if (currentScene.getTileAt("collision", targetX, targetY) == 9) {
        return false;
    }

    if (state.getPlayerX() == targetX && state.getPlayerY() == targetY) {
        return false;
    }

    for (const auto& event : currentScene.getData().events) {
        if (event.id == eventId) continue;
        const Vec2i pos = currentScene.getRuntimeEventPosition(event.id)
                              .value_or(Vec2i{event.x, event.y});
        if (pos.x != targetX || pos.y != targetY) continue;
        if (rpg::eventHasActivePage(event, state, state.getCurrentMapId()) &&
            rpg::activeEventBlocksMovement(event, state, state.getCurrentMapId())) {
            return false;
        }
    }

    return true;
}

std::string Game::resolveMovementRouteEventId(const MovementRouteRequest& request) const {
    const std::string target = request.target.empty() ? "player" : request.target;
    if (target == "thisEvent") {
        if (request.ownerEventId.empty()) {
            Logger::warning("setMovementRoute: thisEvent target has no owning event");
        }
        return request.ownerEventId;
    }
    if (target == "event") {
        if (request.eventId.empty()) {
            Logger::warning("setMovementRoute: named event target is empty");
        }
        return request.eventId;
    }

    Logger::warning("setMovementRoute: unsupported route target '" + target + "'");
    return {};
}

bool Game::triggerTouchEventAt(int x, int y) {
    if (const EventData* ev = currentScene.getEventAt(x, y)) {
        if (rpg::activeEventTrigger(*ev, state, state.getCurrentMapId()) == "touch") {
            runEventCommands(*ev);
            return true;
        }
    }
    return false;
}

void Game::applyAnimationRequest(const AnimationRequest& request) {
    auto resolveDuration = [&](const std::string& setId, const std::string& action, Direction dir) {
        if (request.durationMs > 0) return static_cast<float>(request.durationMs) / 1000.0f;
        if (const AnimationClip* clip = animationDatabase.findClip(setId, action, dir)) {
            if (clip->fps > 0.0f) {
                return static_cast<float>(clip->frameCount) / clip->fps;
            }
        }
        return 0.0f;
    };

    auto applyToState = [&](RuntimeAnimationState& state,
                            const std::string& setId,
                            Direction fallbackDirection) {
        Direction dir = fallbackDirection;
        if (request.direction != "current") {
            dir = stringToDirection(request.direction);
        }
        state.action = request.action.empty() ? "idle" : request.action;
        state.direction = dir;
        state.elapsed = 0.0f;
        state.duration = resolveDuration(setId, state.action, dir);
        state.manual = true;
        state.loop = request.loop;
    };

    if (request.target == "player") {
        applyToState(playerAnimation, playerAnimationSet, state.getPlayerDirection());
        return;
    }

    const std::string targetEventId =
        request.target == "thisEvent" ? request.ownerEventId : request.eventId;
    if (targetEventId.empty()) return;

    const EventData* event = nullptr;
    for (const auto& candidate : currentScene.getData().events) {
        if (candidate.id == targetEventId) {
            event = &candidate;
            break;
        }
    }
    if (!event) {
        Logger::warning("playAnimation target event not found: " + targetEventId);
        return;
    }

    auto& anim = eventAnimations[targetEventId];
    const EventPage* activePage = event->pages.empty()
        ? nullptr
        : rpg::selectActiveEventPage(*event, state, state.getCurrentMapId());
    const std::string animationSet =
        activePage && !activePage->graphic.animationSet.empty()
            ? activePage->graphic.animationSet
            : event->animationSet;
    Direction fallbackDirection = Direction::Down;
    if (auto runtimeState = currentScene.getRuntimeEventState(targetEventId)) {
        fallbackDirection = runtimeState->direction;
    }
    applyToState(anim, animationSet, fallbackDirection);
}

void Game::updateAnimationStates(float dt) {
    auto updateOne = [dt](RuntimeAnimationState& anim) {
        anim.elapsed += std::max(0.0f, dt);
        if (!anim.manual) return;
        if (anim.loop && anim.duration <= 0.0f) return;
        if (anim.duration > 0.0f && anim.elapsed >= anim.duration) {
            anim.action = "idle";
            anim.elapsed = 0.0f;
            anim.duration = 0.0f;
            anim.manual = false;
            anim.loop = false;
        }
    };

    updateOne(playerAnimation);
    for (auto& [_, anim] : eventAnimations) {
        updateOne(anim);
    }
}

void Game::hookEventRunnerResolvers() {
    if (!eventRunner) return;
    configureEventRunner(*eventRunner);
    if (eventScheduler) {
        eventScheduler->setRunnerConfigurator([this](EventRunner& runner) {
            configureEventRunner(runner);
        });
    }
}

void Game::configureEventRunner(EventRunner& runner) {
    runner.setTraceBuffer(&eventTraceBuffer);
    runner.setCommonEventResolver(
        [this](const std::string& id) -> std::vector<std::shared_ptr<EventCommand>> {
            const auto* ce = databases.findCommonEvent(id);
            return ce ? ce->commands : std::vector<std::shared_ptr<EventCommand>>{};
        });
    runner.setQuestObjectiveResolver(
        [this](const std::string& qid) -> std::vector<std::string> {
            const auto* q = databases.findQuest(qid);
            std::vector<std::string> out;
            if (q) for (const auto& obj : q->objectives) out.push_back(obj.id);
            return out;
        });
    runner.setBattleRunner([this](const std::string& troopId) {
        if (!battleSystem) return BattleResult{};
        return battleSystem->run(troopId);
    });
}

void Game::updateCamera() {
    int tileSize = currentScene.getTileSize();
    if (tileSize <= 0) tileSize = 32;
    const int mapPixelWidth = currentScene.getWidth() * tileSize;
    const int mapPixelHeight = currentScene.getHeight() * tileSize;

    if (project.visualProfile.cameraMode == "fixed-room") {
        camera.centerRoom(mapPixelWidth, mapPixelHeight);
        return;
    }

    int px = static_cast<int>(std::round(playerMotion.visualX())) + tileSize / 2;
    int py = static_cast<int>(std::round(playerMotion.visualY())) + tileSize / 2;
    camera.follow(px, py, mapPixelWidth, mapPixelHeight);
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
    playerMotion.snapToTile(state.getPlayerX(), state.getPlayerY(), currentScene.getTileSize());
    updateCamera();
    if (showDialogueFeedback) dialogue.showText("", "Partida cargada.");
    return true;
}

void Game::render(IRenderer& renderer) {
    const RenderEntitiesSnapshot entities = buildRenderSnapshot();
    renderer.renderMap(currentScene, camera, MapRenderPass::Background);
    renderer.renderEntities(entities, camera, EntityRenderPass::BelowAndSame);
    renderer.renderMap(currentScene, camera, MapRenderPass::Foreground);
    renderer.renderEntities(entities, camera, EntityRenderPass::Above);
    renderer.renderHUD(state);
    renderer.renderDialogue(dialogue);
    renderer.renderMenu(menuSystem.snapshot(state, databases));
    renderer.renderShop(shopSystem.snapshot(state, databases));
    renderer.renderBattleSummary(battleSummarySystem.snapshot());
}

RenderEntitiesSnapshot Game::buildRenderSnapshot() const {
    RenderEntitiesSnapshot snapshot;
    int tileSize = currentScene.getTileSize();
    if (tileSize <= 0) tileSize = 32;

    for (const auto& event : currentScene.getData().events) {
        const EventPage* activePage = event.pages.empty()
            ? nullptr
            : rpg::selectActiveEventPage(event, state, state.getCurrentMapId());
        if (!event.pages.empty() && !activePage) continue;

        const auto animIt = eventAnimations.find(event.id);
        const RuntimeAnimationState fallbackAnim;
        const RuntimeAnimationState& anim =
            animIt == eventAnimations.end() ? fallbackAnim : animIt->second;
        const std::string action = anim.manual ? anim.action : "idle";
        const auto runtimeState = currentScene.getRuntimeEventState(event.id);
        const Direction eventDirection =
            runtimeState ? runtimeState->direction : Direction::Down;
        const Direction dir = anim.manual ? anim.direction : eventDirection;
        const std::string animationSet =
            activePage && !activePage->graphic.animationSet.empty()
                ? activePage->graphic.animationSet
                : event.animationSet;
        const std::string fallbackAsset =
            activePage && !activePage->graphic.sprite.empty()
                ? activePage->graphic.sprite
                : SpriteCatalog::eventAssetFor(event);
        const float displayHeightTiles =
            activePage && activePage->graphic.displayHeightTiles > 0.0f
                ? activePage->graphic.displayHeightTiles
                : event.displayHeightTiles;
        const Vec2i eventPosition = currentScene.getRuntimeEventPosition(event.id)
                                        .value_or(Vec2i{event.x, event.y});
        auto sprite = buildAnimatedSprite(
            animationSet,
            fallbackAsset,
            action,
            dir,
            anim.elapsed,
            static_cast<float>(eventPosition.x * tileSize),
            static_cast<float>(eventPosition.y * tileSize),
            tileSize,
            displayHeightTiles,
            event.type == "npc" || !animationSet.empty(),
            false);
        sprite.id = event.id;
        sprite.renderPriority = renderPriorityFromEventPriority(
            rpg::activeEventRenderPriority(event, state, state.getCurrentMapId()));
        snapshot.events.push_back(std::move(sprite));
    }

    const bool playerManual = playerAnimation.manual;
    const std::string playerAction =
        playerManual ? playerAnimation.action : (playerMotion.isMoving() ? "walk" : "idle");
    const Direction playerDir =
        playerManual ? playerAnimation.direction : state.getPlayerDirection();
    snapshot.player = buildAnimatedSprite(
        playerAnimationSet,
        "player_adventurer",
        playerAction,
        playerDir,
        playerAnimation.elapsed,
        playerMotion.visualX(),
        playerMotion.visualY(),
        tileSize,
        0.0f,
        true,
        true);
    snapshot.player.id = "player";
    snapshot.player.renderPriority = EntityRenderPriority::Same;

    return snapshot;
}

EntityRenderSprite Game::buildAnimatedSprite(const std::string& animationSet,
                                             const std::string& fallbackAsset,
                                             const std::string& action,
                                             Direction direction,
                                             float elapsed,
                                             float worldX,
                                             float worldY,
                                             int tileSize,
                                             float displayHeightOverride,
                                             bool useCharacterDisplayDefault,
                                             bool showDirectionDot) const {
    EntityRenderSprite sprite;
    sprite.assetKey = fallbackAsset;
    sprite.worldX = worldX;
    sprite.worldY = worldY;
    sprite.worldW = tileSize;
    sprite.worldH = tileSize;
    sprite.direction = direction;
    sprite.showDirectionDot = showDirectionDot;

    const AnimationSet* set = animationSet.empty() ? nullptr : animationDatabase.findSet(animationSet);
    const AnimationClip* clip =
        animationSet.empty() ? nullptr : animationDatabase.findClip(animationSet, action, direction);

    auto applyDisplay = [&](float aspect) {
        float heightTiles = displayHeightOverride > 0.0f ? displayHeightOverride : 0.0f;
        float widthTiles = 0.0f;
        float yOffsetPx = 0.0f;
        if (heightTiles <= 0.0f && set && set->display.heightTiles > 0.0f) {
            heightTiles = set->display.heightTiles;
            widthTiles = set->display.widthTiles;
            yOffsetPx = set->display.yOffsetPx;
        }
        if (heightTiles <= 0.0f && useCharacterDisplayDefault) {
            heightTiles = defaultCharacterHeightTiles > 0.0f ? defaultCharacterHeightTiles : 1.5f;
        }
        if (heightTiles <= 0.0f) {
            return;
        }

        const float renderH = static_cast<float>(tileSize) * heightTiles;
        const float renderW = static_cast<float>(tileSize) *
                              (widthTiles > 0.0f ? widthTiles : heightTiles * aspect);
        sprite.worldX = worldX + static_cast<float>(tileSize) * 0.5f - renderW * 0.5f;
        sprite.worldY = worldY + static_cast<float>(tileSize) - renderH + yOffsetPx;
        sprite.worldW = std::max(1, static_cast<int>(std::round(renderW)));
        sprite.worldH = std::max(1, static_cast<int>(std::round(renderH)));
    };

    if (!clip) {
        applyDisplay(1.0f);
        return sprite;
    }

    int frameIndex = 0;
    if (clip->frameCount > 1 && clip->fps > 0.0f) {
        frameIndex = static_cast<int>(std::floor(elapsed * clip->fps));
        if (clip->loop) {
            frameIndex %= clip->frameCount;
        } else {
            frameIndex = std::min(frameIndex, clip->frameCount - 1);
        }
    }

    sprite.assetKey = clip->asset;
    sprite.source.active = true;
    sprite.source.x = frameIndex * clip->frameSize.width;
    sprite.source.y = 0;
    sprite.source.w = clip->frameSize.width;
    sprite.source.h = clip->frameSize.height;
    const float aspect =
        clip->frameSize.height > 0
            ? static_cast<float>(clip->frameSize.width) / static_cast<float>(clip->frameSize.height)
            : 1.0f;
    applyDisplay(aspect);
    sprite.showDirectionDot = false;
    return sprite;
}

// ---- Public verbs ---------------------------------------------------------

void Game::stepMove(int dx, int dy, Direction dir) {
    if (dialogue.isActive() ||
        (eventRunner && eventRunner->isRunning()) ||
        hasBlockingScheduledRunner()) return;
    tryMove(dx, dy, dir);
    updateCamera();
}

void Game::stepInteract() {
    if (dialogue.isActive() ||
        (eventRunner && eventRunner->isRunning()) ||
        hasBlockingScheduledRunner()) return;
    interact();
}

void Game::stepDismissDialogue() {
    if (dialogue.isChoiceActive()) {
        dialogue.confirmChoice();
    } else if (dialogue.isActive()) {
        dialogue.close();
    }
}

void Game::stepSave() { saveGame(); }
void Game::stepLoad() { loadGameFromDisk(); }

void Game::pumpEvents(float dt) {
    if (!eventRunner) return;
    playerMotion.update(dt);
    finalizeSmoothStepIfNeeded();
    updateAnimationStates(dt);
    eventRunner->update(dt);
    if (applyRunnerRequests(*eventRunner)) return;
    updateScheduledEvents(dt);
}

bool Game::isEventRunnerRunning() const {
    return (eventRunner && eventRunner->isRunning()) ||
           (eventScheduler && eventScheduler->hasBlockingRunner());
}

rpg::RuntimeDebugSnapshot Game::buildRuntimeDebugSnapshot(std::uint64_t frameNumber) const {
    rpg::RuntimeDebugSnapshot snapshot;
    snapshot.frameNumber = frameNumber;
    snapshot.mapId = state.getCurrentMapId();
    snapshot.playerX = state.getPlayerX();
    snapshot.playerY = state.getPlayerY();
    snapshot.playerDirection = directionToString(state.getPlayerDirection());
    snapshot.gold = state.getGold();
    snapshot.party = state.getParty();

    for (const auto& [key, value] : state.getSwitches()) {
        snapshot.switches[key] = value;
    }
    for (const auto& [key, value] : state.getVariables()) {
        snapshot.variables[key] = value;
    }
    for (const auto& [key, value] : state.getSelfSwitches()) {
        snapshot.selfSwitches[key] = value;
    }
    for (const auto& [key, value] : state.getInventory()) {
        snapshot.inventory[key] = value;
    }

    snapshot.activeDialogue = dialogue.isActive();
    snapshot.activeMenu = menuSystem.isOpen();
    snapshot.activeShop = shopSystem.isOpen();
    snapshot.activeBattle = battleSummarySystem.isOpen();

    if (eventRunner) {
        const std::string id = eventRunner->debugRunningSourceId();
        if (!id.empty()) snapshot.runningEventIds.push_back(id);
    }
    if (eventScheduler) {
        auto ids = eventScheduler->runningDebugSourceIds();
        snapshot.runningEventIds.insert(snapshot.runningEventIds.end(), ids.begin(), ids.end());
    }

    return snapshot;
}
