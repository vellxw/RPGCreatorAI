#include "dialogue/DialogueSystem.h"
#include "core/Logger.h"

void DialogueSystem::showText(const std::string& speaker, const std::string& text) {
    currentSpeaker = speaker;
    currentText = text;
    active = true;
    
    if (speaker.empty()) {
        Logger::info("Dialogue: " + text);
    } else {
        Logger::info("Dialogue [" + speaker + "]: " + text);
    }
}

void DialogueSystem::close() {
    active = false;
    currentSpeaker.clear();
    currentText.clear();
}

void DialogueSystem::update() {
    // In Phase 1 without a complex visual typewriter, we rely on InputManager to call close()
}
