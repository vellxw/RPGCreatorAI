import { useState } from 'react';
import { useProjectStore, getEventsByMap } from '../stores/projectStore';
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
} from 'lucide-react';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { CommandStackEditor } from '../components/events/CommandStackEditor';
import { PortraitGenerationPanel } from '../components/database/PortraitGenerationPanel';
import { CharacterConceptGenerationPanel } from '../components/database/CharacterConceptGenerationPanel';
import { validateEvent } from '../validation/validateMap';
import type {
  EventPage,
  EventPageConditions,
  EventPageGraphic,
  EventPageMovement,
  EventPageOptions,
  EventPriority,
  EventType,
  GameEvent,
  MapData,
  MovementSpeed,
  TriggerType,
  VariableComparison,
} from '../types/project';
import { eventAssets } from '../assets/generated/assetCatalog';

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

function CommandStack({ event, mapId, page }: { event: GameEvent; mapId: string; page: EventPage | null }) {
  const { state: project, dispatch: projectDispatch } = useProjectStore();
  const commands = page?.commands ?? event.commands;

  return (
    <CommandStackEditor
      commands={commands}
      mapIds={Object.keys(project.maps)}
      itemIds={project.items.items.map(i => i.id)}
      operations={{
        update: (path, command) => {
          if (page) {
            projectDispatch({ type: 'UPDATE_PAGE_COMMAND', mapId, eventId: event.id, pageId: page.id, path, command });
          } else {
            projectDispatch({ type: 'UPDATE_COMMAND', mapId, eventId: event.id, path, command });
          }
        },
        remove: path => {
          if (page) {
            projectDispatch({ type: 'REMOVE_PAGE_COMMAND', mapId, eventId: event.id, pageId: page.id, path });
          } else {
            projectDispatch({ type: 'REMOVE_COMMAND', mapId, eventId: event.id, path });
          }
        },
        removeRange: (fromPath, toPath) => {
          if (page) {
            projectDispatch({ type: 'REMOVE_PAGE_COMMAND_RANGE', mapId, eventId: event.id, pageId: page.id, fromPath, toPath });
          } else {
            projectDispatch({ type: 'REMOVE_COMMAND_RANGE', mapId, eventId: event.id, fromPath, toPath });
          }
        },
        insert: (path, placement, command) => {
          if (page) {
            projectDispatch({ type: 'INSERT_PAGE_COMMAND', mapId, eventId: event.id, pageId: page.id, path, placement, command });
          } else {
            projectDispatch({ type: 'INSERT_COMMAND', mapId, eventId: event.id, path, placement, command });
          }
        },
        move: (path, direction) => {
          if (page) {
            projectDispatch({ type: 'MOVE_PAGE_COMMAND', mapId, eventId: event.id, pageId: page.id, path, direction });
          } else {
            projectDispatch({ type: 'MOVE_COMMAND', mapId, eventId: event.id, path, direction });
          }
        },
        duplicate: path => {
          if (page) {
            projectDispatch({ type: 'DUPLICATE_PAGE_COMMAND', mapId, eventId: event.id, pageId: page.id, path });
          } else {
            projectDispatch({ type: 'DUPLICATE_COMMAND', mapId, eventId: event.id, path });
          }
        },
      }}
    />
  );
}

function makeEventPage(id: string, index: number): EventPage {
  return {
    id,
    name: `Page ${index + 1}`,
    conditions: {},
    graphic: {},
    movement: { type: 'fixed', speed: 'normal' },
    options: { walking: true, stepping: false, directionFix: false, through: false },
    priority: 'sameAsCharacters',
    trigger: 'interact',
    commands: [],
  };
}

function EventPageTabs({
  event,
  mapId,
  selectedPageId,
  onSelect,
}: {
  event: GameEvent;
  mapId: string;
  selectedPageId: string | null;
  onSelect(pageId: string): void;
}) {
  const { dispatch } = useProjectStore();
  const pages = event.pages ?? [];
  const addPage = () => {
    const used = new Set(pages.map(page => page.id));
    let next = pages.length + 1;
    while (used.has(`page_${next}`)) next += 1;
    const page = makeEventPage(`page_${next}`, pages.length);
    dispatch({ type: 'ADD_EVENT_PAGE', mapId, eventId: event.id, page });
    onSelect(page.id);
  };

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-white">
      {pages.map((page, index) => (
        <div key={page.id} className="flex items-center">
          <button
            type="button"
            onClick={() => onSelect(page.id)}
            className={`px-3 py-1.5 text-[12px] border rounded-md ${
              (selectedPageId ?? pages[0]?.id) === page.id
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {page.name ?? `Page ${index + 1}`}
          </button>
          <button
            type="button"
            title="Move page left"
            onClick={() => dispatch({ type: 'REORDER_EVENT_PAGE', mapId, eventId: event.id, pageId: page.id, direction: 'up' })}
            className="flex h-6 w-6 items-center justify-center rounded text-[11px] text-gray-400 hover:bg-gray-50 hover:text-gray-700"
          >
            ←
          </button>
          <button
            type="button"
            title="Move page right"
            onClick={() => dispatch({ type: 'REORDER_EVENT_PAGE', mapId, eventId: event.id, pageId: page.id, direction: 'down' })}
            className="flex h-6 w-6 items-center justify-center rounded text-[11px] text-gray-400 hover:bg-gray-50 hover:text-gray-700"
          >
            →
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addPage}
        className="ml-auto flex items-center gap-1 px-2 py-1.5 text-[12px] text-indigo-600 hover:bg-indigo-50 rounded-md"
      >
        <Plus size={12} />
        Page
      </button>
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

function EventProperties({ event, mapId, page }: { event: GameEvent; mapId: string; page: EventPage | null }) {
  const { state: project, dispatch } = useProjectStore();

  const update = (changes: Partial<Omit<GameEvent, 'commands'>>) => {
    dispatch({ type: 'UPDATE_EVENT', mapId, eventId: event.id, changes });
  };
  const updatePage = (changes: Partial<EventPage>) => {
    if (!page) return;
    dispatch({ type: 'UPDATE_EVENT_PAGE', mapId, eventId: event.id, pageId: page.id, changes });
  };
  const updateSelfSwitchCondition = (switchId: 'A' | 'B' | 'C' | 'D', enabled: boolean) => {
    if (!page) return;
    const next = { ...(page.conditions.selfSwitches ?? {}) };
    if (enabled) next[switchId] = true;
    else delete next[switchId];
    updatePage({ conditions: { ...page.conditions, selfSwitches: next } });
  };
  const updatePageGraphic = (changes: Partial<EventPageGraphic>) => {
    if (!page) {
      update(changes);
      return;
    }
    updatePage({ graphic: { ...page.graphic, ...changes } });
  };
  const updatePageMovement = (changes: Partial<EventPageMovement>) => {
    if (!page) return;
    updatePage({ movement: { ...page.movement, ...changes } });
  };
  const updatePageOptions = (changes: Partial<EventPageOptions>) => {
    if (!page) return;
    updatePage({ options: { ...page.options, ...changes } });
  };
  const updatePageConditions = (changes: Partial<EventPageConditions>) => {
    if (!page) return;
    updatePage({ conditions: { ...page.conditions, ...changes } });
  };
  const updateSwitchCondition = (oldId: string, nextId: string, value: boolean) => {
    if (!page) return;
    const next = { ...(page.conditions.switches ?? {}) };
    delete next[oldId];
    const cleanId = nextId.trim();
    if (cleanId) next[cleanId] = value;
    updatePageConditions({ switches: next });
  };
  const addSwitchCondition = () => {
    if (!page) return;
    const next = { ...(page.conditions.switches ?? {}) };
    let index = Object.keys(next).length + 1;
    while (next[`switch_${index}`] !== undefined) index += 1;
    next[`switch_${index}`] = true;
    updatePageConditions({ switches: next });
  };
  const removeSwitchCondition = (switchId: string) => {
    if (!page) return;
    const next = { ...(page.conditions.switches ?? {}) };
    delete next[switchId];
    updatePageConditions({ switches: next });
  };
  const updateVariableCondition = (
    index: number,
    changes: Partial<NonNullable<EventPageConditions['variables']>[number]>,
  ) => {
    if (!page) return;
    const next = [...(page.conditions.variables ?? [])];
    next[index] = { ...next[index], ...changes };
    updatePageConditions({ variables: next });
  };
  const addVariableCondition = () => {
    if (!page) return;
    const variableId = project.databases.variables[0]?.id ?? `variable_${(page.conditions.variables ?? []).length + 1}`;
    updatePageConditions({
      variables: [
        ...(page.conditions.variables ?? []),
        { variableId, op: 'eq', value: 0 },
      ],
    });
  };
  const removeVariableCondition = (index: number) => {
    if (!page) return;
    updatePageConditions({ variables: (page.conditions.variables ?? []).filter((_, i) => i !== index) });
  };
  const pageGraphic: EventPageGraphic = page?.graphic ?? {
    sprite: event.sprite,
    animationSet: event.animationSet,
    displayHeightTiles: event.displayHeightTiles,
  };
  const spriteOptions = [
    { value: '', label: '(none)' },
    { value: 'npc_old_man', label: 'Old Man' },
    { value: 'npc_shopkeeper', label: 'Shopkeeper' },
    { value: 'chest_closed', label: 'Closed Chest' },
    { value: 'transfer_door', label: 'Transfer Door' },
    { value: 'npc_placeholder', label: 'Placeholder NPC' },
  ];
  const activeSpriteOptions = pageGraphic.sprite && !spriteOptions.some(option => option.value === pageGraphic.sprite)
    ? [...spriteOptions, { value: pageGraphic.sprite, label: `${pageGraphic.sprite} (unknown)` }]
    : spriteOptions;
  const portraitAssetOptions = [
    { value: '', label: '(none)' },
    ...project.assets.assets
      .filter(asset => asset.kind === 'image' || asset.kind === 'generated')
      .map(asset => ({ value: asset.id, label: `${asset.name} (${asset.id})` })),
  ];
  const activePortraitAssetOptions = event.portraitAssetId && !portraitAssetOptions.some(option => option.value === event.portraitAssetId)
    ? [...portraitAssetOptions, { value: event.portraitAssetId, label: `${event.portraitAssetId} (unknown)` }]
    : portraitAssetOptions;

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
          value={page?.trigger ?? event.trigger}
          options={[
            { value: 'interact', label: 'Interact' },
            { value: 'touch', label: 'Touch' },
            { value: 'autorun', label: 'Autorun' },
            { value: 'parallel', label: 'Parallel' },
          ]}
          onChange={v => page ? updatePage({ trigger: v as TriggerType }) : update({ trigger: v as TriggerType })}
        />
        {page && (
          <div className="space-y-3 rounded-md border border-gray-100 bg-gray-50 p-3">
            <div className="text-[12px] font-semibold text-gray-700">Page Settings</div>
            <Input
              label="Page Name"
              value={page.name ?? ''}
              onChange={e => updatePage({ name: e.target.value })}
            />
            <Select
              label="Priority"
              value={page.priority}
              options={[
                { value: 'belowCharacters', label: 'Below characters' },
                { value: 'sameAsCharacters', label: 'Same as characters' },
                { value: 'aboveCharacters', label: 'Above characters' },
              ]}
              onChange={v => updatePage({ priority: v as EventPriority })}
            />
            <div className="space-y-2">
              <div className="text-[12px] font-semibold text-gray-700">Page Conditions</div>
              <div>
                <div className="text-[12px] font-medium text-gray-500 mb-1">Self Switch Conditions</div>
                <div className="grid grid-cols-4 gap-1">
                  {(['A', 'B', 'C', 'D'] as const).map(id => (
                    <label key={id} className="flex items-center justify-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600">
                      <input
                        type="checkbox"
                        checked={page.conditions.selfSwitches?.[id] === true}
                        onChange={e => updateSelfSwitchCondition(id, e.target.checked)}
                      />
                      {id}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[12px] font-medium text-gray-500">Switch Conditions</div>
                {Object.entries(page.conditions.switches ?? {}).map(([switchId, value]) => (
                  <div key={switchId} className="grid grid-cols-[minmax(0,1fr)_64px] gap-1.5 rounded border border-gray-100 bg-white p-1.5">
                    <input
                      aria-label={`Switch condition ${switchId}`}
                      className="min-w-0 px-2 py-1 text-[12px] border border-gray-200 rounded bg-white"
                      value={switchId}
                      onChange={e => updateSwitchCondition(switchId, e.target.value, value)}
                    />
                    <select
                      aria-label={`Switch ${switchId} value`}
                      className="px-2 py-1 text-[12px] border border-gray-200 rounded bg-white"
                      value={value ? 'true' : 'false'}
                      onChange={e => updateSwitchCondition(switchId, switchId, e.target.value === 'true')}
                    >
                      <option value="true">ON</option>
                      <option value="false">OFF</option>
                    </select>
                    <button
                      type="button"
                      className="col-span-2 justify-self-start px-2 py-1 text-[11px] text-red-600 border border-red-100 rounded bg-white hover:bg-red-50"
                      onClick={() => removeSwitchCondition(switchId)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSwitchCondition}
                  className="inline-flex h-6 items-center rounded px-1.5 text-[11px] text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  Add switch condition
                </button>
              </div>
              <div className="space-y-1.5">
                <div className="text-[12px] font-medium text-gray-500">Variable Conditions</div>
                {(page.conditions.variables ?? []).map((condition, index) => (
                  <div key={`${condition.variableId}-${index}`} className="space-y-1.5 rounded border border-gray-100 bg-white p-1.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_64px] gap-1.5">
                      <input
                        aria-label={`Variable condition ${index + 1}`}
                        className="min-w-0 px-2 py-1 text-[12px] border border-gray-200 rounded bg-white"
                        value={condition.variableId}
                        onChange={e => updateVariableCondition(index, { variableId: e.target.value })}
                      />
                      <select
                        aria-label={`Variable condition ${index + 1} comparison`}
                        className="px-2 py-1 text-[12px] border border-gray-200 rounded bg-white"
                        value={condition.op}
                        onChange={e => updateVariableCondition(index, { op: e.target.value as VariableComparison })}
                      >
                        <option value="eq">==</option>
                        <option value="neq">!=</option>
                        <option value="gt">&gt;</option>
                        <option value="gte">&gt;=</option>
                        <option value="lt">&lt;</option>
                        <option value="lte">&lt;=</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
                      <input
                        aria-label={`Variable condition ${index + 1} value`}
                        type="number"
                        className="min-w-0 px-2 py-1 text-[12px] border border-gray-200 rounded bg-white"
                        value={condition.value}
                        onChange={e => updateVariableCondition(index, { value: Number(e.target.value) })}
                      />
                      <button
                        type="button"
                        className="px-2 py-1 text-[11px] text-red-600 border border-red-100 rounded bg-white hover:bg-red-50"
                        onClick={() => removeVariableCondition(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVariableCondition}
                  className="inline-flex h-6 items-center rounded px-1.5 text-[11px] text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  Add variable condition
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-[12px] font-semibold text-gray-700">Movement</div>
              <Select
                label="Movement Type"
                value={page.movement.type}
                options={[
                  { value: 'fixed', label: 'Fixed' },
                  { value: 'random', label: 'Random' },
                  { value: 'approach', label: 'Approach player' },
                  { value: 'custom', label: 'Custom' },
                ]}
                onChange={v => updatePageMovement({ type: v as EventPageMovement['type'] })}
              />
              <Select
                label="Movement Speed"
                value={page.movement.speed}
                options={[
                  { value: 'oneEighth', label: '1/8x' },
                  { value: 'oneQuarter', label: '1/4x' },
                  { value: 'half', label: '1/2x' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'double', label: '2x' },
                  { value: 'quadruple', label: '4x' },
                ]}
                onChange={v => updatePageMovement({ speed: v as MovementSpeed })}
              />
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ['walking', 'Walking animation'],
                  ['stepping', 'Stepping animation'],
                  ['directionFix', 'Direction fix'],
                  ['through', 'Through'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-600">
                    <input
                      type="checkbox"
                      checked={page.options[key]}
                      onChange={e => updatePageOptions({ [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        <Select
          label="Solid"
          value={(page?.priority ?? (event.solid ? 'sameAsCharacters' : 'belowCharacters')) === 'sameAsCharacters' ? 'yes' : 'no'}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          onChange={v => page ? updatePage({ priority: v === 'yes' ? 'sameAsCharacters' : 'belowCharacters' }) : update({ solid: v === 'yes' })}
        />
        <Select
          label={page ? 'Page sprite' : 'Sprite'}
          value={pageGraphic.sprite ?? ''}
          options={activeSpriteOptions}
          onChange={v => updatePageGraphic({ sprite: v || undefined })}
        />
        <Select
          label="Portrait asset"
          value={event.portraitAssetId ?? ''}
          options={activePortraitAssetOptions}
          onChange={v => update({ portraitAssetId: v || undefined })}
        />
        <Select
          label="Concept asset"
          value={event.conceptAssetId ?? ''}
          options={activePortraitAssetOptions}
          onChange={v => update({ conceptAssetId: v || undefined })}
        />
        <PortraitGenerationPanel
          ownerKind="event"
          ownerId={event.id}
          ownerName={event.id}
          description={`${event.type} event at (${event.x}, ${event.y})`}
          assets={project.assets.assets}
          onAssetAccepted={(asset, portraitAssetId) => {
            dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset });
            update({ portraitAssetId });
          }}
        />
        <CharacterConceptGenerationPanel
          ownerKind="event"
          ownerId={event.id}
          ownerName={event.id}
          description={`${event.type} event at (${event.x}, ${event.y})`}
          assets={project.assets.assets}
          onAssetAccepted={(asset, conceptAssetId) => {
            dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset });
            update({ conceptAssetId });
          }}
        />
        <Input
          label={page ? 'Page animation set' : 'Animation Set'}
          value={pageGraphic.animationSet ?? ''}
          onChange={e => updatePageGraphic({ animationSet: e.target.value || undefined })}
        />
        <Input
          label={page ? 'Page display height (tiles)' : 'Display height (tiles)'}
          type="number"
          step="0.1"
          min="0.1"
          value={pageGraphic.displayHeightTiles ?? ''}
          onChange={e =>
            updatePageGraphic({
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
        <button className="inline-flex h-6 items-center text-[13px] font-medium text-indigo-600 border-b-2 border-indigo-500 cursor-pointer">
          Validation
        </button>
        <button className="inline-flex h-6 items-center text-[13px] text-gray-500 cursor-pointer hover:text-gray-700">Event Preview</button>
        <button className="inline-flex h-6 items-center text-[13px] text-gray-500 cursor-pointer hover:text-gray-700">Notes</button>
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
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  // Default to first event if none selected
  const selected = editor.selectedEvent;
  const selectedMapId = editor.selectedEventMapId ?? editor.selectedMapId;

  const map = project.maps[selectedMapId] ?? project.maps.town;
  // Always read fresh event from store
  const event = selected
    ? map?.events.find(e => e.id === selected.id) ?? map?.events[0]
    : map?.events[0];

  if (!event || !map) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
        <EmptyState
          align="center"
          icon={<Plus size={18} />}
          title="No events in this project"
          detail="Use the Events layer in the main editor palette. Place an NPC, chest, transfer, or trigger on a map, then return here to edit pages and commands."
        />
      </div>
    );
  }

  const pages = event.pages ?? [];
  const activePage = pages.find(page => page.id === selectedPageId) ?? pages[0] ?? null;
  const activePageId = activePage?.id ?? null;

  return (
    <div className="flex-1 flex overflow-hidden">
      <EventList />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <MapPreview event={event} map={map} />
            <EventPageTabs event={event} mapId={map.id} selectedPageId={activePageId} onSelect={setSelectedPageId} />
            <CommandStack key={`${map.id}:${event.id}:${activePageId ?? 'legacy'}`} event={event} mapId={map.id} page={activePage} />
          </div>
          <EventProperties event={event} mapId={map.id} page={activePage} />
        </div>
        <ValidationPanel event={event} map={map} mapIds={Object.keys(project.maps)} />
      </div>
    </div>
  );
}
