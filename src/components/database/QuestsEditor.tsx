import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { NumberField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import type { ItemData, ObjectiveData, QuestData, QuestRewards } from '../../types/project';

interface QuestsEditorProps {
  entry: QuestData;
  items: ItemData[];
  idField: ReactNode;
  onChange(changes: Partial<QuestData>): void;
}

export function QuestsEditor({ entry, items, idField, onChange }: QuestsEditorProps) {
  const itemOptions = items.map(item => ({ value: item.id, label: item.name || item.id }));
  const updateObjective = (index: number, changes: Partial<ObjectiveData>) => {
    onChange({
      objectives: entry.objectives.map((objective, i) => (
        i === index ? { ...objective, ...changes } : objective
      )),
    });
  };
  const updateRewards = (changes: Partial<QuestRewards>) => {
    onChange({ rewards: { ...entry.rewards, ...changes } });
  };
  const updateRewardItem = (
    index: number,
    changes: Partial<QuestRewards['items'][number]>,
  ) => {
    updateRewards({
      items: entry.rewards.items.map((reward, i) => (
        i === index ? { ...reward, ...changes } : reward
      )),
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {idField}
      <TextField label="Quest title" value={entry.title} onChange={title => onChange({ title })} />
      <TextField label="Summary" value={entry.summary} onChange={summary => onChange({ summary })} />
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-gray-500">Objectives</p>
          <Button
            size="sm"
            icon={<Plus size={12} />}
            onClick={() => onChange({
              objectives: [
                ...entry.objectives,
                { id: `objective_${entry.objectives.length + 1}`, description: '' },
              ],
            })}
          >
            Add
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {entry.objectives.map((objective, index) => (
            <div key={index} className="grid grid-cols-[160px_1fr_auto] gap-2 items-end">
              <TextField
                label={`Objective ID ${index + 1}`}
                value={objective.id}
                onChange={id => updateObjective(index, { id })}
              />
              <TextField
                label={`Objective description ${index + 1}`}
                value={objective.description}
                onChange={description => updateObjective(index, { description })}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={12} />}
                onClick={() => onChange({ objectives: entry.objectives.filter((_, i) => i !== index) })}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Reward gold"
          value={entry.rewards.gold}
          min={0}
          onChange={gold => updateRewards({ gold })}
        />
        <NumberField
          label="Reward exp"
          value={entry.rewards.exp}
          min={0}
          onChange={exp => updateRewards({ exp })}
        />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-gray-500">Item rewards</p>
          <Button
            size="sm"
            icon={<Plus size={12} />}
            onClick={() => updateRewards({
              items: [...entry.rewards.items, { itemId: items[0]?.id ?? '', amount: 1 }],
            })}
          >
            Add
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {entry.rewards.items.map((reward, index) => (
            <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
              <ReferenceSelect
                label={`Reward item ${index + 1}`}
                value={reward.itemId}
                options={itemOptions}
                onChange={itemId => updateRewardItem(index, { itemId })}
              />
              <NumberField
                label={`Reward item amount ${index + 1}`}
                value={reward.amount}
                min={1}
                onChange={amount => updateRewardItem(index, { amount })}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={12} />}
                onClick={() => updateRewards({
                  items: entry.rewards.items.filter((_, i) => i !== index),
                })}
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
