#include "events/EventRunner.h"
#include "types/EventTypes.h"
#include "events/GameState.h"
#include "dialogue/DialogueSystem.h"
#include "core/Logger.h"
#include <vector>
#include <memory>

EventRunner::EventRunner(GameState& state, DialogueSystem& dialogueSystem)
    : gameState(state), dialogue(dialogueSystem) {}

void EventRunner::runCommandList(const std::vector<std::shared_ptr<EventCommand>>& commands,
                                 const std::string& ownerEventId) {
    commandStack.clear();
    currentOwnerEventId = ownerEventId;
    // Push commands in reverse order so we process them front-to-back via pop_back.
    for (auto it = commands.rbegin(); it != commands.rend(); ++it) {
        commandStack.push_back(*it);
    }
    executing = !commandStack.empty();
}

void EventRunner::pushFront(const std::vector<std::shared_ptr<EventCommand>>& branch) {
    for (auto it = branch.rbegin(); it != branch.rend(); ++it) {
        commandStack.push_back(*it);
    }
}

void EventRunner::update(float dt) {
    if (!executing) return;

    if (dialogue.isActive()) return;

    if (waitTimer > 0.0f) {
        waitTimer -= dt;
        if (waitTimer > 0.0f) return;
        waitTimer = 0.0f;
    }

    while (!commandStack.empty()) {
        auto cmd = commandStack.back();
        commandStack.pop_back();
        processCommand(cmd);
        if (dialogue.isActive() || waitTimer > 0.0f || transferRequest.active ||
            shopRequest.active || battleSummaryRequest.active || animationRequest.active) {
            return;
        }
    }

    executing = false;
}

void EventRunner::executeNext() {
    // Reserved for future cooperative scheduling.
}

static int compareInts(int lhs, int rhs, const std::string& op) {
    if (op == "eq") return lhs == rhs;
    if (op == "neq") return lhs != rhs;
    if (op == "gt") return lhs > rhs;
    if (op == "gte") return lhs >= rhs;
    if (op == "lt") return lhs < rhs;
    if (op == "lte") return lhs <= rhs;
    return 0;
}

void EventRunner::processCommand(const std::shared_ptr<EventCommand>& cmd) {
    if (!cmd) return;
    const std::string& type = cmd->type;

    if (type == "showText") {
        dialogue.showText(cmd->speaker, cmd->text);
        return;
    }
    if (type == "showChoices") {
        std::vector<std::string> labels;
        labels.reserve(cmd->choices.size());
        for (const auto& ch : cmd->choices) labels.push_back(ch.label);
        int choice = -1;
        if (choicePicker) choice = choicePicker(cmd->prompt, labels);
        if (choice < 0 || choice >= static_cast<int>(cmd->choices.size())) {
            // Default: first choice (deterministic without UI).
            choice = cmd->choices.empty() ? -1 : 0;
        }
        if (choice >= 0) pushFront(cmd->choices[static_cast<size_t>(choice)].commands);
        return;
    }
    if (type == "setFlag") {
        gameState.setFlag(cmd->flag, cmd->boolValue);
        return;
    }
    if (type == "ifFlag") {
        bool current = gameState.getFlag(cmd->flag);
        pushFront((current == cmd->boolValue) ? cmd->thenCommands : cmd->elseCommands);
        return;
    }
    if (type == "controlSwitch") {
        gameState.setSwitch(cmd->switchId, cmd->boolValue);
        return;
    }
    if (type == "ifSwitch") {
        bool current = gameState.getSwitch(cmd->switchId);
        pushFront((current == cmd->boolValue) ? cmd->thenCommands : cmd->elseCommands);
        return;
    }
    if (type == "controlVariable") {
        int rhs = cmd->varValue;
        if (!cmd->sourceVariableId.empty()) rhs = gameState.getVariable(cmd->sourceVariableId);
        int current = gameState.getVariable(cmd->variableId);
        const auto& op = cmd->varOp;
        int next = current;
        if (op == "set") next = rhs;
        else if (op == "add") next = current + rhs;
        else if (op == "sub") next = current - rhs;
        else if (op == "mul") next = current * rhs;
        else if (op == "div") next = (rhs == 0) ? current : current / rhs;
        else if (op == "mod") next = (rhs == 0) ? 0 : current % rhs;
        else next = current;
        gameState.setVariable(cmd->variableId, next);
        return;
    }
    if (type == "ifVariable") {
        int current = gameState.getVariable(cmd->variableId);
        bool matches = compareInts(current, cmd->varValue, cmd->compareOp) != 0;
        pushFront(matches ? cmd->thenCommands : cmd->elseCommands);
        return;
    }
    if (type == "addItem") {
        gameState.addItem(cmd->itemId, cmd->amount);
        return;
    }
    if (type == "removeItem") {
        gameState.removeItem(cmd->itemId, cmd->amount);
        return;
    }
    if (type == "addGold") {
        gameState.addGold(cmd->goldAmount);
        return;
    }
    if (type == "removeGold") {
        gameState.removeGold(cmd->goldAmount);
        return;
    }
    if (type == "transferMap") {
        transferRequest.active = true;
        transferRequest.mapId = cmd->mapId;
        transferRequest.targetX = cmd->x;
        transferRequest.targetY = cmd->y;
        transferRequest.direction = cmd->direction;
        return;
    }
    if (type == "setPlayerPosition") {
        // Same effect as transferMap but keeps the runner in this state.
        transferRequest.active = true;
        transferRequest.mapId = cmd->mapId;
        transferRequest.targetX = cmd->x;
        transferRequest.targetY = cmd->y;
        transferRequest.direction = cmd->direction;
        return;
    }
    if (type == "wait") {
        waitTimer = static_cast<float>(cmd->ms) / 1000.0f;
        return;
    }
    if (type == "playSound") {
        Logger::info("playSound: " + cmd->soundId);
        return;
    }
    if (type == "comment") {
        // Comments are ignored at runtime by design.
        return;
    }
    if (type == "callCommonEvent") {
        if (commonEventResolver) {
            auto cmds = commonEventResolver(cmd->commonEventId);
            pushFront(cmds);
        } else {
            Logger::warning("callCommonEvent: no resolver registered for " + cmd->commonEventId);
        }
        return;
    }
    if (type == "startQuest") {
        std::vector<std::string> objs;
        if (questObjectiveResolver) objs = questObjectiveResolver(cmd->questId);
        gameState.startQuest(cmd->questId, objs);
        return;
    }
    if (type == "updateQuestObjective") {
        gameState.updateQuestObjective(cmd->questId, cmd->objectiveId, cmd->objectiveState);
        return;
    }
    if (type == "completeQuest") {
        gameState.completeQuest(cmd->questId);
        return;
    }
    if (type == "openShop") {
        shopRequest.active = true;
        shopRequest.shopId = cmd->shopId;
        return;
    }
    if (type == "startBattle") {
        BattleResult result;
        if (battleRunner) {
            result = battleRunner(cmd->troopId);
        } else {
            Logger::warning("startBattle: no battleRunner registered, treating as victory");
            result.outcome = BattleResult::Outcome::Victory;
        }
        if (result.outcome == BattleResult::Outcome::Victory) {
            gameState.addGold(result.goldAwarded);
            for (const auto& [itemId, amount] : result.itemsAwarded) {
                gameState.addItem(itemId, amount);
            }
            pushFront(cmd->victoryBranch);
        } else if (result.outcome == BattleResult::Outcome::Defeat) {
            pushFront(cmd->defeatBranch);
        }
        battleSummaryRequest.active = true;
        battleSummaryRequest.troopId = cmd->troopId;
        battleSummaryRequest.result = result;
        return;
    }
    if (type == "changeActorHp") {
        // Runtime keeps an actor-id -> hp delta map. Defaults to 0 when no
        // baseline is known; callers can override via setActorHp.
        int currentHp = gameState.getActorHp(cmd->actorId, 0);
        int next = currentHp + cmd->delta;
        if (next < 0) next = 0;
        gameState.setActorHp(cmd->actorId, next);
        return;
    }
    if (type == "playAnimation") {
        animationRequest.active = true;
        animationRequest.target = cmd->animationTarget.empty() ? "player" : cmd->animationTarget;
        animationRequest.ownerEventId = currentOwnerEventId;
        animationRequest.eventId = cmd->animationEventId;
        animationRequest.action = cmd->animationAction.empty() ? "idle" : cmd->animationAction;
        animationRequest.direction = cmd->animationDirection.empty() ? "current" : cmd->animationDirection;
        animationRequest.durationMs = cmd->animationDurationMs;
        animationRequest.blocking = cmd->animationBlocking;
        animationRequest.loop = cmd->animationLoop;
        if (cmd->animationBlocking && cmd->animationDurationMs > 0) {
            waitTimer = static_cast<float>(cmd->animationDurationMs) / 1000.0f;
        }
        return;
    }

    Logger::warning("Unsupported event command type: " + type);
}

MapTransferRequest EventRunner::consumeTransferRequest() {
    MapTransferRequest req = transferRequest;
    transferRequest.active = false;
    transferRequest.mapId.clear();
    transferRequest.targetX = 0;
    transferRequest.targetY = 0;
    transferRequest.direction.clear();
    return req;
}

ShopOpenRequest EventRunner::consumeShopRequest() {
    ShopOpenRequest req = shopRequest;
    shopRequest.active = false;
    shopRequest.shopId.clear();
    return req;
}

BattleSummaryRequest EventRunner::consumeBattleSummaryRequest() {
    BattleSummaryRequest req = battleSummaryRequest;
    battleSummaryRequest = {};
    return req;
}

AnimationRequest EventRunner::consumeAnimationRequest() {
    AnimationRequest req = animationRequest;
    animationRequest = {};
    return req;
}
