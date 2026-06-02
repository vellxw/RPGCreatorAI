import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Map,
  Plus,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEditor } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import type { MapReference } from '../../types/project';
import { EmptyState } from '../ui/EmptyState';

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
              className="p-0.5 text-gray-400 hover:text-gray-700"
              disabled={!hasChildren}
              aria-label={expanded ? `Collapse map group ${mapName}` : `Expand map group ${mapName}`}
              title={expanded ? `Collapse map group ${mapName}` : `Expand map group ${mapName}`}
            >
              {hasChildren ? expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : <span className="block w-[13px]" />}
            </button>
            <button
              type="button"
              onClick={() => editorDispatch({ type: 'SELECT_MAP', mapId: ref.id })}
              onDoubleClick={() => renameMap(ref.id)}
              className="min-w-0 flex-1 flex items-center gap-1.5 text-left"
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
    </div>
  );
}
