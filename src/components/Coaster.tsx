import type { Profile } from '@/lib/types';
import { getInitials } from '@/lib/utils';

interface CoasterProps {
  profile: Profile;
  status?: 'home' | 'traveling' | 'not_confirmed' | 'going' | 'maybe' | 'cant' | 'pending';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  label?: string;
  sublabel?: string;
}

const ledMap: Record<string, string> = {
  home: 'led-green',
  going: 'led-green',
  traveling: 'led-amber',
  maybe: 'led-amber',
  not_confirmed: 'led-red',
  cant: 'led-red',
  pending: 'led-off',
};

export function Coaster({ profile, status = 'pending', size = 'md', onClick, label, sublabel }: CoasterProps) {
  const sizes = {
    sm: 'w-16 h-16 text-2xl',
    md: 'w-24 h-24 text-3xl',
    lg: 'w-32 h-32 text-4xl',
  };

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex flex-col items-center gap-2"
    >
      <div
        className={`coaster relative ${sizes[size]} ${onClick ? 'cursor-pointer active:translate-y-0.5' : ''}`}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `inset 0 0 0 3px ${status === 'home' ? 'var(--green-light)' : status === 'traveling' ? 'var(--amber)' : status === 'not_confirmed' ? 'var(--red)' : 'transparent'}`,
            opacity: 0.6,
          }}
        />
        <span className="font-heading font-bold" style={{ color: 'var(--text)' }}>
          {profile.avatar_emoji}
        </span>
        <span
          className={`led ${ledMap[status]}`}
          style={{ position: 'absolute', bottom: 6, right: 6, width: 12, height: 12 }}
        />
      </div>
      {(label || sublabel) && (
        <div className="text-center">
          {label && (
            <div className="font-heading font-semibold text-sm" style={{ color: 'var(--text)' }}>
              {label}
            </div>
          )}
          {sublabel && (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {sublabel}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
