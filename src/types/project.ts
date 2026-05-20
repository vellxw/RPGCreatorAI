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
  database: DatabasePaths;
  visualProfile?: import('../visual/visualProfile').VisualProfileInput;
}

export interface DatabasePaths {
  items: string;
  actors?: string;
  classes?: string;
  skills?: string;
  enemies?: string;
  troops?: string;
  quests?: string;
  shops?: string;
  system?: string;
  switches?: string;
  variables?: string;
  commonEvents?: string;
  animations?: string;
}

export type DatabaseKey = keyof Omit<DatabasePaths, 'items'>;

export interface MapReference {
  id: string;
  path: string;
  parentId?: string | null;
  order?: number;
  expanded?: boolean;
}

export interface MapData {
  schemaVersion: number;
  id: string;
  name: string;
  displayName?: string;
  tilesetId?: string;
  scrollType?: MapScrollType;
  battleback?: string;
  encounterSteps?: number;
  encounters?: MapEncounter[];
  parallax?: MapParallax;
  width: number;
  height: number;
  tileSize: number;
  layers: MapLayer[];
  events: GameEvent[];
}

export type MapScrollType = 'none' | 'vertical' | 'horizontal' | 'both';

export interface MapEncounter {
  troopId: string;
  weight: number;
  regionIds?: number[];
}

export interface MapParallax {
  image?: string;
  loopX?: boolean;
  loopY?: boolean;
  scrollX?: number;
  scrollY?: number;
}

export interface MapLayer {
  name: string;
  type: 'visual' | 'collision' | 'region';
  role?: 'ground' | 'decoration' | 'foreground' | 'collision' | 'region';
  visible?: boolean;
  locked?: boolean;
  tiles: number[];
}

export interface GameEvent {
  id: string;
  type: EventType;
  x: number;
  y: number;
  solid: boolean;
  sprite?: string;
  animationSet?: string;
  displayHeightTiles?: number;
  trigger: TriggerType;
  commands: EventCommand[];
}

export type EventType = 'npc' | 'transfer' | 'chest' | 'object' | 'trigger';
export type TriggerType = 'interact' | 'touch' | 'autorun' | 'parallel';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type MovementSpeed = 'oneEighth' | 'oneQuarter' | 'half' | 'normal' | 'double' | 'quadruple';

// ---------------------------------------------------------------------------
// Event commands
// ---------------------------------------------------------------------------

export type EventCommand =
  | ShowTextCommand
  | ShowChoicesCommand
  | SetFlagCommand
  | IfFlagCommand
  | IfSwitchCommand
  | IfVariableCommand
  | ControlSwitchCommand
  | ControlVariableCommand
  | AddItemCommand
  | RemoveItemCommand
  | AddGoldCommand
  | RemoveGoldCommand
  | TransferMapCommand
  | SetPlayerPositionCommand
  | WaitCommand
  | PlaySoundCommand
  | CommentCommand
  | CallCommonEventCommand
  | StartQuestCommand
  | UpdateQuestObjectiveCommand
  | CompleteQuestCommand
  | OpenShopCommand
  | StartBattleCommand
  | ChangeActorHpCommand
  | PlayAnimationCommand;

export interface ShowTextCommand {
  type: 'showText';
  speaker?: string;
  text: string;
}

export interface ShowChoicesCommand {
  type: 'showChoices';
  prompt: string;
  choices: Array<{ label: string; commands: EventCommand[] }>;
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

export interface IfSwitchCommand {
  type: 'ifSwitch';
  switchId: string;
  equals: boolean;
  then: EventCommand[];
  else: EventCommand[];
}

export type VariableComparison = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface IfVariableCommand {
  type: 'ifVariable';
  variableId: string;
  op: VariableComparison;
  value: number;
  then: EventCommand[];
  else: EventCommand[];
}

export interface ControlSwitchCommand {
  type: 'controlSwitch';
  switchId: string;
  value: boolean;
}

export type VariableOp = 'set' | 'add' | 'sub' | 'mul' | 'div' | 'mod';

export interface ControlVariableCommand {
  type: 'controlVariable';
  variableId: string;
  op: VariableOp;
  value: number;
  sourceVariableId?: string;
}

export interface AddItemCommand {
  type: 'addItem';
  itemId: string;
  amount: number;
}

export interface RemoveItemCommand {
  type: 'removeItem';
  itemId: string;
  amount: number;
}

export interface AddGoldCommand {
  type: 'addGold';
  amount: number;
}

export interface RemoveGoldCommand {
  type: 'removeGold';
  amount: number;
}

export interface TransferMapCommand {
  type: 'transferMap';
  mapId: string;
  x: number;
  y: number;
  direction: Direction;
}

export interface SetPlayerPositionCommand {
  type: 'setPlayerPosition';
  mapId: string;
  x: number;
  y: number;
  direction: Direction;
}

export interface WaitCommand {
  type: 'wait';
  ms: number;
}

export interface PlaySoundCommand {
  type: 'playSound';
  soundId: string;
}

export interface CommentCommand {
  type: 'comment';
  text: string;
}

export interface CallCommonEventCommand {
  type: 'callCommonEvent';
  commonEventId: string;
}

export interface StartQuestCommand {
  type: 'startQuest';
  questId: string;
}

export interface UpdateQuestObjectiveCommand {
  type: 'updateQuestObjective';
  questId: string;
  objectiveId: string;
  state: 'open' | 'done';
}

export interface CompleteQuestCommand {
  type: 'completeQuest';
  questId: string;
}

export interface OpenShopCommand {
  type: 'openShop';
  shopId: string;
}

export interface StartBattleCommand {
  type: 'startBattle';
  troopId: string;
  canEscape: boolean;
  victoryBranch?: EventCommand[];
  defeatBranch?: EventCommand[];
}

export interface ChangeActorHpCommand {
  type: 'changeActorHp';
  actorId: string;
  delta: number;
}

export type AnimationTarget = 'player' | 'thisEvent' | 'event';
export type AnimationDirection = Direction | 'current';

export interface PlayAnimationCommand {
  type: 'playAnimation';
  target: AnimationTarget;
  eventId?: string;
  action: string;
  direction: AnimationDirection;
  durationMs: number;
  blocking: boolean;
  loop?: boolean;
}

// ---------------------------------------------------------------------------
// Database entries
// ---------------------------------------------------------------------------

export interface ItemData {
  id: string;
  name: string;
  description: string;
  type: string;
  price?: number;
  /**
   * For 'weapon' or 'armor': stat modifiers applied while equipped.
   * For 'consumable': effect applied when used.
   */
  modifiers?: Partial<Stats>;
  effect?: ItemEffect;
  slot?: EquipmentSlot;
}

export type ItemEffect = {
  hp?: number;
  mp?: number;
};

export interface ItemDatabase {
  items: ItemData[];
}

export interface Stats {
  maxHp: number;
  maxMp: number;
  attack: number;
  defense: number;
  magicAttack: number;
  magicDefense: number;
  agility: number;
  luck: number;
}

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export interface ActorData {
  id: string;
  name: string;
  classId: string;
  level: number;
  hp: number;
  mp: number;
  baseStats: Stats;
  equipment: Partial<Record<EquipmentSlot, string | null>>;
  skills: string[];
}

export interface ClassData {
  id: string;
  name: string;
  growth: Stats;
  usableEquipment: EquipmentSlot[];
  learnedSkills: Array<{ level: number; skillId: string }>;
}

export interface SkillData {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  power: number;
  target: 'singleEnemy' | 'allEnemies' | 'singleAlly' | 'allAllies' | 'self';
  element?: string;
}

export interface EnemyDrop {
  itemId: string;
  rate: number; // 0..1
}

export interface EnemyData {
  id: string;
  name: string;
  stats: Stats;
  exp: number;
  gold: number;
  drops: EnemyDrop[];
}

export interface TroopData {
  id: string;
  name: string;
  members: string[];
}

export interface ObjectiveData {
  id: string;
  description: string;
}

export interface QuestRewards {
  gold: number;
  exp: number;
  items: Array<{ itemId: string; amount: number }>;
}

export interface QuestData {
  id: string;
  title: string;
  summary: string;
  objectives: ObjectiveData[];
  rewards: QuestRewards;
}

export interface ShopListing {
  itemId: string;
  price: number;
}

export interface ShopData {
  id: string;
  name: string;
  listings: ShopListing[];
}

export interface SystemData {
  startingParty: string[];
  startingGold: number;
  defaultBgm?: string;
  windowTint?: string;
  battleBackground?: string;
  playerAnimationSet?: string;
  playerMovementSpeed?: MovementSpeed;
  defaultCharacterHeightTiles?: number;
}

export interface SwitchData {
  id: string;
  name: string;
  initial: boolean;
}

export interface VariableData {
  id: string;
  name: string;
  initial: number;
}

export interface CommonEventData {
  id: string;
  name: string;
  trigger: 'manual' | 'autorun' | 'parallel';
  commands: EventCommand[];
}

export interface AnimationClipData {
  action: string;
  direction: Direction | 'any';
  asset: string;
  frameSize: { width: number; height: number };
  frameCount: number;
  fps: number;
  loop: boolean;
  anchor: { x: number; y: number };
}

export interface AnimationSetDisplayData {
  heightTiles: number;
  widthTiles?: number;
  yOffsetPx?: number;
}

export interface AnimationSetData {
  id: string;
  display?: AnimationSetDisplayData;
  clips: AnimationClipData[];
}

export interface AnimationDatabaseData {
  sets: AnimationSetData[];
}

export interface DatabaseEntries {
  actors: ActorData[];
  classes: ClassData[];
  skills: SkillData[];
  enemies: EnemyData[];
  troops: TroopData[];
  quests: QuestData[];
  shops: ShopData[];
  switches: SwitchData[];
  variables: VariableData[];
  commonEvents: CommonEventData[];
  animations: AnimationDatabaseData;
  system: SystemData;
}

export type DatabaseListKey = Exclude<keyof DatabaseEntries, 'system' | 'animations'>;

// Editor-specific types
export type Screen = 'editor' | 'events' | 'database' | 'ai-tools' | 'playtest';

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
