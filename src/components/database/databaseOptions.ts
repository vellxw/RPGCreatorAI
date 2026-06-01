import type { NamedTypeEntry } from '../../types/project';
import type { SelectOption } from './DatabaseFields';

export const FALLBACK_ITEM_CATEGORIES: NamedTypeEntry[] = [
  { id: 'consumable', name: 'Consumable' },
  { id: 'key', name: 'Key Item' },
  { id: 'material', name: 'Material' },
];

export const FALLBACK_WEAPON_TYPES: NamedTypeEntry[] = [
  { id: 'sword', name: 'Sword' },
  { id: 'staff', name: 'Staff' },
  { id: 'bow', name: 'Bow' },
];

export const FALLBACK_ARMOR_TYPES: NamedTypeEntry[] = [
  { id: 'light', name: 'Light Armor' },
  { id: 'heavy', name: 'Heavy Armor' },
  { id: 'robe', name: 'Robe' },
];

export const FALLBACK_EQUIPMENT_SLOTS: NamedTypeEntry[] = [
  { id: 'weapon', name: 'Weapon' },
  { id: 'armor', name: 'Armor' },
  { id: 'shield', name: 'Shield' },
  { id: 'head', name: 'Head' },
  { id: 'body', name: 'Body' },
  { id: 'accessory', name: 'Accessory' },
];

export function namedTypeOptions(
  entries: NamedTypeEntry[],
  fallback: NamedTypeEntry[],
): SelectOption[] {
  const source = entries.length > 0 ? [...entries, ...fallback] : fallback;
  const seen = new Set<string>();
  const out: SelectOption[] = [];
  for (const entry of source) {
    if (!entry.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push({ value: entry.id, label: entry.name || entry.id });
  }
  return out;
}
