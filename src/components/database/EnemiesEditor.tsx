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
  const canAddDrop = itemOptions.length > 0;

  const setDrop = (index: number, changes: Partial<EnemyDrop>) => {
    onChange({
      drops: entry.drops.map((drop, i) => (
        i === index ? { ...drop, ...changes } : drop
      )),
    });
  };

  const addDrop = () => {
    const firstItem = items[0]?.id;
    if (!firstItem) return;
    onChange({ drops: [...entry.drops, { itemId: firstItem, rate: 1 }] });
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
            aria-label="Add drop"
            icon={<Plus size={12} />}
            onClick={addDrop}
            disabled={!canAddDrop}
            title={canAddDrop ? 'Add drop' : 'Create an item before adding drops.'}
          >
            Add
          </Button>
        </div>
        {entry.drops.length === 0 ? (
          <div className="mt-2 rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-500">
            {canAddDrop ? 'No drops configured.' : 'Create an item before adding drops.'}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {entry.drops.map((drop, index) => (
              <div key={index} className="grid grid-cols-[1fr_100px_auto] gap-2 items-end">
                <ReferenceSelect
                  label={`Drop item ${index + 1}`}
                  value={drop.itemId}
                  options={itemOptions}
                  emptyLabel="(missing item)"
                  onChange={itemId => setDrop(index, { itemId })}
                />
                <NumberField
                  label={`Drop chance ${index + 1}`}
                  value={drop.rate}
                  min={0}
                  max={1}
                  step="0.01"
                  onChange={rate => setDrop(index, { rate })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove drop ${index + 1}`}
                  icon={<Trash2 size={12} />}
                  onClick={() => onChange({ drops: entry.drops.filter((_, i) => i !== index) })}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
