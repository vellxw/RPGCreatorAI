#pragma once
#include <string>
#include <vector>

struct ItemData {
    std::string id;
    std::string name;
    std::string description;
    std::string type;
};

class ItemDatabase {
public:
    bool load(const std::string& path);
    const ItemData* getItem(const std::string& id) const;

private:
    std::vector<ItemData> items;
};
