#include "runtime/MenuSystem.h"
#include "platform/InputManager.h"
#include "events/GameState.h"
#include "database/RpgDatabases.h"
#include "save/SaveManager.h"
#include "platform/FileSystem.h"
#include "core/Logger.h"
#include <nlohmann/json.hpp>
#include <algorithm>
#include <ctime>
#include <filesystem>
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

MenuSystem::SlotRow readSlotMetadata(int slotIndex) {
    MenuSystem::SlotRow row;
    row.index = slotIndex;
    const std::string slotId = "slot_" + std::to_string(slotIndex);
    const std::string path = "saves/" + slotId + ".json";
    if (!FileSystem::exists(path)) {
        row.exists = false;
        row.summary = "Slot " + std::to_string(slotIndex) + "   Empty";
        return row;
    }

    auto content = FileSystem::readFile(path);
    if (!content) {
        row.exists = false;
        row.summary = "Slot " + std::to_string(slotIndex) + "   Empty";
        return row;
    }

    try {
        auto j = nlohmann::json::parse(*content);
        row.exists = true;
        row.mapId = j.value("currentMapId", std::string{"?"});
        row.gold = j.value("gold", 0);
        if (j.contains("party") && j.at("party").is_array()) {
            for (const auto& p : j.at("party")) {
                row.party.push_back(p.get<std::string>());
            }
        }
    } catch (const nlohmann::json::exception&) {
        row.exists = false;
        row.summary = "Slot " + std::to_string(slotIndex) + "   (corrupt)";
        return row;
    }

    // mtime via std::filesystem
    try {
        auto ftime = std::filesystem::last_write_time(path);
        auto sctp = std::chrono::time_point_cast<std::chrono::system_clock::duration>(
            ftime - std::filesystem::file_time_type::clock::now() +
            std::chrono::system_clock::now());
        row.mtimeUnix = std::chrono::duration_cast<std::chrono::seconds>(
                             sctp.time_since_epoch())
                             .count();
    } catch (const std::filesystem::filesystem_error&) {
        row.mtimeUnix = 0;
    }

    std::ostringstream oss;
    oss << "Slot " << slotIndex << "   "
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

void MenuSystem::notifySaveResult(bool ok, int slotIndex) {
    if (ok) {
        message_ = "Saved to slot " + std::to_string(slotIndex);
    } else {
        message_ = "Save to slot " + std::to_string(slotIndex) + " failed";
    }
}

void MenuSystem::notifyLoadResult(bool ok, int slotIndex) {
    if (ok) {
        message_ = "Loaded slot " + std::to_string(slotIndex);
    } else {
        message_ = "Load from slot " + std::to_string(slotIndex) + " failed";
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
                if (FileSystem::exists("saves/" + slotId + ".json")) {
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
                std::string slotId = "slot_" + std::to_string(slotIdx);
                if (FileSystem::exists("saves/" + slotId + ".json")) {
                    pendingAction_ = Action::Load;
                    pendingActionSlot_ = slotIdx;
                }
                // Empty Load slots are silently ignored (rendered as
                // disabled by the renderer).
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
                row.description.clear();
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
        row.maxHp = actor->baseStats.maxHp;
        row.maxMp = actor->baseStats.maxMp;
        row.hp = state.getActorHp(actorId, actor->hp);
        row.mp = actor->mp;
        // Stats include base + equipment modifiers (must match BattleSystem
        // resolver semantics).
        row.attack = actor->baseStats.attack;
        row.defense = actor->baseStats.defense;
        row.agility = actor->baseStats.agility;
        row.luck = actor->baseStats.luck;
        for (const auto& [slot, itemId] : actor->equipment) {
            const ItemRecord* item = dbs.findItem(itemId);
            if (item) {
                row.attack += item->modifiers.attack;
                row.defense += item->modifiers.defense;
                row.agility += item->modifiers.agility;
                row.luck += item->modifiers.luck;
            }
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
        for (int i = 1; i <= kMaxSaveSlots; ++i) {
            vm.slots.push_back(readSlotMetadata(i));
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
