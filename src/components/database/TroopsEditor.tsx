import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { TextField } from './DatabaseFields';
import { ReferenceSelect } from './ReferenceSelect';
import type { EnemyData, TroopData } from '../../types/project';

interface TroopsEditorProps {
  entry: TroopData;
  enemies: EnemyData[];
  idField: ReactNode;
  onChange(changes: Partial<TroopData>): void;
}

export function TroopsEditor({ entry, enemies, idField, onChange }: TroopsEditorProps) {
  const enemyOptions = enemies.map(enemy => ({ value: enemy.id, label: enemy.name || enemy.id }));
  const setMember = (index: number, enemyId: string) => {
    onChange({ members: entry.members.map((member, i) => (i === index ? enemyId : member)) });
  };
  const moveMember = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= entry.members.length) return;
    const members = entry.members.slice();
    [members[index], members[target]] = [members[target], members[index]];
    onChange({ members });
  };

  return (
    <div className="space-y-4 max-w-xl">
      {idField}
      <TextField label="Name" value={entry.name} onChange={name => onChange({ name })} />
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-gray-500">Members</p>
          <Button
            size="sm"
            icon={<Plus size={12} />}
            onClick={() => onChange({ members: [...entry.members, enemies[0]?.id ?? ''] })}
          >
            Add
          </Button>
        </div>
        {entry.members.length === 0 ? (
          <p className="mt-2 text-[12px] text-amber-600">Empty troops cannot start a meaningful battle.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {entry.members.map((memberId, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <ReferenceSelect
                  label={`Troop member ${index + 1}`}
                  value={memberId}
                  options={enemyOptions}
                  onChange={enemyId => setMember(index, enemyId)}
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" icon={<ArrowUp size={12} />} onClick={() => moveMember(index, -1)}>
                    Up
                  </Button>
                  <Button size="sm" variant="ghost" icon={<ArrowDown size={12} />} onClick={() => moveMember(index, 1)}>
                    Down
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={12} />}
                    onClick={() => onChange({ members: entry.members.filter((_, i) => i !== index) })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
