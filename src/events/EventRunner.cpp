#include "events/EventRunner.h"
#include "types/EventTypes.h"
#include "events/GameState.h"
#include "dialogue/DialogueSystem.h"
#include "core/Logger.h"
#include <vector>
#include <memory>
#include <cctype>
#include <algorithm>
#include <optional>
#include <iostream>
#include <sstream>
#include <utility>

EventRunner::EventRunner(GameState& state, DialogueSystem& dialogueSystem)
    : gameState(state), dialogue(dialogueSystem) {}

void EventRunner::setTraceSource(EventTraceSource source) {
    traceSource = std::move(source);
    traceSourceExplicit = true;
}

void EventRunner::runCommandList(const std::vector<std::shared_ptr<EventCommand>>& commands,
                                 const std::string& ownerEventId) {
    commandStack.clear();
    pendingChoiceCommand.reset();
    pendingChoicePath.clear();
    activeWaitCommandType.clear();
    activeWaitCommandPath.clear();
    activeWaitResult.clear();
    currentOwnerMapId = gameState.getCurrentMapId();
    currentOwnerEventId = ownerEventId;

    if (!traceSourceExplicit || !ownerEventId.empty()) {
        traceSource.sourceType = ownerEventId.empty() ? "runner" : "mapEvent";
        traceSource.mapId = currentOwnerMapId;
        traceSource.eventId = ownerEventId;
        traceSource.commonEventId.clear();
    }

    // Push commands in reverse order so we process them front-to-back via pop_back.
    for (size_t index = commands.size(); index > 0; --index) {
        const size_t commandIndex = index - 1;
        commandStack.push_back({commands[commandIndex], std::to_string(commandIndex)});
    }
    executing = !commandStack.empty();
}

void EventRunner::pushFront(const std::vector<std::shared_ptr<EventCommand>>& branch,
                            const std::string& parentPath) {
    for (size_t index = branch.size(); index > 0; --index) {
        const size_t commandIndex = index - 1;
        const std::string childPath =
            parentPath.empty()
                ? std::to_string(commandIndex)
                : parentPath + "." + std::to_string(commandIndex);
        commandStack.push_back({branch[commandIndex], childPath});
    }
}

void EventRunner::update(float dt) {
    if (!executing) return;

    if (pendingChoiceCommand) {
        auto result = dialogue.consumeChoiceResult();
        if (!result) return;

        if (!result->cancelled &&
            result->index >= 0 &&
            result->index < static_cast<int>(pendingChoiceCommand->choices.size())) {
            traceCommand(pendingChoiceCommand.get(), pendingChoicePath, "choice",
                         "selected=" + std::to_string(result->index));
            pushFront(pendingChoiceCommand->choices[static_cast<size_t>(result->index)].commands,
                      pendingChoicePath);
        } else {
            traceCommand(pendingChoiceCommand.get(), pendingChoicePath, "choice", "cancelled");
        }
        pendingChoiceCommand.reset();
        pendingChoicePath.clear();
    }

    if (dialogue.isActive()) return;

    if (waitTimer > 0.0f) {
        waitTimer -= dt;
        if (waitTimer > 0.0f) return;
        waitTimer = 0.0f;
        if (!activeWaitCommandType.empty()) {
            traceCommandType(activeWaitCommandType, activeWaitCommandPath,
                             "waitFinish", activeWaitResult);
            activeWaitCommandType.clear();
            activeWaitCommandPath.clear();
            activeWaitResult.clear();
        }
    }

    while (!commandStack.empty()) {
        auto frame = commandStack.back();
        commandStack.pop_back();
        if (!frame.command) {
            traceCommandType("unknown", frame.path, "warning", "null-command");
            continue;
        }
        traceCommand(frame.command.get(), frame.path, "start", "queued");
        processCommand(frame.command, frame.path);
        traceCommand(frame.command.get(), frame.path, "finish", "ok");
        if (dialogue.isActive() || waitTimer > 0.0f || transferRequest.active ||
            shopRequest.active || battleSummaryRequest.active || animationRequest.active ||
            movementRouteRequest.active || soundRequest.active) {
            return;
        }
    }

    executing = false;
}

void EventRunner::waitForMs(int ms) {
    if (ms <= 0) return;
    waitTimer = std::max(waitTimer, static_cast<float>(ms) / 1000.0f);
    activeWaitCommandType = "waitForMs";
    activeWaitCommandPath.clear();
    activeWaitResult = std::to_string(ms) + "ms";
    traceCommandType("waitForMs", "", "wait", activeWaitResult);
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

static char selfSwitchLetter(const std::string& id) {
    return id.empty()
        ? '\0'
        : static_cast<char>(std::toupper(static_cast<unsigned char>(id.front())));
}

enum class PluginCommandHandler {
    DebugLog,
    DebugSetSwitch,
    DebugSetVariable,
};

struct PluginCommandRegistryEntry {
    const char* pluginId;
    const char* command;
    PluginCommandHandler handler;
};

static const std::vector<PluginCommandRegistryEntry>& pluginCommandRegistry() {
    static const std::vector<PluginCommandRegistryEntry> registry = {
        {"debug", "log", PluginCommandHandler::DebugLog},
        {"debug", "setSwitch", PluginCommandHandler::DebugSetSwitch},
        {"debug", "setVariable", PluginCommandHandler::DebugSetVariable},
    };
    return registry;
}

static const PluginCommandRegistryEntry* findPluginCommandRegistryEntry(
    const std::string& pluginId,
    const std::string& command) {
    const auto& registry = pluginCommandRegistry();
    const auto it = std::find_if(registry.begin(), registry.end(), [&](const auto& entry) {
        return pluginId == entry.pluginId && command == entry.command;
    });
    return it == registry.end() ? nullptr : &(*it);
}

static const EventCommand::PluginArg* findPluginArg(const EventCommand& cmd,
                                                    const std::string& key) {
    auto it = cmd.pluginArgs.find(key);
    return it == cmd.pluginArgs.end() ? nullptr : &it->second;
}

static std::optional<std::string> pluginStringArg(const EventCommand& cmd,
                                                  const std::string& key) {
    const auto* arg = findPluginArg(cmd, key);
    if (!arg || arg->type != EventCommand::PluginArg::Type::String) return std::nullopt;
    return arg->stringValue;
}

static std::optional<bool> pluginBoolArg(const EventCommand& cmd,
                                         const std::string& key) {
    const auto* arg = findPluginArg(cmd, key);
    if (!arg || arg->type != EventCommand::PluginArg::Type::Boolean) return std::nullopt;
    return arg->boolValue;
}

static std::optional<double> pluginNumberArg(const EventCommand& cmd,
                                             const std::string& key) {
    const auto* arg = findPluginArg(cmd, key);
    if (!arg || arg->type != EventCommand::PluginArg::Type::Number) return std::nullopt;
    return arg->numberValue;
}

static std::string boolResult(bool value) {
    return value ? "true" : "false";
}

static std::string battleOutcomeString(BattleResult::Outcome outcome) {
    switch (outcome) {
        case BattleResult::Outcome::Victory: return "victory";
        case BattleResult::Outcome::Defeat: return "defeat";
        case BattleResult::Outcome::Escape: return "escape";
    }
    return "unknown";
}

EventTraceSource EventRunner::activeTraceSource() const {
    EventTraceSource source = traceSource;
    if (source.sourceType.empty()) {
        source.sourceType = currentOwnerEventId.empty() ? "runner" : "mapEvent";
    }
    if (source.mapId.empty()) source.mapId = currentOwnerMapId;
    if (source.sourceType == "mapEvent" && source.eventId.empty()) {
        source.eventId = currentOwnerEventId;
    }
    return source;
}

void EventRunner::traceCommand(const EventCommand* cmd,
                               const std::string& commandPath,
                               const std::string& action,
                               const std::string& result) {
    traceCommandType(cmd ? cmd->type : "unknown", commandPath, action, result);
}

void EventRunner::traceCommandType(const std::string& commandType,
                                   const std::string& commandPath,
                                   const std::string& action,
                                   const std::string& result) {
    if (!traceBuffer) return;

    const EventTraceSource source = activeTraceSource();
    EventTraceEntry entry;
    entry.sourceType = source.sourceType;
    entry.mapId = source.mapId;
    entry.eventId = source.eventId;
    entry.commonEventId = source.commonEventId;
    entry.commandPath = commandPath;
    entry.commandType = commandType;
    entry.action = action;
    entry.result = result;
    traceBuffer->record(std::move(entry));
    if (!traceBuffer->entries().empty()) {
        std::cout << formatEventTraceLine(traceBuffer->entries().back()) << '\n';
    }
}

std::string EventRunner::debugRunningSourceId() const {
    if (!executing) return {};
    const EventTraceSource source = activeTraceSource();
    if (!source.commonEventId.empty()) return "common:" + source.commonEventId;
    if (!source.eventId.empty()) return "map:" + source.mapId + ":" + source.eventId;
    return source.sourceType;
}

void EventRunner::processCommand(const std::shared_ptr<EventCommand>& cmd,
                                 const std::string& commandPath) {
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
        if (choicePicker) {
            int choice = choicePicker(cmd->prompt, labels);
            if (choice < 0 || choice >= static_cast<int>(cmd->choices.size())) {
                choice = cmd->choices.empty() ? -1 : 0;
            }
            if (choice >= 0) {
                traceCommand(cmd.get(), commandPath, "choice",
                             "selected=" + std::to_string(choice));
                pushFront(cmd->choices[static_cast<size_t>(choice)].commands, commandPath);
            } else {
                traceCommand(cmd.get(), commandPath, "choice", "empty");
            }
            return;
        }
        if (cmd->choices.empty()) return;
        pendingChoiceCommand = cmd;
        pendingChoicePath = commandPath;
        dialogue.showChoices(cmd->prompt, labels);
        traceCommand(cmd.get(), commandPath, "choice", "waiting");
        return;
    }
    if (type == "setFlag") {
        gameState.setFlag(cmd->flag, cmd->boolValue);
        return;
    }
    if (type == "ifFlag") {
        bool current = gameState.getFlag(cmd->flag);
        const bool matches = current == cmd->boolValue;
        traceCommand(cmd.get(), commandPath, "branch", matches ? "then" : "else");
        pushFront(matches ? cmd->thenCommands : cmd->elseCommands, commandPath);
        return;
    }
    if (type == "controlSwitch") {
        gameState.setSwitch(cmd->switchId, cmd->boolValue);
        return;
    }
    if (type == "ifSwitch") {
        bool current = gameState.getSwitch(cmd->switchId);
        const bool matches = current == cmd->boolValue;
        traceCommand(cmd.get(), commandPath, "branch", matches ? "then" : "else");
        pushFront(matches ? cmd->thenCommands : cmd->elseCommands, commandPath);
        return;
    }
    if (type == "controlSelfSwitch") {
        if (!currentOwnerMapId.empty() && !currentOwnerEventId.empty() && !cmd->switchId.empty()) {
            gameState.setSelfSwitch(currentOwnerMapId, currentOwnerEventId,
                                    selfSwitchLetter(cmd->switchId), cmd->boolValue);
        } else {
            traceCommand(cmd.get(), commandPath, "warning", "missing-self-switch-owner");
        }
        return;
    }
    if (type == "ifSelfSwitch") {
        bool current = false;
        if (!currentOwnerMapId.empty() && !currentOwnerEventId.empty() && !cmd->switchId.empty()) {
            current = gameState.getSelfSwitch(currentOwnerMapId, currentOwnerEventId,
                                              selfSwitchLetter(cmd->switchId));
        }
        const bool matches = current == cmd->boolValue;
        traceCommand(cmd.get(), commandPath, "branch", matches ? "then" : "else");
        pushFront(matches ? cmd->thenCommands : cmd->elseCommands, commandPath);
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
        traceCommand(cmd.get(), commandPath, "branch", matches ? "then" : "else");
        pushFront(matches ? cmd->thenCommands : cmd->elseCommands, commandPath);
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
        traceCommand(cmd.get(), commandPath, "request",
                     "map=" + cmd->mapId + ",x=" + std::to_string(cmd->x) +
                     ",y=" + std::to_string(cmd->y) + ",direction=" + cmd->direction);
        return;
    }
    if (type == "setPlayerPosition") {
        // Same effect as transferMap but keeps the runner in this state.
        transferRequest.active = true;
        transferRequest.mapId = cmd->mapId;
        transferRequest.targetX = cmd->x;
        transferRequest.targetY = cmd->y;
        transferRequest.direction = cmd->direction;
        traceCommand(cmd.get(), commandPath, "request",
                     "map=" + cmd->mapId + ",x=" + std::to_string(cmd->x) +
                     ",y=" + std::to_string(cmd->y) + ",direction=" + cmd->direction);
        return;
    }
    if (type == "wait") {
        waitTimer = static_cast<float>(cmd->ms) / 1000.0f;
        activeWaitCommandType = type;
        activeWaitCommandPath = commandPath;
        activeWaitResult = std::to_string(cmd->ms) + "ms";
        traceCommand(cmd.get(), commandPath, "wait", activeWaitResult);
        return;
    }
    if (type == "playSound") {
        soundRequest.active = true;
        soundRequest.soundId = cmd->soundId;
        traceCommand(cmd.get(), commandPath, "request", "sound=" + cmd->soundId);
        return;
    }
    if (type == "pluginCommand") {
        const std::string fullCommand = cmd->pluginId + "." + cmd->pluginCommand;
        const auto* registryEntry =
            findPluginCommandRegistryEntry(cmd->pluginId, cmd->pluginCommand);

        if (registryEntry) {
            switch (registryEntry->handler) {
            case PluginCommandHandler::DebugLog: {
                const auto message = pluginStringArg(*cmd, "message");
                Logger::info(message ? "pluginCommand debug.log: " + *message
                                     : "pluginCommand debug.log");
                return;
            }
            case PluginCommandHandler::DebugSetSwitch: {
                const auto switchId = pluginStringArg(*cmd, "switchId");
                const auto value = pluginBoolArg(*cmd, "value");
                if (!switchId || switchId->empty() || !value) {
                    Logger::warning("pluginCommand debug.setSwitch missing switchId or value");
                    traceCommand(cmd.get(), commandPath, "warning", "debug.setSwitch missing switchId or value");
                    return;
                }
                gameState.setSwitch(*switchId, *value);
                return;
            }
            case PluginCommandHandler::DebugSetVariable: {
                const auto variableId = pluginStringArg(*cmd, "variableId");
                const auto value = pluginNumberArg(*cmd, "value");
                if (!variableId || variableId->empty() || !value) {
                    Logger::warning("pluginCommand debug.setVariable missing variableId or value");
                    traceCommand(cmd.get(), commandPath, "warning", "debug.setVariable missing variableId or value");
                    return;
                }
                gameState.setVariable(*variableId, static_cast<int>(*value));
                return;
            }
            }
        }

        Logger::warning("pluginCommand: unsupported command '" + fullCommand + "'");
        traceCommand(cmd.get(), commandPath, "warning", "unsupported");
        return;
    }
    if (type == "comment") {
        // Comments are ignored at runtime by design.
        return;
    }
    if (type == "callCommonEvent") {
        traceCommand(cmd.get(), commandPath, "request", "commonEvent=" + cmd->commonEventId);
        if (commonEventResolver) {
            auto cmds = commonEventResolver(cmd->commonEventId);
            pushFront(cmds, commandPath);
        } else {
            Logger::warning("callCommonEvent: no resolver registered for " + cmd->commonEventId);
            traceCommand(cmd.get(), commandPath, "warning", "missing-common-event-resolver");
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
        traceCommand(cmd.get(), commandPath, "request", "shop=" + cmd->shopId);
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
            traceCommand(cmd.get(), commandPath, "branch", "victory");
            pushFront(cmd->victoryBranch, commandPath);
        } else if (result.outcome == BattleResult::Outcome::Defeat) {
            traceCommand(cmd.get(), commandPath, "branch", "defeat");
            pushFront(cmd->defeatBranch, commandPath);
        }
        battleSummaryRequest.active = true;
        battleSummaryRequest.troopId = cmd->troopId;
        battleSummaryRequest.result = result;
        traceCommand(cmd.get(), commandPath, "request",
                     "troop=" + cmd->troopId + ",outcome=" +
                     battleOutcomeString(result.outcome));
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
            activeWaitCommandType = type;
            activeWaitCommandPath = commandPath;
            activeWaitResult = std::to_string(cmd->animationDurationMs) + "ms";
            traceCommand(cmd.get(), commandPath, "wait", activeWaitResult);
        }
        traceCommand(cmd.get(), commandPath, "request",
                     "target=" + animationRequest.target + ",action=" +
                     animationRequest.action + ",blocking=" +
                     boolResult(animationRequest.blocking));
        return;
    }
    if (type == "setMovementRoute") {
        movementRouteRequest.active = true;
        movementRouteRequest.target =
            cmd->movementRouteTarget.empty() ? "player" : cmd->movementRouteTarget;
        movementRouteRequest.ownerEventId = currentOwnerEventId;
        movementRouteRequest.eventId = cmd->movementRouteEventId;
        movementRouteRequest.repeat = cmd->movementRouteRepeat;
        movementRouteRequest.skippable = cmd->movementRouteSkippable;
        movementRouteRequest.wait = cmd->movementRouteWait;
        movementRouteRequest.steps.clear();

        for (const auto& step : cmd->movementRouteSteps) {
            movementRouteRequest.steps.push_back({step.type, step.ms});
        }
        traceCommand(cmd.get(), commandPath, "request",
                     "target=" + movementRouteRequest.target + ",steps=" +
                     std::to_string(movementRouteRequest.steps.size()) +
                     ",wait=" + boolResult(movementRouteRequest.wait));
        return;
    }

    Logger::warning("Unsupported event command type: " + type);
    traceCommand(cmd.get(), commandPath, "warning", "unsupported");
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

MovementRouteRequest EventRunner::consumeMovementRouteRequest() {
    MovementRouteRequest req = movementRouteRequest;
    movementRouteRequest = {};
    return req;
}

SoundRequest EventRunner::consumeSoundRequest() {
    SoundRequest req = soundRequest;
    soundRequest = {};
    return req;
}
