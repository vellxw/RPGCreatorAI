import type { ReactNode } from 'react';
import { ArrayFieldEditor } from './ArrayFieldEditor';
import {
  NumberField,
  TextareaField,
  TextField,
} from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import { ItemIconGenerationPanel } from './ItemIconGenerationPanel';
import {
  FALLBACK_ARMOR_TYPES,
  FALLBACK_EQUIPMENT_SLOTS,
  FALLBACK_WEAPON_TYPES,
  namedTypeOptions,
} from './databaseOptions';
import { STAT_FIELDS, STAT_LABELS } from './partyCombatFields';
import type { ArmorData, AssetCatalogEntry, Stats, TypesDatabaseData, WeaponData } from '../../types/project';
import type { ItemIconGenerationRunner } from '../../providers/itemIconGenerationWorkflow';

interface EquipmentIconGenerationProps {
  assets?: AssetCatalogEntry[];
  iconGenerator?: ItemIconGenerationRunner;
  onAssetImported?(asset: AssetCatalogEntry): void;
}

type EquipmentEditorProps =
  | ({
      kind: 'weapon';
      entry: WeaponData;
      types: TypesDatabaseData;
      animationOptions: Array<{ value: string; label: string }>;
      idField: ReactNode;
      onChange(changes: Partial<WeaponData>): void;
    } & EquipmentIconGenerationProps)
  | ({
      kind: 'armor';
      entry: ArmorData;
      types: TypesDatabaseData;
      animationOptions: Array<{ value: string; label: string }>;
      idField: ReactNode;
      onChange(changes: Partial<ArmorData>): void;
    } & EquipmentIconGenerationProps);

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

function createTrait(values: string[]): string {
  const base = 'new_trait';
  if (!values.includes(base)) return base;
  let suffix = 2;
  while (values.includes(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

interface TraitListProps {
  label: string;
  itemLabel: string;
  values: string[];
  onChange(values: string[]): void;
}

function TraitList({ label, itemLabel, values, onChange }: TraitListProps) {
  return (
    <ArrayFieldEditor
      label={label}
      values={values}
      createValue={() => createTrait(values)}
      emptyLabel={`No ${label.toLowerCase()} configured.`}
      onChange={onChange}
      renderItem={({ value, index, onChange: onItemChange }) => (
        <TextField
          label={`${itemLabel} ${index + 1}`}
          value={value}
          onChange={onItemChange}
        />
      )}
    />
  );
}

interface ModifierGridProps<T extends WeaponData | ArmorData> {
  label: string;
  entry: T;
  onChange(changes: Partial<T>): void;
}

function ModifierGrid<T extends WeaponData | ArmorData>({
  label,
  entry,
  onChange,
}: ModifierGridProps<T>) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-medium text-gray-500">Stat modifiers</p>
      <div className="grid grid-cols-2 gap-3">
        {STAT_FIELDS.map(field => (
          <NumberField
            key={field}
            label={`${label} modifier ${STAT_LABELS[field]}`}
            value={entry.params?.[field] ?? 0}
            onChange={amount => onChange(updateParam(entry, field, amount))}
          />
        ))}
      </div>
    </div>
  );
}

export function EquipmentEditor(props: EquipmentEditorProps) {
  const { idField } = props;
  const assets = props.assets ?? [];
  const iconAssetOptions = assets
    .filter(asset => asset.kind === 'image' || asset.kind === 'generated')
    .map(asset => ({ value: asset.id, label: `${asset.name} (${asset.id})` }));

  if (props.kind === 'weapon') {
    const entry = props.entry;
    const weaponTypeOptions = namedTypeOptions(props.types.weaponTypes, FALLBACK_WEAPON_TYPES);
    const traits = entry.traits ?? [];
    return (
      <div className="space-y-4 max-w-2xl">
        {idField}
        <TextField label="Name" value={entry.name} onChange={name => props.onChange({ name })} />
        <TextareaField
          label="Description"
          value={entry.description}
          onChange={description => props.onChange({ description })}
        />
        <ReferenceSelect
          label="Weapon icon asset"
          value={entry.iconAssetId ?? ''}
          options={iconAssetOptions}
          emptyLabel="(none)"
          onChange={iconAssetId => props.onChange({ iconAssetId: iconAssetId || undefined })}
        />
        <ItemIconGenerationPanel
          ownerKind="weapon"
          ownerId={entry.id}
          ownerName={entry.name}
          description={entry.description}
          category={entry.weaponTypeId}
          assets={assets}
          iconGenerator={props.iconGenerator}
          onAssetAccepted={(asset, iconAssetId) => {
            props.onAssetImported?.(asset);
            props.onChange({ iconAssetId });
          }}
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
        <ReferenceSelect
          label="Animation"
          value={entry.animationId ?? ''}
          options={props.animationOptions}
          emptyLabel="(none)"
          onChange={animationId => props.onChange({ animationId })}
        />
        <ModifierGrid
          label="Weapon"
          entry={entry}
          onChange={changes => props.onChange(changes)}
        />
        <TraitList
          label="Weapon traits"
          itemLabel="Weapon trait"
          values={traits}
          onChange={traits => props.onChange({ traits })}
        />
      </div>
    );
  }

  const entry = props.entry;
  const traits = entry.traits ?? [];
  const armorTypeOptions = namedTypeOptions(props.types.armorTypes, FALLBACK_ARMOR_TYPES);
  const slotOptions = namedTypeOptions(props.types.equipmentSlots, FALLBACK_EQUIPMENT_SLOTS);
  return (
    <div className="space-y-4 max-w-2xl">
      {idField}
      <TextField label="Name" value={entry.name} onChange={name => props.onChange({ name })} />
      <TextareaField
        label="Description"
        value={entry.description}
        onChange={description => props.onChange({ description })}
      />
      <ReferenceSelect
        label="Armor icon asset"
        value={entry.iconAssetId ?? ''}
        options={iconAssetOptions}
        emptyLabel="(none)"
        onChange={iconAssetId => props.onChange({ iconAssetId: iconAssetId || undefined })}
      />
      <ItemIconGenerationPanel
        ownerKind="armor"
        ownerId={entry.id}
        ownerName={entry.name}
        description={entry.description}
        category={entry.armorTypeId}
        assets={assets}
        iconGenerator={props.iconGenerator}
        onAssetAccepted={(asset, iconAssetId) => {
          props.onAssetImported?.(asset);
          props.onChange({ iconAssetId });
        }}
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
          label="Armor price"
          value={entry.price ?? 0}
          min={0}
          onChange={price => props.onChange({ price })}
        />
      </div>
      <ModifierGrid
        label="Armor"
        entry={entry}
        onChange={changes => props.onChange(changes)}
      />
      <TraitList
        label="Armor traits"
        itemLabel="Armor trait"
        values={traits}
        onChange={traits => props.onChange({ traits })}
      />
    </div>
  );
}
