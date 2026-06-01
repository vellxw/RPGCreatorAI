// Phase 6 — Database editor screen.
// One tab per database; minimal CRUD with dirty tracking through the
// existing project reducer + top toolbar Save button.

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { DatabaseLayout } from '../components/database/DatabaseLayout';
import { DatabaseList } from '../components/database/DatabaseList';
import { IdField } from '../components/database/DatabaseFields';
import { EquipmentEditor } from '../components/database/EquipmentEditor';
import { ItemsEditor } from '../components/database/ItemsEditor';
import { StatesEditor } from '../components/database/StatesEditor';
import { TilesetEditor } from '../components/database/TilesetEditor';
import { useProjectStore, type DatabaseRecord } from '../stores/projectStore';
import type {
  ActorData,
  ArmorData,
  ClassData,
  CommonEventData,
  DatabaseListKey,
  EnemyData,
  QuestData,
  ShopData,
  SkillData,
  Stats,
  SwitchData,
  SystemData,
  MovementSpeed,
  StateData,
  TroopData,
  VariableData,
  WeaponData,
} from '../types/project';

type DatabaseTabKey = DatabaseListKey | 'items' | 'tilesets' | 'system';

const TAB_ORDER: Array<{ key: DatabaseTabKey; label: string }> = [
  { key: 'actors', label: 'Actors' },
  { key: 'classes', label: 'Classes' },
  { key: 'skills', label: 'Skills' },
  { key: 'items', label: 'Items' },
  { key: 'weapons', label: 'Weapons' },
  { key: 'armors', label: 'Armors' },
  { key: 'states', label: 'States' },
  { key: 'tilesets', label: 'Tilesets' },
  { key: 'enemies', label: 'Enemies' },
  { key: 'troops', label: 'Troops' },
  { key: 'quests', label: 'Quests' },
  { key: 'shops', label: 'Shops' },
  { key: 'switches', label: 'Switches' },
  { key: 'variables', label: 'Variables' },
  { key: 'commonEvents', label: 'Common Events' },
  { key: 'system', label: 'System' },
];

const MOVEMENT_SPEED_OPTIONS: Array<{ value: MovementSpeed; label: string }> = [
  { value: 'oneEighth', label: '1/8 speed' },
  { value: 'oneQuarter', label: '1/4 speed' },
  { value: 'half', label: 'Half speed' },
  { value: 'normal', label: 'Normal (250 ms/tile)' },
  { value: 'double', label: 'Double (125 ms/tile)' },
  { value: 'quadruple', label: 'Quadruple' },
];

interface DetailProps {
  table: DatabaseListKey;
  entry: DatabaseRecord;
}

function Detail({ table, entry }: DetailProps) {
  const { state, dispatch } = useProjectStore();

  const update = (changes: Partial<DatabaseRecord>) => {
    dispatch({ type: 'UPDATE_DATABASE_ENTRY', table, id: entry.id, changes });
  };

  const renameId = (newId: string) => {
    if (!newId.trim() || newId === entry.id) return;
    dispatch({ type: 'RENAME_DATABASE_ENTRY', table, oldId: entry.id, newId });
  };

  const idField = (
    <IdField
      label="ID"
      value={entry.id}
      onChange={renameId}
    />
  );
  const animationOptions = state.databases.animations.sets.map(set => ({
    value: set.id,
    label: set.id,
  }));

  switch (table) {
    case 'actors':
      return <ActorDetail entry={entry as unknown as ActorData} update={update} idField={idField} />;
    case 'classes':
      return <ClassDetail entry={entry as unknown as ClassData} update={update} idField={idField} />;
    case 'skills':
      return <SkillDetail entry={entry as unknown as SkillData} update={update} idField={idField} />;
    case 'weapons':
      return (
        <EquipmentEditor
          kind="weapon"
          entry={entry as unknown as WeaponData}
          types={state.databases.types}
          animationOptions={animationOptions}
          idField={idField}
          onChange={update}
        />
      );
    case 'armors':
      return (
        <EquipmentEditor
          kind="armor"
          entry={entry as unknown as ArmorData}
          types={state.databases.types}
          animationOptions={animationOptions}
          idField={idField}
          onChange={update}
        />
      );
    case 'states':
      return <StatesEditor entry={entry as unknown as StateData} idField={idField} onChange={update} />;
    case 'enemies':
      return <EnemyDetail entry={entry as unknown as EnemyData} update={update} idField={idField} />;
    case 'troops':
      return <TroopDetail entry={entry as unknown as TroopData} update={update} idField={idField} />;
    case 'quests':
      return <QuestDetail entry={entry as unknown as QuestData} update={update} idField={idField} />;
    case 'shops':
      return <ShopDetail entry={entry as unknown as ShopData} update={update} idField={idField} />;
    case 'switches':
      return <SwitchDetail entry={entry as unknown as SwitchData} update={update} idField={idField} />;
    case 'variables':
      return <VariableDetail entry={entry as unknown as VariableData} update={update} idField={idField} />;
    case 'commonEvents':
      return <CommonEventDetail entry={entry as unknown as CommonEventData} update={update} idField={idField} />;
  }
}

type UpdateFn = (changes: Partial<DatabaseRecord>) => void;

function ActorDetail({ entry, update, idField }: { entry: ActorData; update: UpdateFn; idField: React.ReactNode }) {
  const { state } = useProjectStore();
  const classOptions = state.databases.classes.map(c => ({ value: c.id, label: c.name }));
  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <Select
        label="Class"
        value={entry.classId}
        options={classOptions.length > 0 ? classOptions : [{ value: '', label: '(no classes)' }]}
        onChange={v => update({ classId: v })}
      />
      <Input
        label="Level"
        type="number"
        value={entry.level}
        onChange={e => update({ level: Number(e.target.value) })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="HP"
          type="number"
          value={entry.hp}
          onChange={e => update({ hp: Number(e.target.value) })}
        />
        <Input
          label="MP"
          type="number"
          value={entry.mp}
          onChange={e => update({ mp: Number(e.target.value) })}
        />
      </div>
      <StatsEditor stats={entry.baseStats} onChange={s => update({ baseStats: s })} />
    </div>
  );
}

function ClassDetail({ entry, update, idField }: { entry: ClassData; update: UpdateFn; idField: React.ReactNode }) {
  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <p className="text-[12px] font-medium text-gray-500">Stat growth per level</p>
      <StatsEditor stats={entry.growth} onChange={s => update({ growth: s })} />
    </div>
  );
}

function SkillDetail({ entry, update, idField }: { entry: SkillData; update: UpdateFn; idField: React.ReactNode }) {
  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <Input
        label="Description"
        value={entry.description}
        onChange={e => update({ description: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="MP cost"
          type="number"
          value={entry.mpCost}
          onChange={e => update({ mpCost: Number(e.target.value) })}
        />
        <Input
          label="Power %"
          type="number"
          value={entry.power}
          onChange={e => update({ power: Number(e.target.value) })}
        />
      </div>
      <Select
        label="Target"
        value={entry.target}
        options={[
          { value: 'singleEnemy', label: 'Single Enemy' },
          { value: 'allEnemies', label: 'All Enemies' },
          { value: 'singleAlly', label: 'Single Ally' },
          { value: 'allAllies', label: 'All Allies' },
          { value: 'self', label: 'Self' },
        ]}
        onChange={v => update({ target: v as SkillData['target'] })}
      />
    </div>
  );
}

function WeaponDetail({ entry, update, idField }: { entry: WeaponData; update: UpdateFn; idField: React.ReactNode }) {
  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <Input
        label="Description"
        value={entry.description}
        onChange={e => update({ description: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Weapon type"
          value={entry.weaponTypeId}
          onChange={e => update({ weaponTypeId: e.target.value })}
        />
        <Input
          label="Price"
          type="number"
          value={entry.price ?? 0}
          onChange={e => update({ price: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

function ArmorDetail({ entry, update, idField }: { entry: ArmorData; update: UpdateFn; idField: React.ReactNode }) {
  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <Input
        label="Description"
        value={entry.description}
        onChange={e => update({ description: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Armor type"
          value={entry.armorTypeId}
          onChange={e => update({ armorTypeId: e.target.value })}
        />
        <Select
          label="Slot"
          value={entry.slot}
          options={[
            { value: 'shield', label: 'Shield' },
            { value: 'head', label: 'Head' },
            { value: 'body', label: 'Body' },
            { value: 'accessory', label: 'Accessory' },
          ]}
          onChange={v => update({ slot: v })}
        />
      </div>
      <Input
        label="Price"
        type="number"
        value={entry.price ?? 0}
        onChange={e => update({ price: Number(e.target.value) })}
      />
    </div>
  );
}

function StateDetail({ entry, update, idField }: { entry: StateData; update: UpdateFn; idField: React.ReactNode }) {
  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <Input
        label="Priority"
        type="number"
        value={entry.priority}
        onChange={e => update({ priority: Number(e.target.value) })}
      />
      <Select
        label="Restriction"
        value={entry.restriction ?? 'none'}
        options={[
          { value: 'none', label: 'None' },
          { value: 'cannotMove', label: 'Cannot move' },
        ]}
        onChange={v => update({ restriction: v })}
      />
      <Select
        label="Remove at battle end"
        value={entry.removeAtBattleEnd ? 'true' : 'false'}
        options={[
          { value: 'false', label: 'No' },
          { value: 'true', label: 'Yes' },
        ]}
        onChange={v => update({ removeAtBattleEnd: v === 'true' })}
      />
    </div>
  );
}

function EnemyDetail({ entry, update, idField }: { entry: EnemyData; update: UpdateFn; idField: React.ReactNode }) {
  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Exp reward"
          type="number"
          value={entry.exp}
          onChange={e => update({ exp: Number(e.target.value) })}
        />
        <Input
          label="Gold reward"
          type="number"
          value={entry.gold}
          onChange={e => update({ gold: Number(e.target.value) })}
        />
      </div>
      <StatsEditor stats={entry.stats} onChange={s => update({ stats: s })} />
    </div>
  );
}

function TroopDetail({ entry, update, idField }: { entry: TroopData; update: UpdateFn; idField: React.ReactNode }) {
  const { state } = useProjectStore();
  const enemies = state.databases.enemies;
  const setMembers = (members: string[]) => update({ members });

  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <div>
        <label className="text-[12px] font-medium text-gray-500">Members</label>
        <div className="space-y-1 mt-1">
          {entry.members.map((memberId, i) => (
            <div key={i} className="flex gap-1">
              <select
                className="flex-1 px-2 py-1 text-[12px] border border-gray-200 rounded"
                value={memberId}
                onChange={e => {
                  const next = [...entry.members];
                  next[i] = e.target.value;
                  setMembers(next);
                }}
              >
                {enemies.length === 0 && <option value="">(no enemies)</option>}
                {enemies.map(en => (
                  <option key={en.id} value={en.id}>
                    {en.name}
                  </option>
                ))}
                {!enemies.find(en => en.id === memberId) && memberId && (
                  <option value={memberId}>{memberId} (unknown)</option>
                )}
              </select>
              <Button
                size="sm"
                onClick={() => setMembers(entry.members.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          icon={<Plus size={12} />}
          onClick={() => setMembers([...entry.members, enemies[0]?.id ?? ''])}
        >
          Add member
        </Button>
      </div>
    </div>
  );
}

function QuestDetail({ entry, update, idField }: { entry: QuestData; update: UpdateFn; idField: React.ReactNode }) {
  const updateObjective = (i: number, description: string) => {
    const next = entry.objectives.slice();
    next[i] = { ...next[i], description };
    update({ objectives: next });
  };
  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Title" value={entry.title} onChange={e => update({ title: e.target.value })} />
      <Input
        label="Summary"
        value={entry.summary}
        onChange={e => update({ summary: e.target.value })}
      />
      <div>
        <label className="text-[12px] font-medium text-gray-500">Objectives</label>
        <div className="space-y-1 mt-1">
          {entry.objectives.map((obj, i) => (
            <div key={obj.id} className="flex gap-1 items-center">
              <span className="text-[11px] font-mono text-gray-400 w-16">{obj.id}</span>
              <input
                className="flex-1 px-2 py-1 text-[12px] border border-gray-200 rounded"
                value={obj.description}
                onChange={e => updateObjective(i, e.target.value)}
              />
            </div>
          ))}
          <Button
            size="sm"
            icon={<Plus size={12} />}
            onClick={() =>
              update({
                objectives: [
                  ...entry.objectives,
                  { id: `obj_${entry.objectives.length + 1}`, description: '' },
                ],
              })
            }
          >
            Add objective
          </Button>
        </div>
      </div>
      <p className="text-[12px] font-medium text-gray-500">Rewards</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Gold"
          type="number"
          value={entry.rewards.gold}
          onChange={e => update({ rewards: { ...entry.rewards, gold: Number(e.target.value) } })}
        />
        <Input
          label="Exp"
          type="number"
          value={entry.rewards.exp}
          onChange={e => update({ rewards: { ...entry.rewards, exp: Number(e.target.value) } })}
        />
      </div>
    </div>
  );
}

function ShopDetail({ entry, update, idField }: { entry: ShopData; update: UpdateFn; idField: React.ReactNode }) {
  const { state } = useProjectStore();
  const items = state.items.items;

  const setListings = (listings: ShopData['listings']) => update({ listings });

  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <div>
        <label className="text-[12px] font-medium text-gray-500">Listings</label>
        <div className="space-y-1 mt-1">
          {entry.listings.map((listing, i) => (
            <div key={i} className="flex gap-1 items-center">
              <select
                className="flex-1 px-2 py-1 text-[12px] border border-gray-200 rounded"
                value={listing.itemId}
                onChange={e => {
                  const next = entry.listings.slice();
                  next[i] = { ...next[i], itemId: e.target.value };
                  setListings(next);
                }}
              >
                {items.length === 0 && <option value="">(no items)</option>}
                {items.map(it => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
                {!items.find(it => it.id === listing.itemId) && listing.itemId && (
                  <option value={listing.itemId}>{listing.itemId} (unknown)</option>
                )}
              </select>
              <input
                className="w-24 px-2 py-1 text-[12px] border border-gray-200 rounded"
                type="number"
                value={listing.price}
                onChange={e => {
                  const next = entry.listings.slice();
                  next[i] = { ...next[i], price: Number(e.target.value) };
                  setListings(next);
                }}
              />
              <Button size="sm" onClick={() => setListings(entry.listings.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          icon={<Plus size={12} />}
          onClick={() =>
            setListings([
              ...entry.listings,
              { itemId: items[0]?.id ?? '', price: items[0]?.price ?? 1 },
            ])
          }
        >
          Add listing
        </Button>
      </div>
    </div>
  );
}

function SwitchDetail({ entry, update, idField }: { entry: SwitchData; update: UpdateFn; idField: React.ReactNode }) {
  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <Select
        label="Initial value"
        value={entry.initial ? 'true' : 'false'}
        options={[
          { value: 'false', label: 'OFF' },
          { value: 'true', label: 'ON' },
        ]}
        onChange={v => update({ initial: v === 'true' })}
      />
    </div>
  );
}

function VariableDetail({
  entry,
  update,
  idField,
}: {
  entry: VariableData;
  update: UpdateFn;
  idField: React.ReactNode;
}) {
  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <Input
        label="Initial value"
        type="number"
        value={entry.initial}
        onChange={e => update({ initial: Number(e.target.value) })}
      />
    </div>
  );
}

function CommonEventDetail({
  entry,
  update,
  idField,
}: {
  entry: CommonEventData;
  update: UpdateFn;
  idField: React.ReactNode;
}) {
  const { state } = useProjectStore();
  const switchOptions = [
    { value: '', label: entry.trigger === 'manual' ? '(none)' : '(required)' },
    ...state.databases.switches.map(s => ({ value: s.id, label: s.name || s.id })),
  ];

  return (
    <div className="space-y-3 max-w-md">
      {idField}
      <Input label="Name" value={entry.name} onChange={e => update({ name: e.target.value })} />
      <Select
        label="Trigger"
        value={entry.trigger}
        options={[
          { value: 'manual', label: 'Manual (callCommonEvent)' },
          { value: 'autorun', label: 'Autorun' },
          { value: 'parallel', label: 'Parallel' },
        ]}
        onChange={v => update({ trigger: v as CommonEventData['trigger'] })}
      />
      <Select
        label="Condition Switch"
        value={entry.switchId ?? ''}
        options={switchOptions}
        onChange={v => update({ switchId: v })}
      />
      <p className="text-[11px] text-gray-500">
        Autorun and parallel common events run while their condition switch is ON.
        Command list editing for common events arrives in a later slice.
      </p>
      <p className="text-[11px] text-gray-500">Commands ({entry.commands.length})</p>
    </div>
  );
}

function StatsEditor({ stats, onChange }: { stats: Stats; onChange(s: Stats): void }) {
  const fields: Array<keyof Stats> = [
    'maxHp',
    'maxMp',
    'attack',
    'defense',
    'magicAttack',
    'magicDefense',
    'agility',
    'luck',
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map(field => (
        <Input
          key={field}
          label={field}
          type="number"
          value={stats[field]}
          onChange={e => onChange({ ...stats, [field]: Number(e.target.value) })}
        />
      ))}
    </div>
  );
}

function SystemPanel({ system }: { system: SystemData }) {
  const { state, dispatch } = useProjectStore();
  const update = (changes: Partial<SystemData>) =>
    dispatch({ type: 'UPDATE_SYSTEM_DATA', changes });

  const actors = state.databases.actors;

  const setStartingParty = (party: string[]) => update({ startingParty: party });

  return (
    <div className="space-y-3 max-w-md">
      <Input
        label="Starting gold"
        type="number"
        value={system.startingGold}
        onChange={e => update({ startingGold: Number(e.target.value) })}
      />
      <Input
        label="Default BGM"
        value={system.defaultBgm ?? ''}
        onChange={e => update({ defaultBgm: e.target.value || undefined })}
      />
      <Input
        label="Window tint"
        value={system.windowTint ?? ''}
        onChange={e => update({ windowTint: e.target.value || undefined })}
      />
      <Input
        label="Battle background"
        value={system.battleBackground ?? ''}
        onChange={e => update({ battleBackground: e.target.value || undefined })}
      />
      <Input
        label="Player animation set"
        value={system.playerAnimationSet ?? ''}
        onChange={e => update({ playerAnimationSet: e.target.value || undefined })}
      />
      <Select
        label="Player movement speed"
        value={system.playerMovementSpeed ?? 'double'}
        options={MOVEMENT_SPEED_OPTIONS}
        onChange={v => update({ playerMovementSpeed: v as MovementSpeed })}
      />
      <Input
        label="Default character height (tiles)"
        type="number"
        step="0.1"
        min="0.1"
        value={system.defaultCharacterHeightTiles ?? 1.5}
        onChange={e => update({ defaultCharacterHeightTiles: Number(e.target.value) })}
      />
      <div>
        <label className="text-[12px] font-medium text-gray-500">Starting party (actor ids)</label>
        <div className="space-y-1 mt-1">
          {system.startingParty.map((actorId, i) => (
            <div key={i} className="flex gap-1">
              <select
                className="flex-1 px-2 py-1 text-[12px] border border-gray-200 rounded"
                value={actorId}
                onChange={e => {
                  const next = system.startingParty.slice();
                  next[i] = e.target.value;
                  setStartingParty(next);
                }}
              >
                {actors.length === 0 && <option value="">(no actors)</option>}
                {actors.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                {!actors.find(a => a.id === actorId) && actorId && (
                  <option value={actorId}>{actorId} (unknown)</option>
                )}
              </select>
              <Button
                size="sm"
                onClick={() => setStartingParty(system.startingParty.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            icon={<Plus size={12} />}
            onClick={() => setStartingParty([...system.startingParty, actors[0]?.id ?? ''])}
          >
            Add actor
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DatabaseScreen() {
  const { state, dispatch } = useProjectStore();
  const [tab, setTab] = useState<DatabaseTabKey>('actors');
  const [selectedId, setSelectedId] = useState<string>('');

  const databases = state.databases;
  const standaloneTab = tab === 'system' || tab === 'tilesets' || tab === 'items';
  const entries =
    standaloneTab
      ? []
      : ((databases[tab as DatabaseListKey] as unknown) as DatabaseRecord[]);

  const selectedEntry = entries.find(e => e.id === selectedId) ?? entries[0];
  const activeTabLabel = TAB_ORDER.find(t => t.key === tab)?.label ?? 'Database';
  const mapUsage = Object.values(state.maps).reduce<Record<string, string[]>>((acc, map) => {
    if (!map.tilesetId) return acc;
    acc[map.tilesetId] = [...(acc[map.tilesetId] ?? []), map.name || map.id];
    return acc;
  }, {});

  // keep selection consistent when switching tabs
  const ensureSelection = (key: DatabaseTabKey) => {
    setTab(key);
    if (key === 'system' || key === 'tilesets' || key === 'items') {
      setSelectedId('');
      return;
    }
    const list = (databases[key as DatabaseListKey] as unknown) as DatabaseRecord[];
    setSelectedId(list[0]?.id ?? '');
  };

  const tabCount = (key: DatabaseTabKey): number | null => {
    if (key === 'system') return null;
    if (key === 'items') return state.items.items.length;
    if (key === 'tilesets') return databases.tilesets.tilesets.length;
    return ((databases[key as DatabaseListKey] as unknown) as DatabaseRecord[]).length;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center border-b border-gray-200 px-4 gap-1 bg-white">
        {TAB_ORDER.map(t => (
          <button
            key={t.key}
            onClick={() => ensureSelection(t.key)}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {tabCount(t.key) !== null && (
              <span className="ml-1.5 text-[11px] text-gray-400">
                {tabCount(t.key)}
              </span>
            )}
          </button>
        ))}
      </div>

      <DatabaseLayout
        title={activeTabLabel}
        sidebar={
          standaloneTab ? undefined : (
            <DatabaseList
              table={tab as DatabaseListKey}
              entries={entries}
              selectedId={selectedEntry?.id ?? null}
              onSelect={setSelectedId}
            />
          )
        }
      >
        {tab === 'system' ? (
          <SystemPanel system={databases.system} />
        ) : tab === 'items' ? (
          <ItemsEditor
            value={state.items}
            types={databases.types}
            onChange={items => dispatch({ type: 'UPDATE_ITEM_DATABASE', items })}
          />
        ) : tab === 'tilesets' ? (
          <TilesetEditor
            value={databases.tilesets}
            mapUsage={mapUsage}
            onChange={tilesets => dispatch({ type: 'UPDATE_TILESET_DATABASE', tilesets })}
          />
        ) : (
          selectedEntry ? (
            <Detail table={tab as DatabaseListKey} entry={selectedEntry} />
          ) : (
            <p className="text-[13px] text-gray-400">No entries — add one to begin.</p>
          )
        )}
      </DatabaseLayout>
    </div>
  );
}
