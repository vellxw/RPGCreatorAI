#pragma once

#include <string>
#include <vector>
#include <optional>

class GameState;
class InputManager;

namespace rpg {

class RpgDatabases;

// Phase 7 — runtime pause menu state machine.
//
// Screens
//   Closed        — menu hidden, runtime ticks normally
//   Root          — top-level list (Inventory / Party / Quests / Save / Load / Close)
//   Inventory     — every owned item, name + amount + description
//   Party         — every actor in GameState.party with stats and equipment
//   Quests        — Active / Completed / Failed groups, per-objective bullets
//   Save          — slot picker writing through SaveManager
//   Load          — slot picker reading through SaveManager
//
// Input model is keyboard-only and snapshot-based: handleInput() consumes a
// per-frame InputManager and updates internal state. The renderer reads
// snapshot() each frame and draws purely from that view-model — the
// MenuSystem itself never touches SDL.
class MenuSystem {
public:
    enum class Screen {
        Closed,
        Root,
        Inventory,
        Party,
        Quests,
        Save,
        Load,
    };

    enum class Action {
        None,
        Close,
        Save,         // slot index in actionSlot
        Load,         // slot index in actionSlot
    };

    struct InventoryRow {
        std::string itemId;
        std::string name;
        int amount = 0;
        std::string description;
        bool unknown = false;
    };

    struct PartyRow {
        std::string actorId;
        std::string name;
        std::string className;
        int level = 1;
        int hp = 0;
        int maxHp = 0;
        int mp = 0;
        int maxMp = 0;
        int attack = 0;
        int defense = 0;
        int agility = 0;
        int luck = 0;
        std::string weapon;
        std::string armor;
        std::string accessory;
        bool unknown = false;
    };

    struct ObjectiveRow {
        std::string description;
        bool done = false;
    };

    struct QuestRow {
        std::string questId;
        std::string title;
        std::string summary;
        std::string state;             // "active", "completed", "failed"
        std::vector<ObjectiveRow> objectives;
        bool unknown = false;
    };

    struct SlotRow {
        int index = 1;                 // 1-based for display
        bool exists = false;
        std::string mapId;
        int gold = 0;
        std::vector<std::string> party;
        long long mtimeUnix = 0;
        std::string summary;           // pre-formatted for the renderer
    };

    struct ViewModel {
        Screen screen = Screen::Closed;
        int selectionIndex = 0;
        int playerGold = 0;

        // Filled depending on `screen`. Other fields stay empty so the
        // renderer can blindly read whichever it needs.
        std::vector<std::string> rootItems;
        std::vector<InventoryRow> inventory;
        std::vector<PartyRow> party;
        std::vector<QuestRow> quests;
        std::vector<SlotRow> slots;
        std::optional<std::string> message;

        bool overwriteConfirmActive = false;
        int overwriteConfirmSlotIndex = 0;
    };

    void open();
    void close();
    bool isOpen() const { return screen_ != Screen::Closed; }
    Screen current() const { return screen_; }

    // Returns true if the input was consumed (the menu wants to suppress
    // gameplay input for this frame).
    bool handleInput(const InputManager& input);

    // Set after handleInput when the user picked Save or Load. Consume via
    // consumeAction(); the slot is 1-based.
    Action pendingAction() const { return pendingAction_; }
    int pendingActionSlot() const { return pendingActionSlot_; }
    Action consumeAction();

    // Tells the menu the most recent Save/Load attempt finished, so it can
    // show a toast and close itself.
    void notifySaveResult(bool ok, int slotIndex);
    void notifyLoadResult(bool ok, int slotIndex);

    ViewModel snapshot(const GameState& state, const RpgDatabases& dbs) const;

    // Test seam — install pre-built slot rows so unit tests don't need a
    // real saves directory. When no override is set, snapshot() builds rows
    // from SaveManager::listSlots().
    void setSlotsOverride(std::vector<SlotRow> slots);

    // Force a specific selection index (used by tests).
    void setSelectionForTest(int idx) { selectionIndex_ = idx; }
    int selection() const { return selectionIndex_; }

private:
    void enterScreen(Screen s);
    int rootItemCount() const { return 6; } // Inventory/Party/Quests/Save/Load/Close
    int subItemCount(const GameState& state, const RpgDatabases& dbs) const;
    int saveSlotCount() const { return 3; }
    void clearMessage() { message_.reset(); messageTtl_ = 0.0f; }

    Screen screen_ = Screen::Closed;
    int selectionIndex_ = 0;
    Action pendingAction_ = Action::None;
    int pendingActionSlot_ = 0;
    bool overwriteConfirmActive_ = false;
    int overwriteConfirmSlotIndex_ = 0;
    std::optional<std::string> message_;
    float messageTtl_ = 0.0f;

    std::vector<SlotRow> slotsOverride_;
    bool useSlotsOverride_ = false;
};

} // namespace rpg
