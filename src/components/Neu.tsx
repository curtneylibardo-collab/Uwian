import type { ReactNode, HTMLAttributes } from 'react';

interface NeuCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  inset?: boolean;
  small?: boolean;
}

export function NeuCard({ children, inset, small, className = '', ...rest }: NeuCardProps) {
  const base = inset ? 'neu-inset-card' : 'neu-raised';
  const size = small ? '' : 'p-5';
  return (
    <div className={`${base} ${size} ${className}`} {...rest}>
      {children}
    </div>
  );
}

interface NeuButtonProps extends HTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'raised' | 'pressed';
  disabled?: boolean;
}

export function NeuButton({ children, variant = 'raised', disabled, className = '', ...rest }: NeuButtonProps) {
  const base = variant === 'pressed' ? 'neu-pressed' : 'neu-raised-sm';
  return (
    <button
      className={`${base} tap-target px-5 py-3 font-heading font-semibold text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:neu-pressed ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

interface NeuInputProps extends HTMLAttributes<HTMLInputElement> {
  label?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
}

export function NeuInput({ label, className = '', ...rest }: NeuInputProps) {
  return (
    <label className="block">
      {label && (
        <span className="block mb-2 text-sm font-heading font-semibold text-[var(--text-muted)]">
          {label}
        </span>
      )}
      <input
        className={`neu-inset w-full px-4 py-3 text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none ${className}`}
        {...rest}
      />
    </label>
  );
}

interface NeuToggleProps {
  on: boolean;
  onToggle: () => void;
  label?: string;
}

export function NeuToggle({ on, onToggle, label }: NeuToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 tap-target"
      role="switch"
      aria-checked={on}
      aria-label={label}
    >
      <span className="relative w-14 h-8 rounded-full" style={{ background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)' }}>
        <span
          className="absolute top-1 w-6 h-6 rounded-full transition-all duration-200"
          style={{
            left: on ? 'calc(100% - 28px)' : '4px',
            background: on ? 'var(--green-light)' : 'var(--shadow-dark)',
            boxShadow: on ? '0 0 8px var(--green-light)' : '2px 2px 4px rgba(0,0,0,0.3)',
          }}
        />
      </span>
      {label && <span className="text-sm font-heading font-semibold">{label}</span>}
    </button>
  );
}
