import { useState } from 'react';
import { useProject, getEventsByMap } from '../stores/projectStore';
import { useEditor } from '../stores/editorStore';
import { ChevronDown, ChevronRight, Plus, Search, MoreVertical, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { validateEvent } from '../validation/validateMap';
import type { GameEvent, EventCommand, MapData } from '../types/project';

function EventList() {
  const project = useProject();
  const { state, dispatch } = useEditor();
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
            {expandedMaps[mapId] && events.map(event => (
              <button
                key={event.id}
                onClick={() => dispatch({ type: 'SELECT_EVENT', event, mapId })}
                className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-left cursor-pointer ${
                  state.selectedEvent?.id === event.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span className="text-[12px]">
                  {event.type === 'npc' ? '👤' : event.type === 'chest' ? '📦' : '🚪'}
                </span>
                <span className="text-[13px] truncate">{event.id}</span>
                {state.selectedEvent?.id === event.id && (
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

function CommandCard({ index, command }: { index: number; command: EventCommand }) {
  const icons: Record<string, { icon: string; color: string; bg: string }> = {
    showText: { icon: '💬', color: 'text-blue-600', bg: 'bg-blue-50' },
    ifFlag: { icon: '🔀', color: 'text-red-600', bg: 'bg-red-50' },
    addItem: { icon: '🎒', color: 'text-green-600', bg: 'bg-green-50' },
    setFlag: { icon: '🚩', color: 'text-purple-600', bg: 'bg-purple-50' },
    transferMap: { icon: '🌐', color: 'text-cyan-600', bg: 'bg-cyan-50' },
    playSound: { icon: '🔊', color: 'text-amber-600', bg: 'bg-amber-50' },
  };

  const info = icons[command.type] || { icon: '⬜', color: 'text-gray-600', bg: 'bg-gray-50' };

  const getTitle = (cmd: EventCommand): string => {
    switch (cmd.type) {
      case 'showText': return 'Show Text';
      case 'ifFlag': return 'If Flag';
      case 'addItem': return 'Add Item';
      case 'setFlag': return 'Set Flag';
      case 'transferMap': return 'Transfer Map';
      case 'playSound': return 'Play Sound';
    }
  };

  const getDescription = (cmd: EventCommand): string => {
    switch (cmd.type) {
      case 'showText': return cmd.text;
      case 'ifFlag': return `${cmd.flag} is ${cmd.equals ? 'ON' : 'OFF'}`;
      case 'addItem': return `Item: ${cmd.itemId} × ${cmd.amount}`;
      case 'setFlag': return `${cmd.flag} → ${cmd.value ? 'ON' : 'OFF'}`;
      case 'transferMap': return `Map: ${cmd.mapId}  Location: (${cmd.x}, ${cmd.y})`;
      case 'playSound': return cmd.soundId;
      default: return '';
    }
  };

  const getExtra = (cmd: EventCommand): string | null => {
    if (cmd.type === 'ifFlag') return 'Branch';
    if (cmd.type === 'addItem') return 'Else Branch';
    if (cmd.type === 'transferMap') return `Fade: On`;
    return null;
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <span className="text-[12px] text-gray-400 font-mono mt-1 w-4">{index}</span>
      <div className={`w-9 h-9 rounded-lg ${info.bg} flex items-center justify-center text-lg flex-shrink-0`}>
        {info.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-gray-800">{getTitle(command)}</span>
          {getExtra(command) && (
            <Badge variant="info">{getExtra(command)}</Badge>
          )}
        </div>
        <p className="text-[12px] text-gray-500 mt-0.5 truncate">{getDescription(command)}</p>
      </div>
      <MoreVertical size={14} className="text-gray-300 cursor-pointer hover:text-gray-500 mt-1" />
    </div>
  );
}

function CommandStack({ event }: { event: GameEvent }) {
  // Flatten commands for display (show top-level + nested)
  const flatCommands: EventCommand[] = [];
  function walk(cmds: EventCommand[]) {
    for (const cmd of cmds) {
      flatCommands.push(cmd);
      if (cmd.type === 'ifFlag') {
        walk(cmd.then);
        walk(cmd.else);
      }
    }
  }
  walk(event.commands);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
        <div>
          <span className="text-[13px] font-semibold text-gray-700">Event Commands</span>
          <p className="text-[11px] text-gray-400">Executed top to bottom.</p>
        </div>
        <Button size="sm" icon={<Plus size={12} />}>Add Command</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {flatCommands.map((cmd, i) => (
          <CommandCard key={i} index={i + 1} command={cmd} />
        ))}
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
              <rect key={i} x={x} y={y} width={TILE} height={TILE}
                fill={tile === 9 ? '#5a8a3a' : '#7ab85a'} stroke="#6aa04a" strokeWidth="0.3" />
            );
          })}
          {/* Highlight selected event */}
          <rect
            x={event.x * TILE} y={event.y * TILE}
            width={TILE} height={TILE}
            fill="#6366f1" opacity="0.7" rx="2"
          />
          {/* Label */}
          <rect x={event.x * TILE - 20} y={event.y * TILE - 18} width={60} height={16} fill="#1f2937" rx="3" opacity="0.9" />
          <text x={event.x * TILE + 10} y={event.y * TILE - 6} fontSize="8" fill="white" textAnchor="middle" fontWeight="bold">
            {event.id}
          </text>
        </svg>
      </div>
    </div>
  );
}

function EventProperties({ event }: { event: GameEvent }) {
  return (
    <div className="w-[260px] flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200">
        <span className="text-[13px] font-semibold text-gray-700">Event Properties</span>
      </div>
      <div className="p-4 space-y-4">
        <Input label="Name" defaultValue={event.id} />
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
        />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Position X" type="number" defaultValue={String(event.x)} />
          <Input label="Position Y" type="number" defaultValue={String(event.y)} />
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
        />
        <Select
          label="Solid"
          value={event.solid ? 'yes' : 'no'}
          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
        />
        <Select
          label="Direction"
          value="down"
          options={[
            { value: 'up', label: 'Up' },
            { value: 'down', label: 'Down' },
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
          ]}
        />

        {/* Appearance */}
        <div>
          <label className="text-[12px] font-medium text-gray-500 mb-1 block">Appearance</label>
          <div className="flex items-center gap-2 p-2 border border-gray-200 rounded-md">
            <div className="w-8 h-8 rounded bg-indigo-100 flex items-center justify-center text-sm">
              {event.type === 'npc' ? '👤' : event.type === 'chest' ? '📦' : '🚪'}
            </div>
            <span className="text-[12px] text-gray-600">Placeholder {event.type.toUpperCase()}</span>
          </div>
        </div>

        {/* Dialogue */}
        {event.type === 'npc' && (
          <div>
            <label className="text-[12px] font-medium text-gray-500 mb-1 block">Dialogue</label>
            <textarea
              className="w-full px-2.5 py-2 text-[12px] border border-gray-200 rounded-md resize-none h-16 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              defaultValue={
                event.commands.find(c => c.type === 'showText' || (c.type === 'ifFlag'))
                  ? 'No cruces el puente de noche.'
                  : ''
              }
            />
          </div>
        )}

        {/* AI Actions */}
        <div>
          <label className="text-[12px] font-medium text-gray-500 mb-2 block">✨ AI Actions</label>
          <div className="space-y-1.5">
            {['Rewrite dialogue', 'Generate 3 variants', 'Make it funnier'].map(action => (
              <button key={action} className="w-full text-left px-3 py-2 text-[12px] text-gray-600 bg-gray-50 rounded-md hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors">
                ✏️ {action}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 italic">AI actions replace the dialogue above.</p>
        </div>
      </div>
    </div>
  );
}

function ValidationPanel({ event, map }: { event: GameEvent; map: MapData }) {
  const allMapIds = ['town', 'house'];
  const messages = validateEvent(event, map, allMapIds);
  const errors = messages.filter(m => m.level === 'error');
  const warnings = messages.filter(m => m.level === 'warning');

  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100">
        <button className="text-[13px] font-medium text-indigo-600 border-b-2 border-indigo-500 pb-1 cursor-pointer">Validation</button>
        <button className="text-[13px] text-gray-500 pb-1 cursor-pointer hover:text-gray-700">Event Preview</button>
        <button className="text-[13px] text-gray-500 pb-1 cursor-pointer hover:text-gray-700">Notes</button>
        <div className="ml-auto">
          <Button size="sm" icon={<RefreshCw size={12} />}>Re-validate</Button>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {errors.length === 0 && (
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
            <div>
              <p className="text-[13px] font-medium text-gray-800">1 warning</p>
              <p className="text-[11px] text-gray-500">{msg.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventEditorScreen() {
  const { state } = useEditor();
  const project = useProject();
  const event = state.selectedEvent;
  const mapId = state.selectedEventMapId || state.selectedMapId;
  const map = project.maps[mapId];

  // Default to first event if none selected
  const displayEvent = event || project.maps.town?.events[0];
  const displayMap = map || project.maps.town;

  if (!displayEvent || !displayMap) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">No events found</div>;
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <EventList />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <MapPreview event={displayEvent} map={displayMap} />
            <CommandStack event={displayEvent} />
          </div>
          <EventProperties event={displayEvent} />
        </div>
        <ValidationPanel event={displayEvent} map={displayMap} />
      </div>
    </div>
  );
}
