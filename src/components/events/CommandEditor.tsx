// Inline command editor — lets the user tweak parameters of a selected
// command in the event command stack. Phase 6 v1: covers every command
// type with a focused inline form.

import { useProjectStore } from '../../stores/projectStore';
import type {
  AddGoldCommand,
  AddItemCommand,
  CallCommonEventCommand,
  ChangeActorHpCommand,
  CommentCommand,
  CompleteQuestCommand,
  ControlSelfSwitchCommand,
  ControlSwitchCommand,
  ControlVariableCommand,
  Direction,
  EventCommand,
  IfFlagCommand,
  IfSelfSwitchCommand,
  IfSwitchCommand,
  IfVariableCommand,
  OpenShopCommand,
  PluginCommand,
  PluginCommandArg,
  PlaySoundCommand,
  PlayAnimationCommand,
  RemoveGoldCommand,
  RemoveItemCommand,
  SetFlagCommand,
  SetMovementRouteCommand,
  ShowChoicesCommand,
  ShowTextCommand,
  StartBattleCommand,
  StartQuestCommand,
  TransferMapCommand,
  UpdateQuestObjectiveCommand,
  MovementRouteStep,
  MovementRouteStepType,
  MovementRouteTarget,
  VariableComparison,
  VariableOp,
  WaitCommand,
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
      <Body command={command} mapIds={mapIds} itemIds={itemIds} onChange={onChange} />
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

function Body({
  command,
  mapIds,
  itemIds,
  onChange,
}: {
  command: EventCommand;
  mapIds: string[];
  itemIds: string[];
  onChange(next: EventCommand): void;
}) {
  switch (command.type) {
    case 'showText':
      return <ShowTextEditor command={command} onChange={onChange} />;
    case 'setFlag':
      return <SetFlagEditor command={command} onChange={onChange} />;
    case 'addItem':
      return <ItemEditor command={command} itemIds={itemIds} onChange={onChange} />;
    case 'removeItem':
      return <ItemEditor command={command} itemIds={itemIds} onChange={onChange} />;
    case 'transferMap':
      return <TransferMapEditor command={command} mapIds={mapIds} onChange={onChange} />;
    case 'playSound':
      return <PlaySoundEditor command={command} onChange={onChange} />;
    case 'pluginCommand':
      return <PluginCommandEditor command={command} onChange={onChange} />;
    case 'showChoices':
      return <ShowChoicesEditor command={command} onChange={onChange} />;
    case 'controlSwitch':
      return <ControlSwitchEditor command={command} onChange={onChange} />;
    case 'controlSelfSwitch':
      return <ControlSelfSwitchEditor command={command} onChange={onChange} />;
    case 'controlVariable':
      return <ControlVariableEditor command={command} onChange={onChange} />;
    case 'ifFlag':
    case 'ifSwitch':
    case 'ifSelfSwitch':
    case 'ifVariable':
      return <ConditionalEditor command={command} onChange={onChange} />;
    case 'addGold':
    case 'removeGold':
      return <GoldEditor command={command} onChange={onChange} />;
    case 'wait':
      return <WaitEditor command={command} onChange={onChange} />;
    case 'comment':
      return <CommentEditor command={command} onChange={onChange} />;
    case 'callCommonEvent':
      return <CallCommonEventEditor command={command} onChange={onChange} />;
    case 'startQuest':
    case 'completeQuest':
      return <QuestEditor command={command} onChange={onChange} />;
    case 'updateQuestObjective':
      return <UpdateQuestObjectiveEditor command={command} onChange={onChange} />;
    case 'openShop':
      return <OpenShopEditor command={command} onChange={onChange} />;
    case 'startBattle':
      return <StartBattleEditor command={command} onChange={onChange} />;
    case 'changeActorHp':
      return <ChangeActorHpEditor command={command} onChange={onChange} />;
    case 'playAnimation':
      return <PlayAnimationEditor command={command} onChange={onChange} />;
    case 'setMovementRoute':
      return <MovementRouteEditor command={command} onChange={onChange} />;
    case 'setPlayerPosition':
      return <TransferMapEditor command={{ ...command, type: 'transferMap' as const }} mapIds={mapIds} onChange={(next) => onChange({ ...next, type: 'setPlayerPosition' })} />;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded" {...props} />;
}

function select<T extends string>(
  value: T,
  options: Array<{ value: T; label: string }>,
  onChange: (v: T) => void,
  ariaLabel?: string,
) {
  return (
    <select
      aria-label={ariaLabel}
      className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
      value={value}
      onChange={e => onChange(e.target.value as T)}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function ShowTextEditor({ command, onChange }: { command: ShowTextCommand; onChange: (n: ShowTextCommand) => void }) {
  return (
    <div className="space-y-2">
      <Field label="Speaker">
        {input({ value: command.speaker ?? '', onChange: e => onChange({ ...command, speaker: e.target.value }) })}
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
      <Field label="Flag (legacy)">{input({ value: command.flag, onChange: e => onChange({ ...command, flag: e.target.value }) })}</Field>
      <Field label="Value">
        {select(command.value ? 'true' : 'false', [
          { value: 'true', label: 'true' },
          { value: 'false', label: 'false' },
        ], v => onChange({ ...command, value: v === 'true' }))}
      </Field>
    </div>
  );
}

function ItemEditor({
  command,
  itemIds,
  onChange,
}: {
  command: AddItemCommand | RemoveItemCommand;
  itemIds: string[];
  onChange: (n: AddItemCommand | RemoveItemCommand) => void;
}) {
  return (
    <div className="space-y-2">
      <Field label="Item">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.itemId}
          onChange={e => onChange({ ...command, itemId: e.target.value })}
        >
          {itemIds.length === 0 && <option value="">(no items)</option>}
          {itemIds.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
          {!itemIds.includes(command.itemId) && command.itemId && (
            <option value={command.itemId}>{command.itemId} (unknown)</option>
          )}
        </select>
      </Field>
      <Field label="Amount">
        {input({ type: 'number', value: command.amount, onChange: e => onChange({ ...command, amount: Number(e.target.value) }) })}
      </Field>
    </div>
  );
}

function GoldEditor({ command, onChange }: { command: AddGoldCommand | RemoveGoldCommand; onChange: (n: AddGoldCommand | RemoveGoldCommand) => void }) {
  return (
    <Field label="Amount">
      {input({ type: 'number', value: command.amount, onChange: e => onChange({ ...command, amount: Number(e.target.value) }) })}
    </Field>
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
          {mapIds.map(id => <option key={id} value={id}>{id}</option>)}
          {!mapIds.includes(command.mapId) && (
            <option value={command.mapId}>{command.mapId} (unknown)</option>
          )}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X">{input({ type: 'number', value: command.x, onChange: e => onChange({ ...command, x: Number(e.target.value) }) })}</Field>
        <Field label="Y">{input({ type: 'number', value: command.y, onChange: e => onChange({ ...command, y: Number(e.target.value) }) })}</Field>
      </div>
      <Field label="Direction">
        {select(command.direction, [
          { value: 'up', label: 'Up' }, { value: 'down', label: 'Down' },
          { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' },
        ], v => onChange({ ...command, direction: v as Direction }))}
      </Field>
    </div>
  );
}

function PlaySoundEditor({ command, onChange }: { command: PlaySoundCommand; onChange: (n: PlaySoundCommand) => void }) {
  return (
    <Field label="Sound ID">
      {input({ value: command.soundId, onChange: e => onChange({ ...command, soundId: e.target.value }) })}
    </Field>
  );
}

function PluginCommandEditor({ command, onChange }: { command: PluginCommand; onChange: (n: PluginCommand) => void }) {
  const entries = Object.entries(command.args ?? {});
  const withEntries = (nextEntries: Array<[string, PluginCommandArg]>) => {
    onChange({
      ...command,
      args: Object.fromEntries(nextEntries.filter(([key]) => key.trim() !== '')),
    });
  };
  const updateArg = (index: number, next: [string, PluginCommandArg]) => {
    const copy = entries.slice();
    copy[index] = next;
    withEntries(copy);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Plugin ID">
          {input({ value: command.pluginId, onChange: e => onChange({ ...command, pluginId: e.target.value }) })}
        </Field>
        <Field label="Command">
          {input({ value: command.command, onChange: e => onChange({ ...command, command: e.target.value }) })}
        </Field>
      </div>
      <div className="space-y-1.5">
        {entries.map(([key, value], index) => (
          <div key={`${key}-${index}`} className="grid grid-cols-[1fr_92px_1.2fr_auto] gap-2 items-end">
            <Field label="Arg">
              {input({ value: key, onChange: e => updateArg(index, [e.target.value, value]) })}
            </Field>
            <Field label="Type">
              {select(pluginArgKind(value), [
                { value: 'string', label: 'Text' },
                { value: 'number', label: 'Number' },
                { value: 'boolean', label: 'Boolean' },
                { value: 'null', label: 'Null' },
              ], kind => updateArg(index, [key, defaultPluginArg(kind)]))}
            </Field>
            <Field label="Value">
              <PluginArgValueInput value={value} onChange={next => updateArg(index, [key, next])} />
            </Field>
            <button
              type="button"
              onClick={() => withEntries(entries.filter((_, i) => i !== index))}
              className="h-[26px] px-2 text-[11px] text-red-600 border border-red-100 rounded bg-white hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => withEntries([...entries, [`arg${entries.length + 1}`, '']])}
          className="px-2 py-1 text-[11px] text-indigo-600 border border-indigo-100 rounded bg-white hover:bg-indigo-50"
        >
          Add arg
        </button>
      </div>
    </div>
  );
}

type PluginArgKind = 'string' | 'number' | 'boolean' | 'null';

function pluginArgKind(value: PluginCommandArg): PluginArgKind {
  if (value === null) return 'null';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function defaultPluginArg(kind: PluginArgKind): PluginCommandArg {
  if (kind === 'number') return 0;
  if (kind === 'boolean') return true;
  if (kind === 'null') return null;
  return '';
}

function PluginArgValueInput({ value, onChange }: { value: PluginCommandArg; onChange(next: PluginCommandArg): void }) {
  if (value === null) {
    return input({ value: 'null', disabled: true });
  }
  if (typeof value === 'boolean') {
    return select(value ? 'true' : 'false', [
      { value: 'true', label: 'True' },
      { value: 'false', label: 'False' },
    ], next => onChange(next === 'true'));
  }
  if (typeof value === 'number') {
    return input({ type: 'number', value, onChange: e => onChange(Number(e.target.value)) });
  }
  return input({ value, onChange: e => onChange(e.target.value) });
}

function ShowChoicesEditor({ command, onChange }: { command: ShowChoicesCommand; onChange: (n: ShowChoicesCommand) => void }) {
  return (
    <div className="space-y-2">
      <Field label="Prompt">
        {input({ value: command.prompt, onChange: e => onChange({ ...command, prompt: e.target.value }) })}
      </Field>
      <Field label="Choices (labels only — branch contents edited inline above)">
        <div className="space-y-1">
          {command.choices.map((c, i) => (
            <div key={i} className="flex gap-1">
              <input
                className="flex-1 px-2 py-1 text-[12px] border border-gray-200 rounded"
                value={c.label}
                onChange={e => {
                  const next = command.choices.slice();
                  next[i] = { ...next[i], label: e.target.value };
                  onChange({ ...command, choices: next });
                }}
              />
              <button
                className="px-2 text-[11px] text-red-600 cursor-pointer"
                onClick={() => onChange({ ...command, choices: command.choices.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="text-[11px] text-indigo-600 cursor-pointer"
            onClick={() => onChange({ ...command, choices: [...command.choices, { label: 'New choice', commands: [] }] })}
          >
            + Add choice
          </button>
        </div>
      </Field>
    </div>
  );
}

function ControlSwitchEditor({ command, onChange }: { command: ControlSwitchCommand; onChange: (n: ControlSwitchCommand) => void }) {
  const { state } = useProjectStore();
  const switches = state.databases.switches;
  return (
    <div className="space-y-2">
      <Field label="Switch">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.switchId}
          onChange={e => onChange({ ...command, switchId: e.target.value })}
        >
          {switches.length === 0 && <option value="">(no switches defined)</option>}
          {switches.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          {!switches.find(s => s.id === command.switchId) && command.switchId && (
            <option value={command.switchId}>{command.switchId} (unknown)</option>
          )}
        </select>
      </Field>
      <Field label="Value">
        {select(command.value ? 'true' : 'false', [
          { value: 'true', label: 'ON' }, { value: 'false', label: 'OFF' },
        ], v => onChange({ ...command, value: v === 'true' }))}
      </Field>
    </div>
  );
}

function ControlSelfSwitchEditor({ command, onChange }: { command: ControlSelfSwitchCommand; onChange: (n: ControlSelfSwitchCommand) => void }) {
  return (
    <div className="space-y-2">
      <Field label="Self Switch">
        {selfSwitchSelect(command.switchId, switchId => onChange({ ...command, switchId }))}
      </Field>
      <Field label="Value">
        {select(command.value ? 'true' : 'false', [
          { value: 'true', label: 'ON' },
          { value: 'false', label: 'OFF' },
        ], v => onChange({ ...command, value: v === 'true' }))}
      </Field>
    </div>
  );
}

function ControlVariableEditor({ command, onChange }: { command: ControlVariableCommand; onChange: (n: ControlVariableCommand) => void }) {
  const { state } = useProjectStore();
  const variables = state.databases.variables;
  return (
    <div className="space-y-2">
      <Field label="Variable">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.variableId}
          onChange={e => onChange({ ...command, variableId: e.target.value })}
        >
          {variables.length === 0 && <option value="">(no variables defined)</option>}
          {variables.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          {!variables.find(v => v.id === command.variableId) && command.variableId && (
            <option value={command.variableId}>{command.variableId} (unknown)</option>
          )}
        </select>
      </Field>
      <Field label="Op">
        {select<VariableOp>(command.op, [
          { value: 'set', label: 'Set =' }, { value: 'add', label: 'Add +=' },
          { value: 'sub', label: 'Sub -=' }, { value: 'mul', label: 'Mul *=' },
          { value: 'div', label: 'Div /=' }, { value: 'mod', label: 'Mod %=' },
        ], v => onChange({ ...command, op: v }))}
      </Field>
      <Field label="Value">
        {input({ type: 'number', value: command.value, onChange: e => onChange({ ...command, value: Number(e.target.value) }) })}
      </Field>
    </div>
  );
}

function ConditionalEditor({ command, onChange }: { command: IfFlagCommand | IfSwitchCommand | IfSelfSwitchCommand | IfVariableCommand; onChange: (n: EventCommand) => void }) {
  const { state } = useProjectStore();
  if (command.type === 'ifFlag') {
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-gray-500">If/Else branches are edited inline in the command stack above.</p>
        <Field label="Flag">
          {input({ value: command.flag, onChange: e => onChange({ ...command, flag: e.target.value }) })}
        </Field>
        <Field label="Equals">
          {select(command.equals ? 'true' : 'false', [
            { value: 'true', label: 'ON' }, { value: 'false', label: 'OFF' },
          ], v => onChange({ ...command, equals: v === 'true' }))}
        </Field>
      </div>
    );
  }
  if (command.type === 'ifSwitch') {
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-gray-500">If/Else branches are edited inline in the command stack above.</p>
        <Field label="Switch">
          <select
            className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
            value={command.switchId}
            onChange={e => onChange({ ...command, switchId: e.target.value })}
          >
            {state.databases.switches.length === 0 && <option value="">(no switches)</option>}
            {state.databases.switches.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Equals">
          {select(command.equals ? 'true' : 'false', [
            { value: 'true', label: 'ON' }, { value: 'false', label: 'OFF' },
          ], v => onChange({ ...command, equals: v === 'true' }))}
        </Field>
      </div>
    );
  }
  if (command.type === 'ifSelfSwitch') {
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-gray-500">If/Else branches are edited inline in the command stack above.</p>
        <Field label="Self Switch">
          {selfSwitchSelect(command.switchId, switchId => onChange({ ...command, switchId }))}
        </Field>
        <Field label="Equals">
          {select(command.equals ? 'true' : 'false', [
            { value: 'true', label: 'ON' }, { value: 'false', label: 'OFF' },
          ], v => onChange({ ...command, equals: v === 'true' }))}
        </Field>
      </div>
    );
  }
  // ifVariable
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">If/Else branches are edited inline in the command stack above.</p>
      <Field label="Variable">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.variableId}
          onChange={e => onChange({ ...command, variableId: e.target.value })}
        >
          {state.databases.variables.length === 0 && <option value="">(no variables)</option>}
          {state.databases.variables.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </Field>
      <Field label="Op">
        {select<VariableComparison>(command.op, [
          { value: 'eq', label: '==' }, { value: 'neq', label: '!=' },
          { value: 'gt', label: '>' }, { value: 'gte', label: '>=' },
          { value: 'lt', label: '<' }, { value: 'lte', label: '<=' },
        ], v => onChange({ ...command, op: v }))}
      </Field>
      <Field label="Value">
        {input({ type: 'number', value: command.value, onChange: e => onChange({ ...command, value: Number(e.target.value) }) })}
      </Field>
    </div>
  );
}

function WaitEditor({ command, onChange }: { command: WaitCommand; onChange: (n: WaitCommand) => void }) {
  return (
    <Field label="Duration (ms)">
      {input({ type: 'number', value: command.ms, onChange: e => onChange({ ...command, ms: Number(e.target.value) }) })}
    </Field>
  );
}

function CommentEditor({ command, onChange }: { command: CommentCommand; onChange: (n: CommentCommand) => void }) {
  return (
    <Field label="Comment">
      <textarea
        className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded resize-none h-16"
        value={command.text}
        onChange={e => onChange({ ...command, text: e.target.value })}
      />
    </Field>
  );
}

function CallCommonEventEditor({ command, onChange }: { command: CallCommonEventCommand; onChange: (n: CallCommonEventCommand) => void }) {
  const { state } = useProjectStore();
  const ces = state.databases.commonEvents;
  return (
    <Field label="Common Event">
      <select
        className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
        value={command.commonEventId}
        onChange={e => onChange({ ...command, commonEventId: e.target.value })}
      >
        {ces.length === 0 && <option value="">(no common events)</option>}
        {ces.map(ce => <option key={ce.id} value={ce.id}>{ce.name}</option>)}
      </select>
    </Field>
  );
}

function QuestEditor({ command, onChange }: { command: StartQuestCommand | CompleteQuestCommand; onChange: (n: StartQuestCommand | CompleteQuestCommand) => void }) {
  const { state } = useProjectStore();
  return (
    <Field label="Quest">
      <select
        className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
        value={command.questId}
        onChange={e => onChange({ ...command, questId: e.target.value })}
      >
        {state.databases.quests.length === 0 && <option value="">(no quests)</option>}
        {state.databases.quests.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
      </select>
    </Field>
  );
}

function UpdateQuestObjectiveEditor({ command, onChange }: { command: UpdateQuestObjectiveCommand; onChange: (n: UpdateQuestObjectiveCommand) => void }) {
  const { state } = useProjectStore();
  const quest = state.databases.quests.find(q => q.id === command.questId);
  return (
    <div className="space-y-2">
      <Field label="Quest">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.questId}
          onChange={e => onChange({ ...command, questId: e.target.value, objectiveId: '' })}
        >
          {state.databases.quests.length === 0 && <option value="">(no quests)</option>}
          {state.databases.quests.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
        </select>
      </Field>
      <Field label="Objective">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.objectiveId}
          onChange={e => onChange({ ...command, objectiveId: e.target.value })}
        >
          {!quest && <option value="">(pick a quest)</option>}
          {quest?.objectives.map(o => <option key={o.id} value={o.id}>{o.description || o.id}</option>)}
        </select>
      </Field>
      <Field label="State">
        {select(command.state, [
          { value: 'open', label: 'Open' }, { value: 'done', label: 'Done' },
        ], v => onChange({ ...command, state: v as 'open' | 'done' }))}
      </Field>
    </div>
  );
}

function OpenShopEditor({ command, onChange }: { command: OpenShopCommand; onChange: (n: OpenShopCommand) => void }) {
  const { state } = useProjectStore();
  return (
    <Field label="Shop">
      <select
        className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
        value={command.shopId}
        onChange={e => onChange({ ...command, shopId: e.target.value })}
      >
        {state.databases.shops.length === 0 && <option value="">(no shops)</option>}
        {state.databases.shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </Field>
  );
}

function StartBattleEditor({ command, onChange }: { command: StartBattleCommand; onChange: (n: StartBattleCommand) => void }) {
  const { state } = useProjectStore();
  return (
    <div className="space-y-2">
      <Field label="Troop">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.troopId}
          onChange={e => onChange({ ...command, troopId: e.target.value })}
        >
          {state.databases.troops.length === 0 && <option value="">(no troops)</option>}
          {state.databases.troops.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Can escape">
        {select(command.canEscape ? 'true' : 'false', [
          { value: 'true', label: 'Yes' }, { value: 'false', label: 'No' },
        ], v => onChange({ ...command, canEscape: v === 'true' }))}
      </Field>
      <p className="text-[11px] text-gray-500">Victory and defeat branches edit inline in the stack above (depth+1 from this command).</p>
    </div>
  );
}

function ChangeActorHpEditor({ command, onChange }: { command: ChangeActorHpCommand; onChange: (n: ChangeActorHpCommand) => void }) {
  const { state } = useProjectStore();
  return (
    <div className="space-y-2">
      <Field label="Actor">
        <select
          className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
          value={command.actorId}
          onChange={e => onChange({ ...command, actorId: e.target.value })}
        >
          {state.databases.actors.length === 0 && <option value="">(no actors)</option>}
          {state.databases.actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Delta (negative for damage)">
        {input({ type: 'number', value: command.delta, onChange: e => onChange({ ...command, delta: Number(e.target.value) }) })}
      </Field>
    </div>
  );
}

function selfSwitchSelect<T extends 'A' | 'B' | 'C' | 'D'>(value: T, onChange: (v: T) => void) {
  return select<T>(value, [
    { value: 'A' as T, label: 'A' },
    { value: 'B' as T, label: 'B' },
    { value: 'C' as T, label: 'C' },
    { value: 'D' as T, label: 'D' },
  ], onChange);
}

const MOVEMENT_ROUTE_STEP_OPTIONS: Array<{ value: MovementRouteStepType; label: string }> = [
  { value: 'moveUp', label: 'Move Up' },
  { value: 'moveDown', label: 'Move Down' },
  { value: 'moveLeft', label: 'Move Left' },
  { value: 'moveRight', label: 'Move Right' },
  { value: 'turnUp', label: 'Turn Up' },
  { value: 'turnDown', label: 'Turn Down' },
  { value: 'turnLeft', label: 'Turn Left' },
  { value: 'turnRight', label: 'Turn Right' },
  { value: 'wait', label: 'Wait' },
];

function defaultRouteStep(type: MovementRouteStepType): MovementRouteStep {
  return type === 'wait' ? { type, ms: 250 } : { type };
}

function MovementRouteEditor({ command, onChange }: { command: SetMovementRouteCommand; onChange: (n: SetMovementRouteCommand) => void }) {
  const updateStep = (index: number, step: MovementRouteStep) => {
    const next = command.steps.slice();
    next[index] = step;
    onChange({ ...command, steps: next });
  };
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= command.steps.length) return;
    const next = command.steps.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...command, steps: next });
  };

  return (
    <div className="space-y-2">
      <Field label="Target">
        {select<MovementRouteTarget>(command.target, [
          { value: 'player', label: 'Player' },
          { value: 'thisEvent', label: 'This event' },
          { value: 'event', label: 'Named event' },
        ], v => onChange({ ...command, target: v }))}
      </Field>
      {command.target === 'event' && (
        <Field label="Event ID">
          {input({ value: command.eventId ?? '', onChange: e => onChange({ ...command, eventId: e.target.value }) })}
        </Field>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Field label="Repeat">
          {select(command.repeat ? 'true' : 'false', [
            { value: 'false', label: 'No' },
            { value: 'true', label: 'Yes' },
          ], v => onChange({ ...command, repeat: v === 'true' }))}
        </Field>
        <Field label="Skippable">
          {select(command.skippable ? 'true' : 'false', [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ], v => onChange({ ...command, skippable: v === 'true' }))}
        </Field>
        <Field label="Wait">
          {select(command.wait ? 'true' : 'false', [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ], v => onChange({ ...command, wait: v === 'true' }))}
        </Field>
      </div>
      <Field label="Route Steps">
        <div className="space-y-1">
          {command.steps.map((step, index) => (
            <div key={index} className="grid grid-cols-[42px_1fr_82px_auto_auto_auto] gap-1 items-center">
              <span className="text-[11px] font-mono text-gray-400">#{index + 1}</span>
              {select<MovementRouteStepType>(
                step.type,
                MOVEMENT_ROUTE_STEP_OPTIONS,
                type => updateStep(index, defaultRouteStep(type)),
                `Route step ${index + 1} type`,
              )}
              {step.type === 'wait'
                ? input({
                    'aria-label': `Route step ${index + 1} wait ms`,
                    type: 'number',
                    value: step.ms ?? 0,
                    onChange: e => updateStep(index, { ...step, ms: Number(e.target.value) }),
                  })
                : <span className="text-[11px] text-gray-400">step</span>}
              <button
                type="button"
                aria-label={`Move route step ${index + 1} up`}
                disabled={index === 0}
                className="px-2 text-[11px] text-gray-600 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                onClick={() => moveStep(index, -1)}
              >
                Up
              </button>
              <button
                type="button"
                aria-label={`Move route step ${index + 1} down`}
                disabled={index === command.steps.length - 1}
                className="px-2 text-[11px] text-gray-600 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                onClick={() => moveStep(index, 1)}
              >
                Down
              </button>
              <button
                type="button"
                aria-label={`Remove route step ${index + 1}`}
                className="px-2 text-[11px] text-red-600 cursor-pointer"
                onClick={() => onChange({ ...command, steps: command.steps.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </div>
          ))}
          <select
            aria-label="Add route step"
            className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded"
            defaultValue=""
            onChange={e => {
              if (!e.target.value) return;
              onChange({
                ...command,
                steps: [...command.steps, defaultRouteStep(e.target.value as MovementRouteStepType)],
              });
              e.target.value = '';
            }}
          >
            <option value="">Add route step...</option>
            {MOVEMENT_ROUTE_STEP_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </Field>
    </div>
  );
}

function PlayAnimationEditor({ command, onChange }: { command: PlayAnimationCommand; onChange: (n: PlayAnimationCommand) => void }) {
  const target = command.target;
  return (
    <div className="space-y-2">
      <Field label="Target">
        {select(target, [
          { value: 'player', label: 'Player' },
          { value: 'thisEvent', label: 'This event' },
          { value: 'event', label: 'Named event' },
        ], v => onChange({ ...command, target: v }))}
      </Field>
      {target === 'event' && (
        <Field label="Event ID">
          {input({ value: command.eventId ?? '', onChange: e => onChange({ ...command, eventId: e.target.value }) })}
        </Field>
      )}
      <Field label="Action">
        {select(command.action, [
          { value: 'idle', label: 'Idle' },
          { value: 'walk', label: 'Walk' },
          { value: 'interact', label: 'Interact' },
          { value: 'attack', label: 'Attack' },
          { value: 'hurt', label: 'Hurt' },
          { value: 'death', label: 'Death' },
        ], v => onChange({ ...command, action: v }))}
      </Field>
      <Field label="Direction">
        {select(command.direction, [
          { value: 'current', label: 'Current' },
          { value: 'up', label: 'Up' },
          { value: 'down', label: 'Down' },
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ], v => onChange({ ...command, direction: v }))}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Duration (ms)">
          {input({ type: 'number', value: command.durationMs, onChange: e => onChange({ ...command, durationMs: Number(e.target.value) }) })}
        </Field>
        <Field label="Blocking">
          {select(command.blocking ? 'true' : 'false', [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ], v => onChange({ ...command, blocking: v === 'true' }))}
        </Field>
      </div>
      <Field label="Loop">
        {select(command.loop ? 'true' : 'false', [
          { value: 'false', label: 'No' },
          { value: 'true', label: 'Yes' },
        ], v => onChange({ ...command, loop: v === 'true' }))}
      </Field>
    </div>
  );
}
