#pragma once
#include <optional>
#include <string>
#include <vector>

struct DialogueChoiceResult {
    int index = -1;
    bool cancelled = false;
};

class DialogueSystem {
public:
    void showText(const std::string& speaker, const std::string& text);
    void showChoices(const std::string& prompt, const std::vector<std::string>& labels);
    void close();
    void update();
    bool isActive() const { return active; }
    bool isChoiceActive() const { return active && choiceMode; }

    const std::string& getSpeaker() const { return currentSpeaker; }
    const std::string& getText() const { return currentText; }
    const std::vector<std::string>& getChoiceLabels() const { return choiceLabels; }
    int getSelectedChoiceIndex() const { return selectedChoiceIndex; }

    void moveChoiceSelection(int delta);
    void confirmChoice();
    void cancelChoice();
    bool hasChoiceResult() const { return pendingChoiceResult.has_value(); }
    std::optional<DialogueChoiceResult> consumeChoiceResult();

private:
    bool active = false;
    bool choiceMode = false;
    std::string currentSpeaker;
    std::string currentText;
    std::vector<std::string> choiceLabels;
    int selectedChoiceIndex = 0;
    std::optional<DialogueChoiceResult> pendingChoiceResult;
};
