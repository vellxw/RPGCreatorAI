import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface ArrayFieldEditorProps<T> {
  label: string;
  values: T[];
  createValue(): T;
  onChange(values: T[]): void;
  renderItem(args: { value: T; index: number; onChange(value: T): void }): ReactNode;
  emptyLabel?: string;
}

export function ArrayFieldEditor<T>({
  label,
  values,
  createValue,
  onChange,
  renderItem,
  emptyLabel = 'No entries yet.',
}: ArrayFieldEditorProps<T>) {
  const updateItem = (index: number, value: T) => {
    onChange(values.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const removeItem = (index: number) => {
    onChange(values.filter((_, itemIndex) => itemIndex !== index));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= values.length) return;
    const next = values.slice();
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[12px] font-medium text-gray-500">{label}</label>
        <Button
          size="sm"
          icon={<Plus size={12} />}
          aria-label={`Add ${label} item`}
          onClick={() => onChange([...values, createValue()])}
        >
          Add
        </Button>
      </div>
      {values.length === 0 ? (
        <p className="mt-2 text-[12px] text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {values.map((value, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                {renderItem({ value, index, onChange: next => updateItem(index, next) })}
              </div>
              <div className="flex gap-1 pt-5">
                <button
                  type="button"
                  aria-label={`Move ${label} item ${index + 1} up`}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400"
                  onClick={() => moveItem(index, -1)}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${label} item ${index + 1} down`}
                  disabled={index === values.length - 1}
                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400"
                  onClick={() => moveItem(index, 1)}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${label} item ${index + 1}`}
                  className="text-gray-400 hover:text-red-500"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
