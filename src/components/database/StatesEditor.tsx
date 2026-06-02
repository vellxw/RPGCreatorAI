import type { ReactNode } from 'react';
import { ArrayFieldEditor } from './ArrayFieldEditor';
import {
  NumberField,
  SelectField,
  TextField,
} from './DatabaseFields';
import type { StateData } from '../../types/project';

interface StatesEditorProps {
  entry: StateData;
  idField: ReactNode;
  onChange(changes: Partial<StateData>): void;
}

function createTrait(values: string[]): string {
  const base = 'new_trait';
  if (!values.includes(base)) return base;
  let suffix = 2;
  while (values.includes(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export function StatesEditor({ entry, idField, onChange }: StatesEditorProps) {
  const traits = entry.traits ?? [];
  return (
    <div className="space-y-4 max-w-xl">
      {idField}
      <TextField label="Name" value={entry.name} onChange={name => onChange({ name })} />
      <NumberField
        label="State priority"
        value={entry.priority}
        min={0}
        max={100}
        onChange={priority => onChange({ priority })}
      />
      <SelectField
        label="Remove at battle end"
        value={entry.removeAtBattleEnd ? 'true' : 'false'}
        options={[
          { value: 'false', label: 'No' },
          { value: 'true', label: 'Yes' },
        ]}
        onChange={value => onChange({ removeAtBattleEnd: value === 'true' })}
      />
      <SelectField
        label="Restriction"
        value={entry.restriction ?? 'none'}
        options={[
          { value: 'none', label: 'None' },
          { value: 'cannotMove', label: 'Cannot move' },
        ]}
        onChange={restriction => onChange({ restriction: restriction as StateData['restriction'] })}
      />
      <ArrayFieldEditor
        label="State traits"
        values={traits}
        createValue={() => createTrait(traits)}
        emptyLabel="No state traits configured."
        onChange={traits => onChange({ traits })}
        renderItem={({ value, index, onChange: onItemChange }) => (
          <TextField
            label={`State trait ${index + 1}`}
            value={value}
            onChange={onItemChange}
          />
        )}
      />
    </div>
  );
}
