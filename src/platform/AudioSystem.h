#pragma once

#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

namespace rpg {

struct AudioPlaybackResult {
    bool requested = false;
    bool played = false;
    std::string id;
    std::string path;
    std::string message;
};

class IAudioBackend {
public:
    virtual ~IAudioBackend() = default;

    virtual bool initialize() = 0;
    virtual void shutdown() = 0;
    virtual bool playWav(const std::string& path, bool loop) = 0;
    virtual void stopAll() = 0;
};

class AudioSystem {
public:
    AudioSystem();
    explicit AudioSystem(std::unique_ptr<IAudioBackend> backend);
    ~AudioSystem();

    AudioSystem(const AudioSystem&) = delete;
    AudioSystem& operator=(const AudioSystem&) = delete;

    bool initialize(const std::unordered_map<std::string, std::string>& registry = {});
    void shutdown();

    static std::unordered_map<std::string, std::string> defaultRegistry();

    void registerSound(const std::string& id, const std::string& path);
    void registerSounds(const std::unordered_map<std::string, std::string>& registry);
    bool hasSound(const std::string& id) const;
    std::string pathFor(const std::string& id) const;

    AudioPlaybackResult playSound(const std::string& id);
    AudioPlaybackResult playBgm(const std::string& id);
    void stopBgm();

    const std::vector<std::string>& requestedIds() const { return requestedIds_; }

private:
    AudioPlaybackResult playRegistered(const std::string& id, bool loop);

    std::unique_ptr<IAudioBackend> backend_;
    std::unordered_map<std::string, std::string> registry_;
    std::vector<std::string> requestedIds_;
    std::string currentBgmId_;
    bool backendReady_ = false;
};

} // namespace rpg
