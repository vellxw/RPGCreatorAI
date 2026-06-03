import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Map,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useEditor } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import type { MapReference } from '../../types/project';
import { EmptyState } from '../ui/EmptyState';
import { SCENE_TEMPLATES } from '../../templates/sceneTemplates';
import { createMockProviderAdapter } from '../../providers/mockProviderAdapter';
import {
  generateMapDraftCandidate,
  validateMapDraftGenerationCandidate,
  approveMapDraftGenerationCandidate,
} from '../../providers/mapDraftGenerationWorkflow';


function slugifyMapId(name: string, existing: Set<string>): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'map';
  let candidate = base;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${base}_${n}`;
    n += 1;
  }
  return candidate;
}

function sortedChildren(refs: MapReference[], parentId: string | null): MapReference[] {
  return refs
    .filter(ref => (ref.parentId ?? null) === parentId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}

function mapNameFor(ref: MapReference, maps: Record<string, { name?: string }>): string {
  return maps[ref.id]?.name ?? ref.id;
}

function directChildCount(refs: MapReference[], mapId: string): number {
  return refs.filter(ref => (ref.parentId ?? null) === mapId).length;
}

export function MapTreePanel() {
  const { state: editor, dispatch: editorDispatch } = useEditor();
  const { state: project, dispatch: projectDispatch } = useProjectStore();
  const refs = project.project.maps;
  const existingIds = new Set(refs.map(ref => ref.id));
  const canDeleteAnyMap = refs.length > 1;

  const [showGenModal, setShowGenModal] = useState(false);
  const [genName, setGenName] = useState('Draft Map');
  const [genParentId, setGenParentId] = useState<string>('');
  const [genTemplateId, setGenTemplateId] = useState<string>('story-room-16x9');
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [genStatus, setGenStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const openMapDraftGeneration = () => {
    setGenName(`Draft Map ${refs.length + 1}`);
    setGenParentId('');
    setGenTemplateId('story-room-16x9');
    setGenPrompt('Draft a cozy room with comfortable seating, a treasure chest, and a friendly host.');
    setCandidate(null);
    setGenStatus(null);
    setShowGenModal(true);
  };

  const handleGenerateMap = async () => {
    setGenerating(true);
    setGenStatus(null);
    setCandidate(null);
    try {
      const mapId = slugifyMapId(genName, existingIds);
      const adapter = createMockProviderAdapter();
      const context = {
        existingMapIds: Object.keys(project.maps),
        tilesets: project.databases.tilesets,
        defaultTilesetId: project.maps[project.project.startMapId]?.tilesetId ?? 'sample-town',
      };
      const result = await generateMapDraftCandidate(
        adapter,
        context,
        {
          prompt: genPrompt,
          mapId,
          mapName: genName.trim(),
          templateId: genTemplateId,
        },
        {
          requestId: `map-gen-${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
      );
      // Validate candidate using validateMapDraftGenerationCandidate
      const validationErrors = validateMapDraftGenerationCandidate(result, context);
      if (validationErrors.length > 0) {
        setGenStatus({ tone: 'error', text: `Validation failed: ${validationErrors[0]}` });
        return;
      }
      setCandidate(result);
      setGenStatus({ tone: 'success', text: 'Map draft generated successfully! Please review below.' });
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptMap = () => {
    if (!candidate) return;
    try {
      const context = {
        existingMapIds: Object.keys(project.maps),
        tilesets: project.databases.tilesets,
        defaultTilesetId: project.maps[project.project.startMapId]?.tilesetId ?? 'sample-town',
      };
      const approved = approveMapDraftGenerationCandidate(candidate, context, {
        reviewedAt: new Date().toISOString(),
      });
      projectDispatch({
        type: 'ADD_GENERATED_MAP',
        map: approved.map,
        parentId: genParentId || null,
      });
      editorDispatch({ type: 'SELECT_MAP', mapId: approved.map.id });
      setShowGenModal(false);
      setCandidate(null);
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    }
  };

  const createMap = (parentId: string | null = null) => {
    const name = window.prompt('Map name', 'New Map');
    const normalizedName = name?.trim();
    if (!normalizedName) return;
    const mapId = slugifyMapId(normalizedName, existingIds);
    if (parentId) {
      projectDispatch({
        type: 'UPDATE_MAP_REFERENCE',
        mapId: parentId,
        changes: { expanded: true },
      });
    }
    projectDispatch({ type: 'CREATE_MAP', mapId, name: normalizedName, parentId, width: 20, height: 15 });
    editorDispatch({ type: 'SELECT_MAP', mapId });
  };

  const duplicateMap = (sourceMapId: string) => {
    const source = project.maps[sourceMapId];
    if (!source) return;
    const name = window.prompt('Duplicate map name', `${source.name} Copy`);
    const normalizedName = name?.trim();
    if (!normalizedName) return;
    const newMapId = slugifyMapId(normalizedName, existingIds);
    const sourceRef = refs.find(ref => ref.id === sourceMapId);
    const parentId = sourceRef?.parentId ?? null;
    if (parentId) {
      projectDispatch({
        type: 'UPDATE_MAP_REFERENCE',
        mapId: parentId,
        changes: { expanded: true },
      });
    }
    projectDispatch({ type: 'DUPLICATE_MAP', sourceMapId, newMapId, name: normalizedName });
    editorDispatch({ type: 'SELECT_MAP', mapId: newMapId });
  };

  const deleteMap = (mapId: string) => {
    const map = project.maps[mapId];
    if (!map) return;
    if (!canDeleteAnyMap || project.project.startMapId === mapId) return;
    const children = directChildCount(refs, mapId);
    const childWarning = children > 0
      ? `\n\n${children} child map${children === 1 ? '' : 's'} will stay in the project and move to root.`
      : '';
    if (!window.confirm(`Delete map "${map.name}"?${childWarning}\n\nUse Undo if this was accidental.`)) return;
    projectDispatch({ type: 'REMOVE_MAP', mapId });
    if (editor.selectedMapId === mapId) {
      editorDispatch({ type: 'SELECT_MAP', mapId: project.project.startMapId });
    }
  };

  const renameMap = (mapId: string) => {
    const map = project.maps[mapId];
    if (!map) return;
    const name = window.prompt('Map name', map.name);
    if (!name || name.trim() === map.name) return;
    projectDispatch({ type: 'UPDATE_MAP_PROPERTIES', mapId, changes: { name: name.trim() } });
  };

  const moveMap = (ref: MapReference, direction: -1 | 1) => {
    const siblings = sortedChildren(refs, ref.parentId ?? null);
    const index = siblings.findIndex(candidate => candidate.id === ref.id);
    const swap = siblings[index + direction];
    if (!swap) return;
    projectDispatch({ type: 'SWAP_MAP_ORDER', firstMapId: ref.id, secondMapId: swap.id });
  };

  const renderBranch = (parentId: string | null, depth = 0): ReactNode => {
    const children = sortedChildren(refs, parentId);
    return children.map((ref, index) => {
      const map = project.maps[ref.id];
      const hasChildren = refs.some(candidate => (candidate.parentId ?? null) === ref.id);
      const expanded = ref.expanded ?? true;
      const selected = editor.selectedMapId === ref.id;
      const mapName = mapNameFor(ref, project.maps);
      const canMoveUp = index > 0;
      const canMoveDown = index < children.length - 1;
      const canDelete = canDeleteAnyMap && project.project.startMapId !== ref.id;
      const deleteLabel = project.project.startMapId === ref.id
        ? `Start map ${mapName} cannot be deleted`
        : !canDeleteAnyMap
          ? `At least one map is required`
          : `Delete map ${mapName}`;
      return (
        <div key={ref.id}>
          <div
            className={`group flex items-center gap-1 px-2 py-1.5 text-[12px] ${
              selected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
            style={{ paddingLeft: 8 + depth * 14 }}
          >
            <button
              type="button"
              onClick={() =>
                projectDispatch({
                  type: 'UPDATE_MAP_REFERENCE',
                  mapId: ref.id,
                  changes: { expanded: !expanded },
                })
              }
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-700 disabled:cursor-default disabled:opacity-40"
              disabled={!hasChildren}
              aria-label={expanded ? `Collapse map group ${mapName}` : `Expand map group ${mapName}`}
              title={expanded ? `Collapse map group ${mapName}` : `Expand map group ${mapName}`}
            >
              {hasChildren ? expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : <span aria-hidden="true" className="block h-[13px] w-[13px]" />}
            </button>
            <button
              type="button"
              onClick={() => editorDispatch({ type: 'SELECT_MAP', mapId: ref.id })}
              onDoubleClick={() => renameMap(ref.id)}
              className="flex h-6 min-w-0 flex-1 items-center gap-1.5 text-left"
              title={map?.name ?? ref.id}
            >
              <Map size={13} className={selected ? 'text-indigo-500' : 'text-gray-400'} />
              <span className="truncate">{map?.name ?? ref.id}</span>
              {project.project.startMapId === ref.id && (
                <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded">Start</span>
              )}
            </button>
            <div className="hidden group-hover:flex group-focus-within:flex items-center gap-0.5">
              <button
                type="button"
                aria-label={`Move ${mapName} up`}
                title={`Move ${mapName} up`}
                disabled={!canMoveUp}
                onClick={() => moveMap(ref, -1)}
                className="p-1 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                aria-label={`Move ${mapName} down`}
                title={`Move ${mapName} down`}
                disabled={!canMoveDown}
                onClick={() => moveMap(ref, 1)}
                className="p-1 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                aria-label={`Duplicate map ${mapName}`}
                title={`Duplicate map ${mapName}`}
                onClick={() => duplicateMap(ref.id)}
                className="p-1 hover:bg-white rounded"
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                aria-label={`Create child map under ${mapName}`}
                title={`Create child map under ${mapName}`}
                onClick={() => createMap(ref.id)}
                className="p-1 hover:bg-white rounded"
              >
                <Plus size={12} />
              </button>
              <button
                type="button"
                aria-label={deleteLabel}
                title={deleteLabel}
                disabled={!canDelete}
                onClick={() => deleteMap(ref.id)}
                className="p-1 hover:bg-red-50 hover:text-red-600 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          {expanded && renderBranch(ref.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="h-[240px] flex-shrink-0 bg-white border-b border-gray-200 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
        <span className="text-[13px] font-semibold text-gray-700">Map Tree</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openMapDraftGeneration}
            aria-label="Generate map draft"
            title="Generate map draft"
            className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
          >
            <Sparkles size={14} />
          </button>
          <button
            type="button"
            onClick={() => createMap(null)}
            aria-label="Create root map"
            title="Create root map"
            className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {refs.length === 0 ? (
          <div className="p-3">
            <EmptyState
              compact
              icon={<Map size={15} />}
              title="No maps in this project"
              detail="A project needs at least one authored scene before painting, events, or playtest can start."
              action={
                <button
                  type="button"
                  onClick={() => createMap(null)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus size={12} />
                  Create the first map
                </button>
              }
            />
          </div>
        ) : (
          renderBranch(null)
        )}
      </div>

      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl flex flex-col max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-500" />
                Generate Map Draft
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowGenModal(false);
                  setCandidate(null);
                  setGenStatus(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {genStatus && (
                <div
                  className={`rounded border p-2.5 text-xs ${
                    genStatus.tone === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {genStatus.text}
                </div>
              )}

              {!candidate ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Map Name
                    </label>
                    <input
                      type="text"
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={genName}
                      onChange={e => setGenName(e.target.value)}
                      placeholder="e.g. Castle Interior"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Parent Map
                    </label>
                    <select
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      value={genParentId}
                      onChange={e => setGenParentId(e.target.value)}
                    >
                      <option value="">None (Root)</option>
                      {refs.map(ref => (
                        <option key={ref.id} value={ref.id}>
                          {mapNameFor(ref, project.maps)} ({ref.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Scene Template
                    </label>
                    <select
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={genTemplateId}
                      onChange={e => setGenTemplateId(e.target.value)}
                    >
                      {SCENE_TEMPLATES.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.label} ({t.aspectRatio})
                        </option>
                      ))}
                    </select>
                    {genTemplateId && (
                      <p className="mt-1 text-[11px] text-gray-400 italic">
                        {SCENE_TEMPLATES.find(t => t.id === genTemplateId)?.description}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      AI Prompt
                    </label>
                    <textarea
                      rows={3}
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      value={genPrompt}
                      onChange={e => setGenPrompt(e.target.value)}
                      placeholder="Describe what kind of layout, pathing, or entities you want to draft..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-gray-50 rounded border p-3">
                  <h4 className="text-xs font-semibold text-gray-700 border-b pb-1.5">
                    Candidate Review Details
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                    <div>
                      <span className="text-gray-400">Map ID:</span>{' '}
                      <span className="font-mono text-gray-800 font-semibold">{candidate.map.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Map Name:</span>{' '}
                      <span className="text-gray-800 font-semibold">{candidate.map.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Size:</span>{' '}
                      <span className="text-gray-800 font-mono">
                        {candidate.map.width} x {candidate.map.height}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Tileset ID:</span>{' '}
                      <span className="font-mono text-gray-800 font-mono">{candidate.map.tilesetId}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 block mb-1">
                      Layers ({candidate.map.layers.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {candidate.map.layers.map((l: any) => (
                        <span
                          key={l.name}
                          className="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1.5 py-0.5 text-[9px] font-mono"
                        >
                          {l.name} ({l.type})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 block mb-1">
                      Events ({candidate.map.events.length})
                    </span>
                    <ul className="text-[11px] text-gray-600 list-disc list-inside max-h-[100px] overflow-y-auto">
                      {candidate.map.events.map((e: any) => (
                        <li key={e.id}>
                          Event <span className="font-mono font-semibold text-gray-800">{e.id}</span> (
                          {e.trigger})
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t pt-2 mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Provenance:</span>
                    <span className="text-gray-500 font-mono">
                      {candidate.provenance.providerId}/{candidate.provenance.modelId}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t pt-3 flex-shrink-0">
              {!candidate ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowGenModal(false)}
                    className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={generating || !genName.trim() || !genPrompt.trim()}
                    onClick={handleGenerateMap}
                    aria-label="Generate Draft"
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {generating ? 'Generating...' : 'Generate Draft'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setCandidate(null)}
                    className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptMap}
                    aria-label="Accept and Insert"
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 flex items-center gap-1"
                  >
                    Accept & Insert
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
