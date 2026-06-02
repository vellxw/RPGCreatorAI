import { TextField } from './DatabaseFields';
import type {
  BattleTerms,
  CommandTerms,
  MenuTerms,
  SaveLoadTerms,
  StatTerms,
  TermsDatabaseData,
} from '../../types/project';

type TermGroupKey = Exclude<keyof TermsDatabaseData, 'currencyUnit'>;

interface TermGroupDescriptor<K extends TermGroupKey> {
  key: K;
  label: string;
  terms: Array<keyof TermsDatabaseData[K] & string>;
}

const TERM_GROUPS: [
  TermGroupDescriptor<'stats'>,
  TermGroupDescriptor<'menu'>,
  TermGroupDescriptor<'commands'>,
  TermGroupDescriptor<'battle'>,
  TermGroupDescriptor<'saveLoad'>,
] = [
  {
    key: 'stats',
    label: 'Stats',
    terms: [
      'maxHp',
      'maxMp',
      'attack',
      'defense',
      'magicAttack',
      'magicDefense',
      'agility',
      'luck',
    ] satisfies Array<keyof StatTerms & string>,
  },
  {
    key: 'menu',
    label: 'Menu',
    terms: ['item', 'skill', 'equip', 'status', 'formation', 'options', 'save', 'load'] satisfies Array<keyof MenuTerms & string>,
  },
  {
    key: 'commands',
    label: 'Commands',
    terms: ['attack', 'guard', 'item', 'skill', 'escape'] satisfies Array<keyof CommandTerms & string>,
  },
  {
    key: 'battle',
    label: 'Battle',
    terms: ['fight', 'escape', 'victory', 'defeat', 'exp', 'levelUp'] satisfies Array<keyof BattleTerms & string>,
  },
  {
    key: 'saveLoad',
    label: 'Save Load',
    terms: ['save', 'load', 'file', 'empty'] satisfies Array<keyof SaveLoadTerms & string>,
  },
];

interface TermsEditorProps {
  terms: TermsDatabaseData;
  onChange(terms: TermsDatabaseData): void;
}

function updateTermGroup<K extends TermGroupKey>(
  terms: TermsDatabaseData,
  group: K,
  label: string,
  value: string,
): TermsDatabaseData {
  return {
    ...terms,
    [group]: {
      ...terms[group],
      [label]: value,
    },
  };
}

export function TermsEditor({ terms, onChange }: TermsEditorProps) {
  return (
    <div className="max-w-3xl space-y-4">
      <section className="space-y-2 rounded-md border border-gray-200 p-3">
        <TextField
          label="Currency unit"
          value={terms.currencyUnit}
          onChange={currencyUnit => onChange({ ...terms, currencyUnit })}
        />
        {terms.currencyUnit.trim() === '' && (
          <p className="text-[11px] text-amber-700">Missing required term: currencyUnit</p>
        )}
      </section>
      {TERM_GROUPS.map(group => (
        <section key={group.key} className="space-y-2 rounded-md border border-gray-200 p-3">
          <div className="text-[12px] font-semibold text-gray-700">{group.label}</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.terms.map(termKey => {
              const groupTerms = terms[group.key] as Record<string, string>;
              const value = groupTerms[termKey] ?? '';
              return (
                <div key={termKey} className="space-y-1">
                  <TextField
                    label={`${group.label} ${termKey} term`}
                    value={value}
                    onChange={term => onChange(updateTermGroup(terms, group.key, termKey, term))}
                  />
                  {value.trim() === '' && (
                    <p className="text-[11px] text-amber-700">
                      Missing required term: {group.key}.{termKey}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
