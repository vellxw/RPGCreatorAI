import { useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { animationSheetKeys } from '../../assets/generated/assetCatalog';
import type {
  AnimationClipData,
  AnimationDatabaseData,
  AnimationSetData,
  Direction,
} from '../../types/project';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { CheckboxField, IdField, NumberField, SelectField, TextField } from './DatabaseFields';
import { AnimationPreview } from './AnimationPreview';

const DIRECTIONS: Array<Direction | 'any'> = ['down', 'left', 'right', 'up', 'any'];

interface AnimationsEditorProps {
  value: AnimationDatabaseData;
  onChange(value: AnimationDatabaseData): void;
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

export function AnimationsEditor({ value, onChange }: AnimationsEditorProps) {
  const [selectedId, setSelectedId] = useState(value.sets[0]?.id ?? '');
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const selected = value.sets.find(set => set.id === selectedId) ?? value.sets[0] ?? null;
  const selectedClip = selected?.clips[selectedClipIndex] ?? selected?.clips[0] ?? null;
  const ids = useMemo(() => new Set(value.sets.map(set => set.id)), [value.sets]);

  const emitSets = (sets: AnimationSetData[]) => onChange({ ...value, sets });
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

  const assetOptions = animationSheetKeys.map(key => ({ value: key, label: key }));
  const directionOptions = DIRECTIONS.map(direction => ({ value: direction, label: direction }));

  if (value.sets.length === 0 || !selected) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="No animation sets yet"
          detail="Add an animation set to define character display size, clips, frame timing, and anchors."
        />
        <Button size="sm" icon={<Plus size={12} />} aria-label="Add animation set" onClick={addSet}>
          Add animation set
        </Button>
      </div>
    );
  }

  return (
    <div className="grid max-w-6xl grid-cols-[minmax(180px,240px)_minmax(420px,1fr)] gap-4">
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-3">
          <Button size="sm" icon={<Plus size={12} />} aria-label="Add animation set" onClick={addSet}>
            Add animation set
          </Button>
        </div>
        <div className="max-h-[620px] overflow-y-auto">
          {value.sets.map(set => (
            <button
              key={set.id}
              type="button"
              className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-gray-50 ${
                selected.id === set.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
              }`}
              onClick={() => {
                setSelectedId(set.id);
                setSelectedClipIndex(0);
              }}
            >
              <span className="block truncate font-medium">{set.id}</span>
              <span className="block truncate text-[11px] text-gray-400">{set.clips.length} clips</span>
            </button>
          ))}
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
              aria-label={`Delete animation set ${selected.id}`}
              onClick={deleteSet}
            >
              Delete
            </Button>
          </div>
        </div>

        <AnimationPreview clip={selectedClip} display={selected.display} />

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
