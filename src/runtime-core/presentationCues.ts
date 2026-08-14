import type {
  VisualNovelAudioAction,
  VisualNovelAudioChannel,
  VisualNovelTransitionStyle,
} from '../dialogue';

/** One-shot renderer work emitted by the deterministic simulation. */
export type RuntimePresentationCue = RuntimeAudioCue | RuntimeTransitionCue;

export interface RuntimeAudioCue {
  type: 'audio';
  channel: VisualNovelAudioChannel;
  action: VisualNovelAudioAction;
  assetId?: string;
  volume?: number;
  loop?: boolean;
  fadeMs?: number;
}

export interface RuntimeTransitionCue {
  type: 'transition';
  style: VisualNovelTransitionStyle;
  durationMs?: number;
  backgroundAssetId?: string;
  /** Removes a renderer-owned VN background when modal presentation closes. */
  clearBackground?: boolean;
}
