import { useEditor } from '../../stores/editorStore';
import { Input, Select } from '../ui/Input';
import { MoreVertical, Plus } from 'lucide-react';
import type { EventCommand } from '../../types/project';

function CommandRow({ index, command }: { index: number; command: EventCommand }) {
  const labels: Record<string, string> = {
    showText: 'Show Text',
    setFlag: 'Control Switch',
    ifFlag: 'If Flag',
    addItem: 'Change Items',
    transferMap: 'Transfer Map',
    playSound: 'Play Sound',
  };

  const getDescription = (cmd: EventCommand): string => {
    switch (cmd.type) {
      case 'showText': return cmd.text.substring(0, 30) + (cmd.text.length > 30 ? '...' : '');
      case 'setFlag': return `${cmd.flag} → ${cmd.value ? 'ON' : 'OFF'}`;
      case 'ifFlag': return `${cmd.flag} is ${cmd.equals ? 'ON' : 'OFF'}`;
      case 'addItem': return `${cmd.itemId} + ${cmd.amount}`;
      case 'transferMap': return `${cmd.mapId} (${cmd.x}, ${cmd.y})`;
      case 'playSound': return cmd.soundId;
      default: return '';
    }
  };

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded border border-gray-100 text-[12px]">
      <span className="text-gray-400 font-mono w-4">{index}</span>
      <span className="font-medium text-gray-700">{labels[command.type] || command.type}</span>
      <span className="text-gray-500 truncate flex-1">{getDescription(command)}</span>
    </div>
  );
}

export function Inspector() {
  const { state } = useEditor();
  const event = state.selectedEvent;

  if (!event) {
    return (
      <div className="w-[280px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <span className="text-gray-400 text-lg">🎯</span>
        </div>
        <p className="text-[13px] text-gray-500">Select an object on the map to inspect its properties</p>
      </div>
    );
  }

  // Flatten top-level commands for display
  const topCommands: EventCommand[] = event.commands;

  return (
    <div className="w-[280px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-gray-800">Inspector</span>
          </div>
        </div>
        <MoreVertical size={14} className="text-gray-400" />
      </div>

      {/* Event info */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-lg">
            {event.type === 'npc' ? '👤' : event.type === 'chest' ? '📦' : event.type === 'transfer' ? '🚪' : '⬜'}
          </div>
          <div>
            <div className="text-[14px] font-semibold text-gray-800">{event.id}</div>
            <div className="text-[12px] text-gray-500 capitalize">Object</div>
          </div>
        </div>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div>
          <div className="text-[12px] font-semibold text-gray-700 mb-3 flex items-center justify-between">
            General
            <ChevronIcon />
          </div>
          <div className="space-y-3">
            <Input label="Name" defaultValue={event.id} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Position X" type="number" defaultValue={String(event.x)} />
              <Input label="Position Y" type="number" defaultValue={String(event.y)} />
            </div>
            <Select
              label="Trigger"
              value={event.trigger}
              options={[
                { value: 'interact', label: 'Interact' },
                { value: 'touch', label: 'Touch' },
                { value: 'autorun', label: 'Autorun' },
                { value: 'parallel', label: 'Parallel' },
              ]}
            />
            <Select
              label="Solid"
              value={event.solid ? 'yes' : 'no'}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
            />
            {event.commands.some(c => c.type === 'ifFlag' || c.type === 'setFlag') && (
              <Input
                label="Flag"
                defaultValue={
                  event.commands.find(c => c.type === 'ifFlag')
                    ? (event.commands.find(c => c.type === 'ifFlag') as { flag: string }).flag
                    : ''
                }
              />
            )}
          </div>
        </div>

        {/* Commands */}
        <div>
          <div className="text-[12px] font-semibold text-gray-700 mb-2">Commands</div>
          <div className="space-y-1.5">
            {topCommands.slice(0, 5).map((cmd, i) => (
              <CommandRow key={i} index={i + 1} command={cmd} />
            ))}
          </div>
          <button className="mt-2 flex items-center gap-1 text-[12px] text-indigo-600 hover:text-indigo-700 cursor-pointer">
            <Plus size={12} />
            Add Command
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-2">
        <button className="flex-1 px-3 py-1.5 text-[12px] font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 cursor-pointer">
          Edit Event Page
        </button>
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-400">
      <path d="M3 5L6 2L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
