#pragma once

#include "events/EventRunner.h"
#include <functional>
#include <memory>
#include <string>
#include <vector>

struct EventCommand;

struct ScheduledEventCandidate {
    std::string key;
    std::string trigger; // "autorun" or "parallel"
    std::string ownerMapId;
    std::string ownerEventId;
    std::string ownerCommonEventId;
    std::vector<std::shared_ptr<EventCommand>> commands;
};

class EventScheduler {
public:
    EventScheduler(GameState& state, DialogueSystem& dialogueSystem);

    using RunnerConfigurator = std::function<void(EventRunner&)>;
    void setRunnerConfigurator(RunnerConfigurator configurator) {
        runnerConfigurator = std::move(configurator);
    }

    void clear();
    void preserveOnly(EventRunner* retainedRunner);
    void sync(const std::vector<ScheduledEventCandidate>& candidates);
    void update(float dt);

    bool isRunning() const;
    bool hasBlockingRunner() const;
    bool ownsRunner(const EventRunner* runner) const;
    std::vector<EventRunner*> runners();

private:
    struct RunningEvent {
        ScheduledEventCandidate candidate;
        std::unique_ptr<EventRunner> runner;
        bool keepUntilFinished = false;
    };

    bool hasRunner(const std::string& key) const;
    void startRunner(const ScheduledEventCandidate& candidate);
    static bool isBlockingTrigger(const std::string& trigger);

    GameState& gameState;
    DialogueSystem& dialogue;
    RunnerConfigurator runnerConfigurator;
    std::vector<RunningEvent> runningEvents;
};
