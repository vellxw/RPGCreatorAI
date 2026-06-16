export type MockChatRole = 'system' | 'user' | 'assistant';

export interface MockChatActionCard {
  id: string;
  title: string;
  detail: string;
  inputs?: Record<string, string>;
}

export interface MockChatMessage {
  id: string;
  role: MockChatRole;
  content: string;
  createdAt: string;
  actionCards?: MockChatActionCard[];
}

export interface MockChatProjectContext {
  projectId: string;
  projectTitle: string;
  databaseTables: string[];
  selectedRecordIds: Record<string, string[]>;
  recentMapIds: string[];
}

export interface MockChatRequest {
  userMessage: string;
  priorMessages: MockChatMessage[];
  projectContext: MockChatProjectContext | null;
}

export interface MockChatResponse extends MockChatMessage {
  role: 'assistant';
}

export interface MockChatTurn {
  systemPromptId: string;
  messages: MockChatMessage[];
}

export interface MockChatConversationLoop {
  submit: (userMessage: string) => MockChatTurn;
  getTurn: () => MockChatTurn;
  reset: (projectContext?: MockChatProjectContext | null) => MockChatTurn;
}

const SYSTEM_PROMPT_ID = 'mock-chat-system-v1';
const ACTION_KEYWORDS: Array<{ id: string; title: string; keywords: RegExp; detail: string }> = [
  {
    id: 'actor-draft',
    title: 'Draft a new actor',
    keywords: /\b(actor|character|hero|npc)\b/i,
    detail: 'Generate a draft actor with name, class, level, base stats, and starting skills.',
  },
  {
    id: 'map-draft',
    title: 'Draft a new map outline',
    keywords: /\b(map|town|dungeon|level|area)\b/i,
    detail: 'Generate a small map with tile roles, event anchors, and a starting encounter layout.',
  },
  {
    id: 'event-draft',
    title: 'Draft event commands',
    keywords: /\b(event|command|script|dialogue|dialog)\b/i,
    detail: 'Generate a small event script for the selected event page.',
  },
  {
    id: 'balance-suggestion',
    title: 'Balance an existing actor',
    keywords: /\b(balance|tune|adjust)\b/i,
    detail: 'Suggest stat and skill adjustments for the selected actor.',
  },
  {
    id: 'validation-repair',
    title: 'Repair broken references',
    keywords: /\b(repair|broken|missing reference|fix)\b/i,
    detail: 'Find broken references in the project and propose offline-safe fixes.',
  },
];

function detectActionCards(prompt: string): MockChatActionCard[] {
  return ACTION_KEYWORDS.filter((k) => k.keywords.test(prompt)).map((k) => ({
    id: k.id,
    title: k.title,
    detail: k.detail,
  }));
}

function deterministicHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function buildAssistantContent(req: MockChatRequest): string {
  const projectSummary = req.projectContext
    ? `Project "${req.projectContext.projectTitle}" (${req.projectContext.databaseTables.length} tables, ${req.projectContext.recentMapIds.length} recent maps). `
    : '';
  const turnIndex = req.priorMessages.filter((m) => m.role === 'user').length + 1;
  return (
    `${projectSummary}Mock assistant turn ${turnIndex}. ` +
    `You asked: "${req.userMessage.slice(0, 80)}". ` +
    `Drafts and previews are local-only; no network call was made. ` +
    `Use the action cards below to route to a draft workflow.`
  );
}

export function buildMockChatResponse(req: MockChatRequest): MockChatResponse {
  const hashSeed = `${req.userMessage}|${req.priorMessages.length}|${
    req.projectContext?.projectId ?? 'no-project'
  }`;
  const id = `mock-assistant-${deterministicHash(hashSeed)}`;
  const content = buildAssistantContent(req);
  const actionCards = detectActionCards(req.userMessage);
  return {
    id,
    role: 'assistant',
    content,
    createdAt: '2026-06-02T12:00:00.000Z',
    ...(actionCards.length > 0 ? { actionCards } : {}),
  };
}

export function initialMockChatTurn(): MockChatTurn {
  return {
    systemPromptId: SYSTEM_PROMPT_ID,
    messages: [],
  };
}

function makeUserMessage(userMessage: string, priorCount: number): MockChatMessage {
  return {
    id: `mock-user-${deterministicHash(`${userMessage}|${priorCount}`)}`,
    role: 'user',
    content: userMessage,
    createdAt: '2026-06-02T12:00:00.000Z',
  };
}

export function createMockChatConversationLoop(options: {
  initialTurn: MockChatTurn;
  projectContext: MockChatProjectContext | null;
}): MockChatConversationLoop {
  let turn: MockChatTurn = options.initialTurn;
  let context: MockChatProjectContext | null = options.projectContext;

  return {
    submit(userMessage: string) {
      const userMsg = makeUserMessage(userMessage, turn.messages.length);
      const updatedMessages = [...turn.messages, userMsg];
      const response = buildMockChatResponse({
        userMessage,
        priorMessages: updatedMessages,
        projectContext: context,
      });
      turn = { ...turn, messages: [...updatedMessages, response] };
      return turn;
    },
    getTurn() {
      return { ...turn, messages: [...turn.messages] };
    },
    reset(nextContext?: MockChatProjectContext | null) {
      if (nextContext !== undefined) context = nextContext;
      turn = initialMockChatTurn();
      return turn;
    },
  };
}
