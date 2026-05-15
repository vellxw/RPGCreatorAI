import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[12px] font-medium text-gray-500">{label}</label>}
      <input
        className={`px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors ${className}`}
        {...props}
      />
    </div>
  );
}

interface SelectProps {
  label?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}

export function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[12px] font-medium text-gray-500">{label}</label>}
      <select
        value={value}
        onChange={e => onChange?.(e.target.value)}
        className="px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 appearance-none cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
