export type PreviewControlsPhase =
  | 'pending'
  | 'validating'
  | 'valid'
  | 'invalid'
  | 'applied'
  | 'rejected';

export type PreviewControlsDecision = 'applied' | 'rejected' | null;

export interface PreviewControlsState {
  phase: PreviewControlsPhase;
  decision: PreviewControlsDecision;
  decidedAt: string | null;
  errors: string[];
  warnings: string[];
}

export type PreviewControlsAction =
  | { type: 'beginValidation' }
  | { type: 'validationSucceeded' }
  | { type: 'validationFailed'; errors: string[]; warnings?: string[] }
  | { type: 'apply' }
  | { type: 'reject' }
  | { type: 'reset' };

export const defaultPreviewControlsState: PreviewControlsState = {
  phase: 'pending',
  decision: null,
  decidedAt: null,
  errors: [],
  warnings: [],
};

function stamp(state: PreviewControlsState, decision: PreviewControlsDecision, phase: PreviewControlsPhase): PreviewControlsState {
  return {
    ...state,
    phase,
    decision,
    decidedAt: state.decidedAt ?? '2026-06-02T12:00:00.000Z',
  };
}

export function previewControlsReducer(
  state: PreviewControlsState,
  action: PreviewControlsAction,
): PreviewControlsState {
  switch (action.type) {
    case 'beginValidation':
      if (state.phase === 'applied' || state.phase === 'rejected') return state;
      return { ...state, phase: 'validating' };
    case 'validationSucceeded':
      if (state.phase === 'applied' || state.phase === 'rejected') return state;
      if (state.phase !== 'validating') return state;
      return { ...state, phase: 'valid', errors: [], warnings: [] };
    case 'validationFailed':
      if (state.phase === 'applied' || state.phase === 'rejected') return state;
      if (state.phase !== 'validating') return state;
      return { ...state, phase: 'invalid', errors: action.errors, warnings: action.warnings ?? [] };
    case 'apply':
      if (state.phase !== 'valid') return state;
      return stamp(state, 'applied', 'applied');
    case 'reject':
      if (state.phase === 'applied') return state;
      if (state.phase === 'rejected') return state;
      return stamp(state, 'rejected', 'rejected');
    case 'reset':
      return defaultPreviewControlsState;
    default:
      return state;
  }
}
