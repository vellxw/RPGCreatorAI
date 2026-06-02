import { NumberField, SelectField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import type { ActorData, AnimationSetData, MovementSpeed, SystemData, TermsDatabaseData } from '../../types/project';
import { audioOptions } from '../../audio/audioRegistry';

interface SystemEditorProps {
  system: SystemData;
  actors: ActorData[];
  animations: AnimationSetData[];
  terms?: TermsDatabaseData;
  onChange(changes: Partial<SystemData>): void;
}

const MOVEMENT_SPEED_OPTIONS: Array<{ value: MovementSpeed; label: string }> = [
  { value: 'oneEighth', label: '1/8 speed' },
  { value: 'oneQuarter', label: '1/4 speed' },
  { value: 'half', label: 'Half speed' },
  { value: 'normal', label: 'Normal (250 ms/tile)' },
  { value: 'double', label: 'Double (125 ms/tile)' },
  { value: 'quadruple', label: 'Quadruple' },
];

export function SystemEditor({ system, actors, animations, terms, onChange }: SystemEditorProps) {
  const animationOptions = animations.map(set => ({ value: set.id, label: set.id }));
  const actorOptions = actors.map(actor => ({ value: actor.id, label: actor.name || actor.id }));
  const registry = system.audio ?? {};
  const audioEntries = Object.entries(registry);
  const bgmOptions = audioOptions(registry);
  const currencyUnit = terms?.currencyUnit?.trim();
  const startingGoldLabel = currencyUnit ? `Starting gold (${currencyUnit})` : 'Starting gold';
  if (system.defaultBgm && !bgmOptions.some(option => option.value === system.defaultBgm)) {
    bgmOptions.push({ value: system.defaultBgm, label: `${system.defaultBgm} (unknown)` });
  }

  const setStartingPartyActor = (index: number, actorId: string) => {
    const next = system.startingParty.slice();
    next[index] = actorId;
    onChange({ startingParty: next.filter(id => id.trim() !== '') });
  };

  const addStartingPartyActor = () => {
    const nextActor = actors.find(actor => !system.startingParty.includes(actor.id)) ?? actors[0];
    if (!nextActor) return;
    onChange({ startingParty: [...system.startingParty, nextActor.id] });
  };

  const commitAudioEntries = (entries: Array<[string, string]>) => {
    const audio = Object.fromEntries(
      entries
        .map(([id, path]) => [id.trim(), path.trim()] as [string, string])
        .filter(([id]) => id !== ''),
    );
    onChange({ audio });
  };

  return (
    <div className="space-y-3 max-w-xl">
      <NumberField
        label={startingGoldLabel}
        value={system.startingGold}
        min={0}
        onChange={startingGold => onChange({ startingGold })}
      />
      <div className="space-y-2 rounded-md border border-gray-200 p-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[12px] font-semibold text-gray-700">Starting party</div>
            {actors.length > 0 && system.startingParty.length === 0 && (
              <p className="text-[11px] text-amber-700">Starting party is empty while actors exist.</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Add starting party actor"
            disabled={actors.length === 0}
            className="h-8 px-2 text-[12px] rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            onClick={addStartingPartyActor}
          >
            Add actor
          </button>
        </div>
        {system.startingParty.length === 0 ? (
          <p className="text-[12px] text-gray-400">No starting actors selected.</p>
        ) : (
          <div className="space-y-2">
            {system.startingParty.map((actorId, index) => (
              <div key={`${actorId}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
                <ReferenceSelect
                  label={`Starting party actor ${index + 1}`}
                  value={actorId}
                  options={actorOptions}
                  onChange={nextActorId => setStartingPartyActor(index, nextActorId)}
                />
                <button
                  type="button"
                  aria-label={`Remove starting party actor ${index + 1}`}
                  className="h-8 px-2 text-[12px] rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                  onClick={() => onChange({ startingParty: system.startingParty.filter((_, i) => i !== index) })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <ReferenceSelect
        label="Player animation set"
        value={system.playerAnimationSet ?? ''}
        options={animationOptions}
        emptyLabel="(none)"
        onChange={playerAnimationSet => onChange({ playerAnimationSet: playerAnimationSet || undefined })}
      />
      <SelectField
        label="Player movement speed"
        value={system.playerMovementSpeed ?? 'double'}
        options={MOVEMENT_SPEED_OPTIONS}
        onChange={playerMovementSpeed => onChange({ playerMovementSpeed: playerMovementSpeed as MovementSpeed })}
      />
      <NumberField
        label="Default character height (tiles)"
        value={system.defaultCharacterHeightTiles ?? 1.5}
        min={0.1}
        step="0.1"
        onChange={defaultCharacterHeightTiles => onChange({ defaultCharacterHeightTiles })}
      />
      <SelectField
        label="Default BGM"
        value={system.defaultBgm ?? ''}
        options={[{ value: '', label: '(none)' }, ...bgmOptions]}
        onChange={defaultBgm => onChange({ defaultBgm: defaultBgm || undefined })}
      />
      <div className="space-y-2 rounded-md border border-gray-200 p-2">
        <div className="text-[12px] font-semibold text-gray-700">Audio registry</div>
        {(audioEntries.length > 0 ? audioEntries : [['', '']]).map(([id, path], index) => (
          <div key={`${id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-2 items-end">
            <TextField
              label={`Audio ID ${index + 1}`}
              value={id}
              onChange={nextId => {
                const next = audioEntries.slice();
                next[index] = [nextId, path];
                commitAudioEntries(next);
              }}
            />
            <TextField
              label={`Audio path ${index + 1}`}
              value={path}
              onChange={nextPath => {
                const next = audioEntries.slice();
                next[index] = [id, nextPath];
                commitAudioEntries(next);
              }}
            />
            <button
              type="button"
              aria-label={`Remove audio ${index + 1}`}
              className="h-8 px-2 text-[12px] rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => commitAudioEntries(audioEntries.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="h-8 px-2 text-[12px] rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
          onClick={() => commitAudioEntries([...audioEntries, [`audio_${audioEntries.length + 1}`, 'assets/audio/new.wav']])}
        >
          Add audio
        </button>
      </div>
      <TextField
        label="Window tint"
        value={system.windowTint ?? ''}
        onChange={windowTint => onChange({ windowTint: windowTint || undefined })}
      />
      <TextField
        label="Battle background"
        value={system.battleBackground ?? ''}
        onChange={battleBackground => onChange({ battleBackground: battleBackground || undefined })}
      />
    </div>
  );
}
