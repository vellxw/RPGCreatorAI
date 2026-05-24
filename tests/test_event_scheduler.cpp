#include <doctest/doctest.h>
#include "events/EventScheduler.h"
#include "events/GameState.h"
#include "dialogue/DialogueSystem.h"
#include "types/EventTypes.h"

namespace {

std::shared_ptr<EventCommand> makeCmd(const std::string& type) {
    auto cmd = std::make_shared<EventCommand>();
    cmd->type = type;
    return cmd;
}

ScheduledEventCandidate makeCandidate(const std::string& key,
                                      const std::string& trigger,
                                      const std::vector<std::shared_ptr<EventCommand>>& commands) {
    ScheduledEventCandidate candidate;
    candidate.key = key;
    candidate.trigger = trigger;
    candidate.ownerMapId = "town";
    candidate.ownerEventId = key;
    candidate.commands = commands;
    return candidate;
}

} // namespace

TEST_CASE("EventScheduler runs autorun commands in a separate runner") {
    GameState state;
    state.setCurrentMap("town");
    DialogueSystem dialogue;
    EventScheduler scheduler(state, dialogue);

    auto setFlag = makeCmd("setFlag");
    setFlag->flag = "autorun_fired";
    setFlag->boolValue = true;

    scheduler.sync({makeCandidate("map:town:auto", "autorun", {setFlag})});
    CHECK(scheduler.isRunning());
    CHECK(scheduler.hasBlockingRunner());

    scheduler.update(0.016f);

    CHECK(state.getFlag("autorun_fired"));
    CHECK_FALSE(scheduler.isRunning());
    CHECK_FALSE(scheduler.hasBlockingRunner());
}

TEST_CASE("EventScheduler parallel runners do not block player input") {
    GameState state;
    state.setCurrentMap("town");
    DialogueSystem dialogue;
    EventScheduler scheduler(state, dialogue);

    auto wait = makeCmd("wait");
    wait->ms = 1000;

    scheduler.sync({makeCandidate("map:town:parallel", "parallel", {wait})});
    scheduler.update(0.016f);

    CHECK(scheduler.isRunning());
    CHECK_FALSE(scheduler.hasBlockingRunner());
}

TEST_CASE("EventScheduler parallel dialogue opens modal state without marking runner as autorun-blocking") {
    GameState state;
    state.setCurrentMap("town");
    DialogueSystem dialogue;
    EventScheduler scheduler(state, dialogue);

    auto showText = makeCmd("showText");
    showText->text = "Parallel notice";

    scheduler.sync({makeCandidate("map:town:parallel_dialogue", "parallel", {showText})});
    scheduler.update(0.016f);

    CHECK(dialogue.isActive());
    CHECK(scheduler.isRunning());
    CHECK_FALSE(scheduler.hasBlockingRunner());
}

TEST_CASE("EventScheduler removes runners whose candidates are no longer active") {
    GameState state;
    state.setCurrentMap("town");
    DialogueSystem dialogue;
    EventScheduler scheduler(state, dialogue);

    auto wait = makeCmd("wait");
    wait->ms = 1000;

    scheduler.sync({makeCandidate("map:town:auto", "autorun", {wait})});
    scheduler.update(0.016f);
    CHECK(scheduler.isRunning());

    scheduler.sync({});

    CHECK_FALSE(scheduler.isRunning());
}

TEST_CASE("EventScheduler restarts active candidates after completion") {
    GameState state;
    state.setCurrentMap("town");
    DialogueSystem dialogue;
    EventScheduler scheduler(state, dialogue);

    auto addGold = makeCmd("addGold");
    addGold->goldAmount = 5;
    const auto candidate = makeCandidate("common:parallel", "parallel", {addGold});

    scheduler.sync({candidate});
    scheduler.update(0.016f);
    CHECK(state.getGold() == 5);
    CHECK_FALSE(scheduler.isRunning());

    scheduler.sync({candidate});
    scheduler.update(0.016f);
    CHECK(state.getGold() == 10);
}

TEST_CASE("EventScheduler configures scheduled runners with runtime resolvers") {
    GameState state;
    state.setCurrentMap("town");
    DialogueSystem dialogue;
    EventScheduler scheduler(state, dialogue);

    auto callCommon = makeCmd("callCommonEvent");
    callCommon->commonEventId = "common_reward";

    auto addGold = makeCmd("addGold");
    addGold->goldAmount = 25;

    scheduler.setRunnerConfigurator([&](EventRunner& runner) {
        runner.setCommonEventResolver(
            [&](const std::string& id) -> std::vector<std::shared_ptr<EventCommand>> {
                return id == "common_reward"
                    ? std::vector<std::shared_ptr<EventCommand>>{addGold}
                    : std::vector<std::shared_ptr<EventCommand>>{};
            });
    });

    scheduler.sync({makeCandidate("map:town:autorun", "autorun", {callCommon})});
    scheduler.update(0.016f);

    CHECK(state.getGold() == 25);
}

TEST_CASE("EventScheduler can preserve a transferring runner until its tail completes") {
    GameState state;
    state.setCurrentMap("town");
    DialogueSystem dialogue;
    EventScheduler scheduler(state, dialogue);

    auto transfer = makeCmd("transferMap");
    transfer->mapId = "house";
    transfer->x = 1;
    transfer->y = 2;
    transfer->direction = "up";

    auto setFlag = makeCmd("setFlag");
    setFlag->flag = "after_transfer";
    setFlag->boolValue = true;

    scheduler.sync({makeCandidate("map:town:auto_transfer", "autorun", {transfer, setFlag})});
    scheduler.update(0.016f);

    auto runners = scheduler.runners();
    REQUIRE(runners.size() == 1);
    auto req = runners[0]->consumeTransferRequest();
    REQUIRE(req.active);

    scheduler.preserveOnly(runners[0]);
    state.setCurrentMap(req.mapId);
    scheduler.sync({});
    scheduler.update(0.016f);

    CHECK(state.getFlag("after_transfer"));
    CHECK_FALSE(scheduler.isRunning());
}
