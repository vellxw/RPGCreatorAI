import { useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { AnimationSetData, AssetCatalogEntry, Direction } from '../../types/project';
import { Button } from '../ui/Button';
import { CheckboxField, NumberField, SelectField, TextareaField, TextField } from './DatabaseFields';
import {
  GeneratedImageVisualQaReviewPanel,
  type GeneratedImageVisualQaReviewValue,
} from '../assets/GeneratedImageVisualQaReviewPanel';
import {
  applyGeneratedImageVisualQaResult,
  buildGeneratedImageVisualQaDraft,
  finalizeGeneratedImageVisualQaReview,
} from '../../providers/generatedImageVisualQa';
import {
  approveSpriteSheetGenerationCandidate,
  defaultSpriteSheetGenerationDraft,
  generateSpriteSheetDraft,
  type SpriteSheetGenerationCandidate,
  type SpriteSheetGenerationDraft,
  type SpriteSheetGenerationRunner,
  type SpriteSheetOwnerKind,
} from '../../providers/spriteSheetGenerationWorkflow';
import {
  applyGeneratedAnimationQaResult,
  buildGeneratedAnimationQaDraft,
  finalizeGeneratedAnimationQaReview,
  type GeneratedAnimationQaDraft,
} from '../../providers/generatedAnimationQa';

interface SpriteSheetGenerationPanelProps {
  assets: AssetCatalogEntry[];
  existingAnimationSetIds: string[];
  spriteSheetGenerator?: SpriteSheetGenerationRunner;
  onAssetAccepted(asset: AssetCatalogEntry, animationSet: AnimationSetData): void;
}

const DIRECTIONS: Array<Direction | 'any'> = ['down', 'left', 'right', 'up', 'any'];

const EMPTY_QA_REVIEW: GeneratedImageVisualQaReviewValue = {
  notes: '',
  tags: 'qa-reviewed',
  rejectionReason: '',
  checks: {},
};

function parseTags(value: string): string[] {
  return value.split(',').map(tag => tag.trim()).filter(Boolean);
}

function isConceptAsset(asset: AssetCatalogEntry): boolean {
  return (
    (asset.kind === 'image' || asset.kind === 'generated') &&
    (
      asset.tags?.includes('character-concept') ||
      asset.generated?.promptTemplateId === 'character-concept-v1'
    )
  );
}

function ownerKindFromAsset(asset?: AssetCatalogEntry): SpriteSheetOwnerKind {
  const kind = asset?.generated?.ownerKind;
  return kind === 'actor' || kind === 'event' ? kind : 'animation';
}

function ownerIdFromAsset(asset?: AssetCatalogEntry): string {
  return asset?.generated?.ownerId ?? asset?.id ?? 'generated_sprite_sheet';
}

function ownerNameFromAsset(asset?: AssetCatalogEntry): string {
  return asset?.generated?.ownerName ?? asset?.name.replace(/\s+Concept$/i, '') ?? 'Generated Sprite';
}

function createDraft(sourceConceptAsset?: AssetCatalogEntry): SpriteSheetGenerationDraft {
  return defaultSpriteSheetGenerationDraft({
    ownerKind: ownerKindFromAsset(sourceConceptAsset),
    ownerId: ownerIdFromAsset(sourceConceptAsset),
    ownerName: ownerNameFromAsset(sourceConceptAsset),
    sourceConceptAsset,
    description: sourceConceptAsset
      ? `Generated from reviewed concept asset ${sourceConceptAsset.id}.`
      : 'Generated from animation metadata without a selected source concept.',
  });
}

function updatePromptInput(
  draft: SpriteSheetGenerationDraft,
  key: keyof SpriteSheetGenerationDraft['promptInputs'],
  value: string,
): SpriteSheetGenerationDraft {
  return {
    ...draft,
    promptInputs: {
      ...draft.promptInputs,
      [key]: value,
    },
  };
}

function SpriteSheetMetadataPreview({ draft }: { draft: SpriteSheetGenerationDraft }) {
  const frames = Math.max(1, Math.min(12, Math.trunc(draft.frameCount || 1)));
  return (
    <div className="rounded border border-sky-100 bg-white p-3">
      <div
        aria-label="Sprite sheet generation metadata preview"
        role="img"
        className="grid h-20 overflow-hidden rounded bg-sky-50"
        style={{ gridTemplateColumns: `repeat(${frames}, minmax(24px, 1fr))` }}
      >
        {Array.from({ length: frames }, (_, index) => (
          <div
            key={index}
            className="relative border-r border-white last:border-r-0"
          >
            <div
              className="absolute bottom-1 h-px bg-sky-600/70"
              style={{ left: 0, right: 0 }}
            />
            <div
              className="absolute top-0 bottom-0 w-px bg-sky-600/70"
              style={{
                left: `${Math.max(0, Math.min(100, (draft.anchorX / Math.max(1, draft.frameWidth)) * 100))}%`,
              }}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-sky-700">
        {draft.action}/{draft.direction} - {draft.frameWidth}x{draft.frameHeight} - {draft.frameCount} frames @ {draft.fps} fps
      </p>
    </div>
  );
}

function CharacterAnimationQaPanel({
  draft,
  notes,
  status,
  onNotesChange,
  onAccept,
  onReject,
}: {
  draft: GeneratedAnimationQaDraft;
  notes: string;
  status?: string;
  onNotesChange(value: string): void;
  onAccept(): void;
  onReject(): void;
}) {
  const checks = Object.values(draft.checks);
  const hasFailures = checks.some(check => check.status === 'fail');
  const toneClass = status === 'accepted'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'rejected'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-sky-100 bg-sky-50 text-sky-700';

  return (
    <div aria-label="Character animation QA" className="border border-sky-100 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-sky-900">Character animation QA</p>
          <p className="text-[11px] text-sky-700">
            Review preview, metadata, coverage, and runtime compatibility before project insertion.
          </p>
        </div>
        {status && (
          <span className={`rounded border px-2 py-1 text-[11px] font-medium ${toneClass}`}>
            Animation QA {status}
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {checks.map(check => (
          <div key={check.id} className="border border-gray-100 bg-gray-50 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-gray-700">{check.label}</p>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  check.status === 'pass'
                    ? 'bg-emerald-100 text-emerald-700'
                    : check.status === 'warning'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {check.status}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">{check.notes}</p>
            {(check.expected || check.actual) && (
              <p className="mt-1 truncate font-mono text-[10px] text-gray-400">
                {check.expected ?? 'expected unknown'} / {check.actual ?? 'actual unknown'}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3">
        <TextareaField
          label="Character animation QA notes"
          value={notes}
          onChange={onNotesChange}
          placeholder="Frame readability, anchor stability, rejection notes, or handoff details."
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">
          {hasFailures
            ? 'Resolve failed checks before accepting this generated animation.'
            : 'All required generated-animation checks are ready for an explicit decision.'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="danger"
            onClick={onReject}
            aria-label="Reject character animation QA"
          >
            Reject animation QA
          </Button>
          <Button
            size="sm"
            disabled={hasFailures}
            onClick={onAccept}
            aria-label="Accept character animation QA"
          >
            Accept animation QA
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SpriteSheetGenerationPanel({
  assets,
  existingAnimationSetIds,
  spriteSheetGenerator = generateSpriteSheetDraft,
  onAssetAccepted,
}: SpriteSheetGenerationPanelProps) {
  const conceptAssets = useMemo(() => assets.filter(isConceptAsset), [assets]);
  const [open, setOpen] = useState(false);
  const [sourceConceptAssetId, setSourceConceptAssetId] = useState('');
  const [draft, setDraft] = useState<SpriteSheetGenerationDraft>(() => createDraft());
  const [candidate, setCandidate] = useState<SpriteSheetGenerationCandidate | null>(null);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [qaReview, setQaReview] = useState<GeneratedImageVisualQaReviewValue>(EMPTY_QA_REVIEW);
  const [animationQaNotes, setAnimationQaNotes] = useState('');
  const selectedSource = conceptAssets.find(asset => asset.id === sourceConceptAssetId);
  const sourceOptions = [
    { value: '', label: '(none)' },
    ...conceptAssets.map(asset => ({ value: asset.id, label: `${asset.name} (${asset.id})` })),
  ];
  const directionOptions = DIRECTIONS.map(direction => ({ value: direction, label: direction }));

  const openPanel = () => {
    const source = conceptAssets[0];
    setSourceConceptAssetId(source?.id ?? '');
    setDraft(createDraft(source));
    setCandidate(null);
    setQaReview(EMPTY_QA_REVIEW);
    setAnimationQaNotes('');
    setStatus('');
    setOpen(true);
  };

  const changeSourceConcept = (id: string) => {
    const source = conceptAssets.find(asset => asset.id === id);
    setSourceConceptAssetId(id);
    setDraft(current => ({
      ...createDraft(source),
      animationSetId: current.animationSetId,
      name: current.name,
      action: current.action,
      direction: current.direction,
      frameWidth: current.frameWidth,
      frameHeight: current.frameHeight,
      frameCount: current.frameCount,
      fps: current.fps,
      loop: current.loop,
      anchorX: current.anchorX,
      anchorY: current.anchorY,
      displayHeightTiles: current.displayHeightTiles,
      displayWidthTiles: current.displayWidthTiles,
      displayYOffsetPx: current.displayYOffsetPx,
    }));
  };

  const runGeneration = async () => {
    setRunning(true);
    setStatus('');
    setCandidate(null);
    setAnimationQaNotes('');
    try {
      const result = await spriteSheetGenerator(
        assets.map(asset => asset.id),
        existingAnimationSetIds,
        {
          ...draft,
          sourceConceptAsset: selectedSource,
        },
      );
      if (!result.success || !result.candidate) {
        setStatus(result.error ?? 'Sprite sheet generation did not return a candidate.');
        return;
      }
      setCandidate(result.candidate);
      setQaReview(EMPTY_QA_REVIEW);
      setAnimationQaNotes('');
      setStatus('Candidate ready for review.');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const acceptCandidate = () => {
    if (!candidate) return;
    try {
      if (candidate.asset.generated?.animationQa?.status !== 'accepted') {
        setStatus('Accept character animation QA before adding this sprite sheet.');
        return;
      }
      const reviewedAt = new Date().toISOString();
      const qaResult = finalizeGeneratedImageVisualQaReview(
        buildGeneratedImageVisualQaDraft(candidate.asset, candidate.qaPreview),
        {
          status: 'accepted',
          reviewedAt,
          notes: qaReview.notes,
          tags: parseTags(qaReview.tags),
          checks: qaReview.checks,
        },
      );
      const approved = approveSpriteSheetGenerationCandidate(candidate, { reviewedAt });
      onAssetAccepted(applyGeneratedImageVisualQaResult(approved.asset, qaResult), approved.animationSet);
      setCandidate(null);
      setStatus(`Added ${approved.animationSet.id}.`);
      setOpen(false);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const acceptAnimationQa = () => {
    if (!candidate) return;
    try {
      const reviewedAt = new Date().toISOString();
      const draft = buildGeneratedAnimationQaDraft(candidate);
      const result = finalizeGeneratedAnimationQaReview(draft, {
        status: 'accepted',
        reviewedAt,
        notes: animationQaNotes,
        tags: ['animation-qa-reviewed'],
      });
      setCandidate({
        ...candidate,
        asset: applyGeneratedAnimationQaResult(candidate.asset, result),
      });
      setStatus('Animation QA accepted.');
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const rejectAnimationQa = () => {
    if (!candidate) return;
    const notes = animationQaNotes.trim();
    if (!notes) {
      setStatus('Character animation QA rejection notes are required.');
      return;
    }
    const reviewedAt = new Date().toISOString();
    const draft = buildGeneratedAnimationQaDraft(candidate);
    const result = finalizeGeneratedAnimationQaReview(draft, {
      status: 'rejected',
      reviewedAt,
      notes,
      rejectionReason: notes,
      tags: ['animation-qa-rejected'],
    });
    setCandidate({
      ...candidate,
      asset: applyGeneratedAnimationQaResult(candidate.asset, result),
    });
    setStatus(`Animation QA rejected: ${notes}`);
  };

  const rejectCandidate = () => {
    if (!candidate) return;
    const qaResult = finalizeGeneratedImageVisualQaReview(
      buildGeneratedImageVisualQaDraft(candidate.asset, candidate.qaPreview),
      {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        notes: qaReview.notes,
        tags: parseTags(qaReview.tags),
        rejectionReason: qaReview.rejectionReason,
        checks: qaReview.checks,
      },
    );
    setCandidate(null);
    setStatus(`Rejected ${candidate.asset.name}${qaResult.rejectionReason ? `: ${qaResult.rejectionReason}` : ''}`);
  };

  return (
    <div className="rounded-md border border-sky-100 bg-sky-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-sky-900">Sprite sheet generation</p>
          <p className="text-[11px] text-sky-700">Offline mock sheet, inserted only after frame QA review.</p>
        </div>
        {open ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<X size={12} />}
            onClick={() => setOpen(false)}
            aria-label="Close sprite sheet generation"
          >
            Close
          </Button>
        ) : (
          <Button
            size="sm"
            icon={<Sparkles size={12} />}
            onClick={openPanel}
            aria-label="Generate sprite sheet"
          >
            Generate
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-3 rounded border border-sky-100 bg-white p-3">
            <SelectField
              label="Sprite sheet source concept"
              value={sourceConceptAssetId}
              options={sourceOptions}
              onChange={changeSourceConcept}
            />
            <TextField label="Sprite sheet set ID" value={draft.animationSetId} onChange={animationSetId => setDraft({ ...draft, animationSetId })} />
            <TextField label="Sprite sheet name" value={draft.name} onChange={name => setDraft({ ...draft, name })} />
            <TextField label="Sprite sheet action" value={draft.action} onChange={action => setDraft({ ...draft, action })} />
            <SelectField
              label="Sprite sheet direction"
              value={draft.direction}
              options={directionOptions}
              onChange={direction => setDraft({ ...draft, direction: direction as Direction | 'any' })}
            />
            <NumberField label="Sprite sheet frame width" value={draft.frameWidth} min={1} onChange={frameWidth => setDraft({ ...draft, frameWidth })} />
            <NumberField label="Sprite sheet frame height" value={draft.frameHeight} min={1} onChange={frameHeight => setDraft({ ...draft, frameHeight })} />
            <NumberField label="Sprite sheet frame count" value={draft.frameCount} min={1} onChange={frameCount => setDraft({ ...draft, frameCount })} />
            <NumberField label="Sprite sheet FPS" value={draft.fps} min={1} onChange={fps => setDraft({ ...draft, fps })} />
            <NumberField label="Sprite sheet anchor X" value={draft.anchorX} onChange={anchorX => setDraft({ ...draft, anchorX })} />
            <NumberField label="Sprite sheet anchor Y" value={draft.anchorY} onChange={anchorY => setDraft({ ...draft, anchorY })} />
            <NumberField label="Sprite sheet display height tiles" value={draft.displayHeightTiles} min={0.1} step={0.1} onChange={displayHeightTiles => setDraft({ ...draft, displayHeightTiles })} />
            <NumberField label="Sprite sheet display width tiles" value={draft.displayWidthTiles} min={0.1} step={0.1} onChange={displayWidthTiles => setDraft({ ...draft, displayWidthTiles })} />
            <NumberField label="Sprite sheet display Y offset px" value={draft.displayYOffsetPx} onChange={displayYOffsetPx => setDraft({ ...draft, displayYOffsetPx })} />
            <CheckboxField label="Sprite sheet loop" checked={draft.loop} onChange={loop => setDraft({ ...draft, loop })} />
          </div>
          <div className="grid grid-cols-1 gap-3 rounded border border-sky-100 bg-white p-3">
            <TextField
              label="Sprite sheet prompt subject"
              value={draft.promptInputs.subject}
              onChange={subject => setDraft(updatePromptInput(draft, 'subject', subject))}
            />
            <TextField
              label="Sprite sheet prompt use case"
              value={draft.promptInputs.useCase}
              onChange={useCase => setDraft(updatePromptInput(draft, 'useCase', useCase))}
            />
            <TextField
              label="Sprite sheet prompt palette"
              value={draft.promptInputs.palette}
              onChange={palette => setDraft(updatePromptInput(draft, 'palette', palette))}
            />
            <TextField
              label="Sprite sheet prompt style notes"
              value={draft.promptInputs.styleNotes}
              onChange={styleNotes => setDraft(updatePromptInput(draft, 'styleNotes', styleNotes))}
            />
          </div>
          <SpriteSheetMetadataPreview draft={draft} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon={<Sparkles size={12} />}
              disabled={running}
              onClick={runGeneration}
              aria-label="Run sprite sheet generation"
            >
              {running ? 'Generating' : 'Run'}
            </Button>
            {status && <span className="text-[11px] text-gray-600">{status}</span>}
          </div>

          {candidate && (
            <div
              aria-label="Generated sprite sheet review"
              className="rounded border border-sky-100 bg-white p-3"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-sky-900">{candidate.asset.name}</p>
                  <p className="truncate font-mono text-[11px] text-sky-700">{candidate.asset.id}</p>
                  <p className="text-[11px] text-sky-700">
                    {candidate.qaPreview.frameCount} frames - {candidate.qaPreview.frameWidth}x{candidate.qaPreview.frameHeight} - {candidate.qaPreview.providerFixture ?? 'offline'}
                  </p>
                </div>
                <div className="col-span-2">
                  <CharacterAnimationQaPanel
                    draft={buildGeneratedAnimationQaDraft(candidate)}
                    notes={animationQaNotes}
                    status={candidate.asset.generated?.animationQa?.status}
                    onNotesChange={setAnimationQaNotes}
                    onAccept={acceptAnimationQa}
                    onReject={rejectAnimationQa}
                  />
                  {candidate.asset.generated?.animationQa?.status === 'rejected' && (
                    <p className="mt-2 rounded border border-red-100 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                      {candidate.asset.generated.animationQa.notes}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <GeneratedImageVisualQaReviewPanel
                    asset={candidate.asset}
                    preview={candidate.qaPreview}
                    value={qaReview}
                    onChange={setQaReview}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCandidate(null)}
                    aria-label="Discard generated sprite sheet"
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={rejectCandidate}
                    aria-label="Reject generated sprite sheet"
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={acceptCandidate}
                    disabled={candidate.asset.generated?.animationQa?.status !== 'accepted'}
                    aria-label="Accept generated sprite sheet"
                  >
                    Accept
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
