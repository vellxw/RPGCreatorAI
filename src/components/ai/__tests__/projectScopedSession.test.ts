import { describe, it, expect } from 'vitest';
import {
  createProjectScopedSession,
  type ProjectScopedSession,
  type ProjectScopedSessionState,
} from '../projectScopedSession';

function asState(s: ProjectScopedSession): ProjectScopedSessionState {
  return s.getState();
}

describe('createProjectScopedSession', () => {
  it('starts in the unscheduled state with no project bound', () => {
    const session = createProjectScopedSession();
    const s = asState(session);
    expect(s.boundProjectId).toBeNull();
    expect(s.phase).toBe('unscheduled');
    expect(s.transcript.length).toBe(0);
    expect(s.contextCache).toBeNull();
  });

  it('binds a project identity on first use', () => {
    const session = createProjectScopedSession();
    session.bind('project-1');
    const s = asState(session);
    expect(s.boundProjectId).toBe('project-1');
    expect(s.phase).toBe('active');
  });

  it('clears transcript and context cache when switching projects', () => {
    const session = createProjectScopedSession();
    session.bind('project-1');
    session.appendTranscript({ id: 'm1', role: 'user', content: 'old message', createdAt: '2026-06-02T12:00:00.000Z' });
    session.setContextCache({ projectTitle: 'Old' });
    session.bind('project-2');
    const s = asState(session);
    expect(s.boundProjectId).toBe('project-2');
    expect(s.transcript.length).toBe(0);
    expect(s.contextCache).toBeNull();
  });

  it('preserves a copy of the prior context as the "archived" field when switching', () => {
    const session = createProjectScopedSession();
    session.bind('project-1');
    session.setContextCache({ projectTitle: 'Old' });
    const prior = asState(session).contextCache;
    session.bind('project-2');
    const archived = asState(session).archivedContext;
    expect(archived).toEqual(prior);
  });

  it('returns the active session state without mutating on getState()', () => {
    const session = createProjectScopedSession();
    session.bind('project-1');
    const s1 = asState(session);
    const s2 = asState(session);
    expect(s1).toEqual(s2);
    expect(s1).not.toBe(s2);
  });

  it('appendTranscript ignores messages with mismatched projectId when bound', () => {
    const session = createProjectScopedSession();
    session.bind('project-1');
    session.appendTranscript({ id: 'a', role: 'user', content: 'right project', projectId: 'project-1', createdAt: '2026-06-02T12:00:00.000Z' });
    session.appendTranscript({ id: 'b', role: 'user', content: 'wrong project', projectId: 'project-2', createdAt: '2026-06-02T12:00:01.000Z' });
    const s = asState(session);
    expect(s.transcript.length).toBe(1);
    expect(s.transcript[0].id).toBe('a');
  });

  it('emits a recoveryCopy when context would be lost on switch', () => {
    const session = createProjectScopedSession();
    session.bind('project-1');
    session.appendTranscript({ id: 'a', role: 'user', content: 'keep', createdAt: '2026-06-02T12:00:00.000Z' });
    session.bind('project-2');
    const copy = asState(session).recoveryCopy;
    expect(copy).toMatch(/switch|project/i);
  });

  it('clears the recovery copy on reset', () => {
    const session = createProjectScopedSession();
    session.bind('project-1');
    session.bind('project-2');
    expect(asState(session).recoveryCopy).toBeTruthy();
    session.reset();
    expect(asState(session).recoveryCopy).toBeNull();
    expect(asState(session).boundProjectId).toBeNull();
  });

  it('rebind to the same projectId is a no-op (does not clear state)', () => {
    const session = createProjectScopedSession();
    session.bind('project-1');
    session.appendTranscript({ id: 'x', role: 'user', content: 'persist', createdAt: '2026-06-02T12:00:00.000Z' });
    session.bind('project-1');
    expect(asState(session).transcript.length).toBe(1);
  });
});
