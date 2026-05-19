#pragma once

#include "types/Direction.h"
#include "types/Vec2i.h"
#include <string>
#include <vector>

struct AnimationClip {
    std::string action;
    std::string direction;
    std::string asset;
    struct {
        int width = 64;
        int height = 64;
    } frameSize;
    int frameCount = 1;
    float fps = 1.0f;
    bool loop = true;
    Vec2i anchor{32, 54};
};

struct AnimationSet {
    std::string id;
    std::vector<AnimationClip> clips;
};

class AnimationDatabase {
public:
    bool load(const std::string& path);
    const AnimationClip* findClip(const std::string& setId,
                                  const std::string& action,
                                  Direction direction) const;
    const AnimationClip* findClip(const std::string& setId,
                                  const std::string& action,
                                  const std::string& direction) const;
    const std::vector<AnimationSet>& sets() const { return sets_; }

private:
    std::vector<AnimationSet> sets_;
};
