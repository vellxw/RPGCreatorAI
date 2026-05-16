#pragma once
#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <optional>

struct MapTransferRequest {
    bool active = false;
    std::string mapId;
    int targetX = 0;
    int targetY = 0;
    std::string direction;
};

// Phase 6 — outcomes the EventRunner emits without owning UI.
struct ShopOpenRequest {
    bool active = false;
    std::string shopId;
};

struct BattleResult {
    enum class Outcome { Victory, Defeat, Escape };
    Outcome outcome = Outcome::Victory;
    int goldAwarded = 0;
    int expAwarded = 0;
    std::vector<std::pair<std::string, int>> itemsAwarded; // itemId, amount
};

class EventRunner {
public:
    EventRunner(class GameState& state, class DialogueSystem& dialogueSystem);

    // World hooks injected by Game so the runner can resolve common events,
    // quest objectives, troops, etc. without owning the database loader.
    using CommonEventResolver =
        std::function<std::vector<std::shared_ptr<struct EventCommand>>(const std::string&)>;
    using QuestObjectiveResolver =
        std::function<std::vector<std::string>(const std::string&)>;
    using BattleRunner =
        std::function<BattleResult(const std::string& troopId)>;

    void setCommonEventResolver(CommonEventResolver r) { commonEventResolver = std::move(r); }
    void setQuestObjectiveResolver(QuestObjectiveResolver r) { questObjectiveResolver = std::move(r); }
    void setBattleRunner(BattleRunner r) { battleRunner = std::move(r); }

    // Pre-configured choice picker for tests. When unset, showChoices logs
    // and picks the first choice (or no-op for an empty list) so the runtime
    // never deadlocks before a real UI lands.
    void setChoicePicker(std::function<int(const std::string&, const std::vector<std::string>&)> p) {
        choicePicker = std::move(p);
    }

    void runCommandList(const std::vector<std::shared_ptr<struct EventCommand>>& commands);
    void update(float dt);
    bool isRunning() const { return executing; }

    MapTransferRequest consumeTransferRequest();
    ShopOpenRequest consumeShopRequest();

private:
    void executeNext();
    void processCommand(const std::shared_ptr<struct EventCommand>& cmd);
    void pushFront(const std::vector<std::shared_ptr<struct EventCommand>>& branch);

    class GameState& gameState;
    class DialogueSystem& dialogue;

    std::vector<std::shared_ptr<struct EventCommand>> commandStack;
    bool executing = false;
    float waitTimer = 0.0f;

    MapTransferRequest transferRequest;
    ShopOpenRequest shopRequest;

    CommonEventResolver commonEventResolver;
    QuestObjectiveResolver questObjectiveResolver;
    BattleRunner battleRunner;
    std::function<int(const std::string&, const std::vector<std::string>&)> choicePicker;
};
