import type { ReactNode } from 'react';
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

function splitTraits(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

export function StatesEditor({ entry, idField, onChange }: StatesEditorProps) {
  return (
    <div className="space-y-3 max-w-xl">
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
      <TextField
        label="Traits"
        value={entry.traits.join(', ')}
        onChange={value => onChange({ traits: splitTraits(value) })}
      />
    </div>
  );
}
