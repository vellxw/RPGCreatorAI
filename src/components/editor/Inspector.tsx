import { useEffect, useState } from 'react';
import { useEditor } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { Input, Select } from '../ui/Input';
import { Copy, MoreVertical, Plus, Trash2 } from 'lucide-react';
import type {
  EventCommand,
  GameEvent,
  MapData,
  MapScrollType,
  ShowTextCommand,
  TriggerType,
} from '../../types/project';
import { eventAssets } from '../../assets/generated/assetCatalog';
import { findDuplicatePlacement } from '../../utils/eventEditing';
import { normalizeVisualProfile } from '../../visual/visualProfile';
import { getVisibleTileSpan } from '../../visual/viewport';

function CommandRow({ index, command }: { index: number; command: EventCommand }) {
  const labels: Record<string, string> = {
    showText: 'Show Text',
    setFlag: 'Control Switch',
    ifFlag: 'If Flag',
    addItem: 'Change Items',
    transferMap: 'Transfer Map',
    playSound: 'Play Sound',
  };

  const getDescription = (cmd: EventCommand): string => {
    switch (cmd.type) {
      case 'showText':
        return cmd.text.substring(0, 30) + (cmd.text.length > 30 ? '...' : '');
      case 'setFlag':
        return `${cmd.flag} → ${cmd.value ? 'ON' : 'OFF'}`;
      case 'ifFlag':
        return `${cmd.flag} is ${cmd.equals ? 'ON' : 'OFF'}`;
      case 'addItem':
        return `${cmd.itemId} + ${cmd.amount}`;
      case 'transferMap':
        return `${cmd.mapId} (${cmd.x}, ${cmd.y})`;
      case 'playSound':
        return cmd.soundId;
      default:
        return cmd.type;
    }
  };

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded border border-gray-100 text-[12px]">
      <span className="text-gray-400 font-mono w-4">{index}</span>
      <span className="font-medium text-gray-700">{labels[command.type] || command.type}</span>
      <span className="text-gray-500 truncate flex-1">{getDescription(command)}</span>
    </div>
  );
}

function findFirstShowText(commands: EventCommand[]): { command: ShowTextCommand; path: number[] } | null {
  function walk(cmds: EventCommand[], prefix: number[]): { command: ShowTextCommand; path: number[] } | null {
    for (let i = 0; i < cmds.length; i++) {
      const cmd = cmds[i];
      if (cmd.type === 'showText') return { command: cmd, path: [...prefix, i] };
      if (cmd.type === 'ifFlag') {
        const inThen = walk(cmd.then, [...prefix, i, 0]);
        if (inThen) return inThen;
        const inElse = walk(cmd.else, [...prefix, i, 1]);
        if (inElse) return inElse;
      }
    }
    return null;
  }
  return walk(commands, []);
}

export function Inspector() {
  const { state: editorState, dispatch: editorDispatch } = useEditor();
  const { state: projectState, dispatch: projectDispatch } = useProjectStore();

  const selected = editorState.selectedEvent;
  const mapId = editorState.selectedEventMapId;

  // Always read fresh event data from the store so edits propagate.
  const event: GameEvent | null =
    selected && mapId
      ? projectState.maps[mapId]?.events.find(e => e.id === selected.id) ?? null
      : null;
  const selectedMap = projectState.maps[editorState.selectedMapId];

  if (!event || !mapId) {
    return <MapSettingsPanel map={selectedMap} />;
  }

  const updateEvent = (changes: Partial<Omit<GameEvent, 'commands'>>) => {
    projectDispatch({ type: 'UPDATE_EVENT', mapId, eventId: event.id, changes });
  };

  const renameEvent = (newId: string) => {
    if (!newId.trim() || newId === event.id) return;
    projectDispatch({ type: 'RENAME_EVENT', mapId, oldId: event.id, newId });
    // Keep the editor selection in sync after a rename so the inspector
    // continues pointing at the same event.
    editorDispatch({
      type: 'SELECT_EVENT',
      event: { ...event, id: newId },
      mapId,
    });
  };

  const showText = findFirstShowText(event.commands);

  const updateDialogue = (text: string) => {
    if (!showText) return;
    const updated: ShowTextCommand = { ...showText.command, text };
    projectDispatch({
      type: 'UPDATE_COMMAND',
      mapId,
      eventId: event.id,
      path: showText.path,
      command: updated,
    });
  };

  const addCommand = () => {
    const placeholder: EventCommand = { type: 'showText', text: 'New dialogue' };
    projectDispatch({ type: 'ADD_COMMAND', mapId, eventId: event.id, command: placeholder });
  };

  const duplicateEvent = () => {
    const { newId, x, y } = findDuplicatePlacement(projectState.maps[mapId], event);
    projectDispatch({
      type: 'DUPLICATE_EVENT',
      mapId,
      eventId: event.id,
      newId,
      x,
      y,
    });
    editorDispatch({
      type: 'SELECT_EVENT',
      event: { ...event, id: newId, x, y },
      mapId,
    });
  };

  const deleteEvent = () => {
    if (!window.confirm(`Delete event "${event.id}"?`)) return;
    projectDispatch({ type: 'REMOVE_EVENT', mapId, eventId: event.id });
    editorDispatch({ type: 'SELECT_EVENT', event: null, mapId: null });
  };

  return (
    <div className="w-[280px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="text-[14px] font-semibold text-gray-800">Inspector</span>
        <MoreVertical size={14} className="text-gray-400" />
      </div>

      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-lg">
            <img src={eventAssets[event.type]} alt="" className="w-8 h-8" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-gray-800">{event.id}</div>
            <div className="text-[12px] text-gray-500 capitalize">{event.type}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div>
          <div className="text-[12px] font-semibold text-gray-700 mb-3">General</div>
          <div className="space-y-3">
            <Input
              label="Name"
              value={event.id}
              onChange={e => renameEvent(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Position X"
                type="number"
                value={event.x}
                onChange={e => updateEvent({ x: Number(e.target.value) })}
              />
              <Input
                label="Position Y"
                type="number"
                value={event.y}
                onChange={e => updateEvent({ y: Number(e.target.value) })}
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
              onChange={v => updateEvent({ trigger: v as TriggerType })}
            />
            <Select
              label="Solid"
              value={event.solid ? 'yes' : 'no'}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
              onChange={v => updateEvent({ solid: v === 'yes' })}
            />
            {showText && (
              <div>
                <label className="text-[12px] font-medium text-gray-500 mb-1 block">Dialogue</label>
                <textarea
                  className="w-full px-2.5 py-2 text-[12px] border border-gray-200 rounded-md resize-none h-16 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  value={showText.command.text}
                  onChange={e => updateDialogue(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-gray-700 mb-2">Commands</div>
          <div className="space-y-1.5">
            {event.commands.slice(0, 5).map((cmd, i) => (
              <CommandRow key={i} index={i + 1} command={cmd} />
            ))}
          </div>
          <button
            onClick={addCommand}
            className="mt-2 flex items-center gap-1 text-[12px] text-indigo-600 hover:text-indigo-700 cursor-pointer"
          >
            <Plus size={12} />
            Add Command
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
        <button
          onClick={duplicateEvent}
          title="Duplicate event"
          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md cursor-pointer"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={deleteEvent}
          title="Delete event"
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function MapSettingsPanel({ map }: { map: MapData | undefined }) {
  const { state: projectState, dispatch } = useProjectStore();
  const [width, setWidth] = useState(map?.width ?? 1);
  const [height, setHeight] = useState(map?.height ?? 1);

  useEffect(() => {
    setWidth(map?.width ?? 1);
    setHeight(map?.height ?? 1);
  }, [map?.width, map?.height]);

  if (!map) {
    return (
      <div className="w-[280px] flex-shrink-0 bg-white border-l border-gray-200 flex items-center justify-center p-6 text-center">
        <p className="text-[13px] text-gray-500">Select a map to edit its scene settings.</p>
      </div>
    );
  }

  const profile = normalizeVisualProfile(projectState.project.visualProfile);
  const visibleSpan = getVisibleTileSpan(profile.baseResolution, map.tileSize || profile.tileSize);
  const updateMap = (changes: Partial<Omit<MapData, 'id' | 'layers' | 'events'>>) => {
    dispatch({ type: 'UPDATE_MAP_PROPERTIES', mapId: map.id, changes });
  };
  const applyResize = () => {
    dispatch({
      type: 'RESIZE_MAP',
      mapId: map.id,
      width,
      height,
      visualFillTile: 1,
    });
  };
  const fitToViewport = () => {
    setWidth(visibleSpan.columns);
    setHeight(visibleSpan.rows);
    dispatch({
      type: 'RESIZE_MAP',
      mapId: map.id,
      width: visibleSpan.columns,
      height: visibleSpan.rows,
      visualFillTile: 1,
    });
  };
  const applyAspectPreset = (aspectRatio: '16:9' | '4:3' | '1:1') => {
    const baseResolution =
      aspectRatio === '16:9'
        ? { width: 1280, height: 720 }
        : aspectRatio === '4:3'
          ? { width: 1024, height: 768 }
          : { width: 768, height: 768 };
    dispatch({
      type: 'UPDATE_PROJECT_META',
      changes: {
        visualProfile: {
          ...profile,
          aspectRatio,
          baseResolution,
        },
      },
    });
  };

  return (
    <div className="w-[280px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="text-[14px] font-semibold text-gray-800">Map Settings</div>
        <div className="text-[12px] text-gray-500">{map.name}</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div>
          <div className="text-[12px] font-semibold text-gray-700 mb-3">General</div>
          <div className="space-y-3">
            <Input
              label="Name"
              value={map.name}
              onChange={e => updateMap({ name: e.target.value })}
            />
            <Input
              label="Display Name"
              value={map.displayName ?? ''}
              onChange={e => updateMap({ displayName: e.target.value })}
            />
            <Select
              label="Tileset"
              value={map.tilesetId ?? 'sample-town'}
              options={[
                { value: 'sample-town', label: 'Sample Town' },
                { value: 'interior', label: 'Interior' },
              ]}
              onChange={v => updateMap({ tilesetId: v })}
            />
            <Select
              label="Scroll"
              value={map.scrollType ?? 'none'}
              options={[
                { value: 'none', label: 'No loop' },
                { value: 'vertical', label: 'Vertical loop' },
                { value: 'horizontal', label: 'Horizontal loop' },
                { value: 'both', label: 'Both axes' },
              ]}
              onChange={v => updateMap({ scrollType: v as MapScrollType })}
            />
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-gray-700 mb-3">Map Size</div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Width" type="number" value={width} onChange={e => setWidth(Number(e.target.value))} />
            <Input label="Height" type="number" value={height} onChange={e => setHeight(Number(e.target.value))} />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={applyResize}
              className="flex-1 px-3 py-1.5 text-[12px] rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              Apply resize
            </button>
            <button
              onClick={fitToViewport}
              className="flex-1 px-3 py-1.5 text-[12px] rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100"
            >
              Fit viewport
            </button>
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-gray-700 mb-3">Viewport Preset</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['16:9', '4:3', '1:1'] as const).map(aspectRatio => (
              <button
                key={aspectRatio}
                onClick={() => applyAspectPreset(aspectRatio)}
                className={`px-2 py-2 text-[12px] rounded-md border ${
                  profile.aspectRatio === aspectRatio
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {aspectRatio}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Current frame: {profile.baseResolution.width}×{profile.baseResolution.height}
          </p>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-gray-700 mb-3">Encounters</div>
          <div className="space-y-3">
            <Input
              label="Encounter Steps"
              type="number"
              value={map.encounterSteps ?? 30}
              onChange={e => updateMap({ encounterSteps: Number(e.target.value) })}
            />
            <Input
              label="Battleback"
              value={map.battleback ?? ''}
              onChange={e => updateMap({ battleback: e.target.value })}
            />
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-gray-700 mb-3">Start</div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_PROJECT_META', changes: { startMapId: map.id } })}
            className={`w-full px-3 py-1.5 text-[12px] rounded-md border ${
              projectState.project.startMapId === map.id
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {projectState.project.startMapId === map.id ? 'Start map' : 'Set as start map'}
          </button>
        </div>
      </div>
    </div>
  );
}
