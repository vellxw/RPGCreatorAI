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

export function MapTreePanel() {
  const { state: editor, dispatch: editorDispatch } = useEditor();
  const { state: project, dispatch: projectDispatch } = useProjectStore();
  const refs = project.project.maps;
  const existingIds = new Set(refs.map(ref => ref.id));

  const createMap = (parentId: string | null = null) => {
    const name = window.prompt('Map name', 'New Map');
    if (!name) return;
    const mapId = slugifyMapId(name, existingIds);
    projectDispatch({ type: 'CREATE_MAP', mapId, name, parentId, width: 20, height: 15 });
    editorDispatch({ type: 'SELECT_MAP', mapId });
  };

  const duplicateMap = (sourceMapId: string) => {
    const source = project.maps[sourceMapId];
    if (!source) return;
    const name = window.prompt('Duplicate map name', `${source.name} Copy`);
    if (!name) return;
    const newMapId = slugifyMapId(name, existingIds);
    projectDispatch({ type: 'DUPLICATE_MAP', sourceMapId, newMapId, name });
    editorDispatch({ type: 'SELECT_MAP', mapId: newMapId });
  };

  const deleteMap = (mapId: string) => {
    const map = project.maps[mapId];
    if (!map) return;
    if (!window.confirm(`Delete map "${map.name}"?`)) return;
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
    return children.map(ref => {
      const map = project.maps[ref.id];
      const hasChildren = refs.some(candidate => (candidate.parentId ?? null) === ref.id);
      const expanded = ref.expanded ?? true;
      const selected = editor.selectedMapId === ref.id;
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
              title={expanded ? 'Collapse map group' : 'Expand map group'}
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
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button type="button" title="Move up" onClick={() => moveMap(ref, -1)} className="p-1 hover:bg-white rounded">
                <ArrowUp size={12} />
              </button>
              <button type="button" title="Move down" onClick={() => moveMap(ref, 1)} className="p-1 hover:bg-white rounded">
                <ArrowDown size={12} />
              </button>
              <button type="button" title="Duplicate map" onClick={() => duplicateMap(ref.id)} className="p-1 hover:bg-white rounded">
                <Copy size={12} />
              </button>
              <button type="button" title="Create child map" onClick={() => createMap(ref.id)} className="p-1 hover:bg-white rounded">
                <Plus size={12} />
              </button>
              <button
                type="button"
                title="Delete map"
                onClick={() => deleteMap(ref.id)}
                className="p-1 hover:bg-red-50 hover:text-red-600 rounded"
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
          title="Create map"
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
