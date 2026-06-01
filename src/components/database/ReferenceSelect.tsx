import { SelectField, type SelectOption } from './DatabaseFields';

interface ReferenceSelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  emptyLabel?: string;
  onChange(value: string): void;
}

export function ReferenceSelect({
  label,
  value,
  options,
  emptyLabel,
  onChange,
}: ReferenceSelectProps) {
  const hasCurrent = value === '' || options.some(option => option.value === value);
  const renderedOptions = [
    ...(emptyLabel ? [{ value: '', label: emptyLabel }] : []),
    ...options,
    ...(!hasCurrent ? [{ value, label: `${value} (unknown)` }] : []),
  ];

  return (
    <SelectField
      label={label}
      value={value}
      options={renderedOptions}
      onChange={onChange}
    />
  );
}
