import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  children: ReactNode;
  icon?: ReactNode;
}

export function Button({ variant = 'default', size = 'md', children, icon, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400 disabled:opacity-50 cursor-pointer';
  const sizes = {
    sm: 'px-2.5 py-1 text-[12px]',
    md: 'px-3.5 py-1.5 text-[13px]',
  };
  const variants = {
    default: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm',
    primary: 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
    ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-800',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
