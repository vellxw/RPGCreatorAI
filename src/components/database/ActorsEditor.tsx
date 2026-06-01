import type { ReactNode } from 'react';
import { NumberField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import { splitIds, StatGrid } from './partyCombatFields';
import type { ActorData, ClassData, EquipmentSlot, ItemData, SkillData } from '../../types/project';

interface ActorsEditorProps {
  entry: ActorData;
  classes: ClassData[];
  skills: SkillData[];
  items: ItemData[];
  idField: ReactNode;
  onChange(changes: Partial<ActorData>): void;
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

export function ActorsEditor({
  entry,
  classes,
  skills,
  items,
  idField,
  onChange,
}: ActorsEditorProps) {
  const classOptions = classes.map(cls => ({ value: cls.id, label: cls.name || cls.id }));
  const skillNames = new Map(skills.map(skill => [skill.id, skill.name || skill.id]));
  const itemOptions = items.map(item => ({ value: item.id, label: item.name || item.id }));

  const updateEquipment = (slot: EquipmentSlot, itemId: string) => {
    onChange({
      equipment: {
        ...entry.equipment,
        [slot]: itemId || null,
      },
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {idField}
      <TextField label="Name" value={entry.name} onChange={name => onChange({ name })} />
      <div className="grid grid-cols-2 gap-3">
        <ReferenceSelect
          label="Class"
          value={entry.classId}
          options={classOptions}
          onChange={classId => onChange({ classId })}
        />
        <NumberField label="Level" value={entry.level} min={1} onChange={level => onChange({ level })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="HP" value={entry.hp} min={0} onChange={hp => onChange({ hp })} />
        <NumberField label="MP" value={entry.mp} min={0} onChange={mp => onChange({ mp })} />
      </div>
      <div>
        <p className="mb-2 text-[12px] font-medium text-gray-500">Base stats</p>
        <StatGrid
          labelPrefix="Base"
          stats={entry.baseStats}
          onChange={baseStats => onChange({ baseStats })}
        />
      </div>
      <div>
        <p className="mb-2 text-[12px] font-medium text-gray-500">Equipment</p>
        <div className="grid grid-cols-3 gap-3">
          {EQUIPMENT_SLOTS.map(slot => (
            <ReferenceSelect
              key={slot}
              label={`Equipment ${slot}`}
              value={entry.equipment[slot] ?? ''}
              options={itemOptions}
              emptyLabel="(none)"
              onChange={itemId => updateEquipment(slot, itemId)}
            />
          ))}
        </div>
      </div>
      <TextField
        label="Actor skills"
        value={entry.skills.join(', ')}
        list="actor-skill-options"
        onChange={value => onChange({ skills: splitIds(value) })}
      />
      <datalist id="actor-skill-options">
        {skills.map(skill => (
          <option key={skill.id} value={skill.id}>
            {skillNames.get(skill.id)}
          </option>
        ))}
      </datalist>
    </div>
  );
}
