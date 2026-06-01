#include "events/EventTrace.h"

#include <algorithm>
#include <sstream>
#include <utility>

namespace {

std::string escapeJson(const std::string& value) {
    std::ostringstream out;
    for (char ch : value) {
        switch (ch) {
            case '\\': out << "\\\\"; break;
            case '"': out << "\\\""; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default: out << ch; break;
        }
    }
    return out.str();
}

void appendStringField(std::ostringstream& out,
                       const std::string& name,
                       const std::string& value) {
    out << ",\"" << name << "\":\"" << escapeJson(value) << "\"";
}

} // namespace

EventTraceBuffer::EventTraceBuffer(std::size_t capacity)
    : maxEntries(std::max<std::size_t>(1, capacity)) {}

void EventTraceBuffer::record(EventTraceEntry entry) {
    entry.sequence = nextSequence++;
    if (recordedEntries.size() >= maxEntries) {
        recordedEntries.erase(recordedEntries.begin());
    }
    recordedEntries.push_back(std::move(entry));
}

void EventTraceBuffer::clear() {
    recordedEntries.clear();
    nextSequence = 1;
}

std::string formatEventTraceLine(const EventTraceEntry& entry) {
    std::ostringstream out;
    out << "[TRACE] {\"sequence\":" << entry.sequence;
    appendStringField(out, "sourceType", entry.sourceType);
    appendStringField(out, "mapId", entry.mapId);
    appendStringField(out, "eventId", entry.eventId);
    appendStringField(out, "commonEventId", entry.commonEventId);
    appendStringField(out, "commandPath", entry.commandPath);
    appendStringField(out, "commandType", entry.commandType);
    appendStringField(out, "action", entry.action);
    appendStringField(out, "result", entry.result);
    out << "}";
    return out.str();
}
