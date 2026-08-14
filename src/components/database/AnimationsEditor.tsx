import { useMemo, useState } from 'react';
import { Copy, Plus, Trash2, Upload } from 'lucide-react';
import { animationSheetKeys } from '../../assets/generated/assetCatalog';
import {
  importSpritesheetAsset,
  type SpritesheetImportRunner,
} from '../../adapters/spritesheetImport';
import {
  ANIMATION_PACKAGE_VERSION,
  validateAnimationPackage,
  type AnimationPackageQaReport,
  type AnimationPackageV1,
} from '../../animation/animationPackage';
import type { SpriteSheetGenerationRunner } from '../../providers/spriteSheetGenerationWorkflow';
import type {
  AnimationClipData,
  AnimationDatabaseData,
  AnimationSetData,
  AssetCatalogEntry,
  Direction,
} from '../../types/project';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { CheckboxField, IdField, NumberField, SelectField, TextField } from './DatabaseFields';
import { AnimationPreview } from './AnimationPreview';
import { SpriteSheetGenerationPanel } from './SpriteSheetGenerationPanel';

const DIRECTIONS: Array<Direction | 'any'> = ['down', 'left', 'right', 'up', 'any'];

interface AnimationsEditorProps {
  value: AnimationDatabaseData;
  assets?: AssetCatalogEntry[];
  assetPreviewUrls?: Record<string, string>;
  spritesheetImporter?: SpritesheetImportRunner;
  spriteSheetGenerator?: SpriteSheetGenerationRunner;
  referenceSources?: Record<string, string[]>;
  onAssetImported?(asset: AssetCatalogEntry): void;
  onChange(value: AnimationDatabaseData): void;
}

interface SpritesheetDraft {
  setId: string;
  name: string;
  action: string;
  direction: Direction | 'any';
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  loop: boolean;
  anchorX: number;
  anchorY: number;
  displayHeightTiles: number;
  displayWidthTiles: number;
  displayYOffsetPx: number;
}

function uniqueId(existing: Set<string>, base: string): string {
  let id = base;
  let index = 1;
  while (existing.has(id)) {
    index += 1;
    id = `${base}_${index}`;
  }
  return id;
}

function slugId(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function cloneSet(set: AnimationSetData): AnimationSetData {
  return JSON.parse(JSON.stringify(set)) as AnimationSetData;
}

function defaultClip(asset = animationSheetKeys[0]): AnimationClipData {
  return {
    action: 'idle',
    direction: 'down',
    asset,
    frameSize: { width: 64, height: 64 },
    frameCount: 4,
    fps: 4,
    loop: true,
    anchor: { x: 32, y: 54 },
  };
}

function defaultSet(id: string): AnimationSetData {
  return {
    id,
    display: { heightTiles: 1.5, widthTiles: 1, yOffsetPx: 0 },
    clips: [defaultClip()],
  };
}

function defaultSpritesheetDraft(index: number): SpritesheetDraft {
  return {
    setId: `spritesheet_${index}`,
    name: `Spritesheet ${index}`,
    action: 'idle',
    direction: 'down',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 4,
    fps: 8,
    loop: true,
    anchorX: 32,
    anchorY: 54,
    displayHeightTiles: 1.5,
    displayWidthTiles: 1,
    displayYOffsetPx: 0,
  };
}

function validateSpritesheetDraftBasics(draft: SpritesheetDraft): string | null {
  if (!draft.setId.trim()) return 'Animation set ID is required.';
  if (!draft.name.trim()) return 'Spritesheet name is required.';
  if (!draft.action.trim()) return 'Action is required.';
  if (!Number.isFinite(draft.frameWidth) || draft.frameWidth <= 0) return 'Frame width must be a positive number.';
  if (!Number.isFinite(draft.frameHeight) || draft.frameHeight <= 0) return 'Frame height must be a positive number.';
  if (!Number.isInteger(draft.frameCount) || draft.frameCount <= 0) return 'Frame count must be a positive integer.';
  if (!Number.isFinite(draft.fps) || draft.fps <= 0) return 'FPS must be a positive number.';
  if (!Number.isFinite(draft.anchorX)) return 'Anchor X must be finite.';
  if (!Number.isFinite(draft.anchorY)) return 'Anchor Y must be finite.';
  if (!Number.isFinite(draft.displayHeightTiles) || draft.displayHeightTiles <= 0) {
    return 'Display height tiles must be a positive number.';
  }
  if (!Number.isFinite(draft.displayWidthTiles) || draft.displayWidthTiles <= 0) {
    return 'Display width tiles must be a positive number.';
  }
  if (!Number.isFinite(draft.displayYOffsetPx)) return 'Display Y offset must be finite.';
  return null;
}

function buildDraftAnimationPackage(draft: SpritesheetDraft): AnimationPackageV1 {
  const packageId = slugId(draft.setId, 'spritesheet');
  return {
    schemaVersion: ANIMATION_PACKAGE_VERSION,
    id: packageId,
    source: {
      path: `assets/imported/${packageId}.png`,
      // The desktop importer replaces this authoring placeholder with the file digest.
      sha256: '0'.repeat(64),
      width: draft.frameWidth * draft.frameCount,
      height: draft.frameHeight,
      layout: 'grid',
    },
    grid: {
      columns: draft.frameCount,
      rows: 1,
      cellWidth: draft.frameWidth,
      cellHeight: draft.frameHeight,
    },
    clips: [{
      id: `${slugId(draft.action, 'idle')}.${draft.direction}`,
      action: slugId(draft.action, 'idle'),
      direction: draft.direction,
      frameIndices: Array.from({ length: draft.frameCount }, (_, index) => index),
      fps: draft.fps,
      loop: draft.loop,
      anchor: { x: draft.anchorX, y: draft.anchorY },
    }],
  };
}

function inspectSpritesheetDraft(draft: SpritesheetDraft): {
  packageData: AnimationPackageV1 | null;
  report: AnimationPackageQaReport | null;
  error: string | null;
} {
  const basicError = validateSpritesheetDraftBasics(draft);
  if (basicError) return { packageData: null, report: null, error: basicError };

  const packageData = buildDraftAnimationPackage(draft);
  const report = validateAnimationPackage(packageData);
  const error = report.issues.find(issue => issue.severity === 'error');
  return {
    packageData,
    report,
    error: error ? `AnimationPackage v1 ${error.path}: ${error.message}` : null,
  };
}

function validateSpritesheetDraft(draft: SpritesheetDraft): string | null {
  return inspectSpritesheetDraft(draft).error;
}

function SpritesheetMetadataPreview({ draft }: { draft: SpritesheetDraft }) {
  const frames = Math.max(1, Math.min(12, Math.trunc(draft.frameCount || 1)));
  const inspection = useMemo(() => inspectSpritesheetDraft(draft), [draft]);
  const manifest = inspection.packageData;
  const report = inspection.report;
  return (
    <div className="space-y-3 rounded border border-gray-200 bg-white p-3">
      <div
        aria-label="Spritesheet metadata preview"
        role="img"
        className="grid h-20 overflow-hidden rounded bg-gray-100"
        style={{ gridTemplateColumns: `repeat(${frames}, minmax(24px, 1fr))` }}
      >
        {Array.from({ length: frames }, (_, index) => (
          <div
            key={index}
            className="relative border-r border-white/80 last:border-r-0"
          >
            <div
              className="absolute bottom-1 h-px bg-indigo-500/70"
              style={{ left: 0, right: 0 }}
            />
            <div
              className="absolute top-0 bottom-0 w-px bg-indigo-500/70"
              style={{
                left: `${Math.max(0, Math.min(100, (draft.anchorX / Math.max(1, draft.frameWidth)) * 100))}%`,
              }}
            />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-500">
        {draft.action}/{draft.direction} · {draft.frameWidth}x{draft.frameHeight} · {draft.frameCount} frames @ {draft.fps} fps
      </p>
      <div
        aria-label="AnimationPackage v1 validation"
        className={`rounded border px-3 py-2 text-[11px] ${
          inspection.error
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">AnimationPackage v1</span>
          <span>{inspection.error ? 'Invalid' : 'Valid for import'}</span>
        </div>
        {inspection.error ? (
          <p className="mt-1">{inspection.error}</p>
        ) : report ? (
          <p className="mt-1">
            {report.summary.clipCount} clip · {report.summary.frameCount} frames · {report.summary.errors} errors · {report.summary.warnings} warnings
          </p>
        ) : null}
      </div>
      {manifest && (
        <dl aria-label="AnimationPackage v1 manifest preview" className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-gray-600">
          <dt className="font-medium text-gray-500">Package</dt>
          <dd className="truncate font-mono">{manifest.id}</dd>
          <dt className="font-medium text-gray-500">Source</dt>
          <dd>{manifest.source.width}x{manifest.source.height} grid</dd>
          <dt className="font-medium text-gray-500">Grid</dt>
          <dd>{manifest.grid.columns}x{manifest.grid.rows} · {manifest.grid.cellWidth}x{manifest.grid.cellHeight} cells</dd>
          <dt className="font-medium text-gray-500">Clip</dt>
          <dd className="truncate font-mono">{manifest.clips[0]?.id}</dd>
          <dt className="font-medium text-gray-500">Anchor</dt>
          <dd>{manifest.clips[0]?.anchor?.x}, {manifest.clips[0]?.anchor?.y} px</dd>
        </dl>
      )}
    </div>
  );
}

export function AnimationsEditor({
  value,
  assets = [],
  assetPreviewUrls = {},
  spritesheetImporter = importSpritesheetAsset,
  spriteSheetGenerator,
  referenceSources = {},
  onAssetImported,
  onChange,
}: AnimationsEditorProps) {
  const [selectedId, setSelectedId] = useState(value.sets[0]?.id ?? '');
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [spritesheetDraft, setSpritesheetDraft] = useState<SpritesheetDraft | null>(null);
  const [spritesheetImporting, setSpritesheetImporting] = useState(false);
  const [spritesheetStatus, setSpritesheetStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const selected = value.sets.find(set => set.id === selectedId) ?? value.sets[0] ?? null;
  const selectedClip = selected?.clips[selectedClipIndex] ?? selected?.clips[0] ?? null;
  const ids = useMemo(() => new Set(value.sets.map(set => set.id)), [value.sets]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSets = useMemo(
    () => (
      normalizedQuery
        ? value.sets.filter(set => set.id.toLowerCase().includes(normalizedQuery))
        : value.sets
    ),
    [normalizedQuery, value.sets],
  );
  const selectedHidden = Boolean(
    normalizedQuery &&
    selected &&
    !filteredSets.some(set => set.id === selected.id),
  );

  const emitSets = (sets: AnimationSetData[]) => onChange({ ...value, sets });
  const openSpritesheetImport = () => {
    setSpritesheetDraft(defaultSpritesheetDraft(value.sets.length + 1));
    setSpritesheetStatus(null);
  };
  const updateSpritesheetDraft = (changes: Partial<SpritesheetDraft>) => {
    setSpritesheetDraft(current => current ? { ...current, ...changes } : current);
  };
  const acceptSpritesheetImport = async () => {
    if (!spritesheetDraft) return;
    const validationError = validateSpritesheetDraft(spritesheetDraft);
    if (validationError) {
      setSpritesheetStatus({ tone: 'error', text: validationError });
      return;
    }

    setSpritesheetImporting(true);
    setSpritesheetStatus(null);
    try {
      const result = await spritesheetImporter(
        assets.map(asset => asset.id),
        {
          idBase: slugId(spritesheetDraft.name, 'spritesheet'),
          name: spritesheetDraft.name.trim(),
          frameWidth: spritesheetDraft.frameWidth,
          frameHeight: spritesheetDraft.frameHeight,
          frameCount: spritesheetDraft.frameCount,
        },
      );
      if (result.cancelled) return;
      if (!result.success || !result.asset) {
        setSpritesheetStatus({ tone: 'error', text: result.error ?? 'Spritesheet import failed.' });
        return;
      }

      onAssetImported?.(result.asset);
      const nextSetId = uniqueId(ids, slugId(spritesheetDraft.setId, `spritesheet_${value.sets.length + 1}`));
      const nextSet: AnimationSetData = {
        id: nextSetId,
        display: {
          heightTiles: spritesheetDraft.displayHeightTiles,
          widthTiles: spritesheetDraft.displayWidthTiles,
          yOffsetPx: spritesheetDraft.displayYOffsetPx,
        },
        clips: [
          {
            action: spritesheetDraft.action.trim(),
            direction: spritesheetDraft.direction,
            asset: result.asset.id,
            frameSize: {
              width: spritesheetDraft.frameWidth,
              height: spritesheetDraft.frameHeight,
            },
            frameCount: spritesheetDraft.frameCount,
            fps: spritesheetDraft.fps,
            loop: spritesheetDraft.loop,
            anchor: {
              x: spritesheetDraft.anchorX,
              y: spritesheetDraft.anchorY,
            },
          },
        ],
      };
      emitSets([...value.sets, nextSet]);
      setSelectedId(nextSet.id);
      setSelectedClipIndex(0);
      setSpritesheetDraft(null);
      setSpritesheetStatus({ tone: 'success', text: `Imported ${result.asset.name}` });
    } catch (error) {
      setSpritesheetStatus({ tone: 'error', text: (error as Error).message });
    } finally {
      setSpritesheetImporting(false);
    }
  };
  const updateSelected = (changes: Partial<AnimationSetData>) => {
    if (!selected) return;
    emitSets(value.sets.map(set => (
      set.id === selected.id ? { ...set, ...changes, id: changes.id ?? set.id } : set
    )));
    if (changes.id) setSelectedId(changes.id);
  };
  const updateDisplay = (changes: Partial<NonNullable<AnimationSetData['display']>>) => {
    updateSelected({ display: { heightTiles: 1.5, ...(selected?.display ?? {}), ...changes } });
  };
  const updateClip = (index: number, changes: Partial<AnimationClipData>) => {
    if (!selected) return;
    updateSelected({
      clips: selected.clips.map((clip, clipIndex) => (
        clipIndex === index ? { ...clip, ...changes } : clip
      )),
    });
  };

  const addSet = () => {
    const id = uniqueId(ids, `animation_${value.sets.length + 1}`);
    emitSets([...value.sets, defaultSet(id)]);
    setSelectedId(id);
    setSelectedClipIndex(0);
  };

  const duplicateSet = () => {
    if (!selected) return;
    const next = cloneSet(selected);
    next.id = uniqueId(ids, `${selected.id}_copy`);
    emitSets([...value.sets, next]);
    setSelectedId(next.id);
    setSelectedClipIndex(0);
  };

  const deleteSet = () => {
    if (!selected) return;
    const refs = referenceSources[selected.id] ?? [];
    if (refs.length > 0) {
      const listed = refs.slice(0, 8).map(source => `- ${source}`).join('\n');
      const remaining = refs.length > 8 ? `\n...and ${refs.length - 8} more.` : '';
      alert(`Cannot delete animation set "${selected.id}" because it is still referenced:\n${listed}${remaining}`);
      return;
    }
    if (!confirm(`Delete animation set "${selected.id}"?`)) return;
    const next = value.sets.filter(set => set.id !== selected.id);
    emitSets(next);
    setSelectedId(next[0]?.id ?? '');
    setSelectedClipIndex(0);
  };

  const addClip = () => {
    if (!selected) return;
    updateSelected({ clips: [...selected.clips, defaultClip()] });
    setSelectedClipIndex(selected.clips.length);
  };

  const duplicateClip = (index: number) => {
    if (!selected) return;
    const clip = selected.clips[index];
    if (!clip) return;
    updateSelected({ clips: [...selected.clips, { ...JSON.parse(JSON.stringify(clip)) }] });
    setSelectedClipIndex(selected.clips.length);
  };

  const deleteClip = (index: number) => {
    if (!selected) return;
    const clips = selected.clips.filter((_, clipIndex) => clipIndex !== index);
    updateSelected({ clips });
    setSelectedClipIndex(Math.max(0, Math.min(index, clips.length - 1)));
  };

  const assetOptions = [
    ...animationSheetKeys.map(key => ({ value: key, label: key })),
    ...assets
      .filter(asset => asset.kind === 'spritesheet')
      .map(asset => ({ value: asset.id, label: `${asset.name} (${asset.id})` })),
  ];
  const directionOptions = DIRECTIONS.map(direction => ({ value: direction, label: direction }));
  const generatedSpriteSheetControls = (
    <SpriteSheetGenerationPanel
      assets={assets}
      existingAnimationSetIds={value.sets.map(set => set.id)}
      spriteSheetGenerator={spriteSheetGenerator}
      onAssetAccepted={(asset, animationSet) => {
        onAssetImported?.(asset);
        emitSets([...value.sets, animationSet]);
        setSelectedId(animationSet.id);
        setSelectedClipIndex(0);
      }}
    />
  );
  const importControls = (
    <>
      {spritesheetStatus && (
        <div
          className={`rounded-md border px-3 py-2 text-[12px] ${
            spritesheetStatus.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {spritesheetStatus.text}
        </div>
      )}
      {spritesheetDraft && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-gray-700">Spritesheet import</p>
            <Button
              size="sm"
              aria-label="Cancel spritesheet import"
              onClick={() => setSpritesheetDraft(null)}
            >
              Cancel
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Spritesheet set ID" value={spritesheetDraft.setId} onChange={setId => updateSpritesheetDraft({ setId })} />
            <TextField label="Spritesheet name" value={spritesheetDraft.name} onChange={name => updateSpritesheetDraft({ name })} />
            <TextField label="Spritesheet action" value={spritesheetDraft.action} onChange={action => updateSpritesheetDraft({ action })} />
            <SelectField
              label="Spritesheet direction"
              value={spritesheetDraft.direction}
              options={directionOptions}
              onChange={direction => updateSpritesheetDraft({ direction: direction as Direction | 'any' })}
            />
            <NumberField label="Spritesheet frame width" value={spritesheetDraft.frameWidth} min={1} onChange={frameWidth => updateSpritesheetDraft({ frameWidth })} />
            <NumberField label="Spritesheet frame height" value={spritesheetDraft.frameHeight} min={1} onChange={frameHeight => updateSpritesheetDraft({ frameHeight })} />
            <NumberField label="Spritesheet frame count" value={spritesheetDraft.frameCount} min={1} onChange={frameCount => updateSpritesheetDraft({ frameCount })} />
            <NumberField label="Spritesheet FPS" value={spritesheetDraft.fps} min={1} onChange={fps => updateSpritesheetDraft({ fps })} />
            <NumberField label="Spritesheet anchor X" value={spritesheetDraft.anchorX} onChange={anchorX => updateSpritesheetDraft({ anchorX })} />
            <NumberField label="Spritesheet anchor Y" value={spritesheetDraft.anchorY} onChange={anchorY => updateSpritesheetDraft({ anchorY })} />
            <NumberField label="Spritesheet display height tiles" value={spritesheetDraft.displayHeightTiles} min={0.1} step={0.1} onChange={displayHeightTiles => updateSpritesheetDraft({ displayHeightTiles })} />
            <NumberField label="Spritesheet display width tiles" value={spritesheetDraft.displayWidthTiles} min={0.1} step={0.1} onChange={displayWidthTiles => updateSpritesheetDraft({ displayWidthTiles })} />
            <NumberField label="Spritesheet display Y offset px" value={spritesheetDraft.displayYOffsetPx} onChange={displayYOffsetPx => updateSpritesheetDraft({ displayYOffsetPx })} />
            <CheckboxField label="Spritesheet loop" checked={spritesheetDraft.loop} onChange={loop => updateSpritesheetDraft({ loop })} />
          </div>
          <div className="mt-3">
            <SpritesheetMetadataPreview draft={spritesheetDraft} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              icon={<Upload size={12} />}
              aria-label="Accept spritesheet import"
              disabled={spritesheetImporting}
              onClick={acceptSpritesheetImport}
            >
              Accept spritesheet import
            </Button>
          </div>
        </div>
      )}
    </>
  );

  if (value.sets.length === 0 || !selected) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="No animation sets yet"
          detail="Add an animation set to define character display size, clips, frame timing, and anchors."
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Plus size={12} />} aria-label="Add animation set" onClick={addSet}>
            Add animation set
          </Button>
          <Button size="sm" icon={<Upload size={12} />} aria-label="Import spritesheet" onClick={openSpritesheetImport}>
            Import spritesheet
          </Button>
        </div>
        {importControls}
        {generatedSpriteSheetControls}
      </div>
    );
  }

  return (
    <div className="grid max-w-6xl grid-cols-[minmax(180px,240px)_minmax(420px,1fr)] gap-4">
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Plus size={12} />} aria-label="Add animation set" onClick={addSet}>
              Add animation set
            </Button>
            <Button size="sm" icon={<Upload size={12} />} aria-label="Import spritesheet" onClick={openSpritesheetImport}>
              Import spritesheet
            </Button>
          </div>
        </div>
        <div className="space-y-2 border-b border-gray-100 p-3">
          <input
            aria-label="Search animation sets"
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Search animation sets..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
            <span>Showing {filteredSets.length} of {value.sets.length} animation sets</span>
            {normalizedQuery && (
              <button
                type="button"
                aria-label="Clear animation set search"
                className="inline-flex h-6 items-center rounded px-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                onClick={() => setQuery('')}
              >
                Clear
              </button>
            )}
          </div>
          {selectedHidden && selected && (
            <div className="rounded border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              Selected {selected.id} is hidden by this filter.
            </div>
          )}
        </div>
        <div className="max-h-[620px] overflow-y-auto">
          {filteredSets.length === 0 ? (
            <div className="p-3">
              <EmptyState
                compact
                title={`No animation sets match "${query.trim()}"`}
                detail="Clear the search or add a new animation set."
              />
            </div>
          ) : filteredSets.map(set => {
            const refCount = referenceSources[set.id]?.length ?? 0;
            return (
            <button
              key={set.id}
              type="button"
              aria-label={`Select animation set ${set.id}`}
              className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-gray-50 ${
                selected.id === set.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
              }`}
              onClick={() => {
                setSelectedId(set.id);
                setSelectedClipIndex(0);
              }}
            >
              <span className="flex items-center gap-1.5">
                <span className="block min-w-0 flex-1 truncate font-medium">{set.id}</span>
                {refCount > 0 && (
                  <span className="flex-shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    {refCount} ref{refCount === 1 ? '' : 's'}
                  </span>
                )}
              </span>
              <span className="block truncate text-[11px] text-gray-400">{set.clips.length} clips</span>
            </button>
          );
          })}
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="grid max-w-xl flex-1 grid-cols-2 gap-3">
            <IdField label="Animation set ID" value={selected.id} onChange={id => updateSelected({ id })} />
            <NumberField
              label="Display height tiles"
              value={selected.display?.heightTiles ?? 1.5}
              min={0.1}
              step={0.1}
              onChange={heightTiles => updateDisplay({ heightTiles })}
            />
            <NumberField
              label="Display width tiles"
              value={selected.display?.widthTiles ?? 1}
              min={0.1}
              step={0.1}
              onChange={widthTiles => updateDisplay({ widthTiles })}
            />
            <NumberField
              label="Display Y offset px"
              value={selected.display?.yOffsetPx ?? 0}
              onChange={yOffsetPx => updateDisplay({ yOffsetPx })}
            />
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              icon={<Copy size={12} />}
              aria-label={`Duplicate animation set ${selected.id}`}
              onClick={duplicateSet}
            >
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={12} />}
              aria-label={
                (referenceSources[selected.id]?.length ?? 0) > 0
                  ? `Delete animation set ${selected.id} blocked by ${referenceSources[selected.id].length} reference${referenceSources[selected.id].length === 1 ? '' : 's'}`
                  : `Delete animation set ${selected.id}`
              }
              onClick={deleteSet}
            >
              Delete
            </Button>
          </div>
        </div>

        {importControls}
        {generatedSpriteSheetControls}

        <AnimationPreview clip={selectedClip} display={selected.display} assetPreviewUrls={assetPreviewUrls} />

        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-gray-600">Clips</p>
          <Button size="sm" icon={<Plus size={12} />} onClick={addClip}>
            Add clip
          </Button>
        </div>

        <div className="space-y-3">
          {selected.clips.map((clip, index) => (
            <div
              key={`${clip.action}-${clip.direction}-${index}`}
              className={`border bg-white p-3 ${
                selectedClipIndex === index ? 'border-indigo-200' : 'border-gray-200'
              }`}
              onClick={() => setSelectedClipIndex(index)}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left text-[13px] font-semibold text-gray-700"
                  onClick={() => setSelectedClipIndex(index)}
                >
                  {clip.action}/{clip.direction}
                </button>
                <div className="flex gap-1">
                  <Button size="sm" icon={<Copy size={12} />} onClick={() => duplicateClip(index)}>
                    Duplicate
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 size={12} />} onClick={() => deleteClip(index)}>
                    Delete
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <TextField label={`Clip action ${index + 1}`} value={clip.action} onChange={action => updateClip(index, { action })} />
                <SelectField
                  label={`Clip direction ${index + 1}`}
                  value={clip.direction}
                  options={directionOptions}
                  onChange={direction => updateClip(index, { direction: direction as AnimationClipData['direction'] })}
                />
                <SelectField
                  label={`Clip asset ${index + 1}`}
                  value={clip.asset}
                  options={assetOptions}
                  onChange={asset => updateClip(index, { asset })}
                />
                <NumberField
                  label={`Frame width ${index + 1}`}
                  value={clip.frameSize.width}
                  min={1}
                  onChange={width => updateClip(index, { frameSize: { ...clip.frameSize, width } })}
                />
                <NumberField
                  label={`Frame height ${index + 1}`}
                  value={clip.frameSize.height}
                  min={1}
                  onChange={height => updateClip(index, { frameSize: { ...clip.frameSize, height } })}
                />
                <NumberField
                  label={`Frame count ${index + 1}`}
                  value={clip.frameCount}
                  min={1}
                  onChange={frameCount => updateClip(index, { frameCount })}
                />
                <NumberField
                  label={`FPS ${index + 1}`}
                  value={clip.fps}
                  min={1}
                  onChange={fps => updateClip(index, { fps })}
                />
                <NumberField
                  label={`Anchor X ${index + 1}`}
                  value={clip.anchor.x}
                  onChange={x => updateClip(index, { anchor: { ...clip.anchor, x } })}
                />
                <NumberField
                  label={`Anchor Y ${index + 1}`}
                  value={clip.anchor.y}
                  onChange={y => updateClip(index, { anchor: { ...clip.anchor, y } })}
                />
                <CheckboxField label={`Loop ${index + 1}`} checked={clip.loop} onChange={loop => updateClip(index, { loop })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
