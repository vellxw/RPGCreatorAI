export type ProjectScopedSessionPhase = 'unscheduled' | 'active';

export interface ProjectScopedTranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  projectId?: string;
}

export interface ProjectScopedContextCache {
  projectTitle?: string;
  tableCount?: number;
  recentMapIds?: string[];
  [key: string]: unknown;
}

export interface ProjectScopedSessionState {
  boundProjectId: string | null;
  phase: ProjectScopedSessionPhase;
  transcript: ProjectScopedTranscriptEntry[];
  contextCache: ProjectScopedContextCache | null;
  archivedContext: ProjectScopedContextCache | null;
  recoveryCopy: string | null;
}

export interface ProjectScopedSession {
  bind: (projectId: string) => ProjectScopedSessionState;
  appendTranscript: (entry: ProjectScopedTranscriptEntry) => void;
  setContextCache: (cache: ProjectScopedContextCache) => void;
  reset: () => ProjectScopedSessionState;
  getState: () => ProjectScopedSessionState;
}

const RECOVERY_COPY = 'You switched projects. The prior AI Studio session context was cleared to avoid mixing drafts between projects.';

export function createProjectScopedSession(): ProjectScopedSession {
  let state: ProjectScopedSessionState = {
    boundProjectId: null,
    phase: 'unscheduled',
    transcript: [],
    contextCache: null,
    archivedContext: null,
    recoveryCopy: null,
  };

  return {
    bind(projectId: string) {
      if (state.boundProjectId === projectId) return { ...state };
      const archived = state.contextCache;
      const hadPrior = state.boundProjectId !== null;
      state = {
        boundProjectId: projectId,
        phase: 'active',
        transcript: [],
        contextCache: null,
        archivedContext: archived,
        recoveryCopy: hadPrior ? RECOVERY_COPY : null,
      };
      return { ...state };
    },
    appendTranscript(entry) {
      if (state.boundProjectId === null) return;
      if (entry.projectId !== undefined && entry.projectId !== state.boundProjectId) return;
      state = { ...state, transcript: [...state.transcript, entry] };
    },
    setContextCache(cache) {
      if (state.boundProjectId === null) return;
      state = { ...state, contextCache: cache };
    },
    reset() {
      state = {
        boundProjectId: null,
        phase: 'unscheduled',
        transcript: [],
        contextCache: null,
        archivedContext: null,
        recoveryCopy: null,
      };
      return { ...state };
    },
    getState() {
      return { ...state };
    },
  };
}
