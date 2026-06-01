import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Input } from '../ui/Input';

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange(value: string): void;
};

export function TextField({ label, value, onChange, ...props }: TextInputProps) {
  return (
    <Input
      label={label}
      aria-label={label}
      value={value}
      onChange={event => onChange(event.target.value)}
      {...props}
    />
  );
}

export function IdField(props: TextInputProps) {
  return <TextField {...props} className={`font-mono ${props.className ?? ''}`} />;
}

type NumberFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> & {
  label: string;
  value: number;
  onChange(value: number): void;
};

export function NumberField({ label, value, onChange, ...props }: NumberFieldProps) {
  return (
    <Input
      label={label}
      aria-label={label}
      type="number"
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      {...props}
    />
  );
}

type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'checked'> & {
  label: string;
  checked: boolean;
  onChange(value: boolean): void;
};

export function CheckboxField({ label, checked, onChange, className = '', ...props }: CheckboxFieldProps) {
  return (
    <label className={`flex items-center gap-2 text-[12px] font-medium text-gray-500 ${className}`}>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
};

export function SelectField({ label, value, options, onChange, className = '', ...props }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-gray-500">{label}</label>
      <select
        aria-label={label}
        value={value}
        onChange={event => onChange(event.target.value)}
        className={`px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange(value: string): void;
};

export function TextareaField({ label, value, onChange, className = '', ...props }: TextareaFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-gray-500">{label}</label>
      <textarea
        aria-label={label}
        value={value}
        onChange={event => onChange(event.target.value)}
        className={`px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors min-h-20 ${className}`}
        {...props}
      />
    </div>
  );
}
