import { createContext, useContext, useReducer, type Dispatch } from 'react';
import type { Screen, GameEvent, EventType } from '../types/project';

export type BrushSelection =
  | {
      kind: 'tile';
      tileId: number;
      label: 'grass' | 'path' | 'water' | 'snow' | 'tree' | 'interiorFloor' | 'interiorWall';
    }
  | { kind: 'collision'; tileId: 0 | 9; label: 'erase' | 'wall' }
  | { kind: 'event'; eventType: EventType; label: 'npc' | 'chest' | 'transfer' | 'trigger' };

export interface EditorState {
  activeScreen: Screen;
  selectedMapId: string;
  selectedEvent: GameEvent | null;
  selectedEventMapId: string | null;
  zoom: number;
  zoomMode: 'fit' | 'manual';
  saved: boolean;
  brush: BrushSelection;
  interactionMode: 'paint' | 'select';
}

export type EditorAction =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SELECT_MAP'; mapId: string }
  | { type: 'SELECT_EVENT'; event: GameEvent | null; mapId: string | null }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'FIT_TO_VIEW' }
  | { type: 'SET_ACTUAL_SIZE' }
  | { type: 'SET_BRUSH'; brush: BrushSelection }
  | { type: 'SET_INTERACTION_MODE'; mode: 'paint' | 'select' }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_DIRTY' };

export const initialEditorState: EditorState = {
  activeScreen: 'editor',
  selectedMapId: 'town',
  selectedEvent: null,
  selectedEventMapId: null,
  zoom: 100,
  zoomMode: 'fit',
  saved: true,
  brush: { kind: 'tile', tileId: 1, label: 'grass' },
  interactionMode: 'paint',
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
      return { ...state, zoom: action.zoom, zoomMode: 'manual' };
    case 'FIT_TO_VIEW':
      return { ...state, zoomMode: 'fit' };
    case 'SET_ACTUAL_SIZE':
      return { ...state, zoom: 100, zoomMode: 'manual' };
    case 'SET_BRUSH':
      return { ...state, brush: action.brush, interactionMode: 'paint' };
    case 'SET_INTERACTION_MODE':
      return { ...state, interactionMode: action.mode };
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
