import { NumberField, SelectField, TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import { splitIds } from './partyCombatFields';
import type { ActorData, AnimationSetData, MovementSpeed, SystemData } from '../../types/project';

interface SystemEditorProps {
  system: SystemData;
  actors: ActorData[];
  animations: AnimationSetData[];
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

export function SystemEditor({ system, actors, animations, onChange }: SystemEditorProps) {
  const animationOptions = animations.map(set => ({ value: set.id, label: set.id }));

  return (
    <div className="space-y-3 max-w-xl">
      <NumberField
        label="Starting gold"
        value={system.startingGold}
        min={0}
        onChange={startingGold => onChange({ startingGold })}
      />
      <TextField
        label="Starting party"
        value={system.startingParty.join(', ')}
        list="starting-party-options"
        onChange={value => onChange({ startingParty: splitIds(value) })}
      />
      <datalist id="starting-party-options">
        {actors.map(actor => (
          <option key={actor.id} value={actor.id}>
            {actor.name || actor.id}
          </option>
        ))}
      </datalist>
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
      <TextField
        label="Default BGM"
        value={system.defaultBgm ?? ''}
        onChange={defaultBgm => onChange({ defaultBgm: defaultBgm || undefined })}
      />
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
