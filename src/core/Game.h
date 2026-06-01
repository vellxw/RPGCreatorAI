#pragma once
#include "platform/Window.h"
#include "platform/InputManager.h"
#include "core/PlayerMotion.h"
#include "renderer/Renderer2D.h"
#include "renderer/RenderSnapshot.h"
#include "world/MapScene.h"
#include "events/GameState.h"
#include "events/EventRunner.h"
#include "events/EventScheduler.h"
#include "dialogue/DialogueSystem.h"
#include "database/ItemDatabase.h"
#include "database/AnimationDatabase.h"
#include "database/RpgDatabases.h"
#include "runtime/BattleSystem.h"
#include "runtime/BattleSummarySystem.h"
#include "runtime/MenuSystem.h"
#include "runtime/ShopSystem.h"
#include "types/ProjectTypes.h"
#include <memory>
#include <string>
#include <unordered_map>

namespace rpg {
class AudioSystem;
}

class Game {
public:
    Game();
    ~Game();

    bool initialize(Window& window, const ProjectData& projectData,
                    rpg::AudioSystem* audioSystem = nullptr);
    void update(const InputManager& input, float dt);
    void render(IRenderer& renderer);

    // ---- Public verbs (used by both the input-driven path and the
    // visual verification harness).
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
    const rpg::RpgDatabases& getDatabases() const { return databases; }

private:
    bool loadMap(const std::string& mapId, bool clearScheduledRunners = true);
    void handlePlayerInput(const InputManager& input);
    bool tryMove(int dx, int dy, Direction dir);
    bool tryStartSmoothMove(int dx, int dy, Direction dir);
    bool canPlayerMoveTo(int targetX, int targetY) const;
    void finalizeSmoothStepIfNeeded();
    void interact();
    void runEventCommands(const EventData& event);
    std::vector<ScheduledEventCandidate> buildScheduledEventCandidates() const;
    void updateScheduledEvents(float dt);
    bool hasBlockingScheduledRunner() const;
    void applyTransferIfPending();
    void applyAnimationIfPending();
    bool applyRunnerRequests(EventRunner& runner);
    void requestSound(const std::string& soundId);
    void requestBgmForCurrentMap();
    void applyAnimationRequest(const AnimationRequest& request);
    int applyMovementRouteRequest(const MovementRouteRequest& request);
    bool applyPlayerMovementRouteStep(const MovementRouteRequest::Step& step, bool skippable);
    bool applyEventMovementRouteStep(const std::string& eventId,
                                     const MovementRouteRequest::Step& step,
                                     bool skippable);
    bool canEventMoveTo(const std::string& eventId, int targetX, int targetY) const;
    std::string resolveMovementRouteEventId(const MovementRouteRequest& request) const;
    bool triggerTouchEventAt(int x, int y);
    void updateAnimationStates(float dt);
    RenderEntitiesSnapshot buildRenderSnapshot() const;
    EntityRenderSprite buildAnimatedSprite(const std::string& animationSet,
                                           const std::string& fallbackAsset,
                                           const std::string& action,
                                           Direction direction,
                                           float elapsed,
                                           float worldX,
                                           float worldY,
                                           int tileSize,
                                           float displayHeightOverride,
                                           bool useCharacterDisplayDefault,
                                           bool showDirectionDot) const;
    void updateCamera();
    bool saveGame(int slotIndex = 1, bool showDialogueFeedback = true);
    bool loadGameFromDisk(int slotIndex = 1, bool showDialogueFeedback = true);
    void hookEventRunnerResolvers();
    void configureEventRunner(EventRunner& runner);

    std::string getMapPath(const std::string& mapId) const;

    ProjectData project;
    MapScene currentScene;
    GameState state;
    DialogueSystem dialogue;
    std::unique_ptr<EventRunner> eventRunner;
    std::unique_ptr<EventScheduler> eventScheduler;
    Camera2D camera;
    ItemDatabase itemDatabase;
    rpg::RpgDatabases databases;
    std::unique_ptr<rpg::BattleSystem> battleSystem;
    rpg::BattleSummarySystem battleSummarySystem;
    rpg::MenuSystem menuSystem;
    rpg::ShopSystem shopSystem;
    AnimationDatabase animationDatabase;
    PlayerMotion playerMotion;
    rpg::AudioSystem* audioSystem = nullptr;

    struct RuntimeAnimationState {
        std::string action = "idle";
        Direction direction = Direction::Down;
        float elapsed = 0.0f;
        float duration = 0.0f;
        bool manual = false;
        bool loop = false;
    };

    RuntimeAnimationState playerAnimation;
    std::unordered_map<std::string, RuntimeAnimationState> eventAnimations;
    std::string playerAnimationSet = "player_adventurer";
    float playerTilesPerSecond = 8.0f;
    float defaultCharacterHeightTiles = 1.5f;

    int viewportW = 800;
    int viewportH = 600;

    static std::string slotIdFor(int slotIndex);
};
