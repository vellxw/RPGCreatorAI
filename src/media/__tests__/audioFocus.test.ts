import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUDIO_FOCUS_POLICY,
  resolveAudioFocus,
  validateAudioFocusPolicy,
  type AudioFocusSnapshot,
} from '../audioFocus';

describe('audio focus contract', () => {
  const ready: AudioFocusSnapshot = {
    focus: 'gained',
    visibility: 'visible',
    userMuted: false,
    voiceActive: false,
    resumeGestureGranted: true,
  };

  it('accepts the default policy and keeps a focused mix active', () => {
    expect(validateAudioFocusPolicy(DEFAULT_AUDIO_FOCUS_POLICY)).toEqual({ valid: true, issues: [] });
    expect(resolveAudioFocus(DEFAULT_AUDIO_FOCUS_POLICY, ready)).toMatchObject({
      mode: 'active',
      masterGain: 1,
      shouldSuspend: false,
    });
  });

  it('suspends hidden or focus-lost playback', () => {
    expect(resolveAudioFocus(DEFAULT_AUDIO_FOCUS_POLICY, { ...ready, visibility: 'hidden' })).toMatchObject({
      mode: 'suspended',
      reason: 'hidden',
      shouldSuspend: true,
    });
    expect(resolveAudioFocus(DEFAULT_AUDIO_FOCUS_POLICY, { ...ready, focus: 'lost' })).toMatchObject({
      mode: 'suspended',
      reason: 'focus-lost',
    });
  });

  it('ducks transient interruptions and background audio under voice', () => {
    expect(resolveAudioFocus(DEFAULT_AUDIO_FOCUS_POLICY, { ...ready, focus: 'lost-transient' })).toMatchObject({
      mode: 'ducked',
      masterGain: 0.2,
      reason: 'focus-duck',
    });
    expect(resolveAudioFocus(DEFAULT_AUDIO_FOCUS_POLICY, { ...ready, voiceActive: true })).toMatchObject({
      mode: 'ducked',
      backgroundGain: 0.35,
      voiceGain: 1,
      reason: 'voice-active',
    });
  });

  it('never resumes a user-muted or gesture-blocked mix', () => {
    expect(resolveAudioFocus(DEFAULT_AUDIO_FOCUS_POLICY, { ...ready, userMuted: true })).toMatchObject({
      mode: 'muted',
      masterGain: 0,
    });
    expect(resolveAudioFocus(DEFAULT_AUDIO_FOCUS_POLICY, { ...ready, resumeGestureGranted: false })).toMatchObject({
      mode: 'blocked',
      requiresUserGesture: true,
    });
  });

  it('rejects gain values that could amplify instead of ducking', () => {
    const report = validateAudioFocusPolicy({ ...DEFAULT_AUDIO_FOCUS_POLICY, duckGain: 1 });
    expect(report.valid).toBe(false);
    expect(report.issues[0]?.code).toBe('invalid-gain');
  });
});
