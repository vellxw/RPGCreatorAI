# Phase 11 AI Request Queue

CP-059 / FRA-94 adds the first AI request queue boundary for optional editor
tooling. The queue is infrastructure only: it records and displays work state,
but it does not call live providers, generate content, mutate project data, or
affect the native runtime.

## Implemented Boundary

- `src/stores/aiRequestQueueStore.ts` defines queue states:
  `queued`, `running`, `cancelled`, `failed`, and `succeeded`.
- Jobs include progress, attempts, max retries, provider/capability metadata,
  optional idempotency keys, and optional write-intent ids.
- The queue is bounded to 12 jobs by default and rejects overflow.
- Duplicate active idempotency keys are rejected to avoid duplicate in-flight
  work.
- Jobs with a write intent cannot be retried into a second successful write
  when that write intent has already completed.
- Running jobs restored after app restart become `failed` with retryable
  failure copy instead of replaying work automatically.
- Queue snapshots are persisted in renderer local storage as editor history
  only. Project JSON and native runtime inputs remain queue-free.

## UI Surface

Settings now includes an `AI Request Queue` panel. The panel shows empty,
active, failed, cancelled, and completed queue state, progress bars,
cancellation for queued/running jobs, and retry for failed/cancelled jobs when
attempts remain.

The panel intentionally has no generate/connect/test-provider action. Future
provider and asset/content issues can enqueue jobs through this boundary after
their mocked contracts and capability gates exist.

## Validation

Normal validation stays offline:

- queue transition tests cover bounded enqueue, duplicate active idempotency
  keys, running/progress/failure/retry/cancel/success transitions, restart
  recovery, and summary counts.
- UI tests cover the empty state, running cancellation, failure copy, and retry
  affordance.
- Settings regression coverage confirms the queue panel does not reintroduce
  live provider actions.

No live OpenAI, Claude, Kimi/Moonshot, DeepSeek, MiniMax, custom endpoint, or
other paid provider call was made.
