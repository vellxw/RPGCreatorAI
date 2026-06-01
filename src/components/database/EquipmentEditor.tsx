import type { ReactNode } from 'react';
import {
  NumberField,
  TextareaField,
  TextField,
} from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import {
  FALLBACK_ARMOR_TYPES,
  FALLBACK_EQUIPMENT_SLOTS,
  FALLBACK_WEAPON_TYPES,
  namedTypeOptions,
} from './databaseOptions';
import type { ArmorData, Stats, TypesDatabaseData, WeaponData } from '../../types/project';

type EquipmentEditorProps =
  | {
      kind: 'weapon';
      entry: WeaponData;
      types: TypesDatabaseData;
      animationOptions: Array<{ value: string; label: string }>;
      idField: ReactNode;
      onChange(changes: Partial<WeaponData>): void;
    }
  | {
      kind: 'armor';
      entry: ArmorData;
      types: TypesDatabaseData;
      animationOptions: Array<{ value: string; label: string }>;
      idField: ReactNode;
      onChange(changes: Partial<ArmorData>): void;
    };

function splitTraits(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function updateParam<T extends WeaponData | ArmorData>(
  entry: T,
  key: keyof Stats,
  amount: number,
): Partial<T> {
  return {
    params: {
      ...(entry.params ?? {}),
      [key]: amount,
    },
  } as Partial<T>;
}

export function EquipmentEditor(props: EquipmentEditorProps) {
  const { idField } = props;

  if (props.kind === 'weapon') {
    const entry = props.entry;
    const traitText = (entry.traits ?? []).join(', ');
    const weaponTypeOptions = namedTypeOptions(props.types.weaponTypes, FALLBACK_WEAPON_TYPES);
    return (
      <div className="space-y-3 max-w-xl">
        {idField}
        <TextField label="Name" value={entry.name} onChange={name => props.onChange({ name })} />
        <TextareaField
          label="Description"
          value={entry.description}
          onChange={description => props.onChange({ description })}
        />
        <div className="grid grid-cols-2 gap-3">
          <ReferenceSelect
            label="Weapon type"
            value={entry.weaponTypeId}
            options={weaponTypeOptions}
            onChange={weaponTypeId => props.onChange({ weaponTypeId })}
          />
          <NumberField
            label="Weapon price"
            value={entry.price ?? 0}
            min={0}
            onChange={price => props.onChange({ price })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Weapon attack"
            value={entry.params?.attack ?? 0}
            onChange={amount => props.onChange(updateParam(entry, 'attack', amount))}
          />
          <ReferenceSelect
            label="Animation"
            value={entry.animationId ?? ''}
            options={props.animationOptions}
            emptyLabel="(none)"
            onChange={animationId => props.onChange({ animationId })}
          />
        </div>
        <TextField
          label="Traits"
          value={traitText}
          onChange={value => props.onChange({ traits: splitTraits(value) })}
        />
      </div>
    );
  }

  const entry = props.entry;
  const traitText = (entry.traits ?? []).join(', ');
  const armorTypeOptions = namedTypeOptions(props.types.armorTypes, FALLBACK_ARMOR_TYPES);
  const slotOptions = namedTypeOptions(props.types.equipmentSlots, FALLBACK_EQUIPMENT_SLOTS);
  return (
    <div className="space-y-3 max-w-xl">
      {idField}
      <TextField label="Name" value={entry.name} onChange={name => props.onChange({ name })} />
      <TextareaField
        label="Description"
        value={entry.description}
        onChange={description => props.onChange({ description })}
      />
      <div className="grid grid-cols-2 gap-3">
        <ReferenceSelect
          label="Armor type"
          value={entry.armorTypeId}
          options={armorTypeOptions}
          onChange={armorTypeId => props.onChange({ armorTypeId })}
        />
        <ReferenceSelect
          label="Armor slot"
          value={entry.slot}
          options={slotOptions}
          onChange={slot => props.onChange({ slot: slot as ArmorData['slot'] })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Armor defense"
          value={entry.params?.defense ?? 0}
          onChange={amount => props.onChange(updateParam(entry, 'defense', amount))}
        />
        <NumberField
          label="Armor price"
          value={entry.price ?? 0}
          min={0}
          onChange={price => props.onChange({ price })}
        />
      </div>
      <TextField
        label="Traits"
        value={traitText}
        onChange={value => props.onChange({ traits: splitTraits(value) })}
      />
    </div>
  );
}
