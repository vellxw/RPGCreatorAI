#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <optional>

struct EventCommand;
struct ProjectData;

namespace rpg {

struct StatsCpp {
    int maxHp = 1;
    int maxMp = 0;
    int attack = 1;
    int defense = 1;
    int magicAttack = 1;
    int magicDefense = 1;
    int agility = 1;
    int luck = 1;
};

struct ActorRecord {
    std::string id;
    std::string name;
    std::string classId;
    int level = 1;
    int hp = 1;
    int mp = 0;
    StatsCpp baseStats;
    std::unordered_map<std::string, std::string> equipment; // slot -> itemId or empty
    std::vector<std::string> skills;
};

struct ClassRecord {
    std::string id;
    std::string name;
    StatsCpp growth;
};

struct SkillRecord {
    std::string id;
    std::string name;
    int mpCost = 0;
    int power = 100;
    std::string target;
};

struct EnemyRecord {
    std::string id;
    std::string name;
    StatsCpp stats;
    int exp = 0;
    int gold = 0;
    std::vector<std::pair<std::string, double>> drops; // itemId, rate (0..1)
};

struct TroopRecord {
    std::string id;
    std::string name;
    std::vector<std::string> members; // enemy ids
};

struct ObjectiveRecord {
    std::string id;
    std::string description;
};

struct QuestRecord {
    std::string id;
    std::string title;
    std::string summary;
    std::vector<ObjectiveRecord> objectives;
    int rewardGold = 0;
    int rewardExp = 0;
    std::vector<std::pair<std::string, int>> rewardItems;
};

struct ShopListing {
    std::string itemId;
    int price = 0;
};
struct ShopRecord {
    std::string id;
    std::string name;
    std::vector<ShopListing> listings;
};

struct CommonEventRecord {
    std::string id;
    std::string name;
    std::string trigger;
    std::vector<std::shared_ptr<EventCommand>> commands;
};

struct SystemRecord {
    std::vector<std::string> startingParty;
    int startingGold = 0;
    std::string defaultBgm;
    std::string windowTint;
    std::string battleBackground;
    std::string playerAnimationSet;
    std::string playerMovementSpeed = "double";
    float defaultCharacterHeightTiles = 1.5f;
};

struct ItemRecord {
    std::string id;
    std::string name;
    std::string description;
    std::string type;
    int price = 0;
    StatsCpp modifiers;     // 0 fields when absent
    int effectHp = 0;
    int effectMp = 0;
    std::string slot;
};

class RpgDatabases {
public:
    bool loadAll(const ::ProjectData& project);

    const std::vector<ActorRecord>& actors() const { return actors_; }
    const std::vector<ClassRecord>& classes() const { return classes_; }
    const std::vector<SkillRecord>& skills() const { return skills_; }
    const std::vector<EnemyRecord>& enemies() const { return enemies_; }
    const std::vector<TroopRecord>& troops() const { return troops_; }
    const std::vector<QuestRecord>& quests() const { return quests_; }
    const std::vector<ShopRecord>& shops() const { return shops_; }
    const std::vector<CommonEventRecord>& commonEvents() const { return commonEvents_; }
    const std::vector<ItemRecord>& items() const { return items_; }
    const SystemRecord& system() const { return system_; }

    const ActorRecord* findActor(const std::string& id) const;
    const ClassRecord* findClass(const std::string& id) const;
    const TroopRecord* findTroop(const std::string& id) const;
    const EnemyRecord* findEnemy(const std::string& id) const;
    const QuestRecord* findQuest(const std::string& id) const;
    const ShopRecord* findShop(const std::string& id) const;
    const CommonEventRecord* findCommonEvent(const std::string& id) const;
    const ItemRecord* findItem(const std::string& id) const;

private:
    std::vector<ActorRecord> actors_;
    std::vector<ClassRecord> classes_;
    std::vector<SkillRecord> skills_;
    std::vector<EnemyRecord> enemies_;
    std::vector<TroopRecord> troops_;
    std::vector<QuestRecord> quests_;
    std::vector<ShopRecord> shops_;
    std::vector<CommonEventRecord> commonEvents_;
    std::vector<ItemRecord> items_;
    SystemRecord system_{};
};

} // namespace rpg
