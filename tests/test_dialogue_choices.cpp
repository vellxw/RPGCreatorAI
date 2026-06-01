#include <doctest/doctest.h>
#include "dialogue/DialogueSystem.h"

TEST_CASE("DialogueSystem shows choices and wraps selection") {
    DialogueSystem dialogue;

    dialogue.showChoices("Pick one", {"Yes", "No", "Maybe"});

    CHECK(dialogue.isActive());
    CHECK(dialogue.isChoiceActive());
    CHECK(dialogue.getText() == "Pick one");
    REQUIRE(dialogue.getChoiceLabels().size() == 3);
    CHECK(dialogue.getChoiceLabels()[0] == "Yes");
    CHECK(dialogue.getSelectedChoiceIndex() == 0);

    dialogue.moveChoiceSelection(1);
    CHECK(dialogue.getSelectedChoiceIndex() == 1);

    dialogue.moveChoiceSelection(10);
    CHECK(dialogue.getSelectedChoiceIndex() == 2);

    dialogue.moveChoiceSelection(1);
    CHECK(dialogue.getSelectedChoiceIndex() == 0);

    dialogue.moveChoiceSelection(-1);
    CHECK(dialogue.getSelectedChoiceIndex() == 2);
}

TEST_CASE("DialogueSystem confirms and consumes a choice result") {
    DialogueSystem dialogue;
    dialogue.showChoices("Pick one", {"Yes", "No"});
    dialogue.moveChoiceSelection(1);

    dialogue.confirmChoice();

    CHECK_FALSE(dialogue.isActive());
    CHECK(dialogue.hasChoiceResult());
    auto result = dialogue.consumeChoiceResult();
    REQUIRE(result.has_value());
    CHECK(result->index == 1);
    CHECK_FALSE(result->cancelled);
    CHECK_FALSE(dialogue.hasChoiceResult());
}

TEST_CASE("DialogueSystem cancellation records a cancelled choice result") {
    DialogueSystem dialogue;
    dialogue.showChoices("Pick one", {"Yes", "No"});

    dialogue.cancelChoice();

    CHECK_FALSE(dialogue.isActive());
    CHECK(dialogue.hasChoiceResult());
    auto result = dialogue.consumeChoiceResult();
    REQUIRE(result.has_value());
    CHECK(result->index == -1);
    CHECK(result->cancelled);
}
