import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { NumberField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import { StatGrid } from './partyCombatFields';
import type { EnemyData, EnemyDrop, ItemData } from '../../types/project';

interface EnemiesEditorProps {
  entry: EnemyData;
  items: ItemData[];
  idField: ReactNode;
  onChange(changes: Partial<EnemyData>): void;
}

export function EnemiesEditor({ entry, items, idField, onChange }: EnemiesEditorProps) {
  const itemOptions = items.map(item => ({ value: item.id, label: item.name || item.id }));

  const setDrop = (index: number, changes: Partial<EnemyDrop>) => {
    onChange({
      drops: entry.drops.map((drop, i) => (
        i === index ? { ...drop, ...changes } : drop
      )),
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {idField}
      <TextField label="Name" value={entry.name} onChange={name => onChange({ name })} />
      <div>
        <p className="mb-2 text-[12px] font-medium text-gray-500">Enemy stats</p>
        <StatGrid labelPrefix="Enemy" stats={entry.stats} onChange={stats => onChange({ stats })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Exp reward" value={entry.exp} min={0} onChange={exp => onChange({ exp })} />
        <NumberField label="Gold reward" value={entry.gold} min={0} onChange={gold => onChange({ gold })} />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-gray-500">Drops</p>
          <Button
            size="sm"
            icon={<Plus size={12} />}
            onClick={() => onChange({ drops: [...entry.drops, { itemId: items[0]?.id ?? '', rate: 0 }] })}
          >
            Add
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {entry.drops.map((drop, index) => (
            <div key={index} className="grid grid-cols-[1fr_100px_auto] gap-2 items-end">
              <ReferenceSelect
                label={`Drop item ${index + 1}`}
                value={drop.itemId}
                options={itemOptions}
                onChange={itemId => setDrop(index, { itemId })}
              />
              <NumberField
                label={`Drop rate ${index + 1}`}
                value={drop.rate}
                min={0}
                max={1}
                step="0.01"
                onChange={rate => setDrop(index, { rate })}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={12} />}
                onClick={() => onChange({ drops: entry.drops.filter((_, i) => i !== index) })}
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
