#include "events/EventScheduler.h"
#include "types/EventTypes.h"
#include <algorithm>
#include <unordered_set>

EventScheduler::EventScheduler(GameState& state, DialogueSystem& dialogueSystem)
    : gameState(state), dialogue(dialogueSystem) {}

void EventScheduler::clear() {
    runningEvents.clear();
}

void EventScheduler::preserveOnly(EventRunner* retainedRunner) {
    runningEvents.erase(
        std::remove_if(runningEvents.begin(), runningEvents.end(),
                       [&](RunningEvent& event) {
                           if (event.runner.get() == retainedRunner) {
                               event.keepUntilFinished = true;
                               return false;
                           }
                           return true;
                       }),
        runningEvents.end());
}

bool EventScheduler::hasRunner(const std::string& key) const {
    return std::any_of(runningEvents.begin(), runningEvents.end(),
                       [&](const RunningEvent& event) { return event.candidate.key == key; });
}

bool EventScheduler::isBlockingTrigger(const std::string& trigger) {
    return trigger == "autorun";
}

void EventScheduler::startRunner(const ScheduledEventCandidate& candidate) {
    if (candidate.key.empty() || candidate.commands.empty()) return;

    RunningEvent running;
    running.candidate = candidate;
    running.runner = std::make_unique<EventRunner>(gameState, dialogue);
    if (runnerConfigurator) runnerConfigurator(*running.runner);
    running.runner->runCommandList(candidate.commands, candidate.ownerEventId);
    runningEvents.push_back(std::move(running));
}

void EventScheduler::sync(const std::vector<ScheduledEventCandidate>& candidates) {
    std::unordered_set<std::string> activeKeys;
    activeKeys.reserve(candidates.size());
    for (const auto& candidate : candidates) {
        if (!candidate.key.empty()) activeKeys.insert(candidate.key);
    }

    runningEvents.erase(
        std::remove_if(runningEvents.begin(), runningEvents.end(),
                       [&](const RunningEvent& event) {
                           return !event.keepUntilFinished &&
                                  activeKeys.find(event.candidate.key) == activeKeys.end();
                       }),
        runningEvents.end());

    for (const auto& candidate : candidates) {
        if (candidate.trigger != "autorun" && candidate.trigger != "parallel") continue;
        if (hasRunner(candidate.key)) continue;
        startRunner(candidate);
    }
}

void EventScheduler::update(float dt) {
    for (auto& event : runningEvents) {
        if (event.runner) event.runner->update(dt);
    }

    runningEvents.erase(
        std::remove_if(runningEvents.begin(), runningEvents.end(),
                       [](const RunningEvent& event) {
                           return !event.runner || !event.runner->isRunning();
                       }),
        runningEvents.end());
}

bool EventScheduler::isRunning() const {
    return std::any_of(runningEvents.begin(), runningEvents.end(),
                       [](const RunningEvent& event) {
                           return event.runner && event.runner->isRunning();
                       });
}

bool EventScheduler::hasBlockingRunner() const {
    return std::any_of(runningEvents.begin(), runningEvents.end(),
                       [](const RunningEvent& event) {
                           return event.runner && event.runner->isRunning() &&
                                  isBlockingTrigger(event.candidate.trigger);
                       });
}

bool EventScheduler::ownsRunner(const EventRunner* runner) const {
    return std::any_of(runningEvents.begin(), runningEvents.end(),
                       [&](const RunningEvent& event) {
                           return event.runner.get() == runner;
                       });
}

std::vector<EventRunner*> EventScheduler::runners() {
    std::vector<EventRunner*> out;
    out.reserve(runningEvents.size());
    for (auto& event : runningEvents) {
        if (event.runner) out.push_back(event.runner.get());
    }
    return out;
}
