import { describe, expect, it } from 'vitest';
import {
  chatRequestReducer,
  defaultChatRequestState,
  type ChatRequestState,
} from './chatRequest';

function dispatch(state: ChatRequestState, action: Parameters<typeof chatRequestReducer>[1]) {
  return chatRequestReducer(state, action);
}

describe('chatRequestReducer', () => {
  it('starts in the pending phase with empty state', () => {
    expect(defaultChatRequestState.phase).toBe('pending');
    expect(defaultChatRequestState.tokens).toEqual([]);
    expect(defaultChatRequestState.finalText).toBeNull();
    expect(defaultChatRequestState.errorMessage).toBeNull();
    expect(defaultChatRequestState.startedAt).toBeNull();
    expect(defaultChatRequestState.completedAt).toBeNull();
  });

  it('moves pending -> streaming on start and stamps startedAt', () => {
    const started = dispatch(defaultChatRequestState, { type: 'start' });
    expect(started.phase).toBe('streaming');
    expect(started.startedAt).not.toBeNull();
    expect(started.tokens).toEqual([]);
  });

  it('ignores start when not in pending', () => {
    const streaming = dispatch(defaultChatRequestState, { type: 'start' });
    const replay = dispatch(streaming, { type: 'start' });
    expect(replay).toBe(streaming);
  });

  it('accumulates tokens via appendToken while streaming', () => {
    let s = dispatch(defaultChatRequestState, { type: 'start' });
    s = dispatch(s, { type: 'appendToken', token: 'Hello, ' });
    s = dispatch(s, { type: 'appendToken', token: 'world.' });
    expect(s.phase).toBe('streaming');
    expect(s.tokens).toEqual(['Hello, ', 'world.']);
    expect(s.finalText).toBeNull();
  });

  it('ignores appendToken outside of streaming', () => {
    const replay = dispatch(defaultChatRequestState, { type: 'appendToken', token: 'no' });
    expect(replay).toBe(defaultChatRequestState);
  });

  it('moves streaming -> completed on complete and joins tokens', () => {
    let s = dispatch(defaultChatRequestState, { type: 'start' });
    s = dispatch(s, { type: 'appendToken', token: 'Draft ' });
    s = dispatch(s, { type: 'appendToken', token: 'outline.' });
    s = dispatch(s, { type: 'complete' });
    expect(s.phase).toBe('completed');
    expect(s.finalText).toBe('Draft outline.');
    expect(s.completedAt).not.toBeNull();
  });

  it('ignores complete outside of streaming', () => {
    const replay = dispatch(defaultChatRequestState, { type: 'complete' });
    expect(replay).toBe(defaultChatRequestState);
  });

  it('moves pending -> canceled on cancel', () => {
    const canceled = dispatch(defaultChatRequestState, { type: 'cancel' });
    expect(canceled.phase).toBe('canceled');
    expect(canceled.completedAt).not.toBeNull();
  });

  it('moves streaming -> canceled on cancel and keeps tokens', () => {
    let s = dispatch(defaultChatRequestState, { type: 'start' });
    s = dispatch(s, { type: 'appendToken', token: 'partial' });
    s = dispatch(s, { type: 'cancel' });
    expect(s.phase).toBe('canceled');
    expect(s.tokens).toEqual(['partial']);
    expect(s.completedAt).not.toBeNull();
  });

  it('ignores cancel from terminal phases', () => {
    let s = dispatch(defaultChatRequestState, { type: 'start' });
    s = dispatch(s, { type: 'appendToken', token: 'x' });
    s = dispatch(s, { type: 'complete' });
    const replay = dispatch(s, { type: 'cancel' });
    expect(replay).toBe(s);
  });

  it('moves streaming -> failed on fail with non-technical message', () => {
    let s = dispatch(defaultChatRequestState, { type: 'start' });
    s = dispatch(s, { type: 'fail', message: "We couldn't reach the provider. Try again in a moment." });
    expect(s.phase).toBe('failed');
    expect(s.errorMessage).toBe("We couldn't reach the provider. Try again in a moment.");
    expect(s.completedAt).not.toBeNull();
  });

  it('ignores fail from terminal phases', () => {
    let s = dispatch(defaultChatRequestState, { type: 'start' });
    s = dispatch(s, { type: 'appendToken', token: 'x' });
    s = dispatch(s, { type: 'complete' });
    const replay = dispatch(s, { type: 'fail', message: 'late' });
    expect(replay).toBe(s);
  });

  it('reset returns to pending from any phase', () => {
    const failed = dispatch(
      dispatch(defaultChatRequestState, { type: 'start' }),
      { type: 'fail', message: 'oops' },
    );
    const reset = dispatch(failed, { type: 'reset' });
    expect(reset).toEqual(defaultChatRequestState);
  });
});
