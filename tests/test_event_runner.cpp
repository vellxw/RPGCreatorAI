#include <doctest/doctest.h>
#include "events/EventRunner.h"
#include "events/GameState.h"
#include "dialogue/DialogueSystem.h"
#include "types/EventTypes.h"

TEST_CASE("EventRunner bootstrap - all commands produce warning and continue") {
    GameState state;
    DialogueSystem dialogue;
    EventRunner runner(state, dialogue);

    SUBCASE("isRunning returns false initially") {
        CHECK(runner.isRunning() == false);
    }

    SUBCASE("single command produces warning and finishes") {
        auto cmd = std::make_shared<EventCommand>();
        cmd->type = "showText";
        cmd->speaker = "NPC";
        cmd->text = "Hello";

        runner.runCommandList({cmd});
        CHECK(runner.isRunning() == true);

        runner.update(0.016f);
        CHECK(runner.isRunning() == false);
    }

    SUBCASE("multiple commands all produce warnings and finish") {
        auto cmd1 = std::make_shared<EventCommand>();
        cmd1->type = "setFlag";
        cmd1->flag = "test_flag";
        cmd1->boolValue = true;

        auto cmd2 = std::make_shared<EventCommand>();
        cmd2->type = "addItem";
        cmd2->itemId = "potion";
        cmd2->amount = 3;

        auto cmd3 = std::make_shared<EventCommand>();
        cmd3->type = "transferMap";
        cmd3->mapId = "house";
        cmd3->x = 2;
        cmd3->y = 3;

        runner.runCommandList({cmd1, cmd2, cmd3});
        runner.update(0.016f);

        // All commands processed (warnings logged), execution finished
        CHECK(runner.isRunning() == false);

        // No concrete logic executed - flag NOT set (bootstrap only)
        CHECK(state.getFlag("test_flag") == false);

        // No items added (bootstrap only)
        CHECK(state.hasItem("potion", 1) == false);
    }

    SUBCASE("unknown command type does not crash") {
        auto cmd = std::make_shared<EventCommand>();
        cmd->type = "unknownCommand";

        runner.runCommandList({cmd});
        runner.update(0.016f);

        CHECK(runner.isRunning() == false);
    }

    SUBCASE("consumeTransferRequest returns inactive by default") {
        auto req = runner.consumeTransferRequest();
        CHECK(req.active == false);
    }

    SUBCASE("consumeTransferRequest resets after consume") {
        // In bootstrap, transferMap doesn't set the request
        auto cmd = std::make_shared<EventCommand>();
        cmd->type = "transferMap";
        cmd->mapId = "house";

        runner.runCommandList({cmd});
        runner.update(0.016f);

        // Bootstrap: no transfer request set (just warning logged)
        auto req = runner.consumeTransferRequest();
        CHECK(req.active == false);
    }

    SUBCASE("empty command list finishes immediately") {
        std::vector<std::shared_ptr<EventCommand>> empty;
        runner.runCommandList(empty);
        runner.update(0.016f);

        CHECK(runner.isRunning() == false);
    }
}
