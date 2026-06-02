import { ArrayFieldEditor } from './ArrayFieldEditor';
import { TextField } from './DatabaseFields';
import type { NamedTypeEntry, TypesDatabaseData } from '../../types/project';

type TypeTableKey = keyof TypesDatabaseData;

interface TypeTableDescriptor {
  key: TypeTableKey;
  label: string;
  defaultName: string;
  seed: string;
}

const TYPE_TABLES: TypeTableDescriptor[] = [
  { key: 'weaponTypes', label: 'Weapon Types', defaultName: 'Weapon Type', seed: 'weapon_type' },
  { key: 'armorTypes', label: 'Armor Types', defaultName: 'Armor Type', seed: 'armor_type' },
  { key: 'skillTypes', label: 'Skill Types', defaultName: 'Skill Type', seed: 'skill_type' },
  { key: 'elements', label: 'Elements', defaultName: 'Element', seed: 'element' },
  { key: 'equipmentSlots', label: 'Equipment Slots', defaultName: 'Equipment Slot', seed: 'equipment_slot' },
  { key: 'itemCategories', label: 'Item Categories', defaultName: 'Item Category', seed: 'item_category' },
];

interface TypesEditorProps {
  types: TypesDatabaseData;
  onChange(types: TypesDatabaseData): void;
}

function nextTypeEntry(table: TypeTableDescriptor, values: NamedTypeEntry[]): NamedTypeEntry {
  const ids = new Set(values.map(value => value.id));
  let index = values.length + 1;
  let id = `${table.seed}_${index}`;
  while (ids.has(id)) {
    index += 1;
    id = `${table.seed}_${index}`;
  }
  return { id, name: `${table.defaultName} ${index}` };
}

export function TypesEditor({ types, onChange }: TypesEditorProps) {
  const updateTable = (key: TypeTableKey, values: NamedTypeEntry[]) => {
    onChange({ ...types, [key]: values });
  };

  return (
    <div className="max-w-3xl space-y-4">
      {TYPE_TABLES.map(table => {
        const values = types[table.key];
        return (
          <section key={table.key} className="space-y-2 rounded-md border border-gray-200 p-3">
            <ArrayFieldEditor
              label={table.label}
              values={values}
              createValue={() => nextTypeEntry(table, values)}
              emptyLabel={`No ${table.label.toLowerCase()} defined.`}
              onChange={next => updateTable(table.key, next)}
              renderItem={({ value, index, onChange: updateValue }) => (
                <div className="space-y-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
                    <TextField
                      label={`${table.label} id ${index + 1}`}
                      value={value.id}
                      onChange={id => updateValue({ ...value, id })}
                    />
                    <TextField
                      label={`${table.label} name ${index + 1}`}
                      value={value.name}
                      onChange={name => updateValue({ ...value, name })}
                    />
                  </div>
                  {value.id.trim() === '' && (
                    <p className="text-[11px] text-amber-700">Missing id for {table.label} entry {index + 1}</p>
                  )}
                  {value.name.trim() === '' && (
                    <p className="text-[11px] text-amber-700">
                      Missing label for {table.label} entry {value.id ? `"${value.id}"` : index + 1}
                    </p>
                  )}
                </div>
              )}
            />
          </section>
        );
      })}
    </div>
  );
}
