interface BottleCapProps {
  label: string;
  onClick?: (e?: React.MouseEvent) => void;
  color?: 'amber' | 'red' | 'green';
  size?: 'md' | 'lg';
  type?: 'button' | 'submit';
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function BottleCap({
  label,
  onClick,
  color = 'amber',
  size = 'md',
  type = 'button',
  disabled,
  icon,
}: BottleCapProps) {
  const colors: Record<string, { face: string; edge: string }> = {
    amber: { face: 'var(--amber)', edge: 'var(--amber-dark)' },
    red: { face: 'var(--red)', edge: 'var(--red-dark)' },
    green: { face: 'var(--green)', edge: 'darkgreen' },
  };

  const c = colors[color];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`bottle-cap ${size === 'lg' ? 'bottle-cap-lg' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      style={
        {
          '--cap-face': c.face,
          '--cap-edge': c.edge,
        } as React.CSSProperties
      }
      aria-label={label}
    >
      {icon ?? <span className="bottle-cap-label">{label}</span>}
    </button>
  );
}
