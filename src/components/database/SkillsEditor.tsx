import type { ReactNode } from 'react';
import { NumberField, SelectField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import { FALLBACK_ELEMENTS, namedTypeOptions } from './databaseOptions';
import type { SkillData, TypesDatabaseData } from '../../types/project';

interface SkillsEditorProps {
  entry: SkillData;
  types: TypesDatabaseData;
  idField: ReactNode;
  onChange(changes: Partial<SkillData>): void;
}

const TARGET_OPTIONS: Array<{ value: SkillData['target']; label: string }> = [
  { value: 'singleEnemy', label: 'Single Enemy' },
  { value: 'allEnemies', label: 'All Enemies' },
  { value: 'singleAlly', label: 'Single Ally' },
  { value: 'allAllies', label: 'All Allies' },
  { value: 'self', label: 'Self' },
];

export function SkillsEditor({ entry, types, idField, onChange }: SkillsEditorProps) {
  const elementOptions = namedTypeOptions(types.elements, FALLBACK_ELEMENTS);
  return (
    <div className="space-y-3 max-w-xl">
      {idField}
      <TextField label="Name" value={entry.name} onChange={name => onChange({ name })} />
      <TextField
        label="Description"
        value={entry.description}
        onChange={description => onChange({ description })}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="MP cost" value={entry.mpCost} min={0} onChange={mpCost => onChange({ mpCost })} />
        <NumberField label="Power" value={entry.power} onChange={power => onChange({ power })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Skill target"
          value={entry.target}
          options={TARGET_OPTIONS}
          onChange={target => onChange({ target: target as SkillData['target'] })}
        />
        <ReferenceSelect
          label="Element"
          value={entry.element ?? ''}
          options={elementOptions}
          emptyLabel="(none)"
          onChange={element => onChange({ element: element || undefined })}
        />
      </div>
    </div>
  );
}
