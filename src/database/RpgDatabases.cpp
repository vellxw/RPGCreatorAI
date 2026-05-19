#include "database/RpgDatabases.h"
#include "platform/FileSystem.h"
#include "core/Logger.h"
#include "types/ProjectTypes.h"
#include "types/EventTypes.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

namespace rpg {

// MapLoader's parseCommand isn't exposed; we duplicate a slim parser here so
// common events can be loaded without dragging map parsing into this module.
// Keeping it small: the renderer is the validator.
static std::shared_ptr<EventCommand> parseCommand(const json& j);

static StatsCpp parseStats(const json& j) {
    StatsCpp s;
    s.maxHp = j.value("maxHp", 1);
    s.maxMp = j.value("maxMp", 0);
    s.attack = j.value("attack", 1);
    s.defense = j.value("defense", 1);
    s.magicAttack = j.value("magicAttack", 1);
    s.magicDefense = j.value("magicDefense", 1);
    s.agility = j.value("agility", 1);
    s.luck = j.value("luck", 1);
    return s;
}

static std::optional<json> readJson(const std::string& path) {
    if (path.empty()) return std::nullopt;
    auto content = FileSystem::readFile(path);
    if (!content) {
        Logger::warning("Database file not found: " + path);
        return std::nullopt;
    }
    try {
        return json::parse(*content);
    } catch (const json::exception& e) {
        Logger::error(std::string("Database parse error in ") + path + ": " + e.what());
        return std::nullopt;
    }
}

bool RpgDatabases::loadAll(const ::ProjectData& project) {
    // Items
    if (auto j = readJson(project.database.itemsPath)) {
        for (const auto& it : (*j).value("items", json::array())) {
            ItemRecord ir;
            ir.id = it.value("id", "");
            ir.name = it.value("name", "");
            ir.description = it.value("description", "");
            ir.type = it.value("type", "");
            ir.price = it.value("price", 0);
            if (it.contains("modifiers")) ir.modifiers = parseStats(it.at("modifiers"));
            if (it.contains("effect")) {
                ir.effectHp = it.at("effect").value("hp", 0);
                ir.effectMp = it.at("effect").value("mp", 0);
            }
            ir.slot = it.value("slot", "");
            items_.push_back(std::move(ir));
        }
    }

    if (auto j = readJson(project.database.actorsPath)) {
        for (const auto& a : (*j).value("actors", json::array())) {
            ActorRecord r;
            r.id = a.value("id", "");
            r.name = a.value("name", "");
            r.classId = a.value("classId", "");
            r.level = a.value("level", 1);
            r.hp = a.value("hp", 1);
            r.mp = a.value("mp", 0);
            if (a.contains("baseStats")) r.baseStats = parseStats(a.at("baseStats"));
            if (a.contains("equipment") && a.at("equipment").is_object()) {
                for (auto& [k, v] : a.at("equipment").items()) {
                    if (v.is_string()) r.equipment[k] = v.get<std::string>();
                }
            }
            if (a.contains("skills")) {
                for (const auto& s : a.at("skills")) r.skills.push_back(s.get<std::string>());
            }
            actors_.push_back(std::move(r));
        }
    }

    if (auto j = readJson(project.database.classesPath)) {
        for (const auto& c : (*j).value("classes", json::array())) {
            ClassRecord r;
            r.id = c.value("id", "");
            r.name = c.value("name", "");
            if (c.contains("growth")) r.growth = parseStats(c.at("growth"));
            classes_.push_back(std::move(r));
        }
    }

    if (auto j = readJson(project.database.skillsPath)) {
        for (const auto& s : (*j).value("skills", json::array())) {
            SkillRecord r;
            r.id = s.value("id", "");
            r.name = s.value("name", "");
            r.mpCost = s.value("mpCost", 0);
            r.power = s.value("power", 100);
            r.target = s.value("target", "");
            skills_.push_back(std::move(r));
        }
    }

    if (auto j = readJson(project.database.enemiesPath)) {
        for (const auto& e : (*j).value("enemies", json::array())) {
            EnemyRecord r;
            r.id = e.value("id", "");
            r.name = e.value("name", "");
            if (e.contains("stats")) r.stats = parseStats(e.at("stats"));
            r.exp = e.value("exp", 0);
            r.gold = e.value("gold", 0);
            if (e.contains("drops")) {
                for (const auto& d : e.at("drops")) {
                    r.drops.emplace_back(d.value("itemId", ""), d.value("rate", 0.0));
                }
            }
            enemies_.push_back(std::move(r));
        }
    }

    if (auto j = readJson(project.database.troopsPath)) {
        for (const auto& t : (*j).value("troops", json::array())) {
            TroopRecord r;
            r.id = t.value("id", "");
            r.name = t.value("name", "");
            if (t.contains("members")) {
                for (const auto& m : t.at("members")) r.members.push_back(m.get<std::string>());
            }
            troops_.push_back(std::move(r));
        }
    }

    if (auto j = readJson(project.database.questsPath)) {
        for (const auto& q : (*j).value("quests", json::array())) {
            QuestRecord r;
            r.id = q.value("id", "");
            r.title = q.value("title", "");
            r.summary = q.value("summary", "");
            for (const auto& obj : q.value("objectives", json::array())) {
                r.objectives.push_back({obj.value("id", ""), obj.value("description", "")});
            }
            const auto& rew = q.value("rewards", json::object());
            r.rewardGold = rew.value("gold", 0);
            r.rewardExp = rew.value("exp", 0);
            for (const auto& it : rew.value("items", json::array())) {
                r.rewardItems.emplace_back(it.value("itemId", ""), it.value("amount", 0));
            }
            quests_.push_back(std::move(r));
        }
    }

    if (auto j = readJson(project.database.shopsPath)) {
        for (const auto& s : (*j).value("shops", json::array())) {
            ShopRecord r;
            r.id = s.value("id", "");
            r.name = s.value("name", "");
            for (const auto& l : s.value("listings", json::array())) {
                r.listings.push_back({l.value("itemId", ""), l.value("price", 0)});
            }
            shops_.push_back(std::move(r));
        }
    }

    if (auto j = readJson(project.database.commonEventsPath)) {
        for (const auto& ce : (*j).value("commonEvents", json::array())) {
            CommonEventRecord r;
            r.id = ce.value("id", "");
            r.name = ce.value("name", "");
            r.trigger = ce.value("trigger", "manual");
            for (const auto& cmdJson : ce.value("commands", json::array())) {
                r.commands.push_back(parseCommand(cmdJson));
            }
            commonEvents_.push_back(std::move(r));
        }
    }

    if (auto j = readJson(project.database.systemPath)) {
        const auto& sys = *j;
        for (const auto& a : sys.value("startingParty", json::array())) {
            system_.startingParty.push_back(a.get<std::string>());
        }
        system_.startingGold = sys.value("startingGold", 0);
        system_.defaultBgm = sys.value("defaultBgm", "");
        system_.windowTint = sys.value("windowTint", "");
        system_.battleBackground = sys.value("battleBackground", "");
        system_.playerAnimationSet = sys.value("playerAnimationSet", "");
        system_.playerMovementSpeed = sys.value("playerMovementSpeed", system_.playerMovementSpeed);
        system_.defaultCharacterHeightTiles =
            sys.value("defaultCharacterHeightTiles", system_.defaultCharacterHeightTiles);
    }

    Logger::info("Databases loaded: " +
                 std::to_string(actors_.size()) + " actors, " +
                 std::to_string(enemies_.size()) + " enemies, " +
                 std::to_string(troops_.size()) + " troops, " +
                 std::to_string(quests_.size()) + " quests, " +
                 std::to_string(shops_.size()) + " shops, " +
                 std::to_string(commonEvents_.size()) + " common events");

    return true;
}

const ActorRecord* RpgDatabases::findActor(const std::string& id) const {
    for (const auto& a : actors_) if (a.id == id) return &a;
    return nullptr;
}
const ClassRecord* RpgDatabases::findClass(const std::string& id) const {
    for (const auto& c : classes_) if (c.id == id) return &c;
    return nullptr;
}
const TroopRecord* RpgDatabases::findTroop(const std::string& id) const {
    for (const auto& t : troops_) if (t.id == id) return &t;
    return nullptr;
}
const EnemyRecord* RpgDatabases::findEnemy(const std::string& id) const {
    for (const auto& e : enemies_) if (e.id == id) return &e;
    return nullptr;
}
const QuestRecord* RpgDatabases::findQuest(const std::string& id) const {
    for (const auto& q : quests_) if (q.id == id) return &q;
    return nullptr;
}
const ShopRecord* RpgDatabases::findShop(const std::string& id) const {
    for (const auto& s : shops_) if (s.id == id) return &s;
    return nullptr;
}
const CommonEventRecord* RpgDatabases::findCommonEvent(const std::string& id) const {
    for (const auto& ce : commonEvents_) if (ce.id == id) return &ce;
    return nullptr;
}
const ItemRecord* RpgDatabases::findItem(const std::string& id) const {
    for (const auto& i : items_) if (i.id == id) return &i;
    return nullptr;
}

// --- Common event command parser (subset; mirrors MapLoader::parseCommand) -

static std::shared_ptr<EventCommand> parseCommand(const json& j) {
    auto cmd = std::make_shared<EventCommand>();
    cmd->type = j.value("type", "");
    const auto& type = cmd->type;
    if (type == "showText") {
        cmd->text = j.value("text", "");
        cmd->speaker = j.value("speaker", "");
    } else if (type == "showChoices") {
        cmd->prompt = j.value("prompt", "");
        for (const auto& c : j.value("choices", json::array())) {
            EventCommand::Choice ch;
            ch.label = c.value("label", "");
            for (const auto& inner : c.value("commands", json::array())) {
                ch.commands.push_back(parseCommand(inner));
            }
            cmd->choices.push_back(std::move(ch));
        }
    } else if (type == "setFlag") {
        cmd->flag = j.value("flag", "");
        cmd->boolValue = j.value("value", false);
    } else if (type == "ifFlag") {
        cmd->flag = j.value("flag", "");
        cmd->boolValue = j.value("equals", false);
        for (const auto& c : j.value("then", json::array())) cmd->thenCommands.push_back(parseCommand(c));
        for (const auto& c : j.value("else", json::array())) cmd->elseCommands.push_back(parseCommand(c));
    } else if (type == "ifSwitch") {
        cmd->switchId = j.value("switchId", "");
        cmd->boolValue = j.value("equals", false);
        for (const auto& c : j.value("then", json::array())) cmd->thenCommands.push_back(parseCommand(c));
        for (const auto& c : j.value("else", json::array())) cmd->elseCommands.push_back(parseCommand(c));
    } else if (type == "ifVariable") {
        cmd->variableId = j.value("variableId", "");
        cmd->compareOp = j.value("op", "eq");
        cmd->varValue = j.value("value", 0);
        for (const auto& c : j.value("then", json::array())) cmd->thenCommands.push_back(parseCommand(c));
        for (const auto& c : j.value("else", json::array())) cmd->elseCommands.push_back(parseCommand(c));
    } else if (type == "controlSwitch") {
        cmd->switchId = j.value("switchId", "");
        cmd->boolValue = j.value("value", false);
    } else if (type == "controlVariable") {
        cmd->variableId = j.value("variableId", "");
        cmd->varOp = j.value("op", "set");
        cmd->varValue = j.value("value", 0);
        cmd->sourceVariableId = j.value("sourceVariableId", "");
    } else if (type == "addItem" || type == "removeItem") {
        cmd->itemId = j.value("itemId", "");
        cmd->amount = j.value("amount", 0);
    } else if (type == "addGold" || type == "removeGold") {
        cmd->goldAmount = j.value("amount", 0);
    } else if (type == "transferMap" || type == "setPlayerPosition") {
        cmd->mapId = j.value("mapId", "");
        cmd->x = j.value("x", 0);
        cmd->y = j.value("y", 0);
        cmd->direction = j.value("direction", "down");
    } else if (type == "playSound") {
        cmd->soundId = j.value("soundId", "");
    } else if (type == "wait") {
        cmd->ms = j.value("ms", 0);
    } else if (type == "comment") {
        cmd->text = j.value("text", "");
    } else if (type == "callCommonEvent") {
        cmd->commonEventId = j.value("commonEventId", "");
    } else if (type == "startQuest" || type == "completeQuest") {
        cmd->questId = j.value("questId", "");
    } else if (type == "updateQuestObjective") {
        cmd->questId = j.value("questId", "");
        cmd->objectiveId = j.value("objectiveId", "");
        cmd->objectiveState = j.value("state", "done");
    } else if (type == "openShop") {
        cmd->shopId = j.value("shopId", "");
    } else if (type == "startBattle") {
        cmd->troopId = j.value("troopId", "");
        cmd->canEscape = j.value("canEscape", false);
        for (const auto& c : j.value("victoryBranch", json::array())) cmd->victoryBranch.push_back(parseCommand(c));
        for (const auto& c : j.value("defeatBranch", json::array())) cmd->defeatBranch.push_back(parseCommand(c));
    } else if (type == "changeActorHp") {
        cmd->actorId = j.value("actorId", "");
        cmd->delta = j.value("delta", 0);
    }
    return cmd;
}

} // namespace rpg
