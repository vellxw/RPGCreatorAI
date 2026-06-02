import type { PluginCommand, PluginCommandArg } from '../types/project';

export type PluginCommandArgKind = 'string' | 'number' | 'boolean' | 'null';
export type PluginCommandReference = 'switch' | 'variable';

export interface PluginCommandArgDefinition {
  key: string;
  label: string;
  kind: PluginCommandArgKind;
  required: boolean;
  defaultValue: PluginCommandArg;
  reference?: PluginCommandReference;
}

export interface PluginCommandDefinition {
  pluginId: string;
  command: string;
  label: string;
  description: string;
  args: PluginCommandArgDefinition[];
}

export const PLUGIN_COMMAND_REGISTRY: PluginCommandDefinition[] = [
  {
    pluginId: 'debug',
    command: 'log',
    label: 'Debug Log',
    description: 'Writes a deterministic local runtime log line.',
    args: [
      {
        key: 'message',
        label: 'Message',
        kind: 'string',
        required: false,
        defaultValue: 'New plugin command',
      },
    ],
  },
  {
    pluginId: 'debug',
    command: 'setSwitch',
    label: 'Debug Set Switch',
    description: 'Sets a project switch through deterministic debug dispatch.',
    args: [
      {
        key: 'switchId',
        label: 'Switch',
        kind: 'string',
        required: true,
        defaultValue: '',
        reference: 'switch',
      },
      {
        key: 'value',
        label: 'Value',
        kind: 'boolean',
        required: true,
        defaultValue: true,
      },
    ],
  },
  {
    pluginId: 'debug',
    command: 'setVariable',
    label: 'Debug Set Variable',
    description: 'Sets a project variable through deterministic debug dispatch.',
    args: [
      {
        key: 'variableId',
        label: 'Variable',
        kind: 'string',
        required: true,
        defaultValue: '',
        reference: 'variable',
      },
      {
        key: 'value',
        label: 'Value',
        kind: 'number',
        required: true,
        defaultValue: 0,
      },
    ],
  },
];

export function pluginCommandKey(pluginId: string, command: string): string {
  return `${pluginId}.${command}`;
}

export function findPluginCommandDefinition(
  pluginId: string,
  command: string,
): PluginCommandDefinition | undefined {
  return PLUGIN_COMMAND_REGISTRY.find(def =>
    def.pluginId === pluginId && def.command === command,
  );
}

export function createPluginCommand(definition: PluginCommandDefinition): PluginCommand {
  return {
    type: 'pluginCommand',
    pluginId: definition.pluginId,
    command: definition.command,
    args: Object.fromEntries(
      definition.args.map(arg => [arg.key, arg.defaultValue]),
    ) as Record<string, PluginCommandArg>,
  };
}

export function defaultPluginCommand(): PluginCommand {
  return createPluginCommand(PLUGIN_COMMAND_REGISTRY[0]);
}

export function pluginCommandOptions(): Array<{ value: string; label: string }> {
  return PLUGIN_COMMAND_REGISTRY.map(def => ({
    value: pluginCommandKey(def.pluginId, def.command),
    label: def.label,
  }));
}
