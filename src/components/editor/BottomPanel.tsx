import { Tabs } from '../ui/Tabs';
import { CheckCircle2, AlertTriangle, Sparkles, ChevronRight } from 'lucide-react';
import { useProject } from '../../stores/projectStore';
import { useEditor } from '../../stores/editorStore';
import { validateMap } from '../../validation/validateMap';

function ValidationContent() {
  const project = useProject();
  const { state } = useEditor();
  const map = project.maps[state.selectedMapId];
  const allMapIds = Object.keys(project.maps);

  if (!map) return <p className="text-gray-400 text-[13px]">No map selected</p>;

  const messages = validateMap(map, allMapIds);
  const errors = messages.filter(m => m.level === 'error');
  const warnings = messages.filter(m => m.level === 'warning');
  const infos = messages.filter(m => m.level === 'info');

  return (
    <div className="space-y-3">
      {infos.map((msg, i) => (
        <div key={`i${i}`} className="flex items-start gap-2.5">
          <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-gray-800">{msg.message}</p>
            <p className="text-[12px] text-gray-500">Great job! Your map is valid and ready for playtesting.</p>
          </div>
        </div>
      ))}
      {errors.map((msg, i) => (
        <div key={`e${i}`} className="flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-gray-800">{msg.message}</p>
            {msg.source && <p className="text-[12px] text-gray-500">{msg.source}</p>}
          </div>
        </div>
      ))}
      {warnings.map((msg, i) => (
        <div key={`w${i}`} className="flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-gray-800">{msg.message}</p>
            {msg.source && <p className="text-[12px] text-gray-500">{msg.source}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function AISuggestionsContent() {
  const suggestions = [
    { icon: '💬', title: 'Generate NPC dialogue', desc: 'Create contextual conversations', color: 'bg-blue-50 text-blue-600' },
    { icon: '🗺️', title: 'Improve town layout', desc: 'AI will suggest layout improvements', color: 'bg-purple-50 text-purple-600' },
    { icon: '⚔️', title: 'Create side quest', desc: 'Generate a new side quest idea', color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="space-y-2">
      <h4 className="text-[12px] font-semibold text-gray-700 mb-3">AI Suggestions</h4>
      {suggestions.map((s, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors group">
          <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center text-sm`}>
            {s.icon}
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-gray-800">{s.title}</p>
            <p className="text-[11px] text-gray-500">{s.desc}</p>
          </div>
          <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500" />
        </div>
      ))}
    </div>
  );
}

export function BottomPanel() {
  return (
    <div className="h-[200px] flex-shrink-0 bg-white border-t border-gray-200 flex">
      <div className="flex-1 border-r border-gray-100">
        <Tabs
          tabs={[
            { id: 'output', label: 'Output', content: <p className="text-[13px] text-gray-500">No output messages</p> },
            { id: 'validation', label: 'Validation', content: <ValidationContent /> },
            { id: 'ai', label: 'AI Suggestions', content: <AISuggestionsContent /> },
            { id: 'logs', label: 'Playtest Logs', content: <p className="text-[13px] text-gray-500">Start a playtest to see logs</p> },
          ]}
          defaultTab="validation"
        />
      </div>
      <div className="w-[320px] p-4">
        <AISuggestionsContent />
      </div>
    </div>
  );
}
