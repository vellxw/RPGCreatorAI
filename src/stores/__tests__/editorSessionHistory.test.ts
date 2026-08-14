import { describe, expect, it } from 'vitest';
import {
  assessRecoveryEnvelope,
  commitEditorRevision,
  createEditorSessionHistory,
  createRecoveryEnvelope,
  isEditorSessionDirty,
  markEditorRevisionAutosaved,
  markEditorRevisionSaved,
  parseRecoveryEnvelope,
  redoEditorRevision,
  serializeRecoveryEnvelope,
  shouldAutosaveEditorSession,
  undoEditorRevision,
} from '../editorSessionHistory';

describe('editor session history', () => {
  it('keeps bounded undo history and clears redo after a new edit', () => {
    let state = createEditorSessionHistory({ title: 'A' }, 0, 2);
    state = commitEditorRevision(state, { title: 'B' }, 1);
    state = commitEditorRevision(state, { title: 'C' }, 2);
    state = commitEditorRevision(state, { title: 'D' }, 3);

    expect(state.past.map(entry => entry.value.title)).toEqual(['B', 'C']);
    state = undoEditorRevision(state);
    expect(state.present.value.title).toBe('C');
    expect(state.future).toHaveLength(1);

    state = commitEditorRevision(state, { title: 'E' }, 4);
    expect(state.future).toEqual([]);
    expect(redoEditorRevision(state)).toBe(state);
  });

  it('tracks dirty state across save, edits, undo and redo', () => {
    let state = createEditorSessionHistory('a', 0);
    state = commitEditorRevision(state, 'b', 1);
    state = markEditorRevisionSaved(state);
    state = commitEditorRevision(state, 'c', 2);
    expect(isEditorSessionDirty(state)).toBe(true);

    state = undoEditorRevision(state);
    expect(state.present.value).toBe('b');
    expect(isEditorSessionDirty(state)).toBe(false);

    state = redoEditorRevision(state);
    expect(isEditorSessionDirty(state)).toBe(true);
  });

  it('schedules at most one autosave per revision after debounce and interval', () => {
    const policy = { enabled: true, intervalMs: 1_000, minimumDirtyAgeMs: 250 };
    let state = createEditorSessionHistory('a', 0);
    state = commitEditorRevision(state, 'b', 100);

    expect(shouldAutosaveEditorSession(state, policy, 349)).toBe(false);
    expect(shouldAutosaveEditorSession(state, policy, 350)).toBe(true);
    state = markEditorRevisionAutosaved(state, 350);
    expect(shouldAutosaveEditorSession(state, policy, 2_000)).toBe(false);

    state = commitEditorRevision(state, 'c', 500);
    expect(shouldAutosaveEditorSession(state, policy, 1_349)).toBe(false);
    expect(shouldAutosaveEditorSession(state, policy, 1_350)).toBe(true);
  });
});

describe('editor recovery envelope', () => {
  it('round-trips and offers a newer valid recovery revision', () => {
    let state = createEditorSessionHistory({ map: 'hospital', flag: false }, 100);
    state = commitEditorRevision(state, { map: 'hospital', flag: true }, 200);
    const envelope = createRecoveryEnvelope({ projectId: 'game-1', sessionId: 'session-1', state, now: 300 });
    const parsed = parseRecoveryEnvelope(serializeRecoveryEnvelope(envelope));

    const assessment = assessRecoveryEnvelope<{ map: string; flag: boolean }>(parsed, {
      projectId: 'game-1',
      savedRevision: 0,
      savedAt: 250,
    });
    expect(assessment.status).toBe('recover');
    if (assessment.status === 'recover') expect(assessment.envelope.payload.flag).toBe(true);
  });

  it('rejects tampered, cross-project and stale recovery data', () => {
    let state = createEditorSessionHistory({ value: 1 }, 0);
    state = commitEditorRevision(state, { value: 2 }, 1);
    const envelope = createRecoveryEnvelope({ projectId: 'game-1', sessionId: 'session-1', state, now: 10 });

    expect(
      assessRecoveryEnvelope({ ...envelope, payload: { value: 999 } }, {
        projectId: 'game-1', savedRevision: 0, savedAt: null,
      }).status,
    ).toBe('invalid');
    expect(
      assessRecoveryEnvelope(envelope, { projectId: 'game-2', savedRevision: 0, savedAt: null }).status,
    ).toBe('invalid');
    expect(
      assessRecoveryEnvelope(envelope, { projectId: 'game-1', savedRevision: 1, savedAt: null }).status,
    ).toBe('stale');
  });

  it('treats malformed JSON and non-JSON payloads as invalid without throwing', () => {
    expect(parseRecoveryEnvelope('{broken')).toBeNull();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const fake = {
      schemaVersion: 1,
      projectId: 'game-1',
      sessionId: 'session-1',
      createdAt: 1,
      revision: 1,
      savedRevision: 0,
      payload: cyclic,
      checksum: '00000000',
    };
    expect(assessRecoveryEnvelope(fake, { projectId: 'game-1', savedRevision: 0, savedAt: null }).status).toBe('invalid');
  });
});
