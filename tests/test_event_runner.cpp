#include <doctest/doctest.h>
#include "events/EventRunner.h"
#include "events/GameState.h"
#include "dialogue/DialogueSystem.h"
#include "types/EventTypes.h"

namespace {

std::shared_ptr<EventCommand> makeCmd(const std::string& type) {
    auto c = std::make_shared<EventCommand>();
    c->type = type;
    c->boolValue = false;
    c->amount = 0;
    c->x = 0;
    c->y = 0;
    c->ms = 0;
    return c;
}

} // namespace

TEST_CASE("EventRunner setFlag updates GameState") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    auto cmd = makeCmd("setFlag");
    cmd->flag = "talked_to_old_man";
    cmd->boolValue = true;

    runner.runCommandList({cmd});
    runner.update(0.016f);

    CHECK(state.getFlag("talked_to_old_man") == true);
    CHECK(runner.isRunning() == false);
}

TEST_CASE("EventRunner ifFlag executes then-branch when flag matches") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    state.setFlag("opened", true);

    auto inner = makeCmd("setFlag");
    inner->flag = "result";
    inner->boolValue = true;

    auto cmd = makeCmd("ifFlag");
    cmd->flag = "opened";
    cmd->boolValue = true; // condition matches
    cmd->thenCommands = { inner };

    runner.runCommandList({cmd});
    runner.update(0.016f);

    CHECK(state.getFlag("result") == true);
}

TEST_CASE("EventRunner ifFlag executes else-branch when flag does not match") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    auto inner = makeCmd("setFlag");
    inner->flag = "result";
    inner->boolValue = true;

    auto cmd = makeCmd("ifFlag");
    cmd->flag = "missing";
    cmd->boolValue = true; // condition does not match (flag default = false)
    cmd->elseCommands = { inner };

    runner.runCommandList({cmd});
    runner.update(0.016f);

    CHECK(state.getFlag("result") == true);
}

TEST_CASE("EventRunner addItem updates inventory") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    auto cmd = makeCmd("addItem");
    cmd->itemId = "potion";
    cmd->amount = 3;

    runner.runCommandList({cmd});
    runner.update(0.016f);

    CHECK(state.hasItem("potion", 3) == true);
    CHECK(state.hasItem("potion", 4) == false);
}

TEST_CASE("EventRunner showText activates dialogue and pauses execution") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    auto text = makeCmd("showText");
    text->speaker = "NPC";
    text->text = "Hello";

    auto setAfter = makeCmd("setFlag");
    setAfter->flag = "after";
    setAfter->boolValue = true;

    runner.runCommandList({text, setAfter});
    runner.update(0.016f);

    CHECK(dialogue.isActive() == true);
    CHECK(runner.isRunning() == true);
    CHECK(state.getFlag("after") == false); // blocked behind dialogue

    dialogue.close();
    runner.update(0.016f);

    CHECK(state.getFlag("after") == true);
    CHECK(runner.isRunning() == false);
}

TEST_CASE("EventRunner transferMap produces a transfer request") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    auto cmd = makeCmd("transferMap");
    cmd->mapId = "house";
    cmd->x = 3;
    cmd->y = 4;
    cmd->direction = "up";

    runner.runCommandList({cmd});
    runner.update(0.016f);

    auto req = runner.consumeTransferRequest();
    CHECK(req.active == true);
    CHECK(req.mapId == "house");
    CHECK(req.targetX == 3);
    CHECK(req.targetY == 4);
    CHECK(req.direction == "up");

    auto req2 = runner.consumeTransferRequest();
    CHECK(req2.active == false);
}

TEST_CASE("EventRunner unsupported command logs warning and continues") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    auto unknown = makeCmd("definitelyNotARealCommand");

    auto after = makeCmd("setFlag");
    after->flag = "after";
    after->boolValue = true;

    runner.runCommandList({unknown, after});
    runner.update(0.016f);

    CHECK(state.getFlag("after") == true);
    CHECK(runner.isRunning() == false);
}

TEST_CASE("EventRunner empty command list does not start executing") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    runner.runCommandList({});
    runner.update(0.016f);
    CHECK(runner.isRunning() == false);
}
