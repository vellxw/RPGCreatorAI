#include <doctest/doctest.h>
#include "events/EventRunner.h"
#include "events/GameState.h"
#include "dialogue/DialogueSystem.h"
#include "types/EventTypes.h"

namespace {

std::shared_ptr<EventCommand> makeCmd(const std::string& type) {
    auto c = std::make_shared<EventCommand>();
    c->type = type;
    return c;
}

void runUntilIdle(EventRunner& runner, int maxIterations = 32) {
    for (int i = 0; i < maxIterations && runner.isRunning(); ++i) {
        runner.update(0.016f);
    }
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
    runUntilIdle(runner);

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
    cmd->boolValue = true;
    cmd->thenCommands = { inner };

    runner.runCommandList({cmd});
    runUntilIdle(runner);

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
    cmd->boolValue = true;
    cmd->elseCommands = { inner };

    runner.runCommandList({cmd});
    runUntilIdle(runner);

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
    runUntilIdle(runner);

    CHECK(state.hasItem("potion", 3) == true);
    CHECK(state.hasItem("potion", 4) == false);
}

TEST_CASE("EventRunner removeItem clamps to zero") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    state.addItem("potion", 2);

    auto cmd = makeCmd("removeItem");
    cmd->itemId = "potion";
    cmd->amount = 10;
    runner.runCommandList({cmd});
    runUntilIdle(runner);

    CHECK(state.hasItem("potion", 1) == false);
}

TEST_CASE("EventRunner addGold and removeGold honor non-negative invariant") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    auto add = makeCmd("addGold");
    add->goldAmount = 50;
    auto rem = makeCmd("removeGold");
    rem->goldAmount = 200;

    runner.runCommandList({add, rem});
    runUntilIdle(runner);

    CHECK(state.getGold() == 0);
}

TEST_CASE("EventRunner controlSwitch and ifSwitch") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    auto setSw = makeCmd("controlSwitch");
    setSw->switchId = "door_open";
    setSw->boolValue = true;

    auto inner = makeCmd("setFlag");
    inner->flag = "branch_taken";
    inner->boolValue = true;

    auto check = makeCmd("ifSwitch");
    check->switchId = "door_open";
    check->boolValue = true;
    check->thenCommands = { inner };

    runner.runCommandList({setSw, check});
    runUntilIdle(runner);

    CHECK(state.getSwitch("door_open") == true);
    CHECK(state.getFlag("branch_taken") == true);
}

TEST_CASE("EventRunner controlVariable performs arithmetic") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    state.setVariable("score", 5);

    auto add = makeCmd("controlVariable");
    add->variableId = "score";
    add->varOp = "add";
    add->varValue = 10;

    auto mul = makeCmd("controlVariable");
    mul->variableId = "score";
    mul->varOp = "mul";
    mul->varValue = 2;

    auto divByZero = makeCmd("controlVariable");
    divByZero->variableId = "score";
    divByZero->varOp = "div";
    divByZero->varValue = 0;

    runner.runCommandList({add, mul, divByZero});
    runUntilIdle(runner);

    CHECK(state.getVariable("score") == 30);
}

TEST_CASE("EventRunner ifVariable comparisons") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    state.setVariable("count", 5);

    auto branch = makeCmd("ifVariable");
    branch->variableId = "count";
    branch->compareOp = "gte";
    branch->varValue = 3;
    auto inner = makeCmd("setFlag");
    inner->flag = "matched";
    inner->boolValue = true;
    branch->thenCommands = { inner };

    runner.runCommandList({branch});
    runUntilIdle(runner);
    CHECK(state.getFlag("matched") == true);
}

TEST_CASE("EventRunner showChoices defaults to first choice without picker") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    EventCommand::Choice yes;
    yes.label = "Yes";
    auto y = makeCmd("setFlag");
    y->flag = "answered_yes";
    y->boolValue = true;
    yes.commands = { y };

    EventCommand::Choice no;
    no.label = "No";
    auto n = makeCmd("setFlag");
    n->flag = "answered_no";
    n->boolValue = true;
    no.commands = { n };

    auto choices = makeCmd("showChoices");
    choices->prompt = "Help him?";
    choices->choices = { yes, no };

    runner.runCommandList({choices});
    runUntilIdle(runner);

    CHECK(state.getFlag("answered_yes") == true);
    CHECK(state.getFlag("answered_no") == false);
}

TEST_CASE("EventRunner showChoices respects picker") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);
    runner.setChoicePicker([](const std::string&, const std::vector<std::string>&) { return 1; });

    EventCommand::Choice a;
    a.label = "A";
    auto setA = makeCmd("setFlag");
    setA->flag = "picked_a";
    setA->boolValue = true;
    a.commands = { setA };

    EventCommand::Choice b;
    b.label = "B";
    auto setB = makeCmd("setFlag");
    setB->flag = "picked_b";
    setB->boolValue = true;
    b.commands = { setB };

    auto choices = makeCmd("showChoices");
    choices->choices = { a, b };

    runner.runCommandList({choices});
    runUntilIdle(runner);

    CHECK(state.getFlag("picked_a") == false);
    CHECK(state.getFlag("picked_b") == true);
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
    CHECK(state.getFlag("after") == false);

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

    auto req2 = runner.consumeTransferRequest();
    CHECK(req2.active == false);
}

TEST_CASE("EventRunner playAnimation emits an animation request and honors blocking duration") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    auto cmd = makeCmd("playAnimation");
    cmd->animationTarget = "thisEvent";
    cmd->animationAction = "attack";
    cmd->animationDirection = "current";
    cmd->animationDurationMs = 250;
    cmd->animationBlocking = true;
    cmd->animationLoop = false;

    runner.runCommandList({cmd}, "slime_trigger");
    runner.update(0.016f);

    auto req = runner.consumeAnimationRequest();
    CHECK(req.active == true);
    CHECK(req.target == "thisEvent");
    CHECK(req.ownerEventId == "slime_trigger");
    CHECK(req.action == "attack");
    CHECK(req.direction == "current");
    CHECK(req.durationMs == 250);
    CHECK(req.blocking == true);
    CHECK(req.loop == false);

    CHECK(runner.isRunning());
    runner.update(0.100f);
    CHECK(runner.isRunning());
    runner.update(0.200f);
    CHECK_FALSE(runner.isRunning());
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
    runUntilIdle(runner);

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

TEST_CASE("EventRunner callCommonEvent runs resolved commands") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    runner.setCommonEventResolver([](const std::string& id) {
        std::vector<std::shared_ptr<EventCommand>> cmds;
        if (id == "set_a") {
            auto c = std::make_shared<EventCommand>();
            c->type = "setFlag";
            c->flag = "common_run";
            c->boolValue = true;
            cmds.push_back(c);
        }
        return cmds;
    });

    auto call = makeCmd("callCommonEvent");
    call->commonEventId = "set_a";
    runner.runCommandList({call});
    runUntilIdle(runner);
    CHECK(state.getFlag("common_run") == true);
}

TEST_CASE("EventRunner quest commands update GameState") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    runner.setQuestObjectiveResolver([](const std::string& qid) {
        if (qid == "lost_chest") return std::vector<std::string>{"open_chest", "talk_back"};
        return std::vector<std::string>{};
    });

    auto start = makeCmd("startQuest");
    start->questId = "lost_chest";

    auto upd = makeCmd("updateQuestObjective");
    upd->questId = "lost_chest";
    upd->objectiveId = "open_chest";
    upd->objectiveState = "done";

    auto complete = makeCmd("completeQuest");
    complete->questId = "lost_chest";

    runner.runCommandList({start, upd, complete});
    runUntilIdle(runner);

    const auto& quests = state.getQuests();
    REQUIRE(quests.find("lost_chest") != quests.end());
    CHECK(quests.at("lost_chest").state == "completed");
    CHECK(quests.at("lost_chest").objectives.at("open_chest") == "done");
}

TEST_CASE("EventRunner openShop emits a shop request") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    auto cmd = makeCmd("openShop");
    cmd->shopId = "town_shop";
    runner.runCommandList({cmd});
    runner.update(0.016f);

    auto req = runner.consumeShopRequest();
    CHECK(req.active == true);
    CHECK(req.shopId == "town_shop");

    // Drains.
    runner.update(0.016f);
    CHECK(runner.isRunning() == false);
}

TEST_CASE("EventRunner startBattle runs battleRunner and applies rewards") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    runner.setBattleRunner([](const std::string& troopId) {
        BattleResult r;
        r.outcome = BattleResult::Outcome::Victory;
        if (troopId == "slime_pair") {
            r.goldAwarded = 16;
            r.expAwarded = 8;
            r.itemsAwarded = {{"potion", 1}};
        }
        return r;
    });

    auto victoryEffect = std::make_shared<EventCommand>();
    victoryEffect->type = "setFlag";
    victoryEffect->flag = "battle_won";
    victoryEffect->boolValue = true;

    auto cmd = makeCmd("startBattle");
    cmd->troopId = "slime_pair";
    cmd->victoryBranch = { victoryEffect };

    runner.runCommandList({cmd});
    runUntilIdle(runner);

    CHECK(state.getGold() == 16);
    CHECK(state.hasItem("potion", 1));
    CHECK(state.getFlag("battle_won") == true);
}

TEST_CASE("EventRunner startBattle emits a summary request before continuing branches") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    runner.setBattleRunner([](const std::string&) {
        BattleResult r;
        r.outcome = BattleResult::Outcome::Victory;
        r.goldAwarded = 16;
        return r;
    });

    auto victoryEffect = std::make_shared<EventCommand>();
    victoryEffect->type = "setFlag";
    victoryEffect->flag = "battle_won";
    victoryEffect->boolValue = true;

    auto cmd = makeCmd("startBattle");
    cmd->troopId = "slime_pair";
    cmd->victoryBranch = { victoryEffect };

    runner.runCommandList({cmd});
    runner.update(0.016f);

    CHECK(runner.isRunning());
    CHECK_FALSE(state.getFlag("battle_won"));

    const auto summary = runner.consumeBattleSummaryRequest();
    CHECK(summary.active);
    CHECK(summary.troopId == "slime_pair");
    CHECK(summary.result.goldAwarded == 16);

    runner.update(0.016f);
    CHECK(state.getFlag("battle_won"));
}

TEST_CASE("EventRunner startBattle defeat runs defeatBranch") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    runner.setBattleRunner([](const std::string&) {
        BattleResult r;
        r.outcome = BattleResult::Outcome::Defeat;
        return r;
    });

    auto onDefeat = std::make_shared<EventCommand>();
    onDefeat->type = "setFlag";
    onDefeat->flag = "lost";
    onDefeat->boolValue = true;

    auto cmd = makeCmd("startBattle");
    cmd->troopId = "slime_pair";
    cmd->defeatBranch = { onDefeat };

    runner.runCommandList({cmd});
    runUntilIdle(runner);

    CHECK(state.getGold() == 0);
    CHECK(state.getFlag("lost") == true);
}

TEST_CASE("EventRunner changeActorHp clamps non-negative") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    state.setActorHp("arc", 10);

    auto cmd = makeCmd("changeActorHp");
    cmd->actorId = "arc";
    cmd->delta = -50;
    runner.runCommandList({cmd});
    runUntilIdle(runner);

    CHECK(state.getActorHp("arc", -1) == 0);
}
