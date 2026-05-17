#pragma once

#include <optional>
#include <string>
#include <vector>

class GameState;
class InputManager;

namespace rpg {

class RpgDatabases;

class ShopSystem {
public:
    struct ListingRow {
        std::string itemId;
        std::string name;
        std::string description;
        int price = 0;
        int owned = 0;
        bool affordable = false;
        bool unknown = false;
    };

    struct ViewModel {
        bool active = false;
        std::string shopId;
        std::string shopName;
        int gold = 0;
        int selectionIndex = 0;
        std::vector<ListingRow> listings;
        std::optional<std::string> message;
    };

    bool open(const std::string& shopId, const RpgDatabases& dbs);
    void close();
    bool isOpen() const { return !shopId_.empty(); }
    bool handleInput(const InputManager& input, GameState& state, const RpgDatabases& dbs);
    ViewModel snapshot(const GameState& state, const RpgDatabases& dbs) const;

private:
    const struct ShopRecord* currentShop(const RpgDatabases& dbs) const;

    std::string shopId_;
    int selectionIndex_ = 0;
    std::optional<std::string> message_;
};

} // namespace rpg
