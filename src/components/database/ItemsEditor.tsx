import { useMemo, useState } from 'react';
import { Copy, Plus, Trash2, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import {
  IdField,
  NumberField,
  TextareaField,
  TextField,
} from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import { ItemIconGenerationPanel } from './ItemIconGenerationPanel';
import {
  FALLBACK_EQUIPMENT_SLOTS,
  FALLBACK_ITEM_CATEGORIES,
  namedTypeOptions,
} from './databaseOptions';
import { STAT_FIELDS, STAT_LABELS } from './partyCombatFields';
import type {
  EquipmentSlot,
  AssetCatalogEntry,
  ItemData,
  ItemDatabase,
  Stats,
  TypesDatabaseData,
} from '../../types/project';
import type { ItemIconGenerationRunner } from '../../providers/itemIconGenerationWorkflow';
import { createMockProviderAdapter } from '../../providers/mockProviderAdapter';
import {
  generateItemDraftCandidate,
  validateItemCandidate,
  approveDbDraftCandidate,
} from '../../providers/dbDraftGenerationWorkflow';

interface ItemsEditorProps {
  value: ItemDatabase;
  types: TypesDatabaseData;
  assets?: AssetCatalogEntry[];
  iconGenerator?: ItemIconGenerationRunner;
  referenceSources?: Record<string, string[]>;
  onAssetImported?(asset: AssetCatalogEntry): void;
  onChange(value: ItemDatabase): void;
}

function uniqueItemId(base: string, items: ItemData[]): string {
  const cleanBase = base.trim() || 'item';
  const ids = new Set(items.map(item => item.id));
  if (!ids.has(cleanBase)) return cleanBase;
  let suffix = 2;
  while (ids.has(`${cleanBase}_${suffix}`)) suffix += 1;
  return `${cleanBase}_${suffix}`;
}

function createItem(items: ItemData[], category: string): ItemData {
  const id = uniqueItemId(`item_${items.length + 1}`, items);
  return {
    id,
    name: 'New Item',
    description: '',
    type: category,
    price: 0,
    effect: {},
    modifiers: {},
  };
}

export function ItemsEditor({
  value,
  types,
  assets = [],
  iconGenerator,
  referenceSources = {},
  onAssetImported,
  onChange,
}: ItemsEditorProps) {
  const [selectedId, setSelectedId] = useState(value.items[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const categoryOptions = namedTypeOptions(types.itemCategories, FALLBACK_ITEM_CATEGORIES);
  const slotOptions = namedTypeOptions(types.equipmentSlots, FALLBACK_EQUIPMENT_SLOTS);
  const selected = value.items.find(item => item.id === selectedId) ?? value.items[0] ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(
    () => (
      normalizedQuery
        ? value.items.filter(item => `${item.id} ${item.name} ${item.description}`.toLowerCase().includes(normalizedQuery))
        : value.items
    ),
    [normalizedQuery, value.items],
  );
  const selectedHidden = Boolean(
    normalizedQuery &&
    selected &&
    !filteredItems.some(item => item.id === selected.id),
  );
  const iconAssetOptions = useMemo(
    () => assets
      .filter(asset => asset.kind === 'image' || asset.kind === 'generated')
      .map(asset => ({ value: asset.id, label: `${asset.name} (${asset.id})` })),
    [assets],
  );

  const [showGenModal, setShowGenModal] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [genStatus, setGenStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const openItemGeneration = () => {
    setGenPrompt('A powerful fire sword that deals burning damage and increases attack.');
    setCandidate(null);
    setGenStatus(null);
    setShowGenModal(true);
  };

  const handleGenerateItem = async () => {
    setGenerating(true);
    setGenStatus(null);
    setCandidate(null);
    try {
      if (!selected) return;
      const adapter = createMockProviderAdapter();
      const context = {
        categories: categoryOptions.map(opt => opt.value),
        slots: slotOptions.map(opt => opt.value),
      };
      const result = await generateItemDraftCandidate(
        adapter,
        genPrompt,
        context,
        { itemId: selected.id, itemName: selected.name || selected.id },
        {
          requestId: `item-gen-${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
      );
      const validationErrors = validateItemCandidate(result, context);
      if (validationErrors.length > 0) {
        setGenStatus({ tone: 'error', text: `Validation failed: ${validationErrors[0]}` });
        return;
      }
      setCandidate(result);
      setGenStatus({ tone: 'success', text: 'Item draft generated successfully! Please review below.' });
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptItem = () => {
    if (!candidate) return;
    try {
      const context = {
        categories: categoryOptions.map(opt => opt.value),
        slots: slotOptions.map(opt => opt.value),
      };
      const approved = approveDbDraftCandidate('item', candidate, context, {
        reviewedAt: new Date().toISOString(),
      });
      updateSelected(approved.item);
      setShowGenModal(false);
      setCandidate(null);
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    }
  };

  const replaceItems = (items: ItemData[]) => onChange({ items });
  const updateSelected = (changes: Partial<ItemData>) => {
    if (!selected) return;
    replaceItems(value.items.map(item => (
      item.id === selected.id ? { ...item, ...changes } : item
    )));
  };

  const addItem = () => {
    const item = createItem(value.items, categoryOptions[0]?.value ?? 'consumable');
    replaceItems([...value.items, item]);
    setSelectedId(item.id);
  };

  const duplicateItem = () => {
    if (!selected) return;
    const clone = {
      ...selected,
      id: uniqueItemId(`${selected.id}_copy`, value.items),
      name: `${selected.name} Copy`,
    };
    replaceItems([...value.items, clone]);
    setSelectedId(clone.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    const refs = referenceSources[selected.id] ?? [];
    if (refs.length > 0) {
      const listed = refs.slice(0, 8).map(source => `- ${source}`).join('\n');
      const remaining = refs.length > 8 ? `\n...and ${refs.length - 8} more.` : '';
      alert(`Cannot delete item "${selected.id}" because it is still referenced:\n${listed}${remaining}`);
      return;
    }
    if (!confirm(`Delete item "${selected.id}"?`)) return;
    const next = value.items.filter(item => item.id !== selected.id);
    replaceItems(next);
    setSelectedId(next[0]?.id ?? '');
  };

  const updateEffect = (key: 'hp' | 'mp', amount: number) => {
    const effect = selected?.effect ?? {};
    updateSelected({
      effect: {
        hp: effect.hp,
        mp: effect.mp,
        [key]: amount,
      },
    });
  };

  const updateModifier = (key: keyof Stats, amount: number) => {
    updateSelected({
      modifiers: {
        ...(selected?.modifiers ?? {}),
        [key]: amount,
      },
    });
  };

  return (
    <div className="grid grid-cols-[minmax(180px,240px)_minmax(320px,1fr)] gap-4 max-w-5xl">
      <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
        <div className="flex items-center justify-between gap-2 px-2 py-2 border-b border-gray-100">
          <span className="text-[12px] font-semibold text-gray-600">Items</span>
          <Button size="sm" icon={<Plus size={12} />} onClick={addItem} aria-label="Add item">
            Add
          </Button>
        </div>
        <div className="space-y-2 border-b border-gray-100 p-2">
          <input
            aria-label="Search items"
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Search items..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
            <span>Showing {filteredItems.length} of {value.items.length} items</span>
            {normalizedQuery && (
              <button
                type="button"
                aria-label="Clear item search"
                className="inline-flex h-6 items-center rounded px-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                onClick={() => setQuery('')}
              >
                Clear
              </button>
            )}
          </div>
          {selectedHidden && selected && (
            <div className="rounded border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              Selected {selected.id} is hidden by this filter.
            </div>
          )}
        </div>
        <div className="max-h-[520px] overflow-auto">
          {value.items.length === 0 ? (
            <div className="p-3">
              <EmptyState
                compact
                title="No items yet"
                detail="Use Add to define consumables, key items, and equipment references for events and shops."
              />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-3">
              <EmptyState
                compact
                title={`No items match "${query.trim()}"`}
                detail="Clear the search or add a new item."
              />
            </div>
          ) : (
            filteredItems.map(item => {
              const refCount = referenceSources[item.id]?.length ?? 0;
              return (
              <button
                key={item.id}
                type="button"
                aria-label={`Select item ${item.id}`}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left px-3 py-2 border-b border-gray-100 transition-colors ${
                  selected?.id === item.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="block min-w-0 flex-1 truncate text-[13px] font-medium">{item.name || item.id}</span>
                  {refCount > 0 && (
                    <span className="flex-shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      {refCount} ref{refCount === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
                <span className="block text-[11px] font-mono text-gray-400 truncate">{item.id}</span>
              </button>
            );
            })
          )}
        </div>
      </div>

      {selected ? (
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" icon={<Copy size={12} />} onClick={duplicateItem}>
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={12} />}
              aria-label={
                (referenceSources[selected.id]?.length ?? 0) > 0
                  ? `Delete item ${selected.id} blocked by ${referenceSources[selected.id].length} reference${referenceSources[selected.id].length === 1 ? '' : 's'}`
                  : `Delete item ${selected.id}`
              }
              onClick={removeSelected}
            >
              Delete
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <IdField label="Item ID" value={selected.id} onChange={id => updateSelected({ id })} />
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <TextField label="Item name" value={selected.name} onChange={name => updateSelected({ name })} />
              </div>
              <button
                type="button"
                onClick={openItemGeneration}
                aria-label="Generate item draft"
                title="Generate item draft"
                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-md flex items-center justify-center cursor-pointer mb-[1px]"
              >
                <Sparkles size={14} />
              </button>
            </div>
          </div>
          <TextareaField
            label="Description"
            value={selected.description}
            onChange={description => updateSelected({ description })}
          />
          <ReferenceSelect
            label="Item icon asset"
            value={selected.iconAssetId ?? ''}
            options={iconAssetOptions}
            emptyLabel="(none)"
            onChange={iconAssetId => updateSelected({ iconAssetId: iconAssetId || undefined })}
          />
          <ItemIconGenerationPanel
            ownerKind="item"
            ownerId={selected.id}
            ownerName={selected.name}
            description={selected.description}
            category={selected.type}
            assets={assets}
            iconGenerator={iconGenerator}
            onAssetAccepted={(asset, iconAssetId) => {
              onAssetImported?.(asset);
              updateSelected({ iconAssetId });
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <ReferenceSelect
              label="Item category"
              value={selected.type}
              options={categoryOptions}
              onChange={type => updateSelected({ type })}
            />
            <NumberField
              label="Item price"
              value={selected.price ?? 0}
              min={0}
              onChange={price => updateSelected({ price })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="HP effect"
              value={selected.effect?.hp ?? 0}
              onChange={amount => updateEffect('hp', amount)}
            />
            <NumberField
              label="MP effect"
              value={selected.effect?.mp ?? 0}
              onChange={amount => updateEffect('mp', amount)}
            />
          </div>
          <ReferenceSelect
            label="Equipment slot"
            value={selected.slot ?? ''}
            options={slotOptions}
            emptyLabel="(none)"
            onChange={slot => updateSelected({ slot: (slot || undefined) as EquipmentSlot | undefined })}
          />
          <div>
            <p className="mb-2 text-[12px] font-medium text-gray-500">Stat modifiers</p>
            <div className="grid grid-cols-2 gap-3">
              {STAT_FIELDS.map(field => (
                <NumberField
                  key={field}
                  label={`Item modifier ${STAT_LABELS[field]}`}
                  value={selected.modifiers?.[field] ?? 0}
                  onChange={amount => updateModifier(field, amount)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No item selected"
          detail="Add an item from the list to edit category, price, effects, and equipment modifiers."
        />
      )}

      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl flex flex-col max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-500" />
                Generate Item Draft
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
                      Item Prompt
                    </label>
                    <textarea
                      rows={4}
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      value={genPrompt}
                      onChange={e => setGenPrompt(e.target.value)}
                      placeholder="Describe the item concepts and attributes..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-gray-50 rounded border p-3 text-xs text-gray-600">
                  <h4 className="text-xs font-semibold text-gray-700 border-b pb-1.5">
                    Candidate Review Details
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-semibold">Name:</span> {candidate.item.name}</div>
                    <div><span className="font-semibold">Category:</span> {candidate.item.type}</div>
                    <div><span className="font-semibold">Price:</span> {candidate.item.price}</div>
                  </div>
                  <div>
                    <span className="font-semibold block mb-1">Description:</span>
                    <p className="p-2 bg-white rounded border text-xs">{candidate.item.description}</p>
                  </div>
                  <div>
                    <span className="font-semibold block mb-1">Effects:</span>
                    <pre className="p-2 bg-white rounded border text-[10px] font-mono">
                      {JSON.stringify(candidate.item.effect, null, 2)}
                    </pre>
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
                    onClick={handleGenerateItem}
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
                    onClick={handleAcceptItem}
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
