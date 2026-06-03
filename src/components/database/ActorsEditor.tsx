import { useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { NumberField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import { PortraitGenerationPanel } from './PortraitGenerationPanel';
import { CharacterConceptGenerationPanel } from './CharacterConceptGenerationPanel';
import { ReferenceChecklist, StatGrid } from './partyCombatFields';
import type { ActorData, AssetCatalogEntry, ClassData, EquipmentSlot, ItemData, SkillData } from '../../types/project';
import type { PortraitGenerationRunner } from '../../providers/portraitGenerationWorkflow';
import type { CharacterConceptGenerationRunner } from '../../providers/characterConceptGenerationWorkflow';
import { createMockProviderAdapter } from '../../providers/mockProviderAdapter';
import {
  generateActorDraftCandidate,
  validateActorCandidate,
  approveDbDraftCandidate,
} from '../../providers/dbDraftGenerationWorkflow';

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

  const [showGenModal, setShowGenModal] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [genStatus, setGenStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const openActorGeneration = () => {
    setGenPrompt('A wise elder mage who specializes in healing spells and high magic defense.');
    setCandidate(null);
    setGenStatus(null);
    setShowGenModal(true);
  };

  const handleGenerateActor = async () => {
    setGenerating(true);
    setGenStatus(null);
    setCandidate(null);
    try {
      const adapter = createMockProviderAdapter();
      const context = { classes };
      const result = await generateActorDraftCandidate(
        adapter,
        genPrompt,
        context,
        { actorId: entry.id, actorName: entry.name || entry.id },
        {
          requestId: `actor-gen-${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
      );
      const validationErrors = validateActorCandidate(result, context);
      if (validationErrors.length > 0) {
        setGenStatus({ tone: 'error', text: `Validation failed: ${validationErrors[0]}` });
        return;
      }
      setCandidate(result);
      setGenStatus({ tone: 'success', text: 'Actor draft generated successfully! Please review below.' });
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptActor = () => {
    if (!candidate) return;
    try {
      const context = { classes };
      const approved = approveDbDraftCandidate('actor', candidate, context, {
        reviewedAt: new Date().toISOString(),
      });
      onChange(approved.actor);
      setShowGenModal(false);
      setCandidate(null);
    } catch (e) {
      setGenStatus({ tone: 'error', text: (e as Error).message });
    }
  };

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
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <TextField label="Name" value={entry.name} onChange={name => onChange({ name })} />
        </div>
        <button
          type="button"
          onClick={openActorGeneration}
          aria-label="Generate actor draft"
          title="Generate actor draft"
          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-md flex items-center justify-center cursor-pointer mb-[1px]"
        >
          <Sparkles size={14} />
        </button>
      </div>
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

      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl flex flex-col max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-500" />
                Generate Actor Draft
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
                      Actor Prompt
                    </label>
                    <textarea
                      rows={4}
                      className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      value={genPrompt}
                      onChange={e => setGenPrompt(e.target.value)}
                      placeholder="Describe the actor character concepts and attributes..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-gray-50 rounded border p-3 text-xs text-gray-600">
                  <h4 className="text-xs font-semibold text-gray-700 border-b pb-1.5">
                    Candidate Review Details
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-semibold">Name:</span> {candidate.actor.name}</div>
                    <div><span className="font-semibold">Class ID:</span> {candidate.actor.classId}</div>
                    <div><span className="font-semibold">Level:</span> {candidate.actor.level}</div>
                    <div><span className="font-semibold">HP / MP:</span> {candidate.actor.hp} / {candidate.actor.mp}</div>
                  </div>
                  <div>
                    <span className="font-semibold block mb-1">Stats:</span>
                    <pre className="p-2 bg-white rounded border text-[10px] font-mono">
                      {JSON.stringify(candidate.actor.baseStats, null, 2)}
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
                    onClick={handleGenerateActor}
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
                    onClick={handleAcceptActor}
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
