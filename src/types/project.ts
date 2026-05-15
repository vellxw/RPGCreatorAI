// Core data model types — matches the C++ runtime JSON schema

export interface ProjectData {
  schemaVersion: number;
  title: string;
  startMapId: string;
  startPosition: {
    x: number;
    y: number;
    direction: Direction;
  };
  maps: MapReference[];
  database: {
    items: string;
  };
}

export interface MapReference {
  id: string;
  path: string;
}

export interface MapData {
  schemaVersion: number;
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  layers: MapLayer[];
  events: GameEvent[];
}

export interface MapLayer {
  name: string;
  type: 'visual' | 'collision';
  tiles: number[];
}

export interface GameEvent {
  id: string;
  type: EventType;
  x: number;
  y: number;
  solid: boolean;
  sprite?: string;
  trigger: TriggerType;
  commands: EventCommand[];
}

export type EventType = 'npc' | 'transfer' | 'chest' | 'object' | 'trigger';
export type TriggerType = 'interact' | 'touch' | 'autorun' | 'parallel';
export type Direction = 'up' | 'down' | 'left' | 'right';

export type EventCommand =
  | ShowTextCommand
  | SetFlagCommand
  | IfFlagCommand
  | AddItemCommand
  | TransferMapCommand
  | PlaySoundCommand;

export interface ShowTextCommand {
  type: 'showText';
  speaker?: string;
  text: string;
}

export interface SetFlagCommand {
  type: 'setFlag';
  flag: string;
  value: boolean;
}

export interface IfFlagCommand {
  type: 'ifFlag';
  flag: string;
  equals: boolean;
  then: EventCommand[];
  else: EventCommand[];
}

export interface AddItemCommand {
  type: 'addItem';
  itemId: string;
  amount: number;
}

export interface TransferMapCommand {
  type: 'transferMap';
  mapId: string;
  x: number;
  y: number;
  direction: Direction;
}

export interface PlaySoundCommand {
  type: 'playSound';
  soundId: string;
}

export interface ItemData {
  id: string;
  name: string;
  description: string;
  type: string;
}

export interface ItemDatabase {
  items: ItemData[];
}

// Editor-specific types
export type Screen = 'editor' | 'events' | 'ai-tools' | 'playtest';

export interface ValidationMessage {
  level: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  status: 'connected' | 'not-connected' | 'coming-later' | 'not-tested';
  model: string;
  apiKey: string;
  capabilities: string[];
  lastTested?: string;
}

export interface PlaytestState {
  running: boolean;
  currentMap: string;
  playerX: number;
  playerY: number;
  direction: Direction;
  flags: Record<string, boolean>;
  inventory: Array<{ itemId: string; name: string; amount: number }>;
  activeEvent: string | null;
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}
