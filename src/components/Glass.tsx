import type { ReactNode } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

export function GlassPanel({ children, className = '' }: GlassPanelProps) {
  return (
    <div className={`glass rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose?: () => void;
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
  const colors: Record<string, string> = {
    info: 'var(--text)',
    success: 'var(--green-light)',
    warning: 'var(--amber)',
    error: 'var(--red)',
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] slide-up">
      <div className="glass rounded-xl px-5 py-3 flex items-center gap-3 max-w-[90vw]">
        <span className={`led ${type === 'success' ? 'led-green' : type === 'warning' ? 'led-amber' : type === 'error' ? 'led-red' : 'led-off'}`} />
        <span className="text-sm font-body" style={{ color: 'var(--text)' }}>
          {message}
        </span>
        {onClose && (
          <button onClick={onClose} className="text-[var(--text-muted)] text-lg leading-none">×</button>
        )}
      </div>
    </div>
  );
}
