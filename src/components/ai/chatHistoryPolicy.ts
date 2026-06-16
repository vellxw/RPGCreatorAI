export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  projectId?: string;
  sessionId?: string;
  actionCards?: unknown[];
}

export interface SanitizedChatMessage {
  id: string;
  role: ChatHistoryMessage['role'];
  content: string;
  createdAt: string;
  projectId?: string;
  sessionId?: string;
  actionCards?: unknown[];
}

export type ChatHistoryPolicy =
  | { policy: 'memory-only' }
  | { policy: 'project-scoped'; projectId: string }
  | { policy: 'session-scoped'; sessionId: string };

export interface ChatHistorySerialized {
  policy: ChatHistoryPolicy['policy'];
  projectId?: string;
  sessionId?: string;
  messages: SanitizedChatMessage[];
  savedAt: string;
}

const SECRET_REDACTION_RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: 'openai-sk', pattern: /\bsk-[A-Za-z0-9_-]{6,}/g },
  { name: 'openai-proj', pattern: /\bsk-proj-[A-Za-z0-9_-]{2,}/g },
  { name: 'openai-sk-live', pattern: /\bsk_live_[A-Za-z0-9_-]{6,}/g },
  { name: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{6,}/g },
  { name: 'github-token', pattern: /\bghp_[A-Za-z0-9]{6,}/g },
  { name: 'bearer', pattern: /\bBearer\s+[A-Za-z0-9._-]{8,}/g },
  { name: 'password-assign', pattern: /\bpassword\s*=\s*[^\s,;]+/gi },
  { name: 'api-key-assign', pattern: /\bapi[_-]?key\s*=\s*[^\s,;]+/gi },
  { name: 'secret-assign', pattern: /\bsecret\s*=\s*[^\s,;]+/gi },
  { name: 'json-apikey', pattern: /"apiKey"\s*:\s*"[^"]+"/g },
  { name: 'json-secret', pattern: /"secret"\s*:\s*"[^"]+"/g },
  { name: 'env-var-name', pattern: /\b[A-Z][A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)\s*=\s*[^\s,;]+/g },
];

export function sanitizeChatMessageForPersistence(message: ChatHistoryMessage): SanitizedChatMessage {
  let content = message.content;
  for (const rule of SECRET_REDACTION_RULES) {
    content = content.replace(rule.pattern, '[REDACTED]');
  }
  const out: SanitizedChatMessage = {
    id: message.id,
    role: message.role,
    content,
    createdAt: message.createdAt,
  };
  if (message.projectId !== undefined) out.projectId = message.projectId;
  if (message.sessionId !== undefined) out.sessionId = message.sessionId;
  if (message.actionCards !== undefined) out.actionCards = message.actionCards;
  return out;
}

export interface ChatHistoryStore {
  record: (message: ChatHistoryMessage) => void;
  clear: () => void;
  size: () => number;
  serialize: () => ChatHistorySerialized | null;
}

export function createChatHistoryStore(policy: ChatHistoryPolicy): ChatHistoryStore {
  const messages: ChatHistoryMessage[] = [];

  return {
    record(message: ChatHistoryMessage) {
      if (policy.policy === 'project-scoped') {
        if (message.projectId !== policy.projectId) return;
      }
      messages.push(message);
    },
    clear() {
      messages.length = 0;
    },
    size() {
      return messages.length;
    },
    serialize() {
      if (policy.policy === 'memory-only') return null;
      const sanitized = messages.map(sanitizeChatMessageForPersistence);
      const out: ChatHistorySerialized = {
        policy: policy.policy,
        messages: sanitized,
        savedAt: '2026-06-02T12:00:00.000Z',
      };
      if (policy.policy === 'project-scoped') out.projectId = policy.projectId;
      if (policy.policy === 'session-scoped') out.sessionId = policy.sessionId;
      return out;
    },
  };
}
