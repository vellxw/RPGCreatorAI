import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import {
  GeneratedImageVisualQaReviewPanel,
  type GeneratedImageVisualQaReviewValue,
} from './GeneratedImageVisualQaReviewPanel';
import type { AssetCatalogEntry } from '../../types/project';
import {
  applyGeneratedImageVisualQaResult,
  buildGeneratedImageVisualQaDraft,
  finalizeGeneratedImageVisualQaReview,
} from '../../providers/generatedImageVisualQa';
import {
  approveImageEditVariationCandidate,
  defaultImageEditVariationCapability,
  defaultImageEditVariationDraft,
  generateImageEditVariationDraft,
  isEditableImageAsset,
  type ImageEditVariationCandidate,
  type ImageEditVariationCapability,
  type ImageEditVariationMode,
  type ImageEditVariationPromptInputs,
  type ImageEditVariationRunner,
} from '../../providers/imageEditVariationWorkflow';

const MODE_OPTIONS = [
  { value: 'variation', label: 'Variation' },
  { value: 'edit', label: 'Edit' },
];

const EMPTY_QA_REVIEW: GeneratedImageVisualQaReviewValue = {
  notes: '',
  tags: 'qa-reviewed',
  rejectionReason: '',
  checks: {},
};

function parseReferenceIds(value: string): string[] {
  return Array.from(new Set(value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)));
}

function statusClass(tone: 'success' | 'error' | 'info'): string {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (tone === 'error') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

interface ImageEditVariationPanelProps {
  selected: AssetCatalogEntry | null;
  assets: AssetCatalogEntry[];
  existingAssetIds: string[];
  imageEditRunner?: ImageEditVariationRunner;
  capability?: ImageEditVariationCapability;
  onAssetAccepted: (asset: AssetCatalogEntry) => void;
}

export function ImageEditVariationPanel({
  selected,
  assets,
  existingAssetIds,
  imageEditRunner = generateImageEditVariationDraft,
  capability = defaultImageEditVariationCapability(),
  onAssetAccepted,
}: ImageEditVariationPanelProps) {
  const [mode, setMode] = useState<ImageEditVariationMode>('variation');
  const [instruction, setInstruction] = useState('');
  const [useCase, setUseCase] = useState('project-owned asset iteration candidate');
  const [preserve, setPreserve] = useState('source composition, RPGCreatorAI readability, and project visual scale');
  const [maskAssetId, setMaskAssetId] = useState('');
  const [referenceIds, setReferenceIds] = useState('');
  const [running, setRunning] = useState(false);
  const [candidate, setCandidate] = useState<ImageEditVariationCandidate | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [qaReview, setQaReview] = useState<GeneratedImageVisualQaReviewValue>(EMPTY_QA_REVIEW);
  const cancelRequested = useRef(false);

  const editableSource = isEditableImageAsset(selected) ? selected : null;
  const editableAssets = useMemo(
    () => editableSource ? assets.filter(asset => isEditableImageAsset(asset) && asset.id !== editableSource.id) : [],
    [assets, editableSource],
  );
  const canRun = !!editableSource && capability.canEdit && !running;
  const runLabel = mode === 'variation' ? 'Run image variation' : 'Run image edit';

  useEffect(() => {
    setCandidate(null);
    setStatus(null);
    setQaReview(EMPTY_QA_REVIEW);
    setMaskAssetId('');
    setReferenceIds('');
    if (selected) {
      const draft = defaultImageEditVariationDraft(selected, { mode });
      setInstruction(draft.promptInputs.instruction);
      setUseCase(draft.promptInputs.useCase);
      setPreserve(draft.promptInputs.preserve);
    }
  }, [mode, selected]);

  const sourceGateCopy = (() => {
    if (!editableSource) return 'Select an image, generated image, tileset, or spritesheet asset to edit.';
    if (!capability.canEdit) return capability.reason;
    return capability.reason;
  })();

  const handleRun = async () => {
    if (!editableSource) {
      setStatus({ tone: 'error', text: 'Select an image, generated image, tileset, or spritesheet asset to edit.' });
      return;
    }
    if (!capability.canEdit) {
      setStatus({ tone: 'error', text: capability.reason });
      return;
    }

    cancelRequested.current = false;
    setRunning(true);
    setCandidate(null);
    setStatus(null);
    const promptInputs: ImageEditVariationPromptInputs = {
      instruction,
      useCase,
      preserve,
      maskNotes: maskAssetId ? `Use mask asset ${maskAssetId}.` : 'no mask; whole-image edit or variation',
    };
    try {
      const result = await imageEditRunner(existingAssetIds, {
        ...defaultImageEditVariationDraft(editableSource, {
          mode,
          maskAssetId: maskAssetId || undefined,
          referenceAssetIds: parseReferenceIds(referenceIds),
        }),
        promptInputs,
      });
      if (cancelRequested.current || result.cancelled) {
        setStatus({ tone: 'info', text: result.error ?? 'Image edit cancelled.' });
        return;
      }
      if (!result.success || !result.candidate) {
        setStatus({ tone: 'error', text: result.error ?? 'Image edit failed.' });
        return;
      }
      setCandidate(result.candidate);
      setQaReview(EMPTY_QA_REVIEW);
      setStatus({ tone: 'info', text: 'Candidate ready for review.' });
    } catch (error) {
      setStatus({ tone: 'error', text: (error as Error).message });
    } finally {
      setRunning(false);
      cancelRequested.current = false;
    }
  };

  const handleCancel = () => {
    cancelRequested.current = true;
    setRunning(false);
    setStatus({ tone: 'info', text: 'Image edit cancelled.' });
  };

  const handleAccept = () => {
    if (!candidate) return;
    const qaResult = finalizeGeneratedImageVisualQaReview(
      buildGeneratedImageVisualQaDraft(candidate.asset, candidate.qaPreview),
      {
        status: 'accepted',
        reviewedAt: new Date().toISOString(),
        notes: qaReview.notes,
        tags: parseReferenceIds(qaReview.tags),
        checks: qaReview.checks,
      },
    );
    const approved = approveImageEditVariationCandidate(candidate, {
      reviewedAt: new Date().toISOString(),
    });
    onAssetAccepted(applyGeneratedImageVisualQaResult(approved.asset, qaResult));
    setCandidate(null);
    setStatus({ tone: 'success', text: `Accepted ${approved.asset.name}` });
  };

  const handleReject = () => {
    if (!candidate) return;
    const qaResult = finalizeGeneratedImageVisualQaReview(
      buildGeneratedImageVisualQaDraft(candidate.asset, candidate.qaPreview),
      {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        notes: qaReview.notes,
        tags: parseReferenceIds(qaReview.tags),
        rejectionReason: qaReview.rejectionReason,
        checks: qaReview.checks,
      },
    );
    setCandidate(null);
    setStatus({
      tone: 'error',
      text: `Rejected ${candidate.asset.name}${qaResult.rejectionReason ? `: ${qaResult.rejectionReason}` : ''}`,
    });
  };

  return (
    <section className="rounded-md border border-gray-200 bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[12px] font-semibold text-gray-800">Image edit and variation</h3>
          <p className="mt-1 text-[12px] text-gray-500">{sourceGateCopy}</p>
        </div>
        <Sparkles size={16} className="mt-0.5 text-indigo-500" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Select
          label="Mode"
          ariaLabel="Image edit mode"
          value={mode}
          options={MODE_OPTIONS}
          onChange={value => setMode(value as ImageEditVariationMode)}
        />
        <Select
          label="Mask"
          ariaLabel="Image edit mask asset"
          value={maskAssetId}
          options={[
            { value: '', label: '(none)' },
            ...editableAssets.map(asset => ({ value: asset.id, label: asset.name })),
          ]}
          onChange={setMaskAssetId}
        />
        <Input
          label="Instruction"
          aria-label="Image edit instruction"
          value={instruction}
          onInput={event => setInstruction(event.currentTarget.value)}
          className="col-span-2"
        />
        <Input
          label="Use case"
          aria-label="Image edit use case"
          value={useCase}
          onInput={event => setUseCase(event.currentTarget.value)}
          className="col-span-2"
        />
        <Input
          label="Preserve"
          aria-label="Image edit preserve guidance"
          value={preserve}
          onInput={event => setPreserve(event.currentTarget.value)}
          className="col-span-2"
        />
        <Input
          label="Reference asset IDs"
          aria-label="Image edit reference asset IDs"
          value={referenceIds}
          onInput={event => setReferenceIds(event.currentTarget.value)}
          placeholder="comma-separated asset ids"
          className="col-span-2"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={handleRun}
          disabled={!canRun}
          title={canRun ? 'Create a non-destructive image edit candidate' : sourceGateCopy}
        >
          {runLabel}
        </Button>
        {running && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<X size={13} />}
            onClick={handleCancel}
          >
            Cancel image edit
          </Button>
        )}
      </div>

      {status && (
        <div className={`mt-3 rounded-md border px-2.5 py-2 text-[12px] ${statusClass(status.tone)}`}>
          {status.text}
        </div>
      )}

      {candidate && (
        <div
          className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2"
          aria-label="Generated image variation review"
        >
          <p className="text-[12px] font-semibold text-indigo-900">
            Generated image {candidate.asset.generated?.editMode ?? mode} review
          </p>
          <p className="mt-1 text-[12px] text-indigo-700">{candidate.asset.name}</p>
          <p className="text-[11px] font-mono text-indigo-700">{candidate.asset.id}</p>
          <p className="mt-1 text-[11px] text-indigo-600">
            {candidate.qaPreview.width}x{candidate.qaPreview.height} / {candidate.qaPreview.providerFixture ?? 'offline fixture'}
          </p>
          <p className="mt-1 text-[11px] font-mono text-indigo-600 break-all">
            {candidate.qaPreview.assetRef}
          </p>
          <GeneratedImageVisualQaReviewPanel
            asset={candidate.asset}
            preview={candidate.qaPreview}
            value={qaReview}
            onChange={setQaReview}
          />
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCandidate(null);
                setStatus({ tone: 'info', text: 'Discarded generated image candidate.' });
              }}
            >
              Discard
            </Button>
            <Button type="button" size="sm" variant="danger" onClick={handleReject}>
              Reject
            </Button>
            <Button type="button" size="sm" variant="primary" onClick={handleAccept}>
              Accept
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
