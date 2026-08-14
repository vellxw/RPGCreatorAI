import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
} from 'react';
import {
  createAiStudioGenerationGateway,
  type AiStudioGenerationGateway,
  type AiStudioGenerationKind,
  type AiStudioImageGenerationSuccess,
  type AiStudioTextGenerationSuccess,
} from '../../providers/aiStudio';
import {
  canRetryAiJob,
  type AiRequestQueueAction,
  type AiRequestQueueState,
} from '../../stores/aiRequestQueueStore';
import {
  makeCandidateId,
  type CandidateStoreApi,
} from '../../aiCandidates/candidateStore';
import type { Candidate } from '../../aiCandidates/candidateTypes';
import { candidateResourceDiffForActions } from '../../aiCandidates/candidateProjectCommit';
import type { ProjectAction } from '../../stores/projectStore';
import type { ProjectContextSelectedMap } from './projectContext';

interface QueueController {
  queue: AiRequestQueueState;
  dispatch: Dispatch<AiRequestQueueAction>;
  cancel(jobId: string): void;
  retry(jobId: string): void;
}

interface GenerationSpec {
  jobId: string;
  candidateId: string;
  kind: AiStudioGenerationKind;
  prompt: string;
  projectId: string;
  selectedMap: ProjectContextSelectedMap | null;
  createdAt: string;
}

export interface AiStudioGenerationOutcome {
  tone: 'success' | 'error' | 'muted';
  message: string;
}

export interface UseAiStudioGenerationControllerOptions {
  projectId: string | null;
  selectedMap: ProjectContextSelectedMap | null;
  queue: QueueController;
  candidates: Pick<CandidateStoreApi, 'addCandidate'>;
  gateway?: AiStudioGenerationGateway;
  onActivity?: (message: string) => void;
  onCandidateReady?: (candidate: Candidate) => void;
}

function truncate(value: string, max: number): string {
  const normalized = value.trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function textCandidate(
  spec: GenerationSpec,
  result: AiStudioTextGenerationSuccess,
): Candidate {
  const map = spec.selectedMap;
  const eventText = truncate(result.output.text, 1_200);
  const applyActions: ProjectAction[] = map
    ? [{
        type: 'ADD_EVENT',
        mapId: map.id,
        event: {
          id: spec.candidateId,
          type: 'npc',
          x: Math.max(0, Math.floor(map.width / 2)),
          y: Math.max(0, Math.floor(map.height / 2)),
          solid: false,
          trigger: 'interact',
          commands: [{ type: 'showText', text: eventText }],
        },
      }]
    : [];

  return {
    id: spec.candidateId,
    kind: 'event-draft',
    title: `Event draft · ${truncate(spec.prompt, 42)}`,
    payload: {
      summary: truncate(result.output.text, 180),
      applyActions,
      output: result.output,
    },
    provenance: {
      providerId: result.provenance.providerId,
      modelId: result.provenance.modelId ?? 'offline-mock',
      operation: result.provenance.operation,
      requestId: result.requestId,
      createdAt: result.provenance.createdAt,
    },
    reviewState: 'review',
    validation: {
      errors: map ? [] : ['Select a map before accepting this event candidate.'],
      warnings: ['Review and edit the generated dialogue before accepting it.'],
    },
    resourceDiff: candidateResourceDiffForActions(applyActions),
    projectId: spec.projectId,
    historyRecordId: `ai-studio:${spec.candidateId}`,
    createdAt: spec.createdAt,
    updatedAt: spec.createdAt,
  };
}

function imageCandidate(
  spec: GenerationSpec,
  result: AiStudioImageGenerationSuccess,
): Candidate {
  const assetRef = result.output.assetRefs[0];
  const applyActions: ProjectAction[] = [{
    type: 'ADD_ASSET_CATALOG_ENTRY',
    asset: {
      id: spec.candidateId,
      name: `Concept · ${truncate(spec.prompt, 42)}`,
      kind: 'generated',
      path: assetRef,
      source: 'generated',
      tags: ['ai-studio', result.provenance.mode],
      provenance: `${result.provenance.providerId}/${result.provenance.modelId ?? 'unknown-model'}`,
      runtimeCompatible: false,
      runtimeNotes: result.provenance.mode === 'offline'
        ? 'Offline fixture reference; replace it with an imported image before runtime use.'
        : 'Generated reference requires normalization/import before runtime use.',
      generated: {
        prompt: spec.prompt,
        tool: 'AI Studio provider gateway',
        createdAt: result.provenance.createdAt,
        providerId: result.provenance.providerId,
        modelId: result.provenance.modelId,
        operation: result.provenance.operation,
      },
    },
  }];

  return {
    id: spec.candidateId,
    kind: 'asset-draft',
    title: `Concept image · ${truncate(spec.prompt, 40)}`,
    payload: {
      summary: `Generated image reference ready for review: ${assetRef}`,
      applyActions,
      output: result.output,
    },
    provenance: {
      providerId: result.provenance.providerId,
      modelId: result.provenance.modelId ?? 'offline-image-mock',
      operation: result.provenance.operation,
      requestId: result.requestId,
      createdAt: result.provenance.createdAt,
    },
    reviewState: 'review',
    validation: {
      errors: [],
      warnings: [
        result.provenance.mode === 'offline'
          ? 'This is an offline fixture reference and is not runtime-compatible.'
          : 'Normalize and import the generated image before runtime use.',
      ],
    },
    resourceDiff: candidateResourceDiffForActions(applyActions),
    projectId: spec.projectId,
    historyRecordId: `ai-studio:${spec.candidateId}`,
    createdAt: spec.createdAt,
    updatedAt: spec.createdAt,
  };
}

export function useAiStudioGenerationController(
  options: UseAiStudioGenerationControllerOptions,
) {
  const gateway = useMemo(
    () => options.gateway ?? createAiStudioGenerationGateway(),
    [options.gateway],
  );
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AiStudioGenerationOutcome | null>(null);
  const mounted = useRef(true);
  const activeJobRef = useRef<string | null>(null);
  const requests = useRef(new Map<string, GenerationSpec>());
  const controllers = useRef(new Map<string, AbortController>());
  const queueRef = useRef(options.queue);
  const candidateRef = useRef(options.candidates);
  const callbacksRef = useRef({
    onActivity: options.onActivity,
    onCandidateReady: options.onCandidateReady,
  });

  queueRef.current = options.queue;
  candidateRef.current = options.candidates;
  callbacksRef.current = {
    onActivity: options.onActivity,
    onCandidateReady: options.onCandidateReady,
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controllers.current.forEach(controller => controller.abort());
      controllers.current.clear();
    };
  }, []);

  const run = useCallback(async (spec: GenerationSpec) => {
    const controller = new AbortController();
    controllers.current.set(spec.jobId, controller);
    queueRef.current.dispatch({ type: 'startNext' });
    queueRef.current.dispatch({
      type: 'progress',
      jobId: spec.jobId,
      progress: 15,
      message: 'Generating with the offline provider…',
    });

    try {
      const result = spec.kind === 'text'
        ? await gateway.generateText({
            id: spec.jobId,
            prompt: spec.prompt,
            createdAt: spec.createdAt,
            context: {
              projectId: spec.projectId,
              selectedMapId: spec.selectedMap?.id,
            },
          }, { signal: controller.signal })
        : await gateway.generateImage({
            id: spec.jobId,
            prompt: spec.prompt,
            createdAt: spec.createdAt,
            parameters: {
              quality: 'low',
              size: '1024x1024',
              outputFormat: 'png',
            },
            context: { projectId: spec.projectId },
          }, { signal: controller.signal });

      if (!mounted.current) return;
      if (controller.signal.aborted) {
        queueRef.current.cancel(spec.jobId);
        setOutcome({ tone: 'muted', message: 'Generation cancelled. Nothing was added to the project.' });
        callbacksRef.current.onActivity?.(`Cancelled offline generation ${spec.jobId}.`);
        return;
      }
      if (result.status !== 'succeeded') {
        if (result.status === 'cancelled') {
          queueRef.current.cancel(spec.jobId);
          setOutcome({ tone: 'muted', message: 'Generation cancelled. Nothing was added to the project.' });
          callbacksRef.current.onActivity?.(`Cancelled offline generation ${spec.jobId}.`);
        } else {
          queueRef.current.dispatch({ type: 'fail', jobId: spec.jobId, error: result.failure.message });
          setOutcome({ tone: 'error', message: result.failure.message });
          callbacksRef.current.onActivity?.(`Offline generation failed: ${result.failure.message}`);
        }
        return;
      }

      queueRef.current.dispatch({
        type: 'progress',
        jobId: spec.jobId,
        progress: 85,
        message: 'Preparing a candidate for review…',
      });
      const candidate = spec.kind === 'text'
        ? textCandidate(spec, result as AiStudioTextGenerationSuccess)
        : imageCandidate(spec, result as AiStudioImageGenerationSuccess);
      candidateRef.current.addCandidate(candidate);
      queueRef.current.dispatch({
        type: 'succeed',
        jobId: spec.jobId,
        resultSummary: `Candidate “${candidate.title}” is ready for review.`,
      });
      setOutcome({ tone: 'success', message: `Candidate “${candidate.title}” is ready for review.` });
      callbacksRef.current.onActivity?.(`Generated candidate “${candidate.title}” with the offline provider.`);
      callbacksRef.current.onCandidateReady?.(candidate);
      requests.current.delete(spec.jobId);
    } catch {
      if (!mounted.current) return;
      queueRef.current.dispatch({
        type: 'fail',
        jobId: spec.jobId,
        error: 'AI Studio could not complete the offline generation request.',
      });
      setOutcome({ tone: 'error', message: 'AI Studio could not complete the offline generation request.' });
    } finally {
      controllers.current.delete(spec.jobId);
      if (activeJobRef.current === spec.jobId) activeJobRef.current = null;
      if (mounted.current) setActiveJobId(current => current === spec.jobId ? null : current);
    }
  }, [gateway]);

  const generate = useCallback((kind: AiStudioGenerationKind, rawPrompt: string): string | null => {
    const prompt = rawPrompt.trim();
    if (!options.projectId) {
      setOutcome({ tone: 'error', message: 'Open a project before generating a candidate.' });
      return null;
    }
    if (!prompt) {
      setOutcome({ tone: 'error', message: 'Enter a prompt before generating.' });
      return null;
    }
    if (activeJobRef.current) return null;
    if (options.queue.queue.jobs.length >= options.queue.queue.maxJobs) {
      setOutcome({ tone: 'error', message: 'The AI request queue is full.' });
      return null;
    }

    const candidateId = makeCandidateId(kind === 'text' ? 'event-draft' : 'asset-draft');
    const jobId = `job_${candidateId}`;
    const createdAt = new Date().toISOString();
    const spec: GenerationSpec = {
      jobId,
      candidateId,
      kind,
      prompt,
      projectId: options.projectId,
      selectedMap: options.selectedMap,
      createdAt,
    };
    requests.current.set(jobId, spec);
    activeJobRef.current = jobId;
    setActiveJobId(jobId);
    setOutcome(null);
    options.queue.dispatch({
      type: 'enqueue',
      job: {
        id: jobId,
        title: kind === 'text' ? 'Offline event-text draft' : 'Offline concept-image draft',
        providerId: 'local',
        capability: kind === 'text' ? 'text.generate' : 'image.generate',
        state: 'queued',
        progress: 0,
        attempt: 1,
        maxRetries: 2,
        createdAt,
        updatedAt: createdAt,
        idempotencyKey: jobId,
        cost: { availability: 'free', estimatedUsd: 0, currency: 'USD' },
        budgetConfirmation: { status: 'not-required', scope: 'session' },
        rateLimit: {
          status: 'not-applicable',
          retryGuidance: 'Offline mock requests do not use a remote retry window.',
        },
      },
    });
    callbacksRef.current.onActivity?.(`Queued ${kind} generation with the offline provider.`);
    void run(spec);
    return jobId;
  }, [options.projectId, options.queue, options.selectedMap, run]);

  const cancel = useCallback((jobId: string) => {
    controllers.current.get(jobId)?.abort();
    queueRef.current.cancel(jobId);
    setOutcome({ tone: 'muted', message: 'Cancellation requested. Nothing will be applied automatically.' });
  }, []);

  const retry = useCallback((jobId: string) => {
    if (activeJobRef.current) return;
    const job = queueRef.current.queue.jobs.find(candidate => candidate.id === jobId);
    const spec = requests.current.get(jobId);
    if (!job || !canRetryAiJob(job)) return;
    if (!spec) {
      setOutcome({
        tone: 'error',
        message: 'The original prompt is unavailable after reload; submit a new generation request.',
      });
      return;
    }
    queueRef.current.retry(jobId);
    activeJobRef.current = jobId;
    setActiveJobId(jobId);
    setOutcome(null);
    callbacksRef.current.onActivity?.(`Retrying offline generation ${jobId}.`);
    void run(spec);
  }, [run]);

  return {
    activeJobId,
    isGenerating: activeJobId !== null,
    outcome,
    generate,
    cancel,
    retry,
  };
}
