import { describe, it, expect } from 'vitest';
import {
  buildMockChatResponse,
  createMockChatConversationLoop,
  initialMockChatTurn,
  type MockChatActionCard,
  type MockChatMessage,
  type MockChatRequest,
  type MockChatRole,
  type MockChatTurn,
} from '../mockChatLoop';

function makeMessage(role: MockChatRole, content: string, id?: string): MockChatMessage {
  return {
    id: id ?? `${role}-${content.slice(0, 8)}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    content,
    createdAt: '2026-06-02T12:00:00.000Z',
  };
}

const baseProjectContext = {
  projectId: 'sample',
  projectTitle: 'Sample RPG',
  databaseTables: ['actors', 'skills'],
  selectedRecordIds: { actors: ['hero'] },
  recentMapIds: ['town-1'],
};

describe('initialMockChatTurn', () => {
  it('returns a fresh transcript with no messages and a stable system prompt id', () => {
    const turn = initialMockChatTurn();
    expect(turn.messages).toEqual([]);
    expect(turn.systemPromptId).toMatch(/^mock-chat-system-/);
  });
});

describe('buildMockChatResponse', () => {
  it('produces a deterministic assistant message for a given input + context', () => {
    const a = buildMockChatResponse({
      userMessage: 'Draft a new actor',
      priorMessages: [],
      projectContext: baseProjectContext,
    });
    const b = buildMockChatResponse({
      userMessage: 'Draft a new actor',
      priorMessages: [],
      projectContext: baseProjectContext,
    });
    expect(a.content).toBe(b.content);
    expect(a.role).toBe('assistant');
    expect(a.id).toMatch(/^mock-assistant-/);
  });

  it('echoes context summary in the assistant content when present', () => {
    const response = buildMockChatResponse({
      userMessage: 'Help me balance the hero',
      priorMessages: [],
      projectContext: baseProjectContext,
    });
    expect(response.content).toMatch(/Sample RPG/);
  });

  it('returns a stable response when no context is supplied', () => {
    const response = buildMockChatResponse({
      userMessage: 'Hi',
      priorMessages: [],
      projectContext: null,
    });
    expect(response.role).toBe('assistant');
    expect(response.content.length).toBeGreaterThan(0);
  });

  it('marks a starter task as an action card when the user prompt matches a known key', () => {
    const response = buildMockChatResponse({
      userMessage: 'Draft a new actor please',
      priorMessages: [],
      projectContext: baseProjectContext,
    });
    const cards = response.actionCards ?? [];
    expect(cards.length).toBeGreaterThanOrEqual(1);
    const actorCard = cards.find((c: MockChatActionCard) => c.id === 'actor-draft');
    expect(actorCard).toBeTruthy();
    expect(actorCard?.title).toMatch(/actor/i);
  });

  it('does not produce action cards for unknown prompts', () => {
    const response = buildMockChatResponse({
      userMessage: 'What is the weather?',
      priorMessages: [],
      projectContext: baseProjectContext,
    });
    expect(response.actionCards ?? []).toEqual([]);
  });

  it('treats the input as deterministic and never makes network calls (no provider id, no model id)', () => {
    const response = buildMockChatResponse({
      userMessage: 'Anything',
      priorMessages: [],
      projectContext: null,
    });
    expect(response).not.toHaveProperty('providerId');
    expect(response).not.toHaveProperty('modelId');
  });
});

describe('createMockChatConversationLoop', () => {
  it('appends the user message and the assistant response in order', () => {
    const loop = createMockChatConversationLoop({
      initialTurn: initialMockChatTurn(),
      projectContext: baseProjectContext,
    });
    const next = loop.submit('Draft a new map');
    expect(next.messages).toHaveLength(2);
    expect(next.messages[0].role).toBe('user');
    expect(next.messages[0].content).toBe('Draft a new map');
    expect(next.messages[1].role).toBe('assistant');
    expect(next.messages[1].content.length).toBeGreaterThan(0);
  });

  it('preserves prior turns when chaining', () => {
    const loop = createMockChatConversationLoop({
      initialTurn: initialMockChatTurn(),
      projectContext: baseProjectContext,
    });
    const t1 = loop.submit('First');
    const t2 = loop.submit('Second');
    expect(t2.messages).toHaveLength(4);
    expect(t2.messages.map((m) => m.content)).toEqual([
      'First', expect.stringContaining('First'),
      'Second', expect.stringContaining('Second'),
    ]);
  });

  it('produces an action card for the actor prompt and not for weather', () => {
    const loop = createMockChatConversationLoop({
      initialTurn: initialMockChatTurn(),
      projectContext: baseProjectContext,
    });
    const actorTurn = loop.submit('Draft a new actor');
    const cardsAfterActor = (actorTurn.messages[actorTurn.messages.length - 1] as MockChatMessage)
      .actionCards ?? [];
    expect(cardsAfterActor.some((c) => c.id === 'actor-draft')).toBe(true);
    const weatherTurn = loop.submit('weather?');
    const cardsAfterWeather = (weatherTurn.messages[weatherTurn.messages.length - 1] as MockChatMessage)
      .actionCards ?? [];
    expect(cardsAfterWeather).toEqual([]);
  });

  it('does not require a network roundtrip: getTurn is sync and yields an immutable snapshot', () => {
    const loop = createMockChatConversationLoop({
      initialTurn: initialMockChatTurn(),
      projectContext: baseProjectContext,
    });
    const turn: MockChatTurn = loop.getTurn();
    expect(turn.messages).toEqual([]);
  });
});
