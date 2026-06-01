#include "platform/AudioSystem.h"
#include "core/Logger.h"
#include "platform/FileSystem.h"
#include <SDL.h>
#include <algorithm>
#include <cstring>

namespace {

class SdlAudioBackend final : public rpg::IAudioBackend {
public:
    bool initialize() override {
        if ((SDL_WasInit(0) == 0 && SDL_Init(SDL_INIT_AUDIO) != 0) ||
            (SDL_WasInit(0) != 0 &&
             SDL_WasInit(SDL_INIT_AUDIO) == 0 &&
             SDL_InitSubSystem(SDL_INIT_AUDIO) != 0)) {
            Logger::warning(std::string("AudioSystem: SDL audio init failed: ") + SDL_GetError());
            return false;
        }

        SDL_AudioSpec desired{};
        desired.freq = 44100;
        desired.format = AUDIO_F32SYS;
        desired.channels = 2;
        desired.samples = 4096;
        desired.callback = nullptr;

        device_ = SDL_OpenAudioDevice(nullptr, 0, &desired, &obtained_, 0);
        if (device_ == 0) {
            Logger::warning(std::string("AudioSystem: audio device unavailable: ") + SDL_GetError());
            return false;
        }

        SDL_PauseAudioDevice(device_, 0);
        return true;
    }

    void shutdown() override {
        if (device_ != 0) {
            SDL_ClearQueuedAudio(device_);
            SDL_CloseAudioDevice(device_);
            device_ = 0;
        }
        if (SDL_WasInit(SDL_INIT_AUDIO) != 0) {
            SDL_QuitSubSystem(SDL_INIT_AUDIO);
        }
    }

    bool playWav(const std::string& path, bool loop) override {
        if (device_ == 0) return false;

        SDL_AudioSpec wavSpec{};
        Uint8* wavBuffer = nullptr;
        Uint32 wavLength = 0;
        if (!SDL_LoadWAV(path.c_str(), &wavSpec, &wavBuffer, &wavLength)) {
            Logger::warning(std::string("AudioSystem: SDL_LoadWAV failed for ") +
                            path + ": " + SDL_GetError());
            return false;
        }

        const bool queued = queueConvertedWav(wavSpec, wavBuffer, wavLength, loop);
        SDL_FreeWAV(wavBuffer);
        return queued;
    }

    void stopAll() override {
        if (device_ != 0) {
            SDL_ClearQueuedAudio(device_);
        }
    }

private:
    bool queueConvertedWav(const SDL_AudioSpec& wavSpec,
                           const Uint8* wavBuffer,
                           Uint32 wavLength,
                           bool loop) {
        SDL_AudioCVT cvt{};
        const int cvtResult = SDL_BuildAudioCVT(
            &cvt,
            wavSpec.format,
            wavSpec.channels,
            wavSpec.freq,
            obtained_.format,
            obtained_.channels,
            obtained_.freq);
        if (cvtResult < 0) {
            Logger::warning(std::string("AudioSystem: SDL_BuildAudioCVT failed: ") +
                            SDL_GetError());
            return false;
        }

        const int repeatCount = loop ? 4 : 1;
        for (int i = 0; i < repeatCount; ++i) {
            if (cvt.needed) {
                cvt.len = static_cast<int>(wavLength);
                cvt.buf = static_cast<Uint8*>(SDL_malloc(cvt.len * cvt.len_mult));
                if (!cvt.buf) {
                    Logger::warning("AudioSystem: failed to allocate audio conversion buffer");
                    return false;
                }
                std::memcpy(cvt.buf, wavBuffer, wavLength);
                if (SDL_ConvertAudio(&cvt) != 0) {
                    Logger::warning(std::string("AudioSystem: SDL_ConvertAudio failed: ") +
                                    SDL_GetError());
                    SDL_free(cvt.buf);
                    return false;
                }
                if (SDL_QueueAudio(device_, cvt.buf, static_cast<Uint32>(cvt.len_cvt)) != 0) {
                    Logger::warning(std::string("AudioSystem: SDL_QueueAudio failed: ") +
                                    SDL_GetError());
                    SDL_free(cvt.buf);
                    return false;
                }
                SDL_free(cvt.buf);
            } else if (SDL_QueueAudio(device_, wavBuffer, wavLength) != 0) {
                Logger::warning(std::string("AudioSystem: SDL_QueueAudio failed: ") +
                                SDL_GetError());
                return false;
            }
        }

        return true;
    }

    SDL_AudioDeviceID device_ = 0;
    SDL_AudioSpec obtained_{};
};

} // namespace

namespace rpg {

AudioSystem::AudioSystem()
    : AudioSystem(std::make_unique<SdlAudioBackend>()) {}

AudioSystem::AudioSystem(std::unique_ptr<IAudioBackend> backend)
    : backend_(std::move(backend)) {}

AudioSystem::~AudioSystem() {
    shutdown();
}

std::unordered_map<std::string, std::string> AudioSystem::defaultRegistry() {
    return {
        {"confirm", "assets/audio/confirm.wav"},
        {"cancel", "assets/audio/cancel.wav"},
        {"chest", "assets/audio/chest.wav"},
        {"chest_open", "assets/audio/chest.wav"},
        {"battle", "assets/audio/battle.wav"},
        {"town_bgm", "assets/audio/town_bgm.wav"},
        {"town_theme", "assets/audio/town_bgm.wav"},
    };
}

bool AudioSystem::initialize(const std::unordered_map<std::string, std::string>& registry) {
    registry_ = defaultRegistry();
    registerSounds(registry);

    backendReady_ = backend_ && backend_->initialize();
    if (!backendReady_) {
        Logger::warning("AudioSystem: running without an audio output device");
    }
    return backendReady_;
}

void AudioSystem::shutdown() {
    if (backend_) {
        backend_->shutdown();
    }
    backendReady_ = false;
    currentBgmId_.clear();
}

void AudioSystem::registerSound(const std::string& id, const std::string& path) {
    if (id.empty() || path.empty()) return;
    registry_[id] = path;
}

void AudioSystem::registerSounds(const std::unordered_map<std::string, std::string>& registry) {
    for (const auto& [id, path] : registry) {
        registerSound(id, path);
    }
}

bool AudioSystem::hasSound(const std::string& id) const {
    return registry_.find(id) != registry_.end();
}

std::string AudioSystem::pathFor(const std::string& id) const {
    auto it = registry_.find(id);
    return it == registry_.end() ? std::string{} : it->second;
}

AudioPlaybackResult AudioSystem::playSound(const std::string& id) {
    return playRegistered(id, false);
}

AudioPlaybackResult AudioSystem::playBgm(const std::string& id) {
    if (!id.empty() && id == currentBgmId_) {
        AudioPlaybackResult result;
        result.requested = true;
        result.played = true;
        result.id = id;
        result.path = pathFor(id);
        result.message = "already playing";
        requestedIds_.push_back(id);
        Logger::info("Audio requested: " + id + " -> " + result.path);
        return result;
    }

    if (!currentBgmId_.empty()) {
        stopBgm();
    }
    auto result = playRegistered(id, true);
    if (result.played) currentBgmId_ = id;
    return result;
}

void AudioSystem::stopBgm() {
    if (backendReady_ && backend_) {
        backend_->stopAll();
    }
    currentBgmId_.clear();
}

AudioPlaybackResult AudioSystem::playRegistered(const std::string& id, bool loop) {
    AudioPlaybackResult result;
    result.requested = true;
    result.id = id;
    requestedIds_.push_back(id);

    auto it = registry_.find(id);
    if (it == registry_.end()) {
        result.message = "unknown audio id";
        Logger::warning("AudioSystem: unknown audio id '" + id + "'");
        return result;
    }

    result.path = it->second;
    Logger::info("Audio requested: " + id + " -> " + result.path);

    if (!FileSystem::exists(result.path)) {
        result.message = "missing audio file";
        Logger::warning("AudioSystem: missing audio file for '" + id + "': " + result.path);
        return result;
    }

    if (!backendReady_ || !backend_) {
        result.message = "audio backend unavailable";
        Logger::warning("AudioSystem: audio backend unavailable for '" + id + "'");
        return result;
    }

    result.played = backend_->playWav(result.path, loop);
    if (!result.played) {
        result.message = "audio playback failed";
        Logger::warning("AudioSystem: playback failed for '" + id + "'");
    }
    return result;
}

} // namespace rpg
