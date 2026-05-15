import { createContext, useContext, useReducer, type Dispatch } from 'react';
import type { Screen, GameEvent } from '../types/project';

export interface EditorState {
  activeScreen: Screen;
  selectedMapId: string;
  selectedEvent: GameEvent | null;
  selectedEventMapId: string | null;
  zoom: number;
  saved: boolean;
}

export type EditorAction =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SELECT_MAP'; mapId: string }
  | { type: 'SELECT_EVENT'; event: GameEvent | null; mapId: string | null }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_DIRTY' };

export const initialEditorState: EditorState = {
  activeScreen: 'editor',
  selectedMapId: 'town',
  selectedEvent: null,
  selectedEventMapId: null,
  zoom: 100,
  saved: true,
};

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, activeScreen: action.screen };
    case 'SELECT_MAP':
      return { ...state, selectedMapId: action.mapId, selectedEvent: null, selectedEventMapId: null };
    case 'SELECT_EVENT':
      return { ...state, selectedEvent: action.event, selectedEventMapId: action.mapId };
    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom };
    case 'MARK_SAVED':
      return { ...state, saved: true };
    case 'MARK_DIRTY':
      return { ...state, saved: false };
    default:
      return state;
  }
}

export const EditorContext = createContext<{ state: EditorState; dispatch: Dispatch<EditorAction> } | null>(null);

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorContext');
  return ctx;
}

export function useEditorDispatch() {
  return useEditor().dispatch;
}
