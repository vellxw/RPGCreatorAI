import { Save, Play, Download, Sparkles, Undo2, Redo2, CheckCircle2, Square, RotateCcw, Upload, ExternalLink, Settings } from 'lucide-react';
import React from 'react';
import { Button } from '../ui/Button';
import { useEditor } from '../../stores/editorStore';
import type { Screen } from '../../types/project';

export function TopToolbar() {
  const { state, dispatch } = useEditor();

  const renderEditorToolbar = () => (
    <>
      <div className="flex items-center gap-2">
        <Undo2 size={16} className="text-gray-400 cursor-pointer hover:text-gray-600" />
        <Redo2 size={16} className="text-gray-400 cursor-pointer hover:text-gray-600" />
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-green-600">
        <CheckCircle2 size={14} />
        <span>All changes saved</span>
      </div>
      <div className="flex items-center gap-2">
        <Button icon={<Save size={14} />} onClick={() => dispatch({ type: 'MARK_SAVED' })}>Save</Button>
        <Button icon={<Play size={14} />} onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'playtest' })}>Playtest</Button>
        <Button variant="primary" icon={<Download size={14} />}>Export</Button>
        <Button icon={<Sparkles size={14} />}>AI Assist</Button>
      </div>
    </>
  );

  const renderEventToolbar = () => (
    <>
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <span className="hover:text-indigo-600 cursor-pointer">Maps</span>
        <span>/</span>
        <span className="hover:text-indigo-600 cursor-pointer">Town</span>
        <span>/</span>
        <span className="hover:text-indigo-600 cursor-pointer">Events</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">{state.selectedEvent?.id || 'Select event'}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button icon={<Save size={14} />}>Save</Button>
        <Button icon={<Play size={14} />}>Playtest Event</Button>
        <Button variant="primary" icon={<CheckCircle2 size={14} />}>Validate</Button>
        <Button icon={<Sparkles size={14} />}>AI Assist</Button>
      </div>
    </>
  );

  const renderAIToolbar = () => (
    <>
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <span>Settings</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">AI Tools</span>
      </div>
      <div className="flex items-center gap-2">
        <Button icon={<Save size={14} />}>Save</Button>
        <Button icon={<Play size={14} />}>Test Connections</Button>
        <Button icon={<Settings size={14} />}>Usage Limits</Button>
        <Button icon={<ExternalLink size={14} />}>Documentation</Button>
      </div>
    </>
  );

  const renderPlaytestToolbar = () => (
    <>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-gray-800 font-medium">Playtest: &quot;My First RPG&quot;</span>
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="danger" icon={<Square size={12} />}>Stop</Button>
        <Button icon={<RotateCcw size={14} />}>Restart</Button>
        <Button icon={<Save size={14} />}>Save State</Button>
        <Button icon={<Upload size={14} />}>Load State</Button>
        <Button icon={<ExternalLink size={14} />}>Open in Runtime</Button>
        <Button variant="primary" icon={<Sparkles size={14} />}>AI Debug Assist</Button>
      </div>
    </>
  );

  const toolbarContent: Record<Screen, () => React.ReactNode> = {
    editor: renderEditorToolbar,
    events: renderEventToolbar,
    'ai-tools': renderAIToolbar,
    playtest: renderPlaytestToolbar,
  };

  return (
    <header className="h-12 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-50">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <span className="text-white text-[12px] font-bold">⚔</span>
          </div>
          <span className="font-semibold text-[14px] text-gray-800">RPGCreatorAI</span>
        </div>
        {/* Project name */}
        {state.activeScreen === 'editor' && (
          <div className="flex items-center gap-1 text-[13px] text-gray-600 border-l border-gray-200 pl-4">
            <span>My First RPG</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-400">
              <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        {toolbarContent[state.activeScreen]()}
      </div>
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200">
        <Settings size={14} className="text-gray-500" />
      </div>
    </header>
  );
}
