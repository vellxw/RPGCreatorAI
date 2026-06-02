#include "runtime/MenuSystem.h"
#include "runtime/BattleStats.h"
#include "platform/InputManager.h"
#include "events/GameState.h"
#include "database/RpgDatabases.h"
#include "save/SaveManager.h"
#include "platform/FileSystem.h"
#include <algorithm>
#include <ctime>
#include <sstream>

namespace rpg {

namespace {

constexpr int kMaxSaveSlots = 3;

const std::vector<std::string> kRootItems = {
    "Inventory",
    "Party",
    "Quests",
    "Save",
    "Load",
    "Close",
};

std::string formatMtime(long long unixSeconds) {
    if (unixSeconds <= 0) return {};
    std::time_t t = static_cast<std::time_t>(unixSeconds);
    std::tm tmv{};
#if defined(_WIN32)
    localtime_s(&tmv, &t);
#else
    localtime_r(&t, &tmv);
#endif
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d", &tmv);
    return std::string(buf);
}

std::string joinParty(const std::vector<std::string>& party) {
    std::string out;
    for (size_t i = 0; i < party.size(); ++i) {
        if (i) out += ", ";
        out += party[i];
    }
    return out;
}

MenuSystem::SlotRow makeSlotRow(const SaveManager::SlotMetadata& metadata) {
    MenuSystem::SlotRow row;
    row.index = metadata.index;
    row.exists = metadata.exists;
    row.loadable = metadata.loadable;
    row.corrupt = metadata.corrupt;
    row.mapId = metadata.mapId;
    row.gold = metadata.gold;
    row.party = metadata.party;
    row.mtimeUnix = metadata.mtimeUnix;
    row.detail = metadata.detail;

    if (!row.exists) {
        row.exists = false;
        row.loadable = false;
        row.summary = "Slot " + std::to_string(row.index) + "   Empty";
        return row;
    }

    if (!row.loadable) {
        std::ostringstream oss;
        oss << "Slot " << row.index << "   "
            << (row.corrupt ? "Corrupt" : "Unavailable");
        auto dateStr = formatMtime(row.mtimeUnix);
        if (!dateStr.empty()) oss << "   " << dateStr;
        row.summary = oss.str();
        return row;
    }

    std::ostringstream oss;
    oss << "Slot " << row.index << "   "
        << (row.mapId.empty() ? "?" : row.mapId)
        << "   " << row.gold << "g";
    if (!row.party.empty()) oss << "   " << joinParty(row.party);
    auto dateStr = formatMtime(row.mtimeUnix);
    if (!dateStr.empty()) oss << "   " << dateStr;
    row.summary = oss.str();
    return row;
}

} // namespace

void MenuSystem::open() {
    enterScreen(Screen::Root);
}

void MenuSystem::close() {
    enterScreen(Screen::Closed);
    overwriteConfirmActive_ = false;
    overwriteConfirmSlotIndex_ = 0;
    pendingAction_ = Action::None;
    pendingActionSlot_ = 0;
    clearMessage();
}

void MenuSystem::enterScreen(Screen s) {
    screen_ = s;
    selectionIndex_ = 0;
    overwriteConfirmActive_ = false;
}

MenuSystem::Action MenuSystem::consumeAction() {
    Action a = pendingAction_;
    pendingAction_ = Action::None;
    pendingActionSlot_ = 0;
    return a;
}

void MenuSystem::notifySaveResult(bool ok, int slotIndex, const std::string& detail) {
    if (ok) {
        message_ = "Saved to slot " + std::to_string(slotIndex);
    } else {
        message_ = detail.empty()
            ? "Save to slot " + std::to_string(slotIndex) + " failed"
            : detail;
    }
}

void MenuSystem::notifyLoadResult(bool ok, int slotIndex, const std::string& detail) {
    if (ok) {
        message_ = "Loaded slot " + std::to_string(slotIndex);
    } else {
        message_ = detail.empty()
            ? "Load from slot " + std::to_string(slotIndex) + " failed"
            : detail;
    }
}

void MenuSystem::setSlotsOverride(std::vector<SlotRow> slots) {
    slotsOverride_ = std::move(slots);
    useSlotsOverride_ = true;
}

bool MenuSystem::handleInput(const InputManager& input) {
    if (!isOpen()) return false;

    // Overwrite confirm has its own modal input handling.
    if (overwriteConfirmActive_) {
        if (input.isJustPressed(KeyButton::Confirm)) {
            pendingAction_ = Action::Save;
            pendingActionSlot_ = overwriteConfirmSlotIndex_;
            overwriteConfirmActive_ = false;
            return true;
        }
        if (input.isJustPressed(KeyButton::Cancel)) {
            overwriteConfirmActive_ = false;
            return true;
        }
        return true;
    }

    switch (screen_) {
        case Screen::Closed:
            return false;

        case Screen::Root: {
            if (input.isJustPressed(KeyButton::Cancel) ||
                input.isJustPressed(KeyButton::Menu)) {
                close();
                return true;
            }
            if (input.isJustPressed(KeyButton::Up)) {
                selectionIndex_ = (selectionIndex_ + rootItemCount() - 1) % rootItemCount();
                return true;
            }
            if (input.isJustPressed(KeyButton::Down)) {
                selectionIndex_ = (selectionIndex_ + 1) % rootItemCount();
                return true;
            }
            if (input.isJustPressed(KeyButton::Confirm)) {
                switch (selectionIndex_) {
                    case 0: enterScreen(Screen::Inventory); break;
                    case 1: enterScreen(Screen::Party); break;
                    case 2: enterScreen(Screen::Quests); break;
                    case 3: enterScreen(Screen::Save); break;
                    case 4: enterScreen(Screen::Load); break;
                    case 5: close(); break;
                    default: break;
                }
                return true;
            }
            return true;
        }

        case Screen::Inventory:
        case Screen::Party:
        case Screen::Quests: {
            if (input.isJustPressed(KeyButton::Cancel)) {
                enterScreen(Screen::Root);
                return true;
            }
            if (input.isJustPressed(KeyButton::Menu)) {
                close();
                return true;
            }
            // Up/Down navigation handled by caller via selectionIndex_; we
            // don't know the row count without a snapshot, so we cap on
            // wrap. The renderer/snapshot clamps before drawing.
            if (input.isJustPressed(KeyButton::Up) && selectionIndex_ > 0) {
                --selectionIndex_;
                return true;
            }
            if (input.isJustPressed(KeyButton::Down)) {
                ++selectionIndex_;
                return true;
            }
            return true;
        }

        case Screen::Save: {
            if (input.isJustPressed(KeyButton::Cancel)) {
                enterScreen(Screen::Root);
                selectionIndex_ = 3; // back on Save
                return true;
            }
            if (input.isJustPressed(KeyButton::Menu)) {
                close();
                return true;
            }
            if (input.isJustPressed(KeyButton::Up)) {
                selectionIndex_ = (selectionIndex_ + saveSlotCount() - 1) % saveSlotCount();
                return true;
            }
            if (input.isJustPressed(KeyButton::Down)) {
                selectionIndex_ = (selectionIndex_ + 1) % saveSlotCount();
                return true;
            }
            if (input.isJustPressed(KeyButton::Confirm)) {
                int slotIdx = selectionIndex_ + 1; // 1-based on disk
                std::string slotId = "slot_" + std::to_string(slotIdx);
                if (SaveManager::hasSave(slotId)) {
                    overwriteConfirmActive_ = true;
                    overwriteConfirmSlotIndex_ = slotIdx;
                } else {
                    pendingAction_ = Action::Save;
                    pendingActionSlot_ = slotIdx;
                }
                return true;
            }
            return true;
        }

        case Screen::Load: {
            if (input.isJustPressed(KeyButton::Cancel)) {
                enterScreen(Screen::Root);
                selectionIndex_ = 4; // back on Load
                return true;
            }
            if (input.isJustPressed(KeyButton::Menu)) {
                close();
                return true;
            }
            if (input.isJustPressed(KeyButton::Up)) {
                selectionIndex_ = (selectionIndex_ + saveSlotCount() - 1) % saveSlotCount();
                return true;
            }
            if (input.isJustPressed(KeyButton::Down)) {
                selectionIndex_ = (selectionIndex_ + 1) % saveSlotCount();
                return true;
            }
            if (input.isJustPressed(KeyButton::Confirm)) {
                int slotIdx = selectionIndex_ + 1;
                const SlotRow slot = slotRowForIndex(slotIdx);
                if (slot.loadable) {
                    pendingAction_ = Action::Load;
                    pendingActionSlot_ = slotIdx;
                } else {
                    if (!slot.exists) {
                        message_ = "Slot " + std::to_string(slotIdx) + " is empty";
                    } else if (!slot.detail.empty()) {
                        message_ = "Slot " + std::to_string(slotIdx) +
                                   " cannot be loaded: " + slot.detail;
                    } else {
                        message_ = "Slot " + std::to_string(slotIdx) + " cannot be loaded";
                    }
                }
                return true;
            }
            return true;
        }
    }

    return true;
}

int MenuSystem::subItemCount(const GameState& state, const RpgDatabases& dbs) const {
    switch (screen_) {
        case Screen::Inventory: return static_cast<int>(state.getInventory().size());
        case Screen::Party:     return static_cast<int>(state.getParty().size());
        case Screen::Quests: {
            int n = 0;
            for (const auto& [_, q] : state.getQuests()) {
                if (q.state != "inactive") ++n;
            }
            return n;
        }
        default: break;
    }
    (void)dbs;
    return 0;
}

MenuSystem::SlotRow MenuSystem::slotRowForIndex(int slotIndex) const {
    if (slotIndex <= 0) return {};
    if (useSlotsOverride_) {
        auto it = std::find_if(slotsOverride_.begin(), slotsOverride_.end(),
                               [&](const SlotRow& row) { return row.index == slotIndex; });
        if (it != slotsOverride_.end()) return *it;
        return {};
    }

    for (const auto& metadata : SaveManager::listSlots(saveSlotCount())) {
        if (metadata.index == slotIndex) return makeSlotRow(metadata);
    }
    return {};
}

MenuSystem::ViewModel MenuSystem::snapshot(const GameState& state, const RpgDatabases& dbs) const {
    ViewModel vm;
    vm.screen = screen_;
    vm.playerGold = state.getGold();
    vm.message = message_;
    vm.overwriteConfirmActive = overwriteConfirmActive_;
    vm.overwriteConfirmSlotIndex = overwriteConfirmSlotIndex_;

    vm.rootItems = kRootItems;

    // Inventory rows — sorted alphabetically by id for deterministic output.
    {
        std::vector<std::pair<std::string, int>> entries(
            state.getInventory().begin(), state.getInventory().end());
        std::sort(entries.begin(), entries.end(),
                  [](const auto& a, const auto& b) { return a.first < b.first; });
        for (const auto& [id, amount] : entries) {
            InventoryRow row;
            row.itemId = id;
            row.amount = amount;
            const ItemRecord* item = dbs.findItem(id);
            if (item) {
                row.name = item->name.empty() ? id : item->name;
                row.description = item->description;
            } else {
                row.name = id;
                row.unknown = true;
                row.description = "(unknown item)";
            }
            vm.inventory.push_back(std::move(row));
        }
    }

    // Party rows — preserve party order.
    for (const auto& actorId : state.getParty()) {
        PartyRow row;
        row.actorId = actorId;
        const ActorRecord* actor = dbs.findActor(actorId);
        if (!actor) {
            row.name = actorId;
            row.unknown = true;
            vm.party.push_back(std::move(row));
            continue;
        }

        row.name = actor->name.empty() ? actorId : actor->name;
        row.level = actor->level;
        const ActorBattleStats battleStats = resolveActorBattleStats(dbs, *actor);
        row.maxHp = battleStats.stats.maxHp;
        row.maxMp = battleStats.stats.maxMp;
        row.hp = state.getActorHp(actorId, battleStats.hp);
        row.mp = battleStats.mp;
        row.attack = battleStats.stats.attack;
        row.defense = battleStats.stats.defense;
        row.agility = battleStats.stats.agility;
        row.luck = battleStats.stats.luck;
        for (const auto& [slot, itemId] : actor->equipment) {
            const ItemRecord* item = dbs.findItem(itemId);
            std::string display = item ? item->name : itemId;
            if (slot == "weapon") row.weapon = display;
            else if (slot == "armor") row.armor = display;
            else if (slot == "accessory") row.accessory = display;
        }
        if (const ClassRecord* klass = dbs.findClass(actor->classId)) {
            row.className = klass->name.empty() ? actor->classId : klass->name;
        } else {
            row.className = actor->classId;
        }
        vm.party.push_back(std::move(row));
    }

    // Quest rows — group active first, completed second, failed last;
    // inactive quests are hidden.
    for (const auto& [qid, q] : state.getQuests()) {
        if (q.state == "inactive") continue;
        QuestRow row;
        row.questId = qid;
        row.state = q.state;
        if (const QuestRecord* qrec = dbs.findQuest(qid)) {
            row.title = qrec->title.empty() ? qid : qrec->title;
            row.summary = qrec->summary;
            for (const auto& obj : qrec->objectives) {
                ObjectiveRow orow;
                orow.description = obj.description.empty() ? obj.id : obj.description;
                auto it = q.objectives.find(obj.id);
                orow.done = (it != q.objectives.end() && it->second == "done");
                row.objectives.push_back(std::move(orow));
            }
        } else {
            row.title = qid;
            row.unknown = true;
        }
        vm.quests.push_back(std::move(row));
    }
    auto stateRank = [](const std::string& s) {
        if (s == "active")    return 0;
        if (s == "completed") return 1;
        if (s == "failed")    return 2;
        return 3;
    };
    std::sort(vm.quests.begin(), vm.quests.end(),
              [&](const QuestRow& a, const QuestRow& b) {
                  int ra = stateRank(a.state);
                  int rb = stateRank(b.state);
                  if (ra != rb) return ra < rb;
                  return a.questId < b.questId;
              });

    // Save / load slot rows.
    if (useSlotsOverride_) {
        vm.slots = slotsOverride_;
    } else {
        for (const auto& metadata : SaveManager::listSlots(kMaxSaveSlots)) {
            vm.slots.push_back(makeSlotRow(metadata));
        }
    }

    // Selection index — clamp on a per-screen basis.
    int maxIdx = 0;
    switch (screen_) {
        case Screen::Closed:    maxIdx = 0; break;
        case Screen::Root:      maxIdx = rootItemCount() - 1; break;
        case Screen::Inventory: maxIdx = std::max(0, static_cast<int>(vm.inventory.size()) - 1); break;
        case Screen::Party:     maxIdx = std::max(0, static_cast<int>(vm.party.size()) - 1); break;
        case Screen::Quests:    maxIdx = std::max(0, static_cast<int>(vm.quests.size()) - 1); break;
        case Screen::Save:
        case Screen::Load:      maxIdx = saveSlotCount() - 1; break;
    }
    int idx = selectionIndex_;
    if (idx < 0) idx = 0;
    if (idx > maxIdx) idx = maxIdx;
    vm.selectionIndex = idx;

    return vm;
}

} // namespace rpg
