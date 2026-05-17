#include "runtime/ShopSystem.h"

#include "database/RpgDatabases.h"
#include "events/GameState.h"
#include "platform/InputManager.h"

#include <algorithm>

namespace rpg {

bool ShopSystem::open(const std::string& shopId, const RpgDatabases& dbs) {
    if (!dbs.findShop(shopId)) {
        return false;
    }

    shopId_ = shopId;
    selectionIndex_ = 0;
    message_.reset();
    return true;
}

void ShopSystem::close() {
    shopId_.clear();
    selectionIndex_ = 0;
    message_.reset();
}

const ShopRecord* ShopSystem::currentShop(const RpgDatabases& dbs) const {
    if (!isOpen()) {
        return nullptr;
    }
    return dbs.findShop(shopId_);
}

bool ShopSystem::handleInput(const InputManager& input,
                             GameState& state,
                             const RpgDatabases& dbs) {
    const ShopRecord* shop = currentShop(dbs);
    if (!shop) {
        close();
        return false;
    }

    if (input.isJustPressed(KeyButton::Cancel) ||
        input.isJustPressed(KeyButton::Menu)) {
        close();
        return true;
    }

    const int listingCount = static_cast<int>(shop->listings.size());
    if (listingCount <= 0) {
        return true;
    }

    if (input.isJustPressed(KeyButton::Up)) {
        selectionIndex_ = (selectionIndex_ + listingCount - 1) % listingCount;
        message_.reset();
        return true;
    }

    if (input.isJustPressed(KeyButton::Down)) {
        selectionIndex_ = (selectionIndex_ + 1) % listingCount;
        message_.reset();
        return true;
    }

    if (input.isJustPressed(KeyButton::Confirm)) {
        const auto& listing = shop->listings[selectionIndex_];
        const ItemRecord* item = dbs.findItem(listing.itemId);
        const std::string displayName =
            item && !item->name.empty() ? item->name : listing.itemId;

        if (state.getGold() < listing.price) {
            message_ = "Not enough gold";
            return true;
        }

        state.removeGold(listing.price);
        state.addItem(listing.itemId, 1);
        message_ = "Bought " + displayName;
        return true;
    }

    return true;
}

ShopSystem::ViewModel ShopSystem::snapshot(const GameState& state,
                                           const RpgDatabases& dbs) const {
    ViewModel vm;
    vm.active = isOpen();
    vm.shopId = shopId_;
    vm.gold = state.getGold();
    vm.selectionIndex = selectionIndex_;
    vm.message = message_;

    const ShopRecord* shop = currentShop(dbs);
    if (!shop) {
        return vm;
    }

    vm.shopName = shop->name.empty() ? shop->id : shop->name;
    for (const auto& listing : shop->listings) {
        ListingRow row;
        row.itemId = listing.itemId;
        row.price = listing.price;
        row.affordable = state.getGold() >= listing.price;
        const auto owned = state.getInventory().find(listing.itemId);
        row.owned = owned != state.getInventory().end() ? owned->second : 0;

        if (const ItemRecord* item = dbs.findItem(listing.itemId)) {
            row.name = item->name.empty() ? listing.itemId : item->name;
            row.description = item->description;
        } else {
            row.name = listing.itemId;
            row.unknown = true;
            row.description = "(unknown item)";
        }

        vm.listings.push_back(std::move(row));
    }

    if (!vm.listings.empty()) {
        vm.selectionIndex = std::clamp(vm.selectionIndex, 0,
                                       static_cast<int>(vm.listings.size()) - 1);
    } else {
        vm.selectionIndex = 0;
    }

    return vm;
}

} // namespace rpg
