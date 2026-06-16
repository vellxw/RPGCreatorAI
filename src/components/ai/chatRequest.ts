export type ChatRequestPhase =
  | 'pending'
  | 'streaming'
  | 'completed'
  | 'canceled'
  | 'failed';

export interface ChatRequestState {
  phase: ChatRequestPhase;
  tokens: string[];
  finalText: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export type ChatRequestAction =
  | { type: 'start' }
  | { type: 'appendToken'; token: string }
  | { type: 'complete' }
  | { type: 'cancel' }
  | { type: 'fail'; message: string }
  | { type: 'reset' };

export const defaultChatRequestState: ChatRequestState = {
  phase: 'pending',
  tokens: [],
  finalText: null,
  errorMessage: null,
  startedAt: null,
  completedAt: null,
};

function nowIso(): string {
  return new Date().toISOString();
}

function isTerminal(phase: ChatRequestPhase): boolean {
  return phase === 'completed' || phase === 'canceled' || phase === 'failed';
}

export function chatRequestReducer(
  state: ChatRequestState,
  action: ChatRequestAction,
): ChatRequestState {
  switch (action.type) {
    case 'start':
      if (state.phase !== 'pending') return state;
      return { ...state, phase: 'streaming', startedAt: nowIso() };
    case 'appendToken':
      if (state.phase !== 'streaming') return state;
      if (!action.token) return state;
      return { ...state, tokens: [...state.tokens, action.token] };
    case 'complete':
      if (state.phase !== 'streaming') return state;
      return {
        ...state,
        phase: 'completed',
        finalText: state.tokens.join(''),
        completedAt: nowIso(),
      };
    case 'cancel':
      if (state.phase !== 'pending' && state.phase !== 'streaming') return state;
      return { ...state, phase: 'canceled', completedAt: nowIso() };
    case 'fail':
      if (state.phase !== 'pending' && state.phase !== 'streaming') return state;
      return {
        ...state,
        phase: 'failed',
        errorMessage: action.message,
        completedAt: nowIso(),
      };
    case 'reset':
      if (isTerminal(state.phase) || state.phase === 'pending') {
        return defaultChatRequestState;
      }
      return state;
    default:
      return state;
  }
}
