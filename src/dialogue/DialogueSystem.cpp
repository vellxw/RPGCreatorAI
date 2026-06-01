#include "dialogue/DialogueSystem.h"
#include "core/Logger.h"

void DialogueSystem::showText(const std::string& speaker, const std::string& text) {
    currentSpeaker = speaker;
    currentText = text;
    choiceMode = false;
    choiceLabels.clear();
    selectedChoiceIndex = 0;
    active = true;
    
    if (speaker.empty()) {
        Logger::info("Dialogue: " + text);
    } else {
        Logger::info("Dialogue [" + speaker + "]: " + text);
    }
}

void DialogueSystem::showChoices(const std::string& prompt, const std::vector<std::string>& labels) {
    currentSpeaker.clear();
    currentText = prompt;
    choiceLabels = labels;
    selectedChoiceIndex = 0;
    choiceMode = true;
    active = true;
    pendingChoiceResult.reset();

    Logger::info("Choices: " + prompt + " (" + std::to_string(choiceLabels.size()) + " options)");
}

void DialogueSystem::close() {
    active = false;
    choiceMode = false;
    currentSpeaker.clear();
    currentText.clear();
    choiceLabels.clear();
    selectedChoiceIndex = 0;
}

void DialogueSystem::update() {
    // In Phase 1 without a complex visual typewriter, we rely on InputManager to call close()
}

void DialogueSystem::moveChoiceSelection(int delta) {
    if (!isChoiceActive() || choiceLabels.empty() || delta == 0) return;

    const int count = static_cast<int>(choiceLabels.size());
    selectedChoiceIndex = (selectedChoiceIndex + delta) % count;
    if (selectedChoiceIndex < 0) selectedChoiceIndex += count;
}

void DialogueSystem::confirmChoice() {
    if (!isChoiceActive()) return;

    const int index = choiceLabels.empty() ? -1 : selectedChoiceIndex;
    pendingChoiceResult = DialogueChoiceResult{index, false};
    close();
}

void DialogueSystem::cancelChoice() {
    if (!isChoiceActive()) return;

    pendingChoiceResult = DialogueChoiceResult{-1, true};
    close();
}

std::optional<DialogueChoiceResult> DialogueSystem::consumeChoiceResult() {
    auto result = pendingChoiceResult;
    pendingChoiceResult.reset();
    return result;
}
