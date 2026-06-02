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

const STAT_LABELS: Record<keyof Stats, string> = {
  maxHp: 'Max HP',
  maxMp: 'Max MP',
  attack: 'Attack',
  defense: 'Defense',
  magicAttack: 'Magic Attack',
  magicDefense: 'Magic Defense',
  agility: 'Agility',
  luck: 'Luck',
};

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
          label={`${labelPrefix} ${STAT_LABELS[field]}`}
          value={stats[field]}
          onChange={amount => onChange({ ...stats, [field]: amount })}
        />
      ))}
    </div>
  );
}

interface ReferenceChecklistOption {
  value: string;
  label: string;
}

interface ReferenceChecklistProps {
  label: string;
  itemLabel?: string;
  values: string[];
  options: ReferenceChecklistOption[];
  emptyText: string;
  onChange(values: string[]): void;
}

export function ReferenceChecklist({
  label,
  itemLabel = label,
  values,
  options,
  emptyText,
  onChange,
}: ReferenceChecklistProps) {
  const valueSet = new Set(values);
  const knownValues = new Set(options.map(option => option.value));
  const renderedOptions = [
    ...options,
    ...values
      .filter(value => value && !knownValues.has(value))
      .map(value => ({ value, label: `${value} (unknown)` })),
  ];

  const toggle = (value: string, checked: boolean) => {
    if (checked) {
      onChange(valueSet.has(value) ? values : [...values, value]);
      return;
    }
    onChange(values.filter(current => current !== value));
  };

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium text-gray-500">{label}</p>
      {renderedOptions.length === 0 ? (
        <div className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-500">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {renderedOptions.map(option => {
            const checked = valueSet.has(option.value);
            const known = knownValues.has(option.value);
            return (
              <label
                key={option.value}
                className={`flex min-w-0 items-center gap-2 rounded border px-2.5 py-1.5 text-[12px] transition-colors ${
                  checked
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <input
                  aria-label={`${itemLabel} ${option.label}`}
                  type="checkbox"
                  checked={checked}
                  onChange={event => toggle(option.value, event.target.checked)}
                  className="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {!known && (
                  <span className="flex-shrink-0 rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                    Unknown
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
