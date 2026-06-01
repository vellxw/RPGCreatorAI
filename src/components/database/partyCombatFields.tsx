import { NumberField } from './DatabaseFields';
import type { Stats } from '../../types/project';

export const STAT_FIELDS: Array<keyof Stats> = [
  'maxHp',
  'maxMp',
  'attack',
  'defense',
  'magicAttack',
  'magicDefense',
  'agility',
  'luck',
];

export function splitIds(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

interface StatGridProps {
  labelPrefix: string;
  stats: Stats;
  onChange(stats: Stats): void;
}

export function StatGrid({ labelPrefix, stats, onChange }: StatGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {STAT_FIELDS.map(field => (
        <NumberField
          key={field}
          label={`${labelPrefix} ${field}`}
          value={stats[field]}
          onChange={amount => onChange({ ...stats, [field]: amount })}
        />
      ))}
    </div>
  );
}
