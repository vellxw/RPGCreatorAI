import { useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  IdField,
  NumberField,
  TextareaField,
  TextField,
} from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import {
  FALLBACK_EQUIPMENT_SLOTS,
  FALLBACK_ITEM_CATEGORIES,
  namedTypeOptions,
} from './databaseOptions';
import type {
  EquipmentSlot,
  ItemData,
  ItemDatabase,
  Stats,
  TypesDatabaseData,
} from '../../types/project';

interface ItemsEditorProps {
  value: ItemDatabase;
  types: TypesDatabaseData;
  onChange(value: ItemDatabase): void;
}

const STAT_FIELDS: Array<keyof Stats> = [
  'maxHp',
  'maxMp',
  'attack',
  'defense',
  'magicAttack',
  'magicDefense',
  'agility',
  'luck',
];

function uniqueItemId(base: string, items: ItemData[]): string {
  const cleanBase = base.trim() || 'item';
  const ids = new Set(items.map(item => item.id));
  if (!ids.has(cleanBase)) return cleanBase;
  let suffix = 2;
  while (ids.has(`${cleanBase}_${suffix}`)) suffix += 1;
  return `${cleanBase}_${suffix}`;
}

function createItem(items: ItemData[], category: string): ItemData {
  const id = uniqueItemId(`item_${items.length + 1}`, items);
  return {
    id,
    name: 'New Item',
    description: '',
    type: category,
    price: 0,
    effect: {},
    modifiers: {},
  };
}

export function ItemsEditor({ value, types, onChange }: ItemsEditorProps) {
  const [selectedId, setSelectedId] = useState(value.items[0]?.id ?? '');
  const categoryOptions = namedTypeOptions(types.itemCategories, FALLBACK_ITEM_CATEGORIES);
  const slotOptions = namedTypeOptions(types.equipmentSlots, FALLBACK_EQUIPMENT_SLOTS);
  const selected = value.items.find(item => item.id === selectedId) ?? value.items[0] ?? null;

  const replaceItems = (items: ItemData[]) => onChange({ items });
  const updateSelected = (changes: Partial<ItemData>) => {
    if (!selected) return;
    replaceItems(value.items.map(item => (
      item.id === selected.id ? { ...item, ...changes } : item
    )));
  };

  const addItem = () => {
    const item = createItem(value.items, categoryOptions[0]?.value ?? 'consumable');
    replaceItems([...value.items, item]);
    setSelectedId(item.id);
  };

  const duplicateItem = () => {
    if (!selected) return;
    const clone = {
      ...selected,
      id: uniqueItemId(`${selected.id}_copy`, value.items),
      name: `${selected.name} Copy`,
    };
    replaceItems([...value.items, clone]);
    setSelectedId(clone.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    const next = value.items.filter(item => item.id !== selected.id);
    replaceItems(next);
    setSelectedId(next[0]?.id ?? '');
  };

  const updateEffect = (key: 'hp' | 'mp', amount: number) => {
    const effect = selected?.effect ?? {};
    updateSelected({
      effect: {
        hp: effect.hp,
        mp: effect.mp,
        [key]: amount,
      },
    });
  };

  const updateModifier = (key: keyof Stats, amount: number) => {
    updateSelected({
      modifiers: {
        ...(selected?.modifiers ?? {}),
        [key]: amount,
      },
    });
  };

  return (
    <div className="grid grid-cols-[minmax(180px,240px)_minmax(320px,1fr)] gap-4 max-w-5xl">
      <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
        <div className="flex items-center justify-between gap-2 px-2 py-2 border-b border-gray-100">
          <span className="text-[12px] font-semibold text-gray-600">Items</span>
          <Button size="sm" icon={<Plus size={12} />} onClick={addItem} aria-label="Add item">
            Add
          </Button>
        </div>
        <div className="max-h-[520px] overflow-auto">
          {value.items.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-gray-400">No items yet. Add one to begin.</p>
          ) : (
            value.items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left px-3 py-2 border-b border-gray-100 transition-colors ${
                  selected?.id === item.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="block text-[13px] font-medium truncate">{item.name || item.id}</span>
                <span className="block text-[11px] font-mono text-gray-400 truncate">{item.id}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {selected ? (
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" icon={<Copy size={12} />} onClick={duplicateItem}>
              Duplicate
            </Button>
            <Button size="sm" variant="danger" icon={<Trash2 size={12} />} onClick={removeSelected}>
              Delete
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <IdField label="Item ID" value={selected.id} onChange={id => updateSelected({ id })} />
            <TextField label="Item name" value={selected.name} onChange={name => updateSelected({ name })} />
          </div>
          <TextareaField
            label="Description"
            value={selected.description}
            onChange={description => updateSelected({ description })}
          />
          <div className="grid grid-cols-2 gap-3">
            <ReferenceSelect
              label="Item category"
              value={selected.type}
              options={categoryOptions}
              onChange={type => updateSelected({ type })}
            />
            <NumberField
              label="Item price"
              value={selected.price ?? 0}
              min={0}
              onChange={price => updateSelected({ price })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="HP effect"
              value={selected.effect?.hp ?? 0}
              onChange={amount => updateEffect('hp', amount)}
            />
            <NumberField
              label="MP effect"
              value={selected.effect?.mp ?? 0}
              onChange={amount => updateEffect('mp', amount)}
            />
          </div>
          <ReferenceSelect
            label="Equipment slot"
            value={selected.slot ?? ''}
            options={slotOptions}
            emptyLabel="(none)"
            onChange={slot => updateSelected({ slot: (slot || undefined) as EquipmentSlot | undefined })}
          />
          <div>
            <p className="mb-2 text-[12px] font-medium text-gray-500">Stat modifiers</p>
            <div className="grid grid-cols-2 gap-3">
              {STAT_FIELDS.map(field => (
                <NumberField
                  key={field}
                  label={`Modifier ${field}`}
                  value={selected.modifiers?.[field] ?? 0}
                  onChange={amount => updateModifier(field, amount)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-gray-400">No items yet. Add one to begin.</p>
      )}
    </div>
  );
}
