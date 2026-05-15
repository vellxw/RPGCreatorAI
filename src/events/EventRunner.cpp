#include "events/EventRunner.h"
#include "types/EventTypes.h"
#include "events/GameState.h"
#include "dialogue/DialogueSystem.h"
#include "core/Logger.h"
#include <vector>
#include <memory>

EventRunner::EventRunner(GameState& state, DialogueSystem& dialogueSystem)
    : gameState(state), dialogue(dialogueSystem) {}

void EventRunner::runCommandList(const std::vector<std::shared_ptr<EventCommand>>& commands) {
    commandStack.clear();
    // Push commands in reverse order so we process them front-to-back via pop_back.
    for (auto it = commands.rbegin(); it != commands.rend(); ++it) {
        commandStack.push_back(*it);
    }
    executing = !commandStack.empty();
}

void EventRunner::update(float dt) {
    if (!executing) return;

    // While dialogue is active we cannot advance — wait for the player to dismiss.
    if (dialogue.isActive()) {
        return;
    }

    // Tick the wait timer.
    if (waitTimer > 0.0f) {
        waitTimer -= dt;
        if (waitTimer > 0.0f) return;
        waitTimer = 0.0f;
    }

    // Drain commands until we hit a blocking one (dialogue, wait) or the queue empties.
    while (!commandStack.empty()) {
        auto cmd = commandStack.back();
        commandStack.pop_back();
        processCommand(cmd);
        if (dialogue.isActive() || waitTimer > 0.0f || transferRequest.active) {
            // A blocking effect was produced — yield to outer loop.
            return;
        }
    }

    executing = false;
}

void EventRunner::executeNext() {
    // Reserved for future cooperative scheduling.
}

void EventRunner::processCommand(const std::shared_ptr<EventCommand>& cmd) {
    if (!cmd) return;
    const std::string& type = cmd->type;

    if (type == "showText") {
        dialogue.showText(cmd->speaker, cmd->text);
        return;
    }
    if (type == "setFlag") {
        gameState.setFlag(cmd->flag, cmd->boolValue);
        return;
    }
    if (type == "ifFlag") {
        bool current = gameState.getFlag(cmd->flag);
        const auto& branch = (current == cmd->boolValue) ? cmd->thenCommands : cmd->elseCommands;
        // Push branch onto stack in reverse order so it executes front-to-back.
        for (auto it = branch.rbegin(); it != branch.rend(); ++it) {
            commandStack.push_back(*it);
        }
        return;
    }
    if (type == "addItem") {
        gameState.addItem(cmd->itemId, cmd->amount);
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
    if (type == "wait") {
        waitTimer = static_cast<float>(cmd->ms) / 1000.0f;
        return;
    }
    if (type == "playSound") {
        // No audio in Phase 2 — log only.
        Logger::info("playSound: " + cmd->soundId);
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
