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
    // Push commands in reverse order so we process them front-to-back via pop_back
    for (auto it = commands.rbegin(); it != commands.rend(); ++it) {
        commandStack.push_back(*it);
    }
    executing = true;
}

void EventRunner::update(float dt) {
    if (!executing) return;

    // Process all commands sequentially
    while (!commandStack.empty()) {
        auto cmd = commandStack.back();
        commandStack.pop_back();
        processCommand(cmd);
    }

    // All commands processed
    executing = false;
}

void EventRunner::executeNext() {
    // Not used in bootstrap — update() processes all commands directly
}

void EventRunner::processCommand(const std::shared_ptr<EventCommand>& cmd) {
    // Bootstrap only: log warning for ALL command types, no concrete execution
    Logger::warning("Unsupported event command type: " + cmd->type);
}

MapTransferRequest EventRunner::consumeTransferRequest() {
    MapTransferRequest req = transferRequest;
    transferRequest.active = false;
    return req;
}
