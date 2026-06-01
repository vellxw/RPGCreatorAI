import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { NumberField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import type { ItemData, ShopData, ShopListing } from '../../types/project';

interface ShopsEditorProps {
  entry: ShopData;
  items: ItemData[];
  idField: ReactNode;
  onChange(changes: Partial<ShopData>): void;
}

export function ShopsEditor({ entry, items, idField, onChange }: ShopsEditorProps) {
  const itemOptions = items.map(item => ({ value: item.id, label: item.name || item.id }));
  const duplicateItems = new Set<string>();
  const seenItems = new Set<string>();
  for (const listing of entry.listings) {
    if (seenItems.has(listing.itemId)) duplicateItems.add(listing.itemId);
    seenItems.add(listing.itemId);
  }

  const setListing = (index: number, changes: Partial<ShopListing>) => {
    onChange({
      listings: entry.listings.map((listing, i) => (
        i === index ? { ...listing, ...changes } : listing
      )),
    });
  };

  return (
    <div className="space-y-4 max-w-xl">
      {idField}
      <TextField label="Name" value={entry.name} onChange={name => onChange({ name })} />
      {entry.listings.length === 0 && (
        <p className="text-[12px] text-amber-600">Empty shop: add at least one listing.</p>
      )}
      {duplicateItems.size > 0 && (
        <p className="text-[12px] text-amber-600">
          Duplicate listing: {Array.from(duplicateItems).join(', ')}
        </p>
      )}
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-gray-500">Listings</p>
          <Button
            size="sm"
            icon={<Plus size={12} />}
            onClick={() => onChange({
              listings: [...entry.listings, { itemId: items[0]?.id ?? '', price: items[0]?.price ?? 0 }],
            })}
          >
            Add
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {entry.listings.map((listing, index) => (
            <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
              <ReferenceSelect
                label={`Listing item ${index + 1}`}
                value={listing.itemId}
                options={itemOptions}
                onChange={itemId => setListing(index, { itemId })}
              />
              <NumberField
                label={`Listing price ${index + 1}`}
                value={listing.price}
                min={0}
                onChange={price => setListing(index, { price })}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={12} />}
                onClick={() => onChange({ listings: entry.listings.filter((_, i) => i !== index) })}
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
