#pragma once

#include <cstdint>
#include <cstddef>
#include <string>
#include <vector>

struct EventTraceEntry {
    std::uint64_t sequence = 0;
    std::string sourceType;
    std::string mapId;
    std::string eventId;
    std::string commonEventId;
    std::string commandPath;
    std::string commandType;
    std::string action;
    std::string result;
};

struct EventTraceSource {
    std::string sourceType;
    std::string mapId;
    std::string eventId;
    std::string commonEventId;
};

class EventTraceBuffer {
public:
    explicit EventTraceBuffer(std::size_t capacity = 256);

    void record(EventTraceEntry entry);
    void clear();

    const std::vector<EventTraceEntry>& entries() const { return recordedEntries; }
    std::size_t size() const { return recordedEntries.size(); }
    std::size_t capacity() const { return maxEntries; }

private:
    std::size_t maxEntries = 256;
    std::uint64_t nextSequence = 1;
    std::vector<EventTraceEntry> recordedEntries;
};

std::string formatEventTraceLine(const EventTraceEntry& entry);
