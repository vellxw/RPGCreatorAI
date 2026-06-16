import { createContext, useContext, useReducer, type Dispatch } from 'react';
import type { Screen, GameEvent, EventType } from '../types/project';
import type { PlaytestSessionMode } from '../adapters/types';

export type BrushSelection =
  | {
      kind: 'tile';
      tileId: number;
      label: string;
    }
  | { kind: 'collision'; tileId: 0 | 9; label: 'erase' | 'wall' }
  | { kind: 'region'; regionId: number; label: string }
  | { kind: 'event'; eventType: EventType; label: 'npc' | 'chest' | 'transfer' | 'trigger' };

export type AuthoringLayer = 'ground' | 'decoration' | 'foreground' | 'collision' | 'region' | 'event';

export interface EditorState {
  activeScreen: Screen;
  activeProjectId: string | null;
  selectedMapId: string;
  selectedEvent: GameEvent | null;
  selectedEventMapId: string | null;
  zoom: number;
  zoomMode: 'fit' | 'manual';
  saved: boolean;
  brush: BrushSelection;
  activeLayer: AuthoringLayer;
  tool: 'brush' | 'fill' | 'rectangle' | 'erase' | 'select';
  brushSize: 1 | 2 | 3 | 5;
  interactionMode: 'paint' | 'select';
  playtestMode: PlaytestSessionMode;
}

export type EditorAction =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SET_ACTIVE_PROJECT'; projectId: string | null }
  | { type: 'SELECT_MAP'; mapId: string }
  | { type: 'SELECT_EVENT'; event: GameEvent | null; mapId: string | null }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'FIT_TO_VIEW' }
  | { type: 'SET_ACTUAL_SIZE' }
  | { type: 'SET_BRUSH'; brush: BrushSelection }
  | { type: 'SET_ACTIVE_LAYER'; layer: EditorState['activeLayer'] }
  | { type: 'SET_TOOL'; tool: EditorState['tool'] }
  | { type: 'SET_BRUSH_SIZE'; brushSize: EditorState['brushSize'] }
  | { type: 'SET_INTERACTION_MODE'; mode: 'paint' | 'select' }
  | { type: 'SET_PLAYTEST_MODE'; mode: PlaytestSessionMode }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_DIRTY' };

export const initialEditorState: EditorState = {
  activeScreen: 'editor',
  activeProjectId: 'town',
  selectedMapId: 'town',
  selectedEvent: null,
  selectedEventMapId: null,
  zoom: 100,
  zoomMode: 'fit',
  saved: true,
  brush: { kind: 'tile', tileId: 1, label: 'grass' },
  activeLayer: 'ground',
  tool: 'brush',
  brushSize: 1,
  interactionMode: 'paint',
  playtestMode: 'projectStart',
};

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, activeScreen: action.screen };
    case 'SELECT_MAP':
      return {
        ...state,
        selectedMapId: action.mapId,
        selectedEvent: null,
        selectedEventMapId: null,
        playtestMode: state.playtestMode === 'selectedEvent' ? 'currentMap' : state.playtestMode,
      };
    case 'SELECT_EVENT':
      return {
        ...state,
        selectedEvent: action.event,
        selectedEventMapId: action.mapId,
        playtestMode:
          action.event === null && state.playtestMode === 'selectedEvent'
            ? 'currentMap'
            : state.playtestMode,
      };
    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom, zoomMode: 'manual' };
    case 'FIT_TO_VIEW':
      return { ...state, zoomMode: 'fit' };
    case 'SET_ACTUAL_SIZE':
      return { ...state, zoom: 100, zoomMode: 'manual' };
    case 'SET_BRUSH':
      return {
        ...state,
        brush: action.brush,
        activeLayer:
          action.brush.kind === 'tile'
            ? 'ground'
            : action.brush.kind === 'collision'
              ? 'collision'
              : action.brush.kind === 'region'
                ? 'region'
              : 'event',
        tool: state.tool === 'select' ? 'brush' : state.tool,
        interactionMode: 'paint',
      };
    case 'SET_ACTIVE_LAYER':
      return {
        ...state,
        activeLayer: action.layer,
        brush:
          action.layer === 'ground' || action.layer === 'decoration' || action.layer === 'foreground'
            ? state.brush.kind === 'tile'
              ? state.brush
              : { kind: 'tile', tileId: 1, label: 'grass' }
            : action.layer === 'collision'
              ? state.brush.kind === 'collision'
                ? state.brush
                : { kind: 'collision', tileId: 9, label: 'wall' }
              : action.layer === 'region'
                ? state.brush.kind === 'region'
                  ? state.brush
                  : { kind: 'region', regionId: 1, label: 'Region 1' }
              : state.brush.kind === 'event'
                ? state.brush
                : { kind: 'event', eventType: 'npc', label: 'npc' },
        interactionMode: action.layer === 'event' && state.tool === 'select' ? 'select' : 'paint',
      };
    case 'SET_TOOL':
      return {
        ...state,
        tool: action.tool,
        interactionMode: action.tool === 'select' ? 'select' : 'paint',
      };
    case 'SET_BRUSH_SIZE':
      return { ...state, brushSize: action.brushSize };
    case 'SET_INTERACTION_MODE':
      return { ...state, interactionMode: action.mode, tool: action.mode === 'select' ? 'select' : state.tool };
    case 'SET_PLAYTEST_MODE':
      return { ...state, playtestMode: action.mode };
    case 'MARK_SAVED':
      return { ...state, saved: true };
    case 'MARK_DIRTY':
      return { ...state, saved: false };
    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.projectId };
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
