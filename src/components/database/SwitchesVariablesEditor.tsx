import type { ReactNode } from 'react';
import { NumberField, SelectField, TextField } from './DatabaseFields';
import type { SwitchData, VariableData } from '../../types/project';

type SwitchesVariablesEditorProps =
  | {
      kind: 'switch';
      entry: SwitchData;
      usageCount: number;
      idField: ReactNode;
      onChange(changes: Partial<SwitchData>): void;
    }
  | {
      kind: 'variable';
      entry: VariableData;
      usageCount: number;
      idField: ReactNode;
      onChange(changes: Partial<VariableData>): void;
    };

function usageLabel(count: number): string {
  return `Used ${count} ${count === 1 ? 'time' : 'times'}`;
}

export function SwitchesVariablesEditor(props: SwitchesVariablesEditorProps) {
  const { entry, usageCount, idField } = props;

  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <p className="text-[12px] text-gray-500">{usageLabel(usageCount)}</p>
      <TextField label="Name" value={entry.name} onChange={name => props.onChange({ name })} />
      {props.kind === 'switch' ? (
        <SelectField
          label="Initial value"
          value={props.entry.initial ? 'true' : 'false'}
          options={[
            { value: 'false', label: 'OFF' },
            { value: 'true', label: 'ON' },
          ]}
          onChange={value => props.onChange({ initial: value === 'true' })}
        />
      ) : (
        <NumberField
          label="Initial value"
          value={props.entry.initial}
          onChange={initial => props.onChange({ initial })}
        />
      )}
    </div>
  );
}
