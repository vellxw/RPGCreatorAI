import { useMemo } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { useProjectStore, type DatabaseRecord } from '../../stores/projectStore';
import { findReferences } from '../../validation/referenceIndex';
import type { DatabaseListKey, Stats } from '../../types/project';

interface DatabaseListProps {
  table: DatabaseListKey;
  entries: DatabaseRecord[];
  selectedId: string | null;
  onSelect(id: string): void;
}

function emptyStats(): Stats {
  return {
    maxHp: 1,
    maxMp: 0,
    attack: 1,
    defense: 1,
    magicAttack: 1,
    magicDefense: 1,
    agility: 1,
    luck: 1,
  };
}

function makePlaceholder(table: DatabaseListKey, id: string): DatabaseRecord {
  switch (table) {
    case 'actors':
      return {
        id,
        name: id,
        classId: '',
        level: 1,
        hp: 10,
        mp: 0,
        baseStats: emptyStats(),
        equipment: { weapon: null, armor: null, accessory: null },
        skills: [],
      } as unknown as DatabaseRecord;
    case 'classes':
      return {
        id,
        name: id,
        growth: emptyStats(),
        usableEquipment: ['weapon', 'armor', 'accessory'],
        learnedSkills: [],
      } as unknown as DatabaseRecord;
    case 'skills':
      return {
        id,
        name: id,
        description: '',
        mpCost: 0,
        power: 100,
        target: 'singleEnemy',
      } as unknown as DatabaseRecord;
    case 'weapons':
      return {
        id,
        name: id,
        description: '',
        weaponTypeId: 'sword',
        price: 0,
        params: {},
        animationId: '',
        traits: [],
      } as unknown as DatabaseRecord;
    case 'armors':
      return {
        id,
        name: id,
        description: '',
        armorTypeId: 'light',
        slot: 'body',
        price: 0,
        params: {},
        traits: [],
      } as unknown as DatabaseRecord;
    case 'states':
      return {
        id,
        name: id,
        priority: 50,
        removeAtBattleEnd: false,
        restriction: 'none',
        traits: [],
      } as unknown as DatabaseRecord;
    case 'enemies':
      return {
        id,
        name: id,
        stats: emptyStats(),
        exp: 1,
        gold: 1,
        drops: [],
      } as unknown as DatabaseRecord;
    case 'troops':
      return { id, name: id, members: [] } as unknown as DatabaseRecord;
    case 'quests':
      return {
        id,
        title: id,
        summary: '',
        objectives: [],
        rewards: { gold: 0, exp: 0, items: [] },
      } as unknown as DatabaseRecord;
    case 'shops':
      return { id, name: id, listings: [] } as unknown as DatabaseRecord;
    case 'switches':
      return { id, name: id, initial: false } as unknown as DatabaseRecord;
    case 'variables':
      return { id, name: id, initial: 0 } as unknown as DatabaseRecord;
    case 'commonEvents':
      return { id, name: id, trigger: 'manual', switchId: '', commands: [] } as unknown as DatabaseRecord;
  }
}

function uniqueId(existing: Set<string>, base: string): string {
  let id = base;
  let i = 1;
  while (existing.has(id)) {
    i += 1;
    id = `${base}_${i}`;
  }
  return id;
}

function entryLabel(entry: DatabaseRecord): string {
  return (
    (entry as { name?: string }).name ??
    (entry as { title?: string }).title ??
    entry.id
  );
}

const tableCopy: Record<DatabaseListKey, { singular: string; plural: string; purpose: string }> = {
  actors: { singular: 'actor', plural: 'actors', purpose: 'actor record' },
  classes: { singular: 'class', plural: 'classes', purpose: 'actor class data' },
  skills: { singular: 'skill', plural: 'skills', purpose: 'battle and event skills' },
  weapons: { singular: 'weapon', plural: 'weapons', purpose: 'equipment records' },
  armors: { singular: 'armor', plural: 'armors', purpose: 'equipment records' },
  states: { singular: 'state', plural: 'states', purpose: 'battle status effects' },
  enemies: { singular: 'enemy', plural: 'enemies', purpose: 'battle encounters' },
  troops: { singular: 'troop', plural: 'troops', purpose: 'enemy groups' },
  quests: { singular: 'quest', plural: 'quests', purpose: 'quest journal entries' },
  shops: { singular: 'shop', plural: 'shops', purpose: 'shop inventory data' },
  switches: { singular: 'switch', plural: 'switches', purpose: 'event conditions' },
  variables: { singular: 'variable', plural: 'variables', purpose: 'numeric event state' },
  commonEvents: { singular: 'common event', plural: 'common events', purpose: 'reusable event command stacks' },
};

export function DatabaseList({ table, entries, selectedId, onSelect }: DatabaseListProps) {
  const { state, dispatch } = useProjectStore();
  const ids = useMemo(() => new Set(entries.map(entry => entry.id)), [entries]);
  const copy = tableCopy[table];

  const addEntry = () => {
    const baseId = `${table.replace(/s$/, '')}_${entries.length + 1}`;
    const id = uniqueId(ids, baseId);
    const entry = makePlaceholder(table, id);
    dispatch({ type: 'ADD_DATABASE_ENTRY', table, entry });
    onSelect(id);
  };

  const duplicateEntry = (sourceId: string) => {
    const source = entries.find(entry => entry.id === sourceId);
    if (!source) return;
    const newId = uniqueId(ids, `${sourceId}_copy`);
    const next: DatabaseRecord = JSON.parse(JSON.stringify(source));
    next.id = newId;
    dispatch({ type: 'ADD_DATABASE_ENTRY', table, entry: next });
    onSelect(newId);
  };

  const removeEntry = (id: string) => {
    const refs = findReferences({
      project: state.project,
      maps: state.maps,
      items: state.items,
      databases: state.databases,
    }, { table, id });
    if (refs.length > 0) {
      const listed = refs.slice(0, 8).map(ref => `- ${ref.source}`).join('\n');
      const remaining = refs.length > 8 ? `\n...and ${refs.length - 8} more.` : '';
      alert(`Cannot delete ${table.slice(0, -1)} "${id}" because it is still referenced:\n${listed}${remaining}`);
      return;
    }
    if (!confirm(`Delete ${table.slice(0, -1)} "${id}"?`)) return;
    dispatch({ type: 'REMOVE_DATABASE_ENTRY', table, id });
    if (selectedId === id) {
      const next = entries.find(entry => entry.id !== id);
      onSelect(next ? next.id : '');
    }
  };

  return (
    <div className="w-[220px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <Button size="sm" icon={<Plus size={12} />} onClick={addEntry}>
          New {table.slice(0, -1)}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="p-3">
            <EmptyState
              compact
              title={`No ${copy.plural} yet`}
              detail={`Use New ${copy.singular} to define the first ${copy.purpose}.`}
            />
          </div>
        ) : (
          entries.map(entry => (
            <div
              key={entry.id}
              className={`flex items-center gap-1 px-3 py-1.5 cursor-pointer hover:bg-gray-50 ${
                selectedId === entry.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
              }`}
              onClick={() => onSelect(entry.id)}
            >
              <span className="truncate text-[13px] flex-1" title={entry.id}>
                {entryLabel(entry)}
              </span>
              <button
                type="button"
                title="Duplicate"
                className="text-gray-400 hover:text-indigo-600 cursor-pointer"
                onClick={event => {
                  event.stopPropagation();
                  duplicateEntry(entry.id);
                }}
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                title="Delete"
                className="text-gray-400 hover:text-red-500 cursor-pointer"
                onClick={event => {
                  event.stopPropagation();
                  removeEntry(entry.id);
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
