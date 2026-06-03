import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Backpack,
  Binary,
  CheckCheck,
  ClipboardPaste,
  Clapperboard,
  Coins,
  Copy,
  Flag,
  GitBranch,
  HeartPulse,
  MapPinned,
  MessageSquare,
  NotebookPen,
  Plug,
  Repeat,
  Scissors,
  ScrollText,
  Store,
  Swords,
  Timer,
  ToggleLeft,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { CommandEditor } from './CommandEditor';
import {
  commandPathKey,
  isCommandStackTextEditingTarget,
  resolveCommandRangeSelection,
  sameCommandPath,
} from '../../utils/commandSelection';
import { defaultPluginCommand } from '../../plugins/pluginCommandRegistry';
import type { EventCommand } from '../../types/project';
import { createMockProviderAdapter } from '../../providers/mockProviderAdapter';
import {
  generateEventCommandsCandidate,
  validateEventCommandsCandidate,
  approveEventCommandsCandidate,
} from '../../providers/eventCommandGenerationWorkflow';

export interface CommandStackOperations {
  update(path: number[], command: EventCommand): void;
  remove(path: number[]): void;
  removeRange(fromPath: number[], toPath: number[]): void;
  insert(path: number[], placement: 'before' | 'after' | 'append', command: EventCommand): void;
  move(path: number[], direction: 'up' | 'down'): void;
  duplicate(path: number[]): void;
}

interface CommandStackEditorProps {
  commands: EventCommand[];
  mapIds: string[];
  itemIds: string[];
  title?: string;
  subtitle?: string;
  ownerCommonEventId?: string;
  operations?: Partial<CommandStackOperations>;
  onCommandsChange?: (commands: EventCommand[]) => void;
}

export function makePlaceholderCommand(type: EventCommand['type']): EventCommand {
  switch (type) {
    case 'showText':
      return { type: 'showText', text: 'New dialogue' };
    case 'showChoices':
      return { type: 'showChoices', prompt: 'Choose:', choices: [{ label: 'Yes', commands: [] }, { label: 'No', commands: [] }] };
    case 'setFlag':
      return { type: 'setFlag', flag: 'flag_name', value: true };
    case 'ifFlag':
      return { type: 'ifFlag', flag: 'flag_name', equals: true, then: [], else: [] };
    case 'ifSwitch':
      return { type: 'ifSwitch', switchId: '', equals: true, then: [], else: [] };
    case 'ifSelfSwitch':
      return { type: 'ifSelfSwitch', switchId: 'A', equals: true, then: [], else: [] };
    case 'ifVariable':
      return { type: 'ifVariable', variableId: '', op: 'eq', value: 0, then: [], else: [] };
    case 'controlSwitch':
      return { type: 'controlSwitch', switchId: '', value: true };
    case 'controlSelfSwitch':
      return { type: 'controlSelfSwitch', switchId: 'A', value: true };
    case 'controlVariable':
      return { type: 'controlVariable', variableId: '', op: 'set', value: 0 };
    case 'addItem':
      return { type: 'addItem', itemId: '', amount: 1 };
    case 'removeItem':
      return { type: 'removeItem', itemId: '', amount: 1 };
    case 'addGold':
      return { type: 'addGold', amount: 10 };
    case 'removeGold':
      return { type: 'removeGold', amount: 10 };
    case 'transferMap':
      return { type: 'transferMap', mapId: '', x: 0, y: 0, direction: 'down' };
    case 'setPlayerPosition':
      return { type: 'setPlayerPosition', mapId: '', x: 0, y: 0, direction: 'down' };
    case 'wait':
      return { type: 'wait', ms: 250 };
    case 'playSound':
      return { type: 'playSound', soundId: '' };
    case 'pluginCommand':
      return defaultPluginCommand();
    case 'comment':
      return { type: 'comment', text: '' };
    case 'callCommonEvent':
      return { type: 'callCommonEvent', commonEventId: '' };
    case 'startQuest':
      return { type: 'startQuest', questId: '' };
    case 'updateQuestObjective':
      return { type: 'updateQuestObjective', questId: '', objectiveId: '', state: 'done' };
    case 'completeQuest':
      return { type: 'completeQuest', questId: '' };
    case 'openShop':
      return { type: 'openShop', shopId: '' };
    case 'startBattle':
      return { type: 'startBattle', troopId: '', canEscape: false };
    case 'changeActorHp':
      return { type: 'changeActorHp', actorId: '', delta: -1 };
    case 'playAnimation':
      return {
        type: 'playAnimation',
        target: 'player',
        action: 'interact',
        direction: 'current',
        durationMs: 300,
        blocking: true,
        loop: false,
      };
    case 'setMovementRoute':
      return {
        type: 'setMovementRoute',
        target: 'player',
        repeat: false,
        skippable: true,
        wait: true,
        steps: [{ type: 'moveDown' }],
      };
  }
}

interface CommandCardProps {
  index: number;
  command: EventCommand;
  selected: boolean;
  rangeSelected: boolean;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  onToggleRangeSelected: (extendRange: boolean) => void;
  depth: number;
}

function CommandCard({ index, command, selected, rangeSelected, onSelect, onToggleRangeSelected, depth }: CommandCardProps) {
  const icons: Record<string, { icon: ReactNode; color: string; bg: string }> = {
    showText: { icon: <MessageSquare size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    showChoices: { icon: <GitBranch size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    ifFlag: { icon: <Flag size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
    ifSwitch: { icon: <GitBranch size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
    ifSelfSwitch: { icon: <GitBranch size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
    ifVariable: { icon: <Binary size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
    addItem: { icon: <Backpack size={18} />, color: 'text-green-600', bg: 'bg-green-50' },
    removeItem: { icon: <Backpack size={18} />, color: 'text-green-600', bg: 'bg-green-50' },
    addGold: { icon: <Coins size={18} />, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    removeGold: { icon: <Coins size={18} />, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    setFlag: { icon: <Flag size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
    controlSwitch: { icon: <ToggleLeft size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
    controlSelfSwitch: { icon: <ToggleLeft size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
    controlVariable: { icon: <Binary size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
    transferMap: { icon: <MapPinned size={18} />, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    setPlayerPosition: { icon: <MapPinned size={18} />, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    playSound: { icon: <Volume2 size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
    pluginCommand: { icon: <Plug size={18} />, color: 'text-sky-600', bg: 'bg-sky-50' },
    wait: { icon: <Timer size={18} />, color: 'text-gray-600', bg: 'bg-gray-50' },
    comment: { icon: <NotebookPen size={18} />, color: 'text-gray-500', bg: 'bg-gray-50' },
    callCommonEvent: { icon: <Repeat size={18} />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    startQuest: { icon: <ScrollText size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    updateQuestObjective: { icon: <CheckCheck size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    completeQuest: { icon: <CheckCheck size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    openShop: { icon: <Store size={18} />, color: 'text-pink-600', bg: 'bg-pink-50' },
    startBattle: { icon: <Swords size={18} />, color: 'text-rose-600', bg: 'bg-rose-50' },
    changeActorHp: { icon: <HeartPulse size={18} />, color: 'text-rose-600', bg: 'bg-rose-50' },
    playAnimation: { icon: <Clapperboard size={18} />, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
    setMovementRoute: { icon: <MapPinned size={18} />, color: 'text-teal-600', bg: 'bg-teal-50' },
  };
  const info = icons[command.type] || { icon: <NotebookPen size={18} />, color: 'text-gray-600', bg: 'bg-gray-50' };

  const titles: Record<string, string> = {
    showText: 'Show Text',
    showChoices: 'Show Choices',
    ifFlag: 'If Flag',
    ifSwitch: 'If Switch',
    ifSelfSwitch: 'If Self Switch',
    ifVariable: 'If Variable',
    addItem: 'Add Item',
    removeItem: 'Remove Item',
    addGold: 'Add Gold',
    removeGold: 'Remove Gold',
    setFlag: 'Set Flag',
    controlSwitch: 'Control Switch',
    controlSelfSwitch: 'Control Self Switch',
    controlVariable: 'Control Variable',
    transferMap: 'Transfer Map',
    setPlayerPosition: 'Set Player Position',
    playSound: 'Play Sound',
    pluginCommand: 'Plugin Command',
    wait: 'Wait',
    comment: 'Comment',
    callCommonEvent: 'Call Common Event',
    startQuest: 'Start Quest',
    updateQuestObjective: 'Update Quest Objective',
    completeQuest: 'Complete Quest',
    openShop: 'Open Shop',
    startBattle: 'Start Battle',
    changeActorHp: 'Change Actor HP',
    playAnimation: 'Play Animation',
    setMovementRoute: 'Set Movement Route',
  };

  const getDescription = (cmd: EventCommand): string => {
    switch (cmd.type) {
      case 'showText': return cmd.text;
      case 'showChoices': return `${cmd.prompt} (${cmd.choices.length} choices)`;
      case 'ifFlag': return `${cmd.flag} is ${cmd.equals ? 'ON' : 'OFF'}`;
      case 'ifSwitch': return `${cmd.switchId} is ${cmd.equals ? 'ON' : 'OFF'}`;
      case 'ifSelfSwitch': return `Self ${cmd.switchId} is ${cmd.equals ? 'ON' : 'OFF'}`;
      case 'ifVariable': return `${cmd.variableId} ${cmd.op} ${cmd.value}`;
      case 'addItem':
      case 'removeItem': return `Item: ${cmd.itemId} x ${cmd.amount}`;
      case 'addGold':
      case 'removeGold': return `${cmd.amount} gold`;
      case 'setFlag': return `${cmd.flag} -> ${cmd.value ? 'ON' : 'OFF'}`;
      case 'controlSwitch': return `${cmd.switchId} -> ${cmd.value ? 'ON' : 'OFF'}`;
      case 'controlSelfSwitch': return `Self ${cmd.switchId} -> ${cmd.value ? 'ON' : 'OFF'}`;
      case 'controlVariable': return `${cmd.variableId} ${cmd.op} ${cmd.value}`;
      case 'transferMap':
      case 'setPlayerPosition': return `Map: ${cmd.mapId}  Location: (${cmd.x}, ${cmd.y})`;
      case 'playSound': return cmd.soundId;
      case 'pluginCommand': return `${cmd.pluginId}.${cmd.command}`;
      case 'wait': return `${cmd.ms} ms`;
      case 'comment': return cmd.text;
      case 'callCommonEvent': return cmd.commonEventId;
      case 'startQuest':
      case 'completeQuest': return cmd.questId;
      case 'updateQuestObjective': return `${cmd.questId}/${cmd.objectiveId} -> ${cmd.state}`;
      case 'openShop': return cmd.shopId;
      case 'startBattle': return `Troop: ${cmd.troopId}${cmd.canEscape ? ' (escapable)' : ''}`;
      case 'changeActorHp': return `${cmd.actorId} ${cmd.delta >= 0 ? '+' : ''}${cmd.delta}`;
      case 'playAnimation': return `${cmd.target}${cmd.eventId ? `:${cmd.eventId}` : ''} -> ${cmd.action}`;
      case 'setMovementRoute': return `${cmd.target}${cmd.eventId ? `:${cmd.eventId}` : ''} (${cmd.steps.length} steps)`;
      default: return (cmd as { type: string }).type;
    }
  };
  const commandTitle = titles[command.type] || command.type;
  const commandDescription = getDescription(command);

  const highlighted = selected || rangeSelected;

  return (
    <div
      style={{ marginLeft: depth * 16 }}
      className={`w-full flex items-start gap-2 p-2 border rounded-lg transition-shadow ${
        highlighted
          ? 'bg-indigo-50 border-indigo-300 shadow-sm'
          : 'bg-white border-gray-200 hover:shadow-sm'
      }`}
    >
      <input
        type="checkbox"
        aria-label={`Select command ${index}: ${commandTitle} ${commandDescription}`}
        checked={rangeSelected}
        onChange={() => undefined}
        onClick={event => {
          event.stopPropagation();
          onToggleRangeSelected(event.shiftKey);
        }}
        className="mt-3 h-4 w-4 rounded border-gray-300 text-indigo-600"
      />
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-start gap-3 text-left min-w-0 cursor-pointer"
      >
        <span className="text-[12px] text-gray-400 font-mono mt-1 w-4">{index}</span>
        <div className={`w-9 h-9 rounded-lg ${info.bg} ${info.color} flex items-center justify-center text-lg flex-shrink-0`}>
          {info.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-gray-800">{commandTitle}</span>
            {(command.type === 'ifFlag' || command.type === 'ifSwitch' || command.type === 'ifSelfSwitch' || command.type === 'ifVariable' || command.type === 'showChoices' || command.type === 'startBattle') && (
              <Badge variant="info">Branch</Badge>
            )}
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5 truncate">{commandDescription}</p>
        </div>
      </button>
    </div>
  );
}

function commandBranch(target: EventCommand, branchIdx: number): EventCommand[] | null {
  if (target.type === 'ifFlag' || target.type === 'ifSwitch' || target.type === 'ifSelfSwitch' || target.type === 'ifVariable') {
    return branchIdx === 0 ? target.then : target.else;
  }
  if (target.type === 'showChoices') {
    return target.choices[branchIdx]?.commands ?? null;
  }
  if (target.type === 'startBattle') {
    return branchIdx === 0 ? target.victoryBranch ?? [] : target.defeatBranch ?? [];
  }
  return null;
}

function withCommandBranch(target: EventCommand, branchIdx: number, branch: EventCommand[]): EventCommand {
  if (target.type === 'ifFlag' || target.type === 'ifSwitch' || target.type === 'ifSelfSwitch' || target.type === 'ifVariable') {
    return branchIdx === 0 ? { ...target, then: branch } : { ...target, else: branch };
  }
  if (target.type === 'showChoices') {
    return {
      ...target,
      choices: target.choices.map((choice, index) => index === branchIdx ? { ...choice, commands: branch } : choice),
    };
  }
  if (target.type === 'startBattle') {
    return branchIdx === 0 ? { ...target, victoryBranch: branch } : { ...target, defeatBranch: branch };
  }
  return target;
}

function commandAtPath(commands: EventCommand[], path: number[]): EventCommand | null {
  if (path.length === 0) return null;
  const [head, ...rest] = path;
  const command = commands[head];
  if (!command) return null;
  if (rest.length === 0) return command;
  const branch = commandBranch(command, rest[0]);
  return branch ? commandAtPath(branch, rest.slice(1)) : null;
}

function setCommandAtPath(commands: EventCommand[], path: number[], replacement: EventCommand): EventCommand[] {
  if (path.length === 0) return commands;
  const result = commands.slice();
  const [head, ...rest] = path;
  if (rest.length === 0) {
    result[head] = cloneCommand(replacement);
    return result;
  }
  const target = result[head];
  if (!target) return commands;
  const branch = commandBranch(target, rest[0]);
  if (!branch) return commands;
  result[head] = withCommandBranch(target, rest[0], setCommandAtPath(branch, rest.slice(1), replacement));
  return result;
}

function insertCommandAtPath(
  commands: EventCommand[],
  path: number[],
  command: EventCommand,
  placement: 'before' | 'after' | 'append',
): EventCommand[] {
  const inserted = cloneCommand(command);
  if (path.length === 0) {
    return [...commands, inserted];
  }
  const [head, ...rest] = path;
  if (rest.length === 0) {
    const result = commands.slice();
    const insertAt = placement === 'before'
      ? Math.max(0, head)
      : Math.min(commands.length, head + 1);
    result.splice(insertAt, 0, inserted);
    return result;
  }
  const result = commands.slice();
  const target = result[head];
  if (!target) return commands;
  const branch = commandBranch(target, rest[0]);
  if (!branch) return commands;
  const branchPath = rest.slice(1);
  const newBranch = branchPath.length === 0
    ? [...branch, inserted]
    : insertCommandAtPath(branch, branchPath, inserted, placement);
  result[head] = withCommandBranch(target, rest[0], newBranch);
  return result;
}

function moveCommandAtPath(commands: EventCommand[], path: number[], direction: 'up' | 'down'): EventCommand[] {
  if (path.length === 0) return commands;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    const targetIndex = direction === 'up' ? head - 1 : head + 1;
    if (head < 0 || head >= commands.length || targetIndex < 0 || targetIndex >= commands.length) {
      return commands;
    }
    const result = commands.slice();
    [result[head], result[targetIndex]] = [result[targetIndex], result[head]];
    return result;
  }
  const result = commands.slice();
  const target = result[head];
  if (!target) return commands;
  const branch = commandBranch(target, rest[0]);
  if (!branch) return commands;
  result[head] = withCommandBranch(target, rest[0], moveCommandAtPath(branch, rest.slice(1), direction));
  return result;
}

function duplicateCommandAtPath(commands: EventCommand[], path: number[]): EventCommand[] {
  const command = commandAtPath(commands, path);
  return command ? insertCommandAtPath(commands, path, cloneCommand(command), 'after') : commands;
}

function removeCommandAtPath(commands: EventCommand[], path: number[]): EventCommand[] {
  if (path.length === 0) return commands;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    const result = commands.slice();
    result.splice(head, 1);
    return result;
  }
  const result = commands.slice();
  const target = result[head];
  if (!target) return commands;
  const branch = commandBranch(target, rest[0]);
  if (!branch) return commands;
  result[head] = withCommandBranch(target, rest[0], removeCommandAtPath(branch, rest.slice(1)));
  return result;
}

function sameNumberPath(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function removeCommandRangeFromList(commands: EventCommand[], listPath: number[], fromIndex: number, toIndex: number): EventCommand[] {
  if (listPath.length === 0) {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= commands.length ||
      toIndex >= commands.length
    ) {
      return commands;
    }
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const result = commands.slice();
    result.splice(start, end - start + 1);
    return result;
  }
  if (listPath.length < 2) return commands;
  const [head, branchIdx, ...rest] = listPath;
  const target = commands[head];
  if (!target) return commands;
  const branch = commandBranch(target, branchIdx);
  if (!branch) return commands;
  const result = commands.slice();
  result[head] = withCommandBranch(target, branchIdx, removeCommandRangeFromList(branch, rest, fromIndex, toIndex));
  return result;
}

function removeCommandRangeAtPath(commands: EventCommand[], fromPath: number[], toPath: number[]): EventCommand[] {
  if (fromPath.length === 0 || toPath.length === 0) return commands;
  const fromParent = fromPath.slice(0, -1);
  const toParent = toPath.slice(0, -1);
  if (!sameNumberPath(fromParent, toParent)) return commands;
  return removeCommandRangeFromList(commands, fromParent, fromPath[fromPath.length - 1], toPath[toPath.length - 1]);
}

type CommandStackRow =
  | { type: 'command'; command: EventCommand; depth: number; path: number[] }
  | { type: 'branch'; label: string; depth: number; listPath: number[]; empty: boolean };

function commandBranchRows(command: EventCommand, path: number[], depth: number): CommandStackRow[] {
  const rows: CommandStackRow[] = [];
  const addBranch = (label: string, listPath: number[], branchCommands: EventCommand[]) => {
    rows.push({ type: 'branch', label, depth, listPath, empty: branchCommands.length === 0 });
    rows.push(...flattenCommandRows(branchCommands, depth + 1, listPath));
  };

  if (command.type === 'ifFlag' || command.type === 'ifSwitch' || command.type === 'ifSelfSwitch' || command.type === 'ifVariable') {
    addBranch('Then', [...path, 0], command.then);
    addBranch('Else', [...path, 1], command.else);
  } else if (command.type === 'showChoices') {
    command.choices.forEach((choice, index) => {
      addBranch(`Choice: ${choice.label || `Option ${index + 1}`}`, [...path, index], choice.commands);
    });
  } else if (command.type === 'startBattle') {
    addBranch('Victory', [...path, 0], command.victoryBranch ?? []);
    addBranch('Defeat', [...path, 1], command.defeatBranch ?? []);
  }

  return rows;
}

function flattenCommandRows(commands: EventCommand[], depth = 0, prefix: number[] = []): CommandStackRow[] {
  const rows: CommandStackRow[] = [];
  commands.forEach((command, index) => {
    const path = [...prefix, index];
    rows.push({ type: 'command', command, depth, path });
    rows.push(...commandBranchRows(command, path, depth + 1));
  });
  return rows;
}

function cloneCommand(command: EventCommand): EventCommand {
  return JSON.parse(JSON.stringify(command)) as EventCommand;
}

function sameOptionalPath(a: number[] | null, b: number[]): boolean {
  return !!a && sameCommandPath(a, b);
}

function movePath(path: number[], direction: 'up' | 'down'): number[] {
  if (path.length === 0) return path;
  const next = path.slice();
  const last = next.length - 1;
  next[last] = direction === 'up'
    ? Math.max(0, next[last] - 1)
    : next[last] + 1;
  return next;
}

function StackIconButton({
  title,
  disabled = false,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-35 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

function BranchTargetRow({
  label,
  depth,
  selected,
  empty,
  onSelect,
}: {
  label: string;
  depth: number;
  selected: boolean;
  empty: boolean;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ marginLeft: depth * 16 }}
      className={`w-full flex items-center gap-2 px-3 py-1.5 border border-dashed rounded-md text-left cursor-pointer ${
        selected
          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
      }`}
    >
      <GitBranch size={13} />
      <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      {empty && <span className="text-[11px] text-gray-400">Empty</span>}
    </button>
  );
}

export function CommandStackEditor({
  commands,
  mapIds,
  itemIds,
  title = 'Event Commands',
  subtitle = 'Executed top to bottom.',
  ownerCommonEventId,
  operations,
  onCommandsChange,
}: CommandStackEditorProps) {
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);
  const [selectedBranchPath, setSelectedBranchPath] = useState<number[] | null>(null);
  const [selectedCommandPaths, setSelectedCommandPaths] = useState<number[][]>([]);
  const [selectionAnchorPath, setSelectionAnchorPath] = useState<number[] | null>(null);
  const [clipboardCommand, setClipboardCommand] = useState<EventCommand | null>(null);

  const [showGenModal, setShowGenModal] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [genStatus, setGenStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const openEventCommandDraftGeneration = () => {
    setGenPrompt('Create a sequence of text and add a potion item.');
    setCandidate(null);
    setGenStatus(null);
    setShowGenModal(true);
  };

  const handleGenerateCommands = async () => {
    setGenerating(true);
    setGenStatus(null);
    setCandidate(null);
    try {
      const adapter = createMockProviderAdapter();
      const context = {
        mapIds,
        items: itemIds.map(id => ({ id })),
      };
      const result = await generateEventCommandsCandidate(
        adapter,
        context,
        {
          prompt: genPrompt,
          targetEventId: undefined,
        },
        {
          requestId: `event-commands-gen-${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
      );
      const validationErrors = validateEventCommandsCandidate(result, context);
      if (validationErrors.length > 0) {
        setGenStatus({ tone: 'error', text: `Validation failed: ${validationErrors[0]}` });
        return;
      }
      setCandidate(result);
      setGenStatus({ tone: 'success', text: 'Event commands generated successfully! Please review below.' });
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptCommands = () => {
    if (!candidate) return;
    try {
      const context = {
        mapIds,
        items: itemIds.map(id => ({ id })),
      };
      const approved = approveEventCommandsCandidate(candidate, context, {
        reviewedAt: new Date().toISOString(),
      });
      
      let path = selectedPath ?? selectedBranchPath ?? [];
      let placement: 'before' | 'after' | 'append' = (selectedPath ? 'after' : 'append') as 'before' | 'after' | 'append';
      
      if (operations?.insert) {
        for (const cmd of approved.commands) {
          operations.insert(path, placement, cmd);
          if (placement === 'after') {
            const nextPath = path.slice();
            nextPath[nextPath.length - 1] += 1;
            path = nextPath;
          } else if (placement === 'before') {
            placement = 'after';
          }
        }
      } else {
        let tempCommands = commands.slice();
        for (const cmd of approved.commands) {
          tempCommands = insertCommandAtPath(tempCommands, path, cmd, placement);
          if (placement === 'after') {
            const nextPath = path.slice();
            nextPath[nextPath.length - 1] += 1;
            path = nextPath;
          } else if (placement === 'before') {
            placement = 'after';
          }
        }
        commitCommands(tempCommands);
      }

      setShowGenModal(false);
      setCandidate(null);
      setGenPrompt('');
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    }
  };

  const rows = flattenCommandRows(commands);
  const commandRows = rows.filter((row): row is Extract<CommandStackRow, { type: 'command' }> => row.type === 'command');
  const commandPaths = commandRows.map(row => row.path);
  const commandPathKeys = new Set(commandPaths.map(commandPathKey));
  const activeSelectedCommandPaths = selectedCommandPaths.filter(path => commandPathKeys.has(commandPathKey(path)));
  const activeSelectedPathKeys = new Set(activeSelectedCommandPaths.map(commandPathKey));
  const hasMultiSelection = activeSelectedCommandPaths.length > 1;

  const selectedCommand = selectedPath && commandPathKeys.has(commandPathKey(selectedPath)) && !hasMultiSelection
    ? commandAtPath(commands, selectedPath)
    : null;
  const canOperateOnSelected = selectedPath !== null && selectedCommand !== null && !hasMultiSelection;
  const canDeleteSelection = activeSelectedCommandPaths.length > 0 || canOperateOnSelected;

  const commitCommands = (next: EventCommand[]) => {
    onCommandsChange?.(next);
  };

  const selectCommand = (path: number[], extendRange = false) => {
    const nextSelection = resolveCommandRangeSelection({
      anchorPath: selectionAnchorPath,
      targetPath: path,
      commandPaths,
      extendRange,
    });
    setSelectedPath(path);
    setSelectedCommandPaths(nextSelection.paths);
    setSelectionAnchorPath(nextSelection.anchorPath);
    setSelectedBranchPath(null);
  };

  const selectBranch = (path: number[]) => {
    setSelectedBranchPath(path);
    setSelectedPath(null);
    setSelectedCommandPaths([]);
    setSelectionAnchorPath(null);
  };

  const toggleCommandRangeSelection = (path: number[], extendRange = false) => {
    if (extendRange) {
      selectCommand(path, true);
      return;
    }
    const key = commandPathKey(path);
    const isOnlySelected = activeSelectedCommandPaths.length === 1 && commandPathKey(activeSelectedCommandPaths[0]) === key;
    if (isOnlySelected) {
      setSelectedPath(null);
      setSelectedCommandPaths([]);
      setSelectionAnchorPath(null);
      return;
    }
    selectCommand(path, false);
  };

  const updateSelected = (next: EventCommand) => {
    if (!selectedPath) return;
    if (operations?.update) {
      operations.update(selectedPath, next);
      return;
    }
    commitCommands(setCommandAtPath(commands, selectedPath, next));
  };

  const removeSelected = () => {
    const selectedForDelete = activeSelectedCommandPaths.length > 0
      ? activeSelectedCommandPaths
      : selectedPath ? [selectedPath] : [];
    if (selectedForDelete.length === 0) return;
    if (selectedForDelete.length > 1) {
      const fromPath = selectedForDelete[0];
      const toPath = selectedForDelete[selectedForDelete.length - 1];
      if (operations?.removeRange) {
        operations.removeRange(fromPath, toPath);
      } else {
        commitCommands(removeCommandRangeAtPath(commands, fromPath, toPath));
      }
      setSelectedPath(null);
      setSelectedCommandPaths([]);
      setSelectionAnchorPath(null);
      return;
    }
    const [path] = selectedForDelete;
    if (operations?.remove) {
      operations.remove(path);
    } else {
      commitCommands(removeCommandAtPath(commands, path));
    }
    setSelectedPath(null);
    setSelectedCommandPaths([]);
    setSelectionAnchorPath(null);
  };

  const insertCommand = (command: EventCommand, placement: 'before' | 'after' | 'append' = 'after') => {
    const path = selectedPath ?? selectedBranchPath ?? [];
    const effectivePlacement = selectedPath ? placement : 'append';
    if (operations?.insert) {
      operations.insert(path, effectivePlacement, command);
    } else {
      commitCommands(insertCommandAtPath(commands, path, command, effectivePlacement));
    }
  };

  const addCommand = (type: EventCommand['type'] = 'showText') => {
    insertCommand(makePlaceholderCommand(type), selectedPath ? 'after' : 'append');
  };

  const moveSelected = (direction: 'up' | 'down') => {
    if (!selectedPath) return;
    const nextPath = movePath(selectedPath, direction);
    if (operations?.move) {
      operations.move(selectedPath, direction);
    } else {
      commitCommands(moveCommandAtPath(commands, selectedPath, direction));
    }
    setSelectedPath(nextPath);
    setSelectedCommandPaths([nextPath]);
    setSelectionAnchorPath(nextPath);
  };

  const duplicateSelected = () => {
    if (!selectedPath) return;
    const nextPath = movePath(selectedPath, 'down');
    if (operations?.duplicate) {
      operations.duplicate(selectedPath);
    } else {
      commitCommands(duplicateCommandAtPath(commands, selectedPath));
    }
    setSelectedPath(nextPath);
    setSelectedCommandPaths([nextPath]);
    setSelectionAnchorPath(nextPath);
  };

  const copySelected = () => {
    if (selectedCommand) setClipboardCommand(cloneCommand(selectedCommand));
  };

  const cutSelected = () => {
    if (!selectedCommand) return;
    setClipboardCommand(cloneCommand(selectedCommand));
    removeSelected();
  };

  const pasteCommand = () => {
    if (!clipboardCommand) return;
    insertCommand(cloneCommand(clipboardCommand), selectedPath ? 'after' : 'append');
  };

  const handleStackKeyDown = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    if (isCommandStackTextEditingTarget(keyboardEvent.target)) return;
    if ((keyboardEvent.key === 'Delete' || keyboardEvent.key === 'Backspace') && canDeleteSelection) {
      keyboardEvent.preventDefault();
      removeSelected();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
        <div>
          <span className="text-[13px] font-semibold text-gray-700">{title}</span>
          <p className="text-[11px] text-gray-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <StackIconButton title="Move up" disabled={!canOperateOnSelected} onClick={() => moveSelected('up')}>
            <ArrowUp size={13} />
          </StackIconButton>
          <StackIconButton title="Move down" disabled={!canOperateOnSelected} onClick={() => moveSelected('down')}>
            <ArrowDown size={13} />
          </StackIconButton>
          <StackIconButton title="Duplicate" disabled={!canOperateOnSelected} onClick={duplicateSelected}>
            <Copy size={13} />
          </StackIconButton>
          <StackIconButton title="Cut" disabled={!canOperateOnSelected} onClick={cutSelected}>
            <Scissors size={13} />
          </StackIconButton>
          <StackIconButton title="Copy" disabled={!canOperateOnSelected} onClick={copySelected}>
            <Copy size={13} />
          </StackIconButton>
          <StackIconButton title="Paste" disabled={!clipboardCommand || hasMultiSelection} onClick={pasteCommand}>
            <ClipboardPaste size={13} />
          </StackIconButton>
          <StackIconButton title="Delete" disabled={!canDeleteSelection} onClick={removeSelected}>
            <Trash2 size={13} />
          </StackIconButton>
          {hasMultiSelection && (
            <span className="px-1.5 text-[11px] font-medium text-indigo-700">{activeSelectedCommandPaths.length} selected</span>
          )}
          <button
            type="button"
            onClick={openEventCommandDraftGeneration}
            aria-label="Generate event commands"
            title="Generate event commands"
            className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
          >
            <Sparkles size={14} />
          </button>
          <select
            className="px-2 py-1 text-[12px] border border-gray-200 rounded"
            onChange={e => {
              if (e.target.value) {
                addCommand(e.target.value as EventCommand['type']);
                e.target.value = '';
              }
            }}
            defaultValue=""
          >
            <option value="">Add command...</option>
            <option value="showText">Show Text</option>
            <option value="showChoices">Show Choices</option>
            <option value="setFlag">Set Flag (legacy)</option>
            <option value="ifFlag">If Flag (legacy)</option>
            <option value="controlSwitch">Control Switch</option>
            <option value="controlSelfSwitch">Control Self Switch</option>
            <option value="ifSwitch">If Switch</option>
            <option value="ifSelfSwitch">If Self Switch</option>
            <option value="controlVariable">Control Variable</option>
            <option value="ifVariable">If Variable</option>
            <option value="addItem">Add Item</option>
            <option value="removeItem">Remove Item</option>
            <option value="addGold">Add Gold</option>
            <option value="removeGold">Remove Gold</option>
            <option value="transferMap">Transfer Map</option>
            <option value="setPlayerPosition">Set Player Position</option>
            <option value="wait">Wait</option>
            <option value="playSound">Play Sound</option>
            <option value="pluginCommand">Plugin Command</option>
            <option value="comment">Comment</option>
            <option value="callCommonEvent">Call Common Event</option>
            <option value="startQuest">Start Quest</option>
            <option value="updateQuestObjective">Update Quest Objective</option>
            <option value="completeQuest">Complete Quest</option>
            <option value="openShop">Open Shop</option>
            <option value="startBattle">Start Battle</option>
            <option value="changeActorHp">Change Actor HP</option>
            <option value="playAnimation">Play Animation</option>
            <option value="setMovementRoute">Set Movement Route</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2" onKeyDown={handleStackKeyDown}>
        {rows.map((row, i) => row.type === 'command' ? (
            <CommandCard
              key={`command-${row.path.join('-')}-${i}`}
              index={i + 1}
              command={row.command}
              depth={row.depth}
              selected={sameOptionalPath(selectedPath, row.path)}
              rangeSelected={activeSelectedPathKeys.has(commandPathKey(row.path))}
              onSelect={event => selectCommand(row.path, event.shiftKey)}
              onToggleRangeSelected={extendRange => toggleCommandRangeSelection(row.path, extendRange)}
            />
          ) : (
            <BranchTargetRow
              key={`branch-${row.listPath.join('-')}-${i}`}
              label={row.label}
              depth={row.depth}
              empty={row.empty}
              selected={sameOptionalPath(selectedBranchPath, row.listPath)}
              onSelect={() => selectBranch(row.listPath)}
            />
          ))}
        {selectedCommand && selectedPath && !hasMultiSelection && (
          <div className="mt-3">
            <p className="text-[11px] text-gray-500 mb-1">Editing selected command</p>
            <CommandEditor
              command={selectedCommand}
              mapIds={mapIds}
              itemIds={itemIds}
              ownerCommonEventId={ownerCommonEventId}
              onChange={updateSelected}
              onRemove={removeSelected}
            />
          </div>
        )}
      </div>
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl flex flex-col max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-500" />
                Generate Event Commands
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowGenModal(false);
                  setCandidate(null);
                  setGenStatus(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {genStatus && (
                <div
                  className={`rounded border p-2.5 text-xs ${
                    genStatus.tone === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {genStatus.text}
                </div>
              )}

              {!candidate ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      AI Prompt
                    </label>
                    <textarea
                      rows={4}
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      value={genPrompt}
                      onChange={e => setGenPrompt(e.target.value)}
                      placeholder="Describe the command sequence you want to generate..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-gray-50 rounded border p-3">
                  <h4 className="text-xs font-semibold text-gray-700 border-b pb-1.5">
                    Candidate Review Details
                  </h4>
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 block mb-1">
                      Commands ({candidate.commands.length})
                    </span>
                    <ul className="text-[11px] text-gray-600 list-disc list-inside max-h-[200px] overflow-y-auto font-mono bg-white p-2 rounded border space-y-1">
                      {candidate.commands.map((cmd: any, idx: number) => (
                        <li key={idx} className="truncate">
                          [{cmd.type}] {cmd.text || cmd.itemId || cmd.switchId || JSON.stringify(cmd)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t pt-2 mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Provenance:</span>
                    <span className="text-gray-500 font-mono">
                      {candidate.provenance.providerId}/{candidate.provenance.modelId}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t pt-3 flex-shrink-0">
              {!candidate ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowGenModal(false)}
                    className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={generating || !genPrompt.trim()}
                    onClick={handleGenerateCommands}
                    aria-label="Generate Draft"
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {generating ? 'Generating...' : 'Generate Draft'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setCandidate(null)}
                    className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptCommands}
                    aria-label="Accept and Insert"
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 flex items-center gap-1"
                  >
                    Accept and Insert
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
