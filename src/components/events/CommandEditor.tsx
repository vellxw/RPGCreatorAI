// Inline command editor — lets the user tweak parameters of a selected
// command in the event command stack. Lightweight: handles the common
// shapes (showText, setFlag, addItem, transferMap) without a node graph.

import type {
  AddItemCommand,
  EventCommand,
  PlaySoundCommand,
  SetFlagCommand,
  ShowTextCommand,
  TransferMapCommand,
  Direction,
} from '../../types/project';

interface Props {
  command: EventCommand;
  mapIds: string[];
  itemIds: string[];
  onChange(next: EventCommand): void;
  onRemove(): void;
}

export function CommandEditor({ command, mapIds, itemIds, onChange, onRemove }: Props) {
  return (
    <div className="space-y-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
      {command.type === 'showText' && <ShowTextEditor command={command} onChange={onChange} />}
      {command.type === 'setFlag' && <SetFlagEditor command={command} onChange={onChange} />}
      {command.type === 'addItem' && <AddItemEditor command={command} itemIds={itemIds} onChange={onChange} />}
      {command.type === 'transferMap' && <TransferMapEditor command={command} mapIds={mapIds} onChange={onChange} />}
      {command.type === 'playSound' && <PlaySoundEditor command={command} onChange={onChange} />}
      {command.type === 'ifFlag' && (
        <p className="text-[11px] text-gray-500 italic">If/Else branches are edited inline in the command stack.</p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] text-red-600 hover:text-red-700 cursor-pointer"
        >
          Remove command
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function ShowTextEditor({ command, onChange }: { command: ShowTextCommand; onChange: (n: ShowTextCommand) => void }) {
  return (
    <div className="space-y-2">
      <Field label="Speaker">
        <input
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.speaker ?? ''}
          onChange={e => onChange({ ...command, speaker: e.target.value })}
        />
      </Field>
      <Field label="Text">
        <textarea
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded resize-none h-16"
          value={command.text}
          onChange={e => onChange({ ...command, text: e.target.value })}
        />
      </Field>
    </div>
  );
}

function SetFlagEditor({ command, onChange }: { command: SetFlagCommand; onChange: (n: SetFlagCommand) => void }) {
  return (
    <div className="space-y-2">
      <Field label="Flag">
        <input
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.flag}
          onChange={e => onChange({ ...command, flag: e.target.value })}
        />
      </Field>
      <Field label="Value">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.value ? 'true' : 'false'}
          onChange={e => onChange({ ...command, value: e.target.value === 'true' })}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </Field>
    </div>
  );
}

function AddItemEditor({
  command,
  itemIds,
  onChange,
}: {
  command: AddItemCommand;
  itemIds: string[];
  onChange: (n: AddItemCommand) => void;
}) {
  return (
    <div className="space-y-2">
      <Field label="Item">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.itemId}
          onChange={e => onChange({ ...command, itemId: e.target.value })}
        >
          {itemIds.map(id => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
          {!itemIds.includes(command.itemId) && (
            <option value={command.itemId}>{command.itemId} (unknown)</option>
          )}
        </select>
      </Field>
      <Field label="Amount">
        <input
          type="number"
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.amount}
          onChange={e => onChange({ ...command, amount: Number(e.target.value) })}
        />
      </Field>
    </div>
  );
}

function TransferMapEditor({
  command,
  mapIds,
  onChange,
}: {
  command: TransferMapCommand;
  mapIds: string[];
  onChange: (n: TransferMapCommand) => void;
}) {
  return (
    <div className="space-y-2">
      <Field label="Target Map">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.mapId}
          onChange={e => onChange({ ...command, mapId: e.target.value })}
        >
          {mapIds.map(id => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
          {!mapIds.includes(command.mapId) && (
            <option value={command.mapId}>{command.mapId} (unknown)</option>
          )}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          <input
            type="number"
            className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
            value={command.x}
            onChange={e => onChange({ ...command, x: Number(e.target.value) })}
          />
        </Field>
        <Field label="Y">
          <input
            type="number"
            className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
            value={command.y}
            onChange={e => onChange({ ...command, y: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Field label="Direction">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.direction}
          onChange={e => onChange({ ...command, direction: e.target.value as Direction })}
        >
          <option value="up">Up</option>
          <option value="down">Down</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </Field>
    </div>
  );
}

function PlaySoundEditor({ command, onChange }: { command: PlaySoundCommand; onChange: (n: PlaySoundCommand) => void }) {
  return (
    <Field label="Sound ID">
      <input
        className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
        value={command.soundId}
        onChange={e => onChange({ ...command, soundId: e.target.value })}
      />
    </Field>
  );
}
