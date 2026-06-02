import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { NumberField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import { FALLBACK_EQUIPMENT_SLOTS, namedTypeOptions } from './databaseOptions';
import { ReferenceChecklist, StatGrid } from './partyCombatFields';
import type { ClassData, SkillData, TypesDatabaseData } from '../../types/project';

interface ClassesEditorProps {
  entry: ClassData;
  types: TypesDatabaseData;
  skills: SkillData[];
  idField: ReactNode;
  onChange(changes: Partial<ClassData>): void;
}

export function ClassesEditor({ entry, types, skills, idField, onChange }: ClassesEditorProps) {
  const skillOptions = skills.map(skill => ({ value: skill.id, label: skill.name || skill.id }));
  const equipmentOptions = namedTypeOptions(types.equipmentSlots, FALLBACK_EQUIPMENT_SLOTS);

  const setLearnedSkill = (index: number, changes: Partial<ClassData['learnedSkills'][number]>) => {
    onChange({
      learnedSkills: entry.learnedSkills.map((learned, i) => (
        i === index ? { ...learned, ...changes } : learned
      )),
    });
  };

  const addLearnedSkill = () => {
    onChange({
      learnedSkills: [
        ...entry.learnedSkills,
        { level: 1, skillId: skills[0]?.id ?? '' },
      ],
    });
  };

  const removeLearnedSkill = (index: number) => {
    onChange({
      learnedSkills: entry.learnedSkills.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {idField}
      <TextField label="Name" value={entry.name} onChange={name => onChange({ name })} />
      <div>
        <p className="mb-2 text-[12px] font-medium text-gray-500">Growth stats</p>
        <StatGrid labelPrefix="Growth" stats={entry.growth} onChange={growth => onChange({ growth })} />
      </div>
      <ReferenceChecklist
        label="Usable equipment"
        values={entry.usableEquipment}
        options={equipmentOptions}
        emptyText="No equipment slots defined yet."
        onChange={usableEquipment => onChange({ usableEquipment: usableEquipment as ClassData['usableEquipment'] })}
      />
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-gray-500">Learned skills</p>
          <Button
            size="sm"
            icon={<Plus size={12} />}
            onClick={addLearnedSkill}
            disabled={skillOptions.length === 0}
            title={skillOptions.length === 0 ? 'Create a skill before adding class progression.' : 'Add learned skill'}
          >
            Add
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {entry.learnedSkills.length === 0 ? (
            <div className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-500">
              No learned skills configured.
            </div>
          ) : entry.learnedSkills.map((learned, index) => (
            <div key={index} className="grid grid-cols-[120px_1fr_auto] gap-2 items-end">
              <NumberField
                label={`Learned skill level ${index + 1}`}
                value={learned.level}
                min={1}
                onChange={level => setLearnedSkill(index, { level })}
              />
              <ReferenceSelect
                label={`Learned skill ${index + 1}`}
                value={learned.skillId}
                options={skillOptions}
                onChange={skillId => setLearnedSkill(index, { skillId })}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={12} />}
                onClick={() => removeLearnedSkill(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
