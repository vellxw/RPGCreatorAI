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
  assetCatalog?: string;
  visualProfile?: import('../visual/visualProfile').VisualProfileInput;
}

export interface DatabasePaths {
  items: string;
  actors?: string;
  classes?: string;
  skills?: string;
  weapons?: string;
  armors?: string;
  states?: string;
  types?: string;
  terms?: string;
  enemies?: string;
  troops?: string;
  quests?: string;
  shops?: string;
  system?: string;
  switches?: string;
  variables?: string;
  commonEvents?: string;
  animations?: string;
  tilesets?: string;
  audio?: string;
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
  bgm?: string;
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

export type TilePassability = 'passable' | 'blocked';

export interface TilesetTileMetadata {
  id: number;
  name: string;
  asset: string;
  group: 'A' | 'B' | 'C' | 'D' | 'E' | 'Region' | 'Collision';
  passability: TilePassability;
  directionalPassability?: Partial<Record<Direction, boolean>>;
  terrainTag?: string;
  ladder?: boolean;
  bush?: boolean;
  counter?: boolean;
  damage?: boolean;
  priority?: number;
}

export interface TilesetData {
  id: string;
  name: string;
  tileSize: number;
  tiles: TilesetTileMetadata[];
}

export interface TilesetDatabaseData {
  tilesets: TilesetData[];
}

export type AssetKind = 'image' | 'spritesheet' | 'tileset' | 'audio' | 'generated';
export type AssetSource = 'local' | 'generated' | 'imported';

export interface GeneratedAssetMetadata {
  prompt?: string;
  tool?: string;
  createdAt?: string;
  promptTemplateId?: string;
  promptTemplateVersion?: number;
  promptTemplateKind?: string;
  promptInputs?: Record<string, string>;
  providerId?: string;
  modelId?: string;
  operation?: string;
  sourceAssetId?: string;
  sourceAssetPath?: string;
  maskAssetId?: string;
  referenceAssetIds?: string[];
  editMode?: 'edit' | 'variation';
  imageSettings?: Partial<ProviderImageGenerationSettings>;
  visualContextSource?: string;
  visualContextVersion?: string;
}

export interface AssetCatalogEntry {
  id: string;
  name: string;
  kind: AssetKind;
  path: string;
  source: AssetSource;
  tags?: string[];
  provenance?: string;
  runtimeCompatible?: boolean;
  runtimeNotes?: string;
  notes?: string;
  protected?: boolean;
  width?: number;
  height?: number;
  frameWidth?: number;
  frameHeight?: number;
  frames?: number;
  durationMs?: number;
  generated?: GeneratedAssetMetadata;
}

export interface AssetCatalogData {
  schemaVersion: number;
  assets: AssetCatalogEntry[];
}

export interface GameEvent {
  id: string;
  type: EventType;
  x: number;
  y: number;
  solid: boolean;
  sprite?: string;
  animationSet?: string;
  portraitAssetId?: string;
  displayHeightTiles?: number;
  trigger: TriggerType;
  commands: EventCommand[];
  pages?: EventPage[];
}

export type EventType = 'npc' | 'transfer' | 'chest' | 'object' | 'trigger';
export type TriggerType = 'interact' | 'touch' | 'autorun' | 'parallel';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type MovementSpeed = 'oneEighth' | 'oneQuarter' | 'half' | 'normal' | 'double' | 'quadruple';
export type SelfSwitchId = 'A' | 'B' | 'C' | 'D';
export type EventPriority = 'belowCharacters' | 'sameAsCharacters' | 'aboveCharacters';

export interface EventPageConditions {
  switches?: Record<string, boolean>;
  variables?: Array<{ variableId: string; op: VariableComparison; value: number }>;
  selfSwitches?: Partial<Record<string, boolean>>;
}

export interface EventPageGraphic {
  sprite?: string;
  animationSet?: string;
  displayHeightTiles?: number;
}

export interface EventPageMovement {
  type: 'fixed' | 'random' | 'approach' | 'custom';
  speed: MovementSpeed;
}

export interface EventPageOptions {
  walking: boolean;
  stepping: boolean;
  directionFix: boolean;
  through: boolean;
}

export interface EventPage {
  id: string;
  name?: string;
  conditions: EventPageConditions;
  graphic: EventPageGraphic;
  movement: EventPageMovement;
  options: EventPageOptions;
  priority: EventPriority;
  trigger: TriggerType;
  commands: EventCommand[];
}

// ---------------------------------------------------------------------------
// Event commands
// ---------------------------------------------------------------------------

export type EventCommand =
  | ShowTextCommand
  | ShowChoicesCommand
  | SetFlagCommand
  | IfFlagCommand
  | IfSwitchCommand
  | IfSelfSwitchCommand
  | IfVariableCommand
  | ControlSwitchCommand
  | ControlSelfSwitchCommand
  | ControlVariableCommand
  | AddItemCommand
  | RemoveItemCommand
  | AddGoldCommand
  | RemoveGoldCommand
  | TransferMapCommand
  | SetPlayerPositionCommand
  | WaitCommand
  | PlaySoundCommand
  | PluginCommand
  | CommentCommand
  | CallCommonEventCommand
  | StartQuestCommand
  | UpdateQuestObjectiveCommand
  | CompleteQuestCommand
  | OpenShopCommand
  | StartBattleCommand
  | ChangeActorHpCommand
  | PlayAnimationCommand
  | SetMovementRouteCommand;

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

export interface IfSelfSwitchCommand {
  type: 'ifSelfSwitch';
  switchId: SelfSwitchId;
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

export interface ControlSelfSwitchCommand {
  type: 'controlSelfSwitch';
  switchId: SelfSwitchId;
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

export type PluginCommandArg = string | number | boolean | null;

export interface PluginCommand {
  type: 'pluginCommand';
  pluginId: string;
  command: string;
  args: Record<string, PluginCommandArg>;
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

export type MovementRouteTarget = 'player' | 'thisEvent' | 'event';
export type MovementRouteStepType =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'turnUp'
  | 'turnDown'
  | 'turnLeft'
  | 'turnRight'
  | 'wait';

export interface MovementRouteStep {
  type: MovementRouteStepType;
  ms?: number;
}

export interface SetMovementRouteCommand {
  type: 'setMovementRoute';
  target: MovementRouteTarget;
  eventId?: string;
  repeat: boolean;
  skippable: boolean;
  wait: boolean;
  steps: MovementRouteStep[];
}

// ---------------------------------------------------------------------------
// Database entries
// ---------------------------------------------------------------------------

export interface ItemData {
  id: string;
  name: string;
  description: string;
  type: string;
  iconAssetId?: string;
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

export interface NamedTypeEntry {
  id: string;
  name: string;
}

export interface TypesDatabaseData {
  weaponTypes: NamedTypeEntry[];
  armorTypes: NamedTypeEntry[];
  skillTypes: NamedTypeEntry[];
  elements: NamedTypeEntry[];
  equipmentSlots: NamedTypeEntry[];
  itemCategories: NamedTypeEntry[];
}

export type StatTerms = Record<keyof Stats, string>;

export interface MenuTerms {
  item: string;
  skill: string;
  equip: string;
  status: string;
  formation: string;
  options: string;
  save: string;
  load: string;
}

export interface CommandTerms {
  attack: string;
  guard: string;
  item: string;
  skill: string;
  escape: string;
}

export interface BattleTerms {
  fight: string;
  escape: string;
  victory: string;
  defeat: string;
  exp: string;
  levelUp: string;
}

export interface SaveLoadTerms {
  save: string;
  load: string;
  file: string;
  empty: string;
}

export interface TermsDatabaseData {
  currencyUnit: string;
  stats: StatTerms;
  menu: MenuTerms;
  commands: CommandTerms;
  battle: BattleTerms;
  saveLoad: SaveLoadTerms;
}

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export type ArmorSlot = 'shield' | 'head' | 'body' | 'accessory';

export interface WeaponData {
  id: string;
  name: string;
  description: string;
  weaponTypeId: string;
  iconAssetId?: string;
  price?: number;
  params?: Partial<Stats>;
  animationId?: string;
  traits?: string[];
}

export interface ArmorData {
  id: string;
  name: string;
  description: string;
  armorTypeId: string;
  slot: ArmorSlot;
  iconAssetId?: string;
  price?: number;
  params?: Partial<Stats>;
  traits?: string[];
}

export interface StateData {
  id: string;
  name: string;
  priority: number;
  removeAtBattleEnd: boolean;
  restriction?: 'none' | 'cannotMove';
  traits: string[];
}

export interface ActorData {
  id: string;
  name: string;
  classId: string;
  portraitAssetId?: string;
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
  audio?: Record<string, string>;
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
  switchId?: string;
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

export interface AudioRegistryEntry {
  id: string;
  path: string;
}

export interface AudioDatabaseData {
  audio?: Record<string, string>;
  sounds?: AudioRegistryEntry[];
  bgm?: AudioRegistryEntry[];
}

export interface DatabaseEntries {
  actors: ActorData[];
  classes: ClassData[];
  skills: SkillData[];
  weapons: WeaponData[];
  armors: ArmorData[];
  states: StateData[];
  types: TypesDatabaseData;
  terms: TermsDatabaseData;
  enemies: EnemyData[];
  troops: TroopData[];
  quests: QuestData[];
  shops: ShopData[];
  switches: SwitchData[];
  variables: VariableData[];
  commonEvents: CommonEventData[];
  animations: AnimationDatabaseData;
  tilesets: TilesetDatabaseData;
  system: SystemData;
  audio?: AudioDatabaseData;
}

export type DatabaseListKey = Exclude<
  keyof DatabaseEntries,
  'system' | 'animations' | 'tilesets' | 'types' | 'terms' | 'audio'
>;

// Editor-specific types
export type Screen = 'editor' | 'events' | 'database' | 'assets' | 'playtest' | 'settings';

export interface ValidationMessage {
  level: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  status: 'disabled' | 'missing-credentials' | 'configured';
  model: string;
  credentialEnvVar?: string;
  credentialState: 'missing' | 'configured' | 'not-required';
  capabilities: string[];
  costEstimateAvailability?: 'free' | 'estimated' | 'unknown';
  rateLimitStatus?: 'not-applicable' | 'provider-managed' | 'unknown';
  requiresPaidJobConfirmation?: boolean;
  expensiveJobThresholdUsd?: number;
  imageSettings?: ProviderImageGenerationSettings;
  notes?: string;
  lastChecked?: string;
}

export type ProviderImageQuality = 'auto' | 'low' | 'medium' | 'high';
export type ProviderImageSize =
  | 'auto'
  | '1024x1024'
  | '1024x1536'
  | '1536x1024'
  | '2048x2048'
  | '2048x1152'
  | '3840x2160'
  | '2160x3840';
export type ProviderImageOutputFormat = 'png' | 'webp' | 'jpeg';
export type ProviderImageBackground = 'auto' | 'opaque';
export type ProviderImageModeration = 'auto' | 'low';
export type ProviderImageStyle =
  | 'project-default'
  | 'pixel-art'
  | 'painted'
  | 'clean-ui';

export interface ProviderImageGenerationSettings {
  modelId: string;
  quality: ProviderImageQuality;
  size: ProviderImageSize;
  style: ProviderImageStyle;
  outputFormat: ProviderImageOutputFormat;
  outputCompression?: number;
  background: ProviderImageBackground;
  moderation: ProviderImageModeration;
  styleIsApiParameter: boolean;
  docsCheckedAt: string;
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
