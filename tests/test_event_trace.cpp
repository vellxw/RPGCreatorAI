#include <doctest/doctest.h>
#include "events/EventTrace.h"
#include "events/EventRunner.h"
#include "events/EventScheduler.h"
#include "events/GameState.h"
#include "dialogue/DialogueSystem.h"
#include "types/EventTypes.h"

namespace {

std::shared_ptr<EventCommand> makeCmd(const std::string& type) {
    auto c = std::make_shared<EventCommand>();
    c->type = type;
    return c;
}

bool hasTrace(const EventTraceBuffer& trace,
              const std::string& commandType,
              const std::string& action,
              const std::string& result) {
    for (const auto& entry : trace.entries()) {
        if (entry.commandType == commandType &&
            entry.action == action &&
            entry.result == result) {
            return true;
        }
    }
    return false;
}

} // namespace

TEST_CASE("EventTraceBuffer assigns deterministic sequence numbers and formats stdout lines") {
    EventTraceBuffer trace(4);

    EventTraceEntry entry;
    entry.sourceType = "mapEvent";
    entry.mapId = "town";
    entry.eventId = "npc_1";
    entry.commandPath = "0";
    entry.commandType = "showText";
    entry.action = "start";
    entry.result = "queued";

    trace.record(entry);

    REQUIRE(trace.entries().size() == 1);
    CHECK(trace.entries()[0].sequence == 1);
    CHECK(formatEventTraceLine(trace.entries()[0]) ==
          R"([TRACE] {"sequence":1,"sourceType":"mapEvent","mapId":"town","eventId":"npc_1","commonEventId":"","commandPath":"0","commandType":"showText","action":"start","result":"queued"})");
}

TEST_CASE("EventRunner traces map-event branches waits and transfer requests") {
    GameState state;
    state.setCurrentMap("town");
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);
    EventTraceBuffer trace(32);
    runner.setTraceBuffer(&trace);

    state.setFlag("gate_open", true);

    auto branchCommand = makeCmd("setFlag");
    branchCommand->flag = "branch_ran";
    branchCommand->boolValue = true;

    auto branch = makeCmd("ifFlag");
    branch->flag = "gate_open";
    branch->boolValue = true;
    branch->thenCommands = {branchCommand};

    auto wait = makeCmd("wait");
    wait->ms = 100;

    auto transfer = makeCmd("transferMap");
    transfer->mapId = "forest";
    transfer->x = 4;
    transfer->y = 5;
    transfer->direction = "down";

    runner.runCommandList({branch, wait, transfer}, "npc_1");
    runner.update(0.016f);
    runner.update(0.2f);

    CHECK(trace.entries().front().sequence == 1);
    CHECK(trace.entries().front().sourceType == "mapEvent");
    CHECK(trace.entries().front().mapId == "town");
    CHECK(trace.entries().front().eventId == "npc_1");
    CHECK(hasTrace(trace, "ifFlag", "branch", "then"));
    CHECK(hasTrace(trace, "wait", "wait", "100ms"));
    CHECK(hasTrace(trace, "wait", "waitFinish", "100ms"));
    CHECK(hasTrace(trace, "transferMap", "request", "map=forest,x=4,y=5,direction=down"));
}

TEST_CASE("EventScheduler tags common event trace sources with common event ids") {
    GameState state;
    state.setCurrentMap("town");
    DialogueSystem dialogue;
    EventScheduler scheduler(state, dialogue);
    EventTraceBuffer trace(16);

    scheduler.setRunnerConfigurator([&](EventRunner& runner) {
        runner.setTraceBuffer(&trace);
    });

    auto command = makeCmd("setFlag");
    command->flag = "common_ran";
    command->boolValue = true;

    ScheduledEventCandidate candidate;
    candidate.key = "common:intro";
    candidate.trigger = "autorun";
    candidate.ownerMapId = "town";
    candidate.ownerCommonEventId = "intro";
    candidate.commands = {command};

    scheduler.sync({candidate});
    scheduler.update(0.016f);

    REQUIRE(trace.entries().size() >= 2);
    CHECK(trace.entries()[0].sourceType == "commonEvent");
    CHECK(trace.entries()[0].mapId == "town");
    CHECK(trace.entries()[0].commonEventId == "intro");
    CHECK(trace.entries()[0].eventId.empty());
}
