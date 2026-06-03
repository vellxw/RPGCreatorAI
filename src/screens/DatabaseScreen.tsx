// Phase 6 — Database editor screen.
// One tab per database; minimal CRUD with dirty tracking through the
// existing project reducer + top toolbar Save button.

import { useMemo, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select } from '../components/ui/Input';
import { DatabaseLayout } from '../components/database/DatabaseLayout';
import { DatabaseList } from '../components/database/DatabaseList';
import { IdField } from '../components/database/DatabaseFields';
import { createMockProviderAdapter } from '../providers/mockProviderAdapter';
import {
  generateBalancingCandidate,
  validateBalancingCandidate,
  approveBalancingCandidate,
} from '../providers/balancingAssistantWorkflow';
import { ActorsEditor } from '../components/database/ActorsEditor';
import { AnimationsEditor } from '../components/database/AnimationsEditor';
import { ClassesEditor } from '../components/database/ClassesEditor';
import { EquipmentEditor } from '../components/database/EquipmentEditor';
import { EnemiesEditor } from '../components/database/EnemiesEditor';
import { ItemsEditor } from '../components/database/ItemsEditor';
import { QuestsEditor } from '../components/database/QuestsEditor';
import { ShopsEditor } from '../components/database/ShopsEditor';
import { SkillsEditor } from '../components/database/SkillsEditor';
import { StatesEditor } from '../components/database/StatesEditor';
import { SwitchesVariablesEditor } from '../components/database/SwitchesVariablesEditor';
import { SystemEditor } from '../components/database/SystemEditor';
import { TermsEditor } from '../components/database/TermsEditor';
import { TilesetEditor } from '../components/database/TilesetEditor';
import { TroopsEditor } from '../components/database/TroopsEditor';
import { TypesEditor } from '../components/database/TypesEditor';
import { CommandStackEditor } from '../components/events/CommandStackEditor';
import { findCharacterAnimationQaBlockedAnimationSets } from '../providers/generatedAnimationQa';
import {
  flattenCommands,
  useProjectStore,
  type DatabaseRecord,
  type ProjectStoreState,
} from '../stores/projectStore';
import { findReferences, listReferences } from '../validation/referenceIndex';
import type {
  ActorData,
  ArmorData,
  ClassData,
  CommonEventData,
  DatabaseListKey,
  EnemyData,
  EventCommand,
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

type DatabaseTabKey = DatabaseListKey | 'items' | 'tilesets' | 'animations' | 'types' | 'terms' | 'system';

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
  { key: 'animations', label: 'Animations' },
  { key: 'types', label: 'Types' },
  { key: 'terms', label: 'Terms' },
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

const EMPTY_DETAIL_COPY: Partial<Record<DatabaseTabKey, { plural: string; singular: string; detail: string }>> = {
  actors: {
    plural: 'actors',
    singular: 'actor',
    detail: 'Create an actor from the list to edit stats, class, equipment, and starting-party references.',
  },
  classes: {
    plural: 'classes',
    singular: 'class',
    detail: 'Create a class from the list to define stat growth, equipment rules, and learned skills.',
  },
  skills: {
    plural: 'skills',
    singular: 'skill',
    detail: 'Create a skill from the list to define costs, target rules, and battle behavior.',
  },
  weapons: {
    plural: 'weapons',
    singular: 'weapon',
    detail: 'Create a weapon from the list to define equipment stats, price, and animation references.',
  },
  armors: {
    plural: 'armors',
    singular: 'armor',
    detail: 'Create an armor record from the list to define equipment stats, slot, and traits.',
  },
  states: {
    plural: 'states',
    singular: 'state',
    detail: 'Create a state from the list to define status effects and battle restrictions.',
  },
  enemies: {
    plural: 'enemies',
    singular: 'enemy',
    detail: 'Create an enemy from the list to define stats, rewards, and drops.',
  },
  troops: {
    plural: 'troops',
    singular: 'troop',
    detail: 'Create a troop from the list to group enemies for battle encounters.',
  },
  quests: {
    plural: 'quests',
    singular: 'quest',
    detail: 'Create a quest from the list to define objectives and rewards.',
  },
  shops: {
    plural: 'shops',
    singular: 'shop',
    detail: 'Create a shop from the list to define listings and prices.',
  },
  switches: {
    plural: 'switches',
    singular: 'switch',
    detail: 'Create a switch from the list to drive event conditions and branches.',
  },
  variables: {
    plural: 'variables',
    singular: 'variable',
    detail: 'Create a variable from the list to track numeric event state.',
  },
  commonEvents: {
    plural: 'common events',
    singular: 'common event',
    detail: 'Create a common event from the list to author reusable command stacks.',
  },
};

interface DatabaseUsageCounts {
  switches: Record<string, number>;
  variables: Record<string, number>;
}

function bump(counts: Record<string, number>, id: string | undefined) {
  if (!id) return;
  counts[id] = (counts[id] ?? 0) + 1;
}

function countCommandUsage(command: EventCommand, usage: DatabaseUsageCounts) {
  switch (command.type) {
    case 'controlSwitch':
    case 'ifSwitch':
      bump(usage.switches, command.switchId);
      break;
    case 'controlVariable':
      bump(usage.variables, command.variableId);
      bump(usage.variables, command.sourceVariableId);
      break;
    case 'ifVariable':
      bump(usage.variables, command.variableId);
      break;
    default:
      break;
  }
}

function countCommandListUsage(commands: EventCommand[], usage: DatabaseUsageCounts) {
  for (const { command } of flattenCommands(commands)) {
    countCommandUsage(command, usage);
  }
}

function databaseUsageCounts(state: ProjectStoreState): DatabaseUsageCounts {
  const usage: DatabaseUsageCounts = { switches: {}, variables: {} };
  for (const map of Object.values(state.maps)) {
    for (const event of map.events) {
      countCommandListUsage(event.commands, usage);
      for (const page of event.pages ?? []) {
        for (const switchId of Object.keys(page.conditions.switches ?? {})) {
          bump(usage.switches, switchId);
        }
        for (const variable of page.conditions.variables ?? []) {
          bump(usage.variables, variable.variableId);
        }
        countCommandListUsage(page.commands, usage);
      }
    }
  }
  for (const commonEvent of state.databases.commonEvents) {
    bump(usage.switches, commonEvent.switchId);
    countCommandListUsage(commonEvent.commands, usage);
  }
  return usage;
}

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
    const refs = findReferences({
      project: state.project,
      maps: state.maps,
      items: state.items,
      databases: state.databases,
      assets: state.assets,
    }, { table, id: entry.id });
    const updateReferences = refs.length > 0 && confirm(
      `Rename "${entry.id}" to "${newId}"?\n\nOK: rename and update ${refs.length} reference${refs.length === 1 ? '' : 's'}.\nCancel: rename only the ID.`,
    );
    dispatch({ type: 'RENAME_DATABASE_ENTRY', table, oldId: entry.id, newId, updateReferences });
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
      return (
        <ActorsEditor
          entry={entry as unknown as ActorData}
          classes={state.databases.classes}
          skills={state.databases.skills}
          items={state.items.items}
          idField={idField}
          assets={state.assets.assets}
          onAssetImported={asset => dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset })}
          onChange={update}
        />
      );
    case 'classes':
      return (
        <ClassesEditor
          entry={entry as unknown as ClassData}
          types={state.databases.types}
          skills={state.databases.skills}
          idField={idField}
          onChange={update}
        />
      );
    case 'skills':
      return (
        <SkillsEditor
          entry={entry as unknown as SkillData}
          types={state.databases.types}
          idField={idField}
          onChange={update}
        />
      );
    case 'weapons':
      return (
        <EquipmentEditor
          kind="weapon"
          entry={entry as unknown as WeaponData}
          types={state.databases.types}
          animationOptions={animationOptions}
          idField={idField}
          assets={state.assets.assets}
          onAssetImported={asset => dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset })}
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
          assets={state.assets.assets}
          onAssetImported={asset => dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset })}
          onChange={update}
        />
      );
    case 'states':
      return <StatesEditor entry={entry as unknown as StateData} idField={idField} onChange={update} />;
    case 'enemies':
      return (
        <EnemiesEditor
          entry={entry as unknown as EnemyData}
          items={state.items.items}
          idField={idField}
          onChange={update}
        />
      );
    case 'troops':
      return (
        <TroopsEditor
          entry={entry as unknown as TroopData}
          enemies={state.databases.enemies}
          idField={idField}
          onChange={update}
        />
      );
    case 'quests':
      return (
        <QuestsEditor
          entry={entry as unknown as QuestData}
          items={state.items.items}
          idField={idField}
          onChange={update}
        />
      );
    case 'shops':
      return (
        <ShopsEditor
          entry={entry as unknown as ShopData}
          items={state.items.items}
          idField={idField}
          onChange={update}
        />
      );
    case 'switches':
      return (
        <SwitchesVariablesEditor
          kind="switch"
          entry={entry as unknown as SwitchData}
          usageCount={databaseUsageCounts(state).switches[entry.id] ?? 0}
          idField={idField}
          onChange={update}
        />
      );
    case 'variables':
      return (
        <SwitchesVariablesEditor
          kind="variable"
          entry={entry as unknown as VariableData}
          usageCount={databaseUsageCounts(state).variables[entry.id] ?? 0}
          idField={idField}
          onChange={update}
        />
      );
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
  const { state, dispatch } = useProjectStore();
  const switchOptions = [
    { value: '', label: entry.trigger === 'manual' ? '(none)' : '(required)' },
    ...state.databases.switches.map(s => ({ value: s.id, label: s.name || s.id })),
  ];

  return (
    <div className="space-y-4">
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
        </p>
      </div>
      <div className="min-h-[420px] max-h-[620px] flex flex-col overflow-hidden rounded-lg border border-gray-200">
        <CommandStackEditor
          title="Common Event Commands"
          subtitle="Reusable command stack for calls, autorun, and parallel common events."
          commands={entry.commands}
          mapIds={Object.keys(state.maps)}
          itemIds={state.items.items.map(item => item.id)}
          ownerCommonEventId={entry.id}
          onCommandsChange={commands =>
            dispatch({ type: 'UPDATE_COMMON_EVENT_COMMANDS', commonEventId: entry.id, commands })
          }
        />
      </div>
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

  const [showBalancingModal, setShowBalancingModal] = useState(false);
  const [balancingPrompt, setBalancingPrompt] = useState('');
  const [balancingCurve, setBalancingCurve] = useState('standard');
  const [balancingGenerating, setBalancingGenerating] = useState(false);
  const [balancingCandidate, setBalancingCandidate] = useState<any>(null);
  const [balancingStatus, setBalancingStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const openBalancingAssistant = () => {
    setBalancingPrompt('Ensure enemies are tougher at early stages while giving more EXP and gold, keeping items slightly cheaper.');
    setBalancingCurve('standard');
    setBalancingCandidate(null);
    setBalancingStatus(null);
    setShowBalancingModal(true);
  };

  const handleGenerateBalancing = async () => {
    setBalancingGenerating(true);
    setBalancingStatus(null);
    setBalancingCandidate(null);
    try {
      const adapter = createMockProviderAdapter();
      const context = {
        actors: databases.actors,
        enemies: databases.enemies,
        items: state.items.items,
      };
      const result = await generateBalancingCandidate(
        adapter,
        balancingPrompt,
        context,
        { curve: balancingCurve },
        {
          requestId: `bal-gen-${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
      );
      const validationErrors = validateBalancingCandidate(result, context);
      if (validationErrors.length > 0) {
        setBalancingStatus({ tone: 'error', text: `Validation failed: ${validationErrors[0]}` });
        return;
      }
      setBalancingCandidate(result);
      setBalancingStatus({ tone: 'success', text: 'Balancing adjustments generated successfully! Review below.' });
    } catch (e) {
      setBalancingStatus({ tone: 'error', text: (e as Error).message });
    } finally {
      setBalancingGenerating(false);
    }
  };

  const handleAcceptBalancing = () => {
    if (!balancingCandidate) return;
    try {
      const context = {
        actors: databases.actors,
        enemies: databases.enemies,
        items: state.items.items,
      };
      const approved = approveBalancingCandidate(balancingCandidate, context, {
        reviewedAt: new Date().toISOString(),
      });

      // Apply changes to Actors
      if (approved.adjustments.actors) {
        for (const adj of approved.adjustments.actors) {
          dispatch({
            type: 'UPDATE_DATABASE_ENTRY',
            table: 'actors',
            id: adj.id,
            changes: adj.changes as any,
          });
        }
      }

      // Apply changes to Enemies
      if (approved.adjustments.enemies) {
        for (const adj of approved.adjustments.enemies) {
          dispatch({
            type: 'UPDATE_DATABASE_ENTRY',
            table: 'enemies',
            id: adj.id,
            changes: adj.changes as any,
          });
        }
      }

      // Apply changes to Items
      if (approved.adjustments.items) {
        let updatedItems = state.items.items.slice();
        for (const adj of approved.adjustments.items) {
          updatedItems = updatedItems.map(item =>
            item.id === adj.id ? { ...item, ...adj.changes } : item
          );
        }
        dispatch({
          type: 'UPDATE_ITEM_DATABASE',
          items: { items: updatedItems },
        });
      }

      setShowBalancingModal(false);
      setBalancingCandidate(null);
    } catch (e) {
      setBalancingStatus({ tone: 'error', text: (e as Error).message });
    }
  };

  const databases = state.databases;
  const standaloneTab =
    tab === 'system' ||
    tab === 'tilesets' ||
    tab === 'items' ||
    tab === 'animations' ||
    tab === 'types' ||
    tab === 'terms';
  const entries =
    standaloneTab
      ? []
      : ((databases[tab as DatabaseListKey] as unknown) as DatabaseRecord[]);

  const selectedEntry = entries.find(e => e.id === selectedId) ?? entries[0];
  const activeTabLabel = TAB_ORDER.find(t => t.key === tab)?.label ?? 'Database';
  const emptyDetail = EMPTY_DETAIL_COPY[tab];
  const mapUsage = Object.values(state.maps).reduce<Record<string, string[]>>((acc, map) => {
    if (!map.tilesetId) return acc;
    acc[map.tilesetId] = [...(acc[map.tilesetId] ?? []), map.name || map.id];
    return acc;
  }, {});
  const standaloneReferenceSources = useMemo(() => {
    const sources: { items: Record<string, string[]>; animations: Record<string, string[]> } = {
      items: {},
      animations: {},
    };
    for (const ref of listReferences({
      project: state.project,
      maps: state.maps,
      items: state.items,
      databases: state.databases,
      assets: state.assets,
    })) {
      if (ref.table === 'items' || ref.table === 'animations') {
        sources[ref.table][ref.id] = [...(sources[ref.table][ref.id] ?? []), ref.source];
      }
    }
    return sources;
  }, [state.assets, state.databases, state.items, state.maps, state.project]);
  const blockedAnimationSetIds = useMemo(
    () => findCharacterAnimationQaBlockedAnimationSets(databases.animations.sets, state.assets.assets),
    [databases.animations.sets, state.assets.assets],
  );

  // keep selection consistent when switching tabs
  const ensureSelection = (key: DatabaseTabKey) => {
    setTab(key);
    if (key === 'system' || key === 'tilesets' || key === 'items' || key === 'animations' || key === 'types' || key === 'terms') {
      setSelectedId('');
      return;
    }
    const list = (databases[key as DatabaseListKey] as unknown) as DatabaseRecord[];
    setSelectedId(list[0]?.id ?? '');
  };

  const tabCount = (key: DatabaseTabKey): number | null => {
    if (key === 'system' || key === 'types' || key === 'terms') return null;
    if (key === 'items') return state.items.items.length;
    if (key === 'tilesets') return databases.tilesets.tilesets.length;
    if (key === 'animations') return databases.animations.sets.length;
    return ((databases[key as DatabaseListKey] as unknown) as DatabaseRecord[]).length;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        aria-label="Database tables"
        className="flex items-center border-b border-gray-200 px-4 gap-1 bg-white overflow-x-auto"
      >
        {TAB_ORDER.map(t => (
          <button
            key={t.key}
            aria-current={tab === t.key ? 'page' : undefined}
            aria-label={`Open ${t.label} database tab`}
            onClick={() => ensureSelection(t.key)}
            className={`flex-shrink-0 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
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
        <div className="flex-1" />
        <button
          type="button"
          onClick={openBalancingAssistant}
          aria-label="Balance database"
          title="AI Balancing Assistant"
          className="my-1.5 px-2.5 py-1 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Sparkles size={13} />
          Balance Database
        </button>
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
          <SystemEditor
            system={databases.system}
            actors={databases.actors}
            animations={databases.animations.sets}
            terms={databases.terms}
            blockedAnimationSetIds={blockedAnimationSetIds}
            onChange={changes => dispatch({ type: 'UPDATE_SYSTEM_DATA', changes })}
          />
        ) : tab === 'types' ? (
          <TypesEditor
            types={databases.types}
            onChange={types => dispatch({ type: 'UPDATE_TYPES_DATABASE', types })}
          />
        ) : tab === 'terms' ? (
          <TermsEditor
            terms={databases.terms}
            onChange={terms => dispatch({ type: 'UPDATE_TERMS_DATABASE', terms })}
          />
        ) : tab === 'items' ? (
          <ItemsEditor
            value={state.items}
            types={databases.types}
            assets={state.assets.assets}
            referenceSources={standaloneReferenceSources.items}
            onAssetImported={asset => dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset })}
            onChange={items => dispatch({ type: 'UPDATE_ITEM_DATABASE', items })}
          />
        ) : tab === 'tilesets' ? (
          <TilesetEditor
            value={databases.tilesets}
            assets={state.assets.assets}
            mapUsage={mapUsage}
            onAssetImported={asset => dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset })}
            onChange={tilesets => dispatch({ type: 'UPDATE_TILESET_DATABASE', tilesets })}
          />
        ) : tab === 'animations' ? (
          <AnimationsEditor
            value={databases.animations}
            assets={state.assets.assets}
            referenceSources={standaloneReferenceSources.animations}
            onAssetImported={asset => dispatch({ type: 'ADD_ASSET_CATALOG_ENTRY', asset })}
            onChange={animations => dispatch({ type: 'UPDATE_ANIMATION_DATABASE', animations })}
          />
        ) : (
          selectedEntry ? (
            <Detail table={tab as DatabaseListKey} entry={selectedEntry} />
          ) : (
            <EmptyState
              title={`No ${emptyDetail?.plural ?? activeTabLabel.toLowerCase()} selected`}
              detail={emptyDetail?.detail ?? `Create a ${activeTabLabel.toLowerCase()} entry from the list to edit it here.`}
            />
          )
        )}
      </DatabaseLayout>

      {showBalancingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl flex flex-col max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-500" />
                AI Balancing Assistant
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowBalancingModal(false);
                  setBalancingCandidate(null);
                  setBalancingStatus(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {balancingStatus && (
                <div
                  className={`rounded border p-2.5 text-xs ${
                    balancingStatus.tone === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {balancingStatus.text}
                </div>
              )}

              {!balancingCandidate ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Progression Curve
                    </label>
                    <select
                      value={balancingCurve}
                      onChange={e => setBalancingCurve(e.target.value)}
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white cursor-pointer"
                    >
                      <option value="standard">Standard Curve (Smooth)</option>
                      <option value="fast">Fast Scaling (Aggressive growth)</option>
                      <option value="slow">Slow Scaling (Flat growth)</option>
                      <option value="hard">Hard Mode (Tough enemies, low gold)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Balancing Prompt
                    </label>
                    <textarea
                      rows={4}
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      value={balancingPrompt}
                      onChange={e => setBalancingPrompt(e.target.value)}
                      placeholder="Describe how you want to balance stats, exp, rewards, prices..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-gray-50 rounded border p-3 text-xs text-gray-600">
                  <h4 className="text-xs font-semibold text-gray-700 border-b pb-1.5">
                    Proposed Adjustments Review
                  </h4>
                  {balancingCandidate.adjustments.actors && balancingCandidate.adjustments.actors.length > 0 && (
                    <div>
                      <span className="font-semibold block mb-1">Actors ({balancingCandidate.adjustments.actors.length}):</span>
                      <ul className="list-disc list-inside bg-white p-2 rounded border space-y-1">
                        {balancingCandidate.adjustments.actors.map((adj: any) => (
                          <li key={adj.id} className="font-mono text-[10px]">
                            ID: {adj.id} - HP: {adj.changes.hp}, MP: {adj.changes.mp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {balancingCandidate.adjustments.enemies && balancingCandidate.adjustments.enemies.length > 0 && (
                    <div>
                      <span className="font-semibold block mb-1">Enemies ({balancingCandidate.adjustments.enemies.length}):</span>
                      <ul className="list-disc list-inside bg-white p-2 rounded border space-y-1">
                        {balancingCandidate.adjustments.enemies.map((adj: any) => (
                          <li key={adj.id} className="font-mono text-[10px]">
                            ID: {adj.id} - Gold: {adj.changes.gold}, EXP: {adj.changes.exp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {balancingCandidate.adjustments.items && balancingCandidate.adjustments.items.length > 0 && (
                    <div>
                      <span className="font-semibold block mb-1">Items ({balancingCandidate.adjustments.items.length}):</span>
                      <ul className="list-disc list-inside bg-white p-2 rounded border space-y-1">
                        {balancingCandidate.adjustments.items.map((adj: any) => (
                          <li key={adj.id} className="font-mono text-[10px]">
                            ID: {adj.id} - Price: {adj.changes.price}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="border-t pt-2 mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Provenance:</span>
                    <span className="text-gray-500 font-mono">
                      {balancingCandidate.provenance.providerId}/{balancingCandidate.provenance.modelId}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t pt-3 flex-shrink-0">
              {!balancingCandidate ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBalancingModal(false)}
                    className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={balancingGenerating || !balancingPrompt.trim()}
                    onClick={handleGenerateBalancing}
                    aria-label="Generate Adjustments"
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  >
                    {balancingGenerating ? 'Generating...' : 'Generate Adjustments'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setBalancingCandidate(null)}
                    className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptBalancing}
                    aria-label="Accept and Apply"
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    Accept and Apply
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
