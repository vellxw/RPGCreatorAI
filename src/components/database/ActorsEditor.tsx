import type { ReactNode } from 'react';
import { NumberField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import { PortraitGenerationPanel } from './PortraitGenerationPanel';
import { CharacterConceptGenerationPanel } from './CharacterConceptGenerationPanel';
import { ReferenceChecklist, StatGrid } from './partyCombatFields';
import type { ActorData, AssetCatalogEntry, ClassData, EquipmentSlot, ItemData, SkillData } from '../../types/project';
import type { PortraitGenerationRunner } from '../../providers/portraitGenerationWorkflow';
import type { CharacterConceptGenerationRunner } from '../../providers/characterConceptGenerationWorkflow';

interface ActorsEditorProps {
  entry: ActorData;
  classes: ClassData[];
  skills: SkillData[];
  items: ItemData[];
  assets?: AssetCatalogEntry[];
  portraitGenerator?: PortraitGenerationRunner;
  characterConceptGenerator?: CharacterConceptGenerationRunner;
  idField: ReactNode;
  onAssetImported?(asset: AssetCatalogEntry): void;
  onChange(changes: Partial<ActorData>): void;
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

export function ActorsEditor({
  entry,
  classes,
  skills,
  items,
  assets = [],
  portraitGenerator,
  characterConceptGenerator,
  idField,
  onAssetImported,
  onChange,
}: ActorsEditorProps) {
  const classOptions = classes.map(cls => ({ value: cls.id, label: cls.name || cls.id }));
  const skillOptions = skills.map(skill => ({ value: skill.id, label: skill.name || skill.id }));
  const itemOptions = items.map(item => ({ value: item.id, label: item.name || item.id }));
  const portraitAssetOptions = assets
    .filter(asset => asset.kind === 'image' || asset.kind === 'generated')
    .map(asset => ({ value: asset.id, label: `${asset.name} (${asset.id})` }));
  const conceptAssetOptions = portraitAssetOptions;

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
      <ReferenceSelect
        label="Actor portrait asset"
        value={entry.portraitAssetId ?? ''}
        options={portraitAssetOptions}
        emptyLabel="(none)"
        onChange={portraitAssetId => onChange({ portraitAssetId: portraitAssetId || undefined })}
      />
      <ReferenceSelect
        label="Actor concept asset"
        value={entry.conceptAssetId ?? ''}
        options={conceptAssetOptions}
        emptyLabel="(none)"
        onChange={conceptAssetId => onChange({ conceptAssetId: conceptAssetId || undefined })}
      />
      <PortraitGenerationPanel
        ownerKind="actor"
        ownerId={entry.id}
        ownerName={entry.name}
        description={`Actor ${entry.name || entry.id}, level ${entry.level}`}
        assets={assets}
        portraitGenerator={portraitGenerator}
        onAssetAccepted={(asset, portraitAssetId) => {
          onAssetImported?.(asset);
          onChange({ portraitAssetId });
        }}
      />
      <CharacterConceptGenerationPanel
        ownerKind="actor"
        ownerId={entry.id}
        ownerName={entry.name}
        description={`Actor ${entry.name || entry.id}, level ${entry.level}`}
        assets={assets}
        characterConceptGenerator={characterConceptGenerator}
        onAssetAccepted={(asset, conceptAssetId) => {
          onAssetImported?.(asset);
          onChange({ conceptAssetId });
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <ReferenceSelect
          label="Class"
          value={entry.classId}
          options={classOptions}
          emptyLabel="(no class)"
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
      <ReferenceChecklist
        label="Actor skills"
        itemLabel="Actor skill"
        values={entry.skills}
        options={skillOptions}
        emptyText="No skills defined yet."
        onChange={skills => onChange({ skills })}
      />
    </div>
  );
}
