import { useState, type ReactNode } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { NumberField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import { StatGrid } from './partyCombatFields';
import type { EnemyData, EnemyDrop, ItemData } from '../../types/project';
import { createMockProviderAdapter } from '../../providers/mockProviderAdapter';
import {
  generateEnemyDraftCandidate,
  validateEnemyCandidate,
  approveDbDraftCandidate,
} from '../../providers/dbDraftGenerationWorkflow';

interface EnemiesEditorProps {
  entry: EnemyData;
  items: ItemData[];
  idField: ReactNode;
  onChange(changes: Partial<EnemyData>): void;
}

export function EnemiesEditor({ entry, items, idField, onChange }: EnemiesEditorProps) {
  const itemOptions = items.map(item => ({ value: item.id, label: item.name || item.id }));
  const canAddDrop = itemOptions.length > 0;

  const [showGenModal, setShowGenModal] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [genStatus, setGenStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const openEnemyGeneration = () => {
    setGenPrompt('A scary shadow beast that lurks in deep dungeons, dropping rare gems and giving high EXP.');
    setCandidate(null);
    setGenStatus(null);
    setShowGenModal(true);
  };

  const handleGenerateEnemy = async () => {
    setGenerating(true);
    setGenStatus(null);
    setCandidate(null);
    try {
      const adapter = createMockProviderAdapter();
      const context = { items };
      const result = await generateEnemyDraftCandidate(
        adapter,
        genPrompt,
        context,
        { enemyId: entry.id, enemyName: entry.name || entry.id },
        {
          requestId: `enemy-gen-${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
      );
      const validationErrors = validateEnemyCandidate(result, context);
      if (validationErrors.length > 0) {
        setGenStatus({ tone: 'error', text: `Validation failed: ${validationErrors[0]}` });
        return;
      }
      setCandidate(result);
      setGenStatus({ tone: 'success', text: 'Enemy draft generated successfully! Please review below.' });
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptEnemy = () => {
    if (!candidate) return;
    try {
      const context = { items };
      const approved = approveDbDraftCandidate('enemy', candidate, context, {
        reviewedAt: new Date().toISOString(),
      });
      onChange(approved.enemy);
      setShowGenModal(false);
      setCandidate(null);
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    }
  };

  const setDrop = (index: number, changes: Partial<EnemyDrop>) => {
    onChange({
      drops: entry.drops.map((drop, i) => (
        i === index ? { ...drop, ...changes } : drop
      )),
    });
  };

  const addDrop = () => {
    const firstItem = items[0]?.id;
    if (!firstItem) return;
    onChange({ drops: [...entry.drops, { itemId: firstItem, rate: 1 }] });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {idField}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <TextField label="Name" value={entry.name} onChange={name => onChange({ name })} />
        </div>
        <button
          type="button"
          onClick={openEnemyGeneration}
          aria-label="Generate enemy draft"
          title="Generate enemy draft"
          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-md flex items-center justify-center cursor-pointer mb-[1px]"
        >
          <Sparkles size={14} />
        </button>
      </div>
      <div>
        <p className="mb-2 text-[12px] font-medium text-gray-500">Enemy stats</p>
        <StatGrid labelPrefix="Enemy" stats={entry.stats} onChange={stats => onChange({ stats })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Exp reward" value={entry.exp} min={0} onChange={exp => onChange({ exp })} />
        <NumberField label="Gold reward" value={entry.gold} min={0} onChange={gold => onChange({ gold })} />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-gray-500">Drops</p>
          <Button
            size="sm"
            aria-label="Add drop"
            icon={<Plus size={12} />}
            onClick={addDrop}
            disabled={!canAddDrop}
            title={canAddDrop ? 'Add drop' : 'Create an item before adding drops.'}
          >
            Add
          </Button>
        </div>
        {entry.drops.length === 0 ? (
          <div className="mt-2 rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-500">
            {canAddDrop ? 'No drops configured.' : 'Create an item before adding drops.'}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {entry.drops.map((drop, index) => (
              <div key={index} className="grid grid-cols-[1fr_100px_auto] gap-2 items-end">
                <ReferenceSelect
                  label={`Drop item ${index + 1}`}
                  value={drop.itemId}
                  options={itemOptions}
                  emptyLabel="(missing item)"
                  onChange={itemId => setDrop(index, { itemId })}
                />
                <NumberField
                  label={`Drop chance ${index + 1}`}
                  value={drop.rate}
                  min={0}
                  max={1}
                  step="0.01"
                  onChange={rate => setDrop(index, { rate })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove drop ${index + 1}`}
                  icon={<Trash2 size={12} />}
                  onClick={() => onChange({ drops: entry.drops.filter((_, i) => i !== index) })}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl flex flex-col max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-500" />
                Generate Enemy Draft
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
                      Enemy Prompt
                    </label>
                    <textarea
                      rows={4}
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      value={genPrompt}
                      onChange={e => setGenPrompt(e.target.value)}
                      placeholder="Describe the enemy character concepts and attributes..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-gray-50 rounded border p-3 text-xs text-gray-600">
                  <h4 className="text-xs font-semibold text-gray-700 border-b pb-1.5">
                    Candidate Review Details
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-semibold">Name:</span> {candidate.enemy.name}</div>
                    <div><span className="font-semibold">Exp Reward:</span> {candidate.enemy.exp}</div>
                    <div><span className="font-semibold">Gold Reward:</span> {candidate.enemy.gold}</div>
                  </div>
                  <div>
                    <span className="font-semibold block mb-1">Stats:</span>
                    <pre className="p-2 bg-white rounded border text-[10px] font-mono">
                      {JSON.stringify(candidate.enemy.stats, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="font-semibold block mb-1">Drops ({candidate.enemy.drops.length}):</span>
                    <ul className="list-disc list-inside bg-white p-2 rounded border space-y-1">
                      {candidate.enemy.drops.map((drop: any, idx: number) => (
                        <li key={idx} className="font-mono text-[10px]">
                          Item: {drop.itemId} (Chance: {drop.rate})
                        </li>
                      ))}
                    </ul>
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
                    disabled={generating || !genPrompt.trim()}
                    onClick={handleGenerateEnemy}
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
                    onClick={handleAcceptEnemy}
                    aria-label="Accept and Insert"
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
