export const DEFAULT_AUDIO_REGISTRY: Record<string, string> = {
  confirm: 'assets/audio/confirm.wav',
  cancel: 'assets/audio/cancel.wav',
  chest: 'assets/audio/chest.wav',
  chest_open: 'assets/audio/chest.wav',
  battle: 'assets/audio/battle.wav',
  town_bgm: 'assets/audio/town_bgm.wav',
  town_theme: 'assets/audio/town_bgm.wav',
};

export function mergeAudioRegistry(
  audio: Record<string, string> | undefined,
): Record<string, string> {
  return { ...DEFAULT_AUDIO_REGISTRY, ...(audio ?? {}) };
}

export function audioOptions(audio: Record<string, string> | undefined): Array<{ value: string; label: string }> {
  return Object.keys(mergeAudioRegistry(audio)).map(id => ({ value: id, label: id }));
}
