export const VISUAL_NOVEL_SCHEMA_VERSION = 1 as const;

export type VisualNovelValue = string | number | boolean | null;
export type VisualNovelVariables = Record<string, VisualNovelValue>;

export type VisualNovelComparisonOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'truthy'
  | 'falsy';

export interface VisualNovelCondition {
  variable: string;
  operator: VisualNovelComparisonOperator;
  value?: VisualNovelValue;
}

export type VisualNovelVariableEffect =
  | { operation: 'set'; variable: string; value: VisualNovelValue }
  | {
      operation: 'add';
      variable: string;
      value: number;
      /** Optional authored bounds. Older v1 documents remain valid without it. */
      clamp?: { min: number; max: number };
    };

export interface VisualNovelPortrait {
  assetId: string;
  expression?: string;
  position?: 'left' | 'center' | 'right';
  mirror?: boolean;
}

interface VisualNovelNodeBase {
  id: string;
}

export interface VisualNovelDialogueNode extends VisualNovelNodeBase {
  type: 'dialogue';
  text: string;
  /** Character name shown in the nameplate. Empty/omitted means narration. */
  speaker?: string;
  portrait?: VisualNovelPortrait;
  voiceAssetId?: string;
  next?: string;
}

export interface VisualNovelChoice {
  id: string;
  text: string;
  next: string;
  conditions?: VisualNovelCondition[];
  effects?: VisualNovelVariableEffect[];
}

export interface VisualNovelChoiceNode extends VisualNovelNodeBase {
  type: 'choice';
  prompt?: string;
  choices: VisualNovelChoice[];
}

export interface VisualNovelVariableNode extends VisualNovelNodeBase {
  type: 'variable';
  effect: VisualNovelVariableEffect;
  next: string;
}

export type VisualNovelTransitionStyle = 'cut' | 'fade' | 'dissolve' | 'slide' | 'flash';

export interface VisualNovelTransitionNode extends VisualNovelNodeBase {
  type: 'transition';
  style: VisualNovelTransitionStyle;
  durationMs?: number;
  backgroundAssetId?: string;
  next: string;
}

export type VisualNovelAudioChannel = 'bgm' | 'ambient' | 'sfx' | 'voice';
export type VisualNovelAudioAction = 'play' | 'stop' | 'fade';

export interface VisualNovelAudioNode extends VisualNovelNodeBase {
  type: 'audio';
  channel: VisualNovelAudioChannel;
  action: VisualNovelAudioAction;
  assetId?: string;
  volume?: number;
  loop?: boolean;
  fadeMs?: number;
  next: string;
}

export interface VisualNovelEndingNode extends VisualNovelNodeBase {
  type: 'ending';
  endingId: string;
  title?: string;
  kind?: 'good' | 'bad' | 'neutral' | 'secret';
}

export type VisualNovelNode =
  | VisualNovelDialogueNode
  | VisualNovelChoiceNode
  | VisualNovelVariableNode
  | VisualNovelTransitionNode
  | VisualNovelAudioNode
  | VisualNovelEndingNode;

export interface VisualNovelScene {
  id: string;
  title?: string;
  entryNodeId: string;
  initialVariables?: VisualNovelVariables;
  nodes: VisualNovelNode[];
}

/** Canonical VN payload embedded in GameBundle v1. */
export interface VisualNovelContentV1 {
  schemaVersion: typeof VISUAL_NOVEL_SCHEMA_VERSION;
  scenes: Record<string, VisualNovelScene>;
}
