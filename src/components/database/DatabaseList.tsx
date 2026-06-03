import { useMemo, useState } from 'react';
import { Copy, Plus, Trash2, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { useProjectStore, type DatabaseRecord } from '../../stores/projectStore';
import { findReferences, listReferences } from '../../validation/referenceIndex';
import type { DatabaseListKey, Stats } from '../../types/project';
import { createMockProviderAdapter } from '../../providers/mockProviderAdapter';
import {
  generateQuestCandidate,
  validateQuestCandidate,
  approveQuestCandidate,
} from '../../providers/questGenerationWorkflow';

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
  const [query, setQuery] = useState('');
  const ids = useMemo(() => new Set(entries.map(entry => entry.id)), [entries]);
  const copy = tableCopy[table];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = useMemo(
    () => (
      normalizedQuery
        ? entries.filter(entry => `${entry.id} ${entryLabel(entry)}`.toLowerCase().includes(normalizedQuery))
        : entries
    ),
    [entries, normalizedQuery],
  );
  const referenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const project = {
      project: state.project,
      maps: state.maps,
      items: state.items,
      databases: state.databases,
    };
    for (const ref of listReferences(project)) {
      if (ref.table === table) counts[ref.id] = (counts[ref.id] ?? 0) + 1;
    }
    return counts;
  }, [state.databases, state.items, state.maps, state.project, table]);
  const selectedHidden = Boolean(
    normalizedQuery &&
    selectedId &&
    entries.some(entry => entry.id === selectedId) &&
    !filteredEntries.some(entry => entry.id === selectedId),
  );

  const [showGenModal, setShowGenModal] = useState(false);
  const [genTitle, setGenTitle] = useState('New Quest');
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [genStatus, setGenStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const openQuestGeneration = () => {
    setGenTitle(`Quest ${entries.length + 1}`);
    setGenPrompt('Help a townsperson recover their stolen heirloom from a nearby goblin cave.');
    setCandidate(null);
    setGenStatus(null);
    setShowGenModal(true);
  };

  const handleGenerateQuest = async () => {
    setGenerating(true);
    setGenStatus(null);
    setCandidate(null);
    try {
      const slugId = (title: string) => title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'quest';
      const questId = uniqueId(ids, slugId(genTitle));
      const adapter = createMockProviderAdapter();
      const context = {
        items: state.items.items,
      };
      const result = await generateQuestCandidate(
        adapter,
        context,
        {
          prompt: genPrompt,
          questId,
          questTitle: genTitle.trim(),
        },
        {
          requestId: `quest-gen-${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
      );
      const validationErrors = validateQuestCandidate(result, context);
      if (validationErrors.length > 0) {
        setGenStatus({ tone: 'error', text: `Validation failed: ${validationErrors[0]}` });
        return;
      }
      setCandidate(result);
      setGenStatus({ tone: 'success', text: 'Quest draft generated successfully! Please review below.' });
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptQuest = () => {
    if (!candidate) return;
    try {
      const context = {
        items: state.items.items,
      };
      const approved = approveQuestCandidate(candidate, context, {
        reviewedAt: new Date().toISOString(),
      });
      dispatch({
        type: 'ADD_DATABASE_ENTRY',
        table: 'quests',
        entry: approved.quest,
      });
      onSelect(approved.quest.id);
      setShowGenModal(false);
      setCandidate(null);
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    }
  };

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
      alert(`Cannot delete ${copy.singular} "${id}" because it is still referenced:\n${listed}${remaining}`);
      return;
    }
    if (!confirm(`Delete ${copy.singular} "${id}"?`)) return;
    dispatch({ type: 'REMOVE_DATABASE_ENTRY', table, id });
    if (selectedId === id) {
      const next = entries.find(entry => entry.id !== id);
      onSelect(next ? next.id : '');
    }
  };

  return (
    <div className="w-[260px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-3 border-b border-gray-200 space-y-2">
        <div className="flex gap-1.5">
          <Button size="sm" icon={<Plus size={12} />} onClick={addEntry}>
            New {copy.singular}
          </Button>
          {table === 'quests' && (
            <button
              type="button"
              onClick={openQuestGeneration}
              aria-label="Generate quest draft"
              title="Generate quest draft"
              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded flex items-center justify-center cursor-pointer"
            >
              <Sparkles size={14} />
            </button>
          )}
        </div>
        <input
          aria-label={`Search ${copy.plural}`}
          className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder={`Search ${copy.plural}...`}
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
          <span>
            Showing {filteredEntries.length} of {entries.length} {copy.plural}
          </span>
          {normalizedQuery && (
            <button
              type="button"
              aria-label={`Clear ${copy.singular} search`}
              className="inline-flex h-6 items-center rounded px-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
              onClick={() => setQuery('')}
            >
              Clear
            </button>
          )}
        </div>
        {selectedHidden && (
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
            Selected {selectedId} is hidden by this filter.
          </div>
        )}
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
        ) : filteredEntries.length === 0 ? (
          <div className="p-3">
            <EmptyState
              compact
              title={`No ${copy.plural} match "${query.trim()}"`}
              detail={`Clear the search or create a new ${copy.singular}.`}
            />
          </div>
        ) : (
          filteredEntries.map(entry => {
            const referenceCount = referenceCounts[entry.id] ?? 0;
            const referenceLabel = `${referenceCount} reference${referenceCount === 1 ? '' : 's'}`;
            return (
            <div
              key={entry.id}
              className={`flex items-center gap-1 px-2 py-1.5 hover:bg-gray-50 ${
                selectedId === entry.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
              }`}
            >
              <button
                type="button"
                aria-label={`Select ${copy.singular} ${entry.id}`}
                className="min-w-0 flex-1 flex items-center gap-1.5 text-left cursor-pointer"
                onClick={() => onSelect(entry.id)}
              >
                <span className="truncate text-[13px] flex-1" title={entry.id}>
                  {entryLabel(entry)}
                </span>
                {referenceCount > 0 && (
                  <span
                    aria-label={referenceLabel}
                    className="flex-shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                  >
                    {referenceCount} ref{referenceCount === 1 ? '' : 's'}
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-label={`Duplicate ${copy.singular} ${entry.id}`}
                title={`Duplicate ${copy.singular}`}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer"
                onClick={event => {
                  event.stopPropagation();
                  duplicateEntry(entry.id);
                }}
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                aria-label={
                  referenceCount > 0
                    ? `Delete ${copy.singular} ${entry.id} blocked by ${referenceLabel}`
                    : `Delete ${copy.singular} ${entry.id}`
                }
                title={referenceCount > 0 ? `Referenced by ${referenceLabel}` : `Delete ${copy.singular}`}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 cursor-pointer"
                onClick={event => {
                  event.stopPropagation();
                  removeEntry(entry.id);
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
          })
        )}
      </div>
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl flex flex-col max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-500" />
                Generate Quest Draft
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowGenModal(false);
                  setCandidate(null);
                  setGenStatus(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {genStatus && (
                <div
                  className={`rounded border p-2.5 text-xs ${
                    genStatus.tone === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {genStatus.text}
                </div>
              )}

              {!candidate ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Quest Title
                    </label>
                    <input
                      type="text"
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={genTitle}
                      onChange={e => setGenTitle(e.target.value)}
                      placeholder="e.g. Stolen Heirloom"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      AI Prompt
                    </label>
                    <textarea
                      rows={4}
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      value={genPrompt}
                      onChange={e => setGenPrompt(e.target.value)}
                      placeholder="Describe the quest plot, objectives, and reward expectations..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-gray-50 rounded border p-3">
                  <h4 className="text-xs font-semibold text-gray-700 border-b pb-1.5">
                    Candidate Review Details
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                    <div>
                      <span className="text-gray-400">Quest ID:</span>{' '}
                      <span className="font-mono text-gray-800 font-semibold">{candidate.quest.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Quest Title:</span>{' '}
                      <span className="text-gray-800 font-semibold">{candidate.quest.title}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[11px] font-medium">Summary:</span>
                    <p className="text-[11px] text-gray-600 bg-white border rounded p-1.5 mt-0.5">
                      {candidate.quest.summary}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 block mb-1">
                      Objectives ({candidate.quest.objectives.length})
                    </span>
                    <ul className="text-[11px] text-gray-600 list-disc list-inside max-h-[100px] overflow-y-auto bg-white border rounded p-1.5 space-y-1">
                      {candidate.quest.objectives.map((obj: any) => (
                        <li key={obj.id}>
                          <span className="font-mono font-semibold text-gray-800">{obj.id}</span>: {obj.description}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 block mb-1">
                      Rewards
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-white border rounded p-1.5">
                      <div>
                        <span className="text-gray-400">Gold:</span>{' '}
                        <span className="text-gray-800 font-semibold">{candidate.quest.rewards.gold}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Exp:</span>{' '}
                        <span className="text-gray-800 font-semibold">{candidate.quest.rewards.exp}</span>
                      </div>
                      <div className="col-span-2 border-t pt-1 mt-1">
                        <span className="text-gray-400">Items:</span>{' '}
                        {candidate.quest.rewards.items.length === 0 ? (
                          <span className="text-gray-500 italic">None</span>
                        ) : (
                          <span className="text-gray-800 font-semibold">
                            {candidate.quest.rewards.items.map((item: any) => {
                              const found = state.items.items.find(i => i.id === item.itemId);
                              return `${found?.name ?? item.itemId} x${item.amount}`;
                            }).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-2 mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Provenance:</span>
                    <span className="text-gray-500 font-mono">
                      {candidate.provenance.providerId}/{candidate.provenance.modelId}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t pt-3 flex-shrink-0">
              {!candidate ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowGenModal(false)}
                    className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={generating || !genTitle.trim() || !genPrompt.trim()}
                    onClick={handleGenerateQuest}
                    aria-label="Generate Draft"
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  >
                    {generating ? 'Generating...' : 'Generate Draft'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setCandidate(null)}
                    className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptQuest}
                    aria-label="Accept and Insert"
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    Accept & Insert
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
