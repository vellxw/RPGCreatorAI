#pragma once
#include <string>

class DialogueSystem {
public:
    void showText(const std::string& speaker, const std::string& text);
    void close();
    void update();
    bool isActive() const { return active; }

    const std::string& getSpeaker() const { return currentSpeaker; }
    const std::string& getText() const { return currentText; }

private:
    bool active = false;
    std::string currentSpeaker;
    std::string currentText;
};
