#pragma once
#include <string>
#include <vector>
#include <memory>

struct MapTransferRequest {
    bool active = false;
    std::string mapId;
    int targetX = 0;
    int targetY = 0;
    std::string direction;
};

class EventRunner {
public:
    EventRunner(class GameState& state, class DialogueSystem& dialogueSystem);
    
    void runCommandList(const std::vector<std::shared_ptr<struct EventCommand>>& commands);
    void update(float dt);
    bool isRunning() const { return executing; }

    MapTransferRequest consumeTransferRequest();

private:
    void executeNext();
    void processCommand(const std::shared_ptr<struct EventCommand>& cmd);

    class GameState& gameState;
    class DialogueSystem& dialogue;
    
    std::vector<std::shared_ptr<struct EventCommand>> commandStack;
    bool executing = false;
    float waitTimer = 0.0f;
    
    MapTransferRequest transferRequest;
};
