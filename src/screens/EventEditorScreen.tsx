import { useState, type ReactNode } from 'react';
import { useProjectStore, getEventsByMap, flattenCommands } from '../stores/projectStore';
import { useEditor } from '../stores/editorStore';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  GitBranch,
  Backpack,
  Coins,
  Flag,
  ToggleLeft,
  Binary,
  MapPinned,
  Volume2,
  Timer,
  NotebookPen,
  Repeat,
  ScrollText,
  CheckCheck,
  Store,
  Swords,
  HeartPulse,
  Clapperboard,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { CommandEditor } from '../components/events/CommandEditor';
import { validateEvent } from '../validation/validateMap';
import type { EventCommand, EventType, GameEvent, MapData, TriggerType, Direction } from '../types/project';
import { eventAssets } from '../assets/generated/assetCatalog';

function makePlaceholderCommand(type: EventCommand['type']): EventCommand {
  switch (type) {
    case 'showText':
      return { type: 'showText', text: 'New dialogue' };
    case 'showChoices':
      return { type: 'showChoices', prompt: 'Choose:', choices: [{ label: 'Yes', commands: [] }, { label: 'No', commands: [] }] };
    case 'setFlag':
      return { type: 'setFlag', flag: 'flag_name', value: true };
    case 'ifFlag':
      return { type: 'ifFlag', flag: 'flag_name', equals: true, then: [], else: [] };
    case 'ifSwitch':
      return { type: 'ifSwitch', switchId: '', equals: true, then: [], else: [] };
    case 'ifVariable':
      return { type: 'ifVariable', variableId: '', op: 'eq', value: 0, then: [], else: [] };
    case 'controlSwitch':
      return { type: 'controlSwitch', switchId: '', value: true };
    case 'controlVariable':
      return { type: 'controlVariable', variableId: '', op: 'set', value: 0 };
    case 'addItem':
      return { type: 'addItem', itemId: '', amount: 1 };
    case 'removeItem':
      return { type: 'removeItem', itemId: '', amount: 1 };
    case 'addGold':
      return { type: 'addGold', amount: 10 };
    case 'removeGold':
      return { type: 'removeGold', amount: 10 };
    case 'transferMap':
      return { type: 'transferMap', mapId: '', x: 0, y: 0, direction: 'down' };
    case 'setPlayerPosition':
      return { type: 'setPlayerPosition', mapId: '', x: 0, y: 0, direction: 'down' };
    case 'wait':
      return { type: 'wait', ms: 250 };
    case 'playSound':
      return { type: 'playSound', soundId: '' };
    case 'comment':
      return { type: 'comment', text: '' };
    case 'callCommonEvent':
      return { type: 'callCommonEvent', commonEventId: '' };
    case 'startQuest':
      return { type: 'startQuest', questId: '' };
    case 'updateQuestObjective':
      return { type: 'updateQuestObjective', questId: '', objectiveId: '', state: 'done' };
    case 'completeQuest':
      return { type: 'completeQuest', questId: '' };
    case 'openShop':
      return { type: 'openShop', shopId: '' };
    case 'startBattle':
      return { type: 'startBattle', troopId: '', canEscape: false };
    case 'changeActorHp':
      return { type: 'changeActorHp', actorId: '', delta: -1 };
    case 'playAnimation':
      return {
        type: 'playAnimation',
        target: 'player',
        action: 'interact',
        direction: 'current',
        durationMs: 300,
        blocking: true,
        loop: false,
      };
  }
}

function EventList() {
  const { state: project } = useProjectStore();
  const { state: editor, dispatch } = useEditor();
  const eventsByMap = getEventsByMap(project);
  const [expandedMaps, setExpandedMaps] = useState<Record<string, boolean>>({ town: true, house: true });

  const toggleMap = (mapId: string) => {
    setExpandedMaps(prev => ({ ...prev, [mapId]: !prev[mapId] }));
  };

  return (
    <div className="w-[200px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
        <span className="text-[13px] font-semibold text-gray-700">Events</span>
        <Plus size={14} className="text-gray-400 cursor-pointer hover:text-indigo-600" />
      </div>
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            className="w-full pl-7 pr-2 py-1.5 text-[12px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {Object.entries(eventsByMap).map(([mapId, { mapName, events }]) => (
          <div key={mapId}>
            <button
              onClick={() => toggleMap(mapId)}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
            >
              {expandedMaps[mapId] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-[13px] font-medium text-gray-700">{mapName}</span>
            </button>
            {expandedMaps[mapId] &&
              events.map(event => (
                <button
                  key={event.id}
                  onClick={() => dispatch({ type: 'SELECT_EVENT', event, mapId })}
                  className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-left cursor-pointer ${
                    editor.selectedEvent?.id === event.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <img src={eventAssets[event.type]} alt="" className="w-4 h-4" />
                  <span className="text-[13px] truncate">{event.id}</span>
                  {editor.selectedEvent?.id === event.id && (
                    <MoreVertical size={12} className="ml-auto text-gray-400" />
                  )}
                </button>
              ))}
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-gray-200">
        <button className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 cursor-pointer font-medium">
          <Plus size={12} />
          Add Event
        </button>
      </div>
    </div>
  );
}

interface CommandCardProps {
  index: number;
  command: EventCommand;
  selected: boolean;
  onSelect: () => void;
  depth: number;
}

function CommandCard({ index, command, selected, onSelect, depth }: CommandCardProps) {
  const icons: Record<string, { icon: ReactNode; color: string; bg: string }> = {
    showText: { icon: <MessageSquare size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    showChoices: { icon: <GitBranch size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    ifFlag: { icon: <Flag size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
    ifSwitch: { icon: <GitBranch size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
    ifVariable: { icon: <Binary size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
    addItem: { icon: <Backpack size={18} />, color: 'text-green-600', bg: 'bg-green-50' },
    removeItem: { icon: <Backpack size={18} />, color: 'text-green-600', bg: 'bg-green-50' },
    addGold: { icon: <Coins size={18} />, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    removeGold: { icon: <Coins size={18} />, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    setFlag: { icon: <Flag size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
    controlSwitch: { icon: <ToggleLeft size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
    controlVariable: { icon: <Binary size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
    transferMap: { icon: <MapPinned size={18} />, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    setPlayerPosition: { icon: <MapPinned size={18} />, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    playSound: { icon: <Volume2 size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
    wait: { icon: <Timer size={18} />, color: 'text-gray-600', bg: 'bg-gray-50' },
    comment: { icon: <NotebookPen size={18} />, color: 'text-gray-500', bg: 'bg-gray-50' },
    callCommonEvent: { icon: <Repeat size={18} />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    startQuest: { icon: <ScrollText size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    updateQuestObjective: { icon: <CheckCheck size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    completeQuest: { icon: <CheckCheck size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    openShop: { icon: <Store size={18} />, color: 'text-pink-600', bg: 'bg-pink-50' },
    startBattle: { icon: <Swords size={18} />, color: 'text-rose-600', bg: 'bg-rose-50' },
    changeActorHp: { icon: <HeartPulse size={18} />, color: 'text-rose-600', bg: 'bg-rose-50' },
    playAnimation: { icon: <Clapperboard size={18} />, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
  };
  const info = icons[command.type] || { icon: <NotebookPen size={18} />, color: 'text-gray-600', bg: 'bg-gray-50' };

  const titles: Record<string, string> = {
    showText: 'Show Text',
    showChoices: 'Show Choices',
    ifFlag: 'If Flag',
    ifSwitch: 'If Switch',
    ifVariable: 'If Variable',
    addItem: 'Add Item',
    removeItem: 'Remove Item',
    addGold: 'Add Gold',
    removeGold: 'Remove Gold',
    setFlag: 'Set Flag',
    controlSwitch: 'Control Switch',
    controlVariable: 'Control Variable',
    transferMap: 'Transfer Map',
    setPlayerPosition: 'Set Player Position',
    playSound: 'Play Sound',
    wait: 'Wait',
    comment: 'Comment',
    callCommonEvent: 'Call Common Event',
    startQuest: 'Start Quest',
    updateQuestObjective: 'Update Quest Objective',
    completeQuest: 'Complete Quest',
    openShop: 'Open Shop',
    startBattle: 'Start Battle',
    changeActorHp: 'Change Actor HP',
    playAnimation: 'Play Animation',
  };

  const getDescription = (cmd: EventCommand): string => {
    switch (cmd.type) {
      case 'showText': return cmd.text;
      case 'showChoices': return `${cmd.prompt} (${cmd.choices.length} choices)`;
      case 'ifFlag': return `${cmd.flag} is ${cmd.equals ? 'ON' : 'OFF'}`;
      case 'ifSwitch': return `${cmd.switchId} is ${cmd.equals ? 'ON' : 'OFF'}`;
      case 'ifVariable': return `${cmd.variableId} ${cmd.op} ${cmd.value}`;
      case 'addItem':
      case 'removeItem': return `Item: ${cmd.itemId} × ${cmd.amount}`;
      case 'addGold':
      case 'removeGold': return `${cmd.amount} gold`;
      case 'setFlag': return `${cmd.flag} → ${cmd.value ? 'ON' : 'OFF'}`;
      case 'controlSwitch': return `${cmd.switchId} → ${cmd.value ? 'ON' : 'OFF'}`;
      case 'controlVariable': return `${cmd.variableId} ${cmd.op} ${cmd.value}`;
      case 'transferMap':
      case 'setPlayerPosition': return `Map: ${cmd.mapId}  Location: (${cmd.x}, ${cmd.y})`;
      case 'playSound': return cmd.soundId;
      case 'wait': return `${cmd.ms} ms`;
      case 'comment': return cmd.text;
      case 'callCommonEvent': return cmd.commonEventId;
      case 'startQuest':
      case 'completeQuest': return cmd.questId;
      case 'updateQuestObjective': return `${cmd.questId}/${cmd.objectiveId} → ${cmd.state}`;
      case 'openShop': return cmd.shopId;
      case 'startBattle': return `Troop: ${cmd.troopId}${cmd.canEscape ? ' (escapable)' : ''}`;
      case 'changeActorHp': return `${cmd.actorId} ${cmd.delta >= 0 ? '+' : ''}${cmd.delta}`;
      case 'playAnimation': return `${cmd.target}${cmd.eventId ? `:${cmd.eventId}` : ''} → ${cmd.action}`;
      default: return (cmd as { type: string }).type;
    }
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ marginLeft: depth * 16 }}
      className={`w-full flex items-start gap-3 p-3 border rounded-lg transition-shadow text-left cursor-pointer ${
        selected
          ? 'bg-indigo-50 border-indigo-300 shadow-sm'
          : 'bg-white border-gray-200 hover:shadow-sm'
      }`}
    >
      <span className="text-[12px] text-gray-400 font-mono mt-1 w-4">{index}</span>
      <div className={`w-9 h-9 rounded-lg ${info.bg} ${info.color} flex items-center justify-center text-lg flex-shrink-0`}>
        {info.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-gray-800">{titles[command.type] || command.type}</span>
          {(command.type === 'ifFlag' || command.type === 'ifSwitch' || command.type === 'ifVariable' || command.type === 'showChoices' || command.type === 'startBattle') && (
            <Badge variant="info">Branch</Badge>
          )}
        </div>
        <p className="text-[12px] text-gray-500 mt-0.5 truncate">{getDescription(command)}</p>
      </div>
    </button>
  );
}

function CommandStack({ event, mapId }: { event: GameEvent; mapId: string }) {
  const { state: project, dispatch: projectDispatch } = useProjectStore();
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);

  const flat = flattenCommands(event.commands);
  const mapIds = Object.keys(project.maps);
  const itemIds = project.items.items.map(i => i.id);

  const findCommandAtPath = (path: number[]): EventCommand | null => {
    let cmds: EventCommand[] = event.commands;
    for (let i = 0; i < path.length; i++) {
      const idx = path[i];
      if (i === path.length - 1) return cmds[idx] ?? null;
      const branchIdx = path[i + 1];
      const cmd = cmds[idx];
      if (cmd?.type !== 'ifFlag') return null;
      cmds = branchIdx === 0 ? cmd.then : cmd.else;
      i += 1; // skip the branch index slot
    }
    return null;
  };

  const samePath = (a: number[] | null, b: number[]) => {
    if (!a || a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  };

  const selectedCommand = selectedPath ? findCommandAtPath(selectedPath) : null;

  const updateSelected = (next: EventCommand) => {
    if (!selectedPath) return;
    projectDispatch({ type: 'UPDATE_COMMAND', mapId, eventId: event.id, path: selectedPath, command: next });
  };

  const removeSelected = () => {
    if (!selectedPath) return;
    projectDispatch({ type: 'REMOVE_COMMAND', mapId, eventId: event.id, path: selectedPath });
    setSelectedPath(null);
  };

  const addCommand = (type: EventCommand['type'] = 'showText') => {
    const placeholder = makePlaceholderCommand(type);
    projectDispatch({ type: 'ADD_COMMAND', mapId, eventId: event.id, command: placeholder });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
        <div>
          <span className="text-[13px] font-semibold text-gray-700">Event Commands</span>
          <p className="text-[11px] text-gray-400">Executed top to bottom.</p>
        </div>
        <div className="flex items-center gap-1">
          <select
            className="px-2 py-1 text-[12px] border border-gray-200 rounded"
            onChange={e => {
              if (e.target.value) {
                addCommand(e.target.value as EventCommand['type']);
                e.target.value = '';
              }
            }}
            defaultValue=""
          >
            <option value="">Add command…</option>
            <option value="showText">Show Text</option>
            <option value="showChoices">Show Choices</option>
            <option value="setFlag">Set Flag (legacy)</option>
            <option value="ifFlag">If Flag (legacy)</option>
            <option value="controlSwitch">Control Switch</option>
            <option value="ifSwitch">If Switch</option>
            <option value="controlVariable">Control Variable</option>
            <option value="ifVariable">If Variable</option>
            <option value="addItem">Add Item</option>
            <option value="removeItem">Remove Item</option>
            <option value="addGold">Add Gold</option>
            <option value="removeGold">Remove Gold</option>
            <option value="transferMap">Transfer Map</option>
            <option value="setPlayerPosition">Set Player Position</option>
            <option value="wait">Wait</option>
            <option value="playSound">Play Sound</option>
            <option value="comment">Comment</option>
            <option value="callCommonEvent">Call Common Event</option>
            <option value="startQuest">Start Quest</option>
            <option value="updateQuestObjective">Update Quest Objective</option>
            <option value="completeQuest">Complete Quest</option>
            <option value="openShop">Open Shop</option>
            <option value="startBattle">Start Battle</option>
            <option value="changeActorHp">Change Actor HP</option>
            <option value="playAnimation">Play Animation</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {flat.map(({ command, depth, path }, i) => (
          <CommandCard
            key={`${path.join('-')}-${i}`}
            index={i + 1}
            command={command}
            depth={depth}
            selected={samePath(selectedPath, path)}
            onSelect={() => setSelectedPath(path)}
          />
        ))}
        {selectedCommand && selectedPath && (
          <div className="mt-3">
            <p className="text-[11px] text-gray-500 mb-1">Editing selected command</p>
            <CommandEditor
              command={selectedCommand}
              mapIds={mapIds}
              itemIds={itemIds}
              onChange={updateSelected}
              onRemove={removeSelected}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MapPreview({ event, map }: { event: GameEvent; map: MapData }) {
  const TILE = 16;
  const w = map.width * TILE;
  const h = map.height * TILE;

  return (
    <div className="border-b border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium text-gray-600">Map Preview — {map.name}</span>
      </div>
      <div className="bg-gray-100 rounded-lg overflow-hidden inline-block">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {map.layers.find(l => l.type === 'collision')?.tiles.map((tile, i) => {
            const x = (i % map.width) * TILE;
            const y = Math.floor(i / map.width) * TILE;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={TILE}
                height={TILE}
                fill={tile === 9 ? '#5a8a3a' : '#7ab85a'}
                stroke="#6aa04a"
                strokeWidth="0.3"
              />
            );
          })}
          <rect
            x={event.x * TILE}
            y={event.y * TILE}
            width={TILE}
            height={TILE}
            fill="#6366f1"
            opacity="0.7"
            rx="2"
          />
          <rect
            x={event.x * TILE - 20}
            y={event.y * TILE - 18}
            width={60}
            height={16}
            fill="#1f2937"
            rx="3"
            opacity="0.9"
          />
          <text
            x={event.x * TILE + 10}
            y={event.y * TILE - 6}
            fontSize="8"
            fill="white"
            textAnchor="middle"
            fontWeight="bold"
          >
            {event.id}
          </text>
        </svg>
      </div>
    </div>
  );
}

function EventProperties({ event, mapId }: { event: GameEvent; mapId: string }) {
  const { dispatch } = useProjectStore();

  const update = (changes: Partial<Omit<GameEvent, 'commands'>>) => {
    dispatch({ type: 'UPDATE_EVENT', mapId, eventId: event.id, changes });
  };

  return (
    <div className="w-[260px] flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200">
        <span className="text-[13px] font-semibold text-gray-700">Event Properties</span>
      </div>
      <div className="p-4 space-y-4">
        <Input
          label="Name"
          value={event.id}
          onChange={e => {
            const newId = e.target.value;
            if (newId.trim() && newId !== event.id) {
              dispatch({ type: 'RENAME_EVENT', mapId, oldId: event.id, newId });
            }
          }}
        />
        <Select
          label="Type"
          value={event.type}
          options={[
            { value: 'npc', label: 'NPC' },
            { value: 'chest', label: 'Chest' },
            { value: 'transfer', label: 'Transfer' },
            { value: 'object', label: 'Object' },
            { value: 'trigger', label: 'Trigger' },
          ]}
          onChange={v => update({ type: v as EventType })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Position X"
            type="number"
            value={event.x}
            onChange={e => update({ x: Number(e.target.value) })}
          />
          <Input
            label="Position Y"
            type="number"
            value={event.y}
            onChange={e => update({ y: Number(e.target.value) })}
          />
        </div>
        <Select
          label="Trigger"
          value={event.trigger}
          options={[
            { value: 'interact', label: 'Interact' },
            { value: 'touch', label: 'Touch' },
            { value: 'autorun', label: 'Autorun' },
            { value: 'parallel', label: 'Parallel' },
          ]}
          onChange={v => update({ trigger: v as TriggerType })}
        />
        <Select
          label="Solid"
          value={event.solid ? 'yes' : 'no'}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          onChange={v => update({ solid: v === 'yes' })}
        />
        <Select
          label="Sprite"
          value={event.sprite ?? ''}
          options={[
            { value: '', label: '(none)' },
            { value: 'npc_placeholder', label: 'Placeholder NPC' },
          ]}
          onChange={v => update({ sprite: v || undefined })}
        />
        <Input
          label="Animation Set"
          value={event.animationSet ?? ''}
          onChange={e => update({ animationSet: e.target.value || undefined })}
        />
        <Input
          label="Display height (tiles)"
          type="number"
          step="0.1"
          min="0.1"
          value={event.displayHeightTiles ?? ''}
          onChange={e =>
            update({
              displayHeightTiles: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        />
      </div>
    </div>
  );
}

function ValidationPanel({ event, map, mapIds }: { event: GameEvent; map: MapData; mapIds: string[] }) {
  const { dispatch } = useProjectStore();
  const messages = validateEvent(event, map, mapIds);
  const errors = messages.filter(m => m.level === 'error');
  const warnings = messages.filter(m => m.level === 'warning');

  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100">
        <button className="text-[13px] font-medium text-indigo-600 border-b-2 border-indigo-500 pb-1 cursor-pointer">
          Validation
        </button>
        <button className="text-[13px] text-gray-500 pb-1 cursor-pointer hover:text-gray-700">Event Preview</button>
        <button className="text-[13px] text-gray-500 pb-1 cursor-pointer hover:text-gray-700">Notes</button>
        <div className="ml-auto">
          <Button size="sm" icon={<RefreshCw size={12} />} onClick={() => dispatch({ type: 'VALIDATE' })}>
            Re-validate
          </Button>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {errors.length === 0 && warnings.length === 0 && (
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <div>
              <p className="text-[13px] font-medium text-gray-800">No errors</p>
              <p className="text-[11px] text-gray-500">Everything looks good!</p>
            </div>
          </div>
        )}
        {errors.map((msg, i) => (
          <div key={i} className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <p className="text-[13px] text-gray-700">{msg.message}</p>
          </div>
        ))}
        {warnings.map((msg, i) => (
          <div key={i} className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <p className="text-[13px] text-gray-700">{msg.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventEditorScreen() {
  const { state: editor } = useEditor();
  const { state: project } = useProjectStore();

  // Default to first event if none selected
  const selected = editor.selectedEvent;
  const selectedMapId = editor.selectedEventMapId ?? editor.selectedMapId;

  const map = project.maps[selectedMapId] ?? project.maps.town;
  // Always read fresh event from store
  const event = selected
    ? map?.events.find(e => e.id === selected.id) ?? map?.events[0]
    : map?.events[0];

  if (!event || !map) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">No events found</div>;
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <EventList />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <MapPreview event={event} map={map} />
            <CommandStack event={event} mapId={map.id} />
          </div>
          <EventProperties event={event} mapId={map.id} />
        </div>
        <ValidationPanel event={event} map={map} mapIds={Object.keys(project.maps)} />
      </div>
    </div>
  );
}
