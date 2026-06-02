import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { AssetCatalogEntry } from '../../types/project';
import { Button } from '../ui/Button';
import { TextField } from './DatabaseFields';
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
  approvePortraitGenerationCandidate,
  defaultPortraitGenerationDraft,
  generatePortraitDraft,
  type PortraitGenerationCandidate,
  type PortraitGenerationDraft,
  type PortraitGenerationRunner,
  type PortraitOwnerKind,
} from '../../providers/portraitGenerationWorkflow';

interface PortraitGenerationPanelProps {
  ownerKind: PortraitOwnerKind;
  ownerId: string;
  ownerName: string;
  description: string;
  assets: AssetCatalogEntry[];
  portraitGenerator?: PortraitGenerationRunner;
  onAssetAccepted(asset: AssetCatalogEntry, portraitAssetId: string): void;
}

const titleByKind: Record<PortraitOwnerKind, string> = {
  actor: 'Actor',
  event: 'Event',
};

const EMPTY_QA_REVIEW: GeneratedImageVisualQaReviewValue = {
  notes: '',
  tags: 'qa-reviewed',
  rejectionReason: '',
  checks: {},
};

function createDraft(props: Pick<PortraitGenerationPanelProps, 'ownerKind' | 'ownerId' | 'ownerName' | 'description'>) {
  return defaultPortraitGenerationDraft({
    ownerKind: props.ownerKind,
    ownerId: props.ownerId,
    ownerName: props.ownerName,
    description: props.description,
  });
}

function updatePromptInput(
  draft: PortraitGenerationDraft,
  key: keyof PortraitGenerationDraft['promptInputs'],
  value: string,
): PortraitGenerationDraft {
  return {
    ...draft,
    promptInputs: {
      ...draft.promptInputs,
      [key]: value,
    },
  };
}

export function PortraitGenerationPanel(props: PortraitGenerationPanelProps) {
  const title = titleByKind[props.ownerKind];
  const lower = title.toLowerCase();
  const runner = props.portraitGenerator ?? generatePortraitDraft;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PortraitGenerationDraft>(() => createDraft(props));
  const [candidate, setCandidate] = useState<PortraitGenerationCandidate | null>(null);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [qaReview, setQaReview] = useState<GeneratedImageVisualQaReviewValue>(EMPTY_QA_REVIEW);

  const openPanel = () => {
    setDraft(createDraft(props));
    setCandidate(null);
    setQaReview(EMPTY_QA_REVIEW);
    setStatus('');
    setOpen(true);
  };

  const runGeneration = async () => {
    setRunning(true);
    setStatus('');
    setCandidate(null);
    try {
      const result = await runner(props.assets.map(asset => asset.id), draft);
      if (!result.success || !result.candidate) {
        setStatus(result.error ?? 'Portrait generation did not return a candidate.');
        return;
      }
      setCandidate(result.candidate);
      setQaReview(EMPTY_QA_REVIEW);
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
      const reviewedAt = new Date().toISOString();
      const qaResult = finalizeGeneratedImageVisualQaReview(
        buildGeneratedImageVisualQaDraft(candidate.asset, candidate.qaPreview),
        {
          status: 'accepted',
          reviewedAt,
          notes: qaReview.notes,
          tags: qaReview.tags.split(',').map(tag => tag.trim()).filter(Boolean),
          checks: qaReview.checks,
        },
      );
      const approved = approvePortraitGenerationCandidate(candidate, {
        reviewedAt,
      });
      props.onAssetAccepted(applyGeneratedImageVisualQaResult(approved.asset, qaResult), approved.portraitAssetId);
      setCandidate(null);
      setStatus(`Assigned ${approved.portraitAssetId}.`);
      setOpen(false);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const rejectCandidate = () => {
    if (!candidate) return;
    const qaResult = finalizeGeneratedImageVisualQaReview(
      buildGeneratedImageVisualQaDraft(candidate.asset, candidate.qaPreview),
      {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        notes: qaReview.notes,
        tags: qaReview.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        rejectionReason: qaReview.rejectionReason,
        checks: qaReview.checks,
      },
    );
    setCandidate(null);
    setStatus(`Rejected ${candidate.asset.name}${qaResult.rejectionReason ? `: ${qaResult.rejectionReason}` : ''}`);
  };

  return (
    <div className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-indigo-800">{title} portrait generation</p>
          <p className="text-[11px] text-indigo-700">Offline mock candidate, accepted only after review.</p>
        </div>
        {open ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<X size={12} />}
            onClick={() => setOpen(false)}
            aria-label={`Close ${lower} portrait generation`}
          >
            Close
          </Button>
        ) : (
          <Button
            size="sm"
            icon={<Sparkles size={12} />}
            onClick={openPanel}
            aria-label={`Generate ${lower} portrait`}
          >
            Generate
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <div
            aria-label={`${title} portrait generation metadata preview`}
            className="grid grid-cols-1 gap-3 rounded border border-indigo-100 bg-white p-3"
          >
            <TextField
              label={`${title} portrait subject`}
              value={draft.promptInputs.subject}
              onChange={subject => setDraft(updatePromptInput(draft, 'subject', subject))}
            />
            <TextField
              label={`${title} portrait use case`}
              value={draft.promptInputs.useCase}
              onChange={useCase => setDraft(updatePromptInput(draft, 'useCase', useCase))}
            />
            <TextField
              label={`${title} portrait palette`}
              value={draft.promptInputs.palette}
              onChange={palette => setDraft(updatePromptInput(draft, 'palette', palette))}
            />
            <TextField
              label={`${title} portrait style notes`}
              value={draft.promptInputs.styleNotes}
              onChange={styleNotes => setDraft(updatePromptInput(draft, 'styleNotes', styleNotes))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon={<Sparkles size={12} />}
              disabled={running}
              onClick={runGeneration}
              aria-label={`Run ${lower} portrait generation`}
            >
              {running ? 'Generating' : 'Run'}
            </Button>
            {status && <span className="text-[11px] text-gray-600">{status}</span>}
          </div>

          {candidate && (
            <div
              aria-label={`Generated ${lower} portrait review`}
              className="rounded border border-emerald-100 bg-emerald-50 p-3"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-emerald-800">{candidate.asset.name}</p>
                  <p className="truncate font-mono text-[11px] text-emerald-700">{candidate.asset.id}</p>
                  <p className="text-[11px] text-emerald-700">
                    {candidate.qaPreview.width}x{candidate.qaPreview.height} · {candidate.qaPreview.providerFixture ?? 'offline'}
                  </p>
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
                    aria-label={`Discard generated ${lower} portrait`}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={rejectCandidate}
                    aria-label={`Reject generated ${lower} portrait`}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={acceptCandidate}
                    aria-label={`Accept generated ${lower} portrait`}
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
