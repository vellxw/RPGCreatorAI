import { describe, it, expect } from 'vitest';
import {
  sanitizeChatMessageForPersistence,
  createChatHistoryStore,
  type ChatHistoryMessage,
  type ChatHistoryPolicy,
} from '../chatHistoryPolicy';

const SECRET_PATTERNS = [
  'sk-1234567890abcdefghij',
  'sk_live_abcdefghij1234567890',
  'sk-proj-abc',
  'AIzaSyDxxx',
  'ghp_abcdefghij1234567890',
  'Bearer eyJhbGciOiJIUzI1NiJ9.payload',
  'password=hunter2',
  'api_key=secret123',
  '"apiKey": "abcdef1234567890"',
  '"secret": "topsecret"',
];

const SAFE_MESSAGES: ChatHistoryMessage[] = [
  { id: 'm1', role: 'user', content: 'Help me balance the hero', createdAt: '2026-06-02T12:00:00.000Z' },
  { id: 'm2', role: 'assistant', content: 'Mock assistant turn 1.', createdAt: '2026-06-02T12:00:01.000Z' },
];

function messageWith(extra: string): ChatHistoryMessage {
  return {
    id: 'mX',
    role: 'user',
    content: `Here is the prompt: ${extra} thanks`,
    createdAt: '2026-06-02T12:00:00.000Z',
  };
}

describe('sanitizeChatMessageForPersistence', () => {
  it('keeps safe messages unchanged', () => {
    for (const m of SAFE_MESSAGES) {
      const out = sanitizeChatMessageForPersistence(m);
      expect(out.content).toBe(m.content);
      expect(out.id).toBe(m.id);
      expect(out.role).toBe(m.role);
    }
  });

  it.each(SECRET_PATTERNS)('redacts the secret pattern "%s"', (secret) => {
    const m = messageWith(secret);
    const out = sanitizeChatMessageForPersistence(m);
    expect(out.content).not.toContain(secret);
    expect(out.content).toMatch(/\[REDACTED\]|\[secret removed\]/i);
  });

  it('strips credential env var names like ANTHROPIC_API_KEY', () => {
    const m = messageWith('ANTHROPIC_API_KEY=sk-abc123');
    const out = sanitizeChatMessageForPersistence(m);
    expect(out.content).not.toMatch(/sk-abc123/);
    expect(out.content).not.toMatch(/ANTHROPIC_API_KEY/);
  });

  it('preserves the message id, role, and createdAt for safe messages', () => {
    const m: ChatHistoryMessage = {
      id: 'keep-me',
      role: 'assistant',
      content: 'mock reply',
      createdAt: '2026-06-02T12:00:00.000Z',
    };
    const out = sanitizeChatMessageForPersistence(m);
    expect(out.id).toBe('keep-me');
    expect(out.role).toBe('assistant');
    expect(out.createdAt).toBe('2026-06-02T12:00:00.000Z');
  });

  it('does not mutate the input message', () => {
    const m = messageWith('sk-test-1234');
    const before = JSON.stringify(m);
    sanitizeChatMessageForPersistence(m);
    expect(JSON.stringify(m)).toBe(before);
  });

  it('treats empty content as a valid safe message', () => {
    const m: ChatHistoryMessage = { id: 'e', role: 'user', content: '', createdAt: '2026-06-02T12:00:00.000Z' };
    const out = sanitizeChatMessageForPersistence(m);
    expect(out.content).toBe('');
  });
});

describe('createChatHistoryStore with policy: memory-only', () => {
  it('records messages but exposes no serialization', () => {
    const store = createChatHistoryStore({ policy: 'memory-only' });
    store.record(SAFE_MESSAGES[0]);
    store.record(SAFE_MESSAGES[1]);
    expect(store.size()).toBe(2);
    expect(store.serialize()).toBeNull();
  });

  it('clear() removes all messages', () => {
    const store = createChatHistoryStore({ policy: 'memory-only' });
    store.record(SAFE_MESSAGES[0]);
    store.clear();
    expect(store.size()).toBe(0);
  });
});

describe('createChatHistoryStore with policy: project-scoped', () => {
  const policy: ChatHistoryPolicy = { policy: 'project-scoped', projectId: 'sample' };

  it('only persists messages from the matching project scope', () => {
    const store = createChatHistoryStore(policy);
    store.record({ ...SAFE_MESSAGES[0], projectId: 'sample' });
    store.record({ ...SAFE_MESSAGES[1], projectId: 'other' });
    const persisted = store.serialize();
    expect(persisted).not.toBeNull();
    expect(persisted?.messages).toHaveLength(1);
    expect(persisted?.messages[0].projectId).toBe('sample');
  });

  it('redacts secrets in the serialized payload', () => {
    const store = createChatHistoryStore(policy);
    store.record({ ...messageWith('sk-verysecret123'), projectId: 'sample' });
    const json = JSON.stringify(store.serialize());
    expect(json).not.toContain('sk-verysecret123');
  });

  it('exposes the policy type in the serialized payload', () => {
    const store = createChatHistoryStore(policy);
    store.record({ ...SAFE_MESSAGES[0], projectId: 'sample' });
    expect(store.serialize()?.policy).toBe('project-scoped');
    expect(store.serialize()?.projectId).toBe('sample');
  });
});

describe('createChatHistoryStore with policy: session-scoped', () => {
  it('serializes but tags the payload as session-scoped', () => {
    const store = createChatHistoryStore({ policy: 'session-scoped', sessionId: 'sess-1' });
    store.record(SAFE_MESSAGES[0]);
    const persisted = store.serialize();
    expect(persisted?.policy).toBe('session-scoped');
    expect(persisted?.sessionId).toBe('sess-1');
  });

  it('drops any credentials accidentally present on messages', () => {
    const store = createChatHistoryStore({ policy: 'session-scoped', sessionId: 'sess-2' });
    store.record(messageWith('api_key=hunter2hunter2'));
    const json = JSON.stringify(store.serialize());
    expect(json).not.toContain('api_key');
    expect(json).not.toContain('hunter2');
  });
});
