import { useState, useRef, useEffect } from 'react';

interface TallyCounterProps {
  count: number;
  limit: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
}

export function TallyCounter({ count, limit, onIncrement, onDecrement, onReset }: TallyCounterProps) {
  const [displayCount, setDisplayCount] = useState(count);
  const [animating, setAnimating] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (prevCount.current !== count) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setDisplayCount(count);
        setAnimating(false);
      }, 200);
      prevCount.current = count;
      return () => clearTimeout(timer);
    }
  }, [count]);

  const digits = displayCount.toString().padStart(3, '0').split('');
  const atLimit = count >= limit;
  const nearLimit = count >= limit - 1 && count < limit;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-1.5" style={{ perspective: '200px' }}>
        {digits.map((d, i) => (
          <div key={i} className="tally-digit" style={{
            transform: animating ? 'rotateX(-90deg)' : 'rotateX(0)',
            transition: 'transform 0.2s ease',
          }}>
            {d}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 text-sm font-heading">
        <span className="text-[var(--text-muted)]">Limit:</span>
        <span
          className="font-bold px-3 py-1 rounded-lg"
          style={{
            background: 'var(--surface)',
            boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)',
            color: atLimit ? 'var(--red)' : nearLimit ? 'var(--amber)' : 'var(--text)',
          }}
        >
          {limit}
        </span>
      </div>

      {atLimit && (
        <div className="text-center text-sm font-heading font-semibold" style={{ color: 'var(--red)' }}>
          Nasa limit ka na. Time na mag-check in para uwian.
        </div>
      )}
      {nearLimit && !atLimit && (
        <div className="text-center text-sm font-heading font-semibold" style={{ color: 'var(--amber)' }}>
          Isa na lang. Mag-ingat.
        </div>
      )}

      <div className="flex items-center gap-4 mt-2">
        <button
          onClick={onDecrement}
          disabled={count === 0}
          className="neu-circle-raised tap-target w-14 h-14 flex items-center justify-center font-heading font-bold text-2xl disabled:opacity-40 active:neu-circle-inset"
        >
          −
        </button>
        <button
          onClick={onIncrement}
          disabled={atLimit}
          className="tap-target w-20 h-20 rounded-full flex items-center justify-center font-heading font-bold text-white text-lg active:translate-y-0.5 transition-transform disabled:opacity-40"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #555, #222)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -2px 4px rgba(0,0,0,0.3)',
          }}
        >
          +1
        </button>
        <button
          onClick={onReset}
          className="neu-circle-raised tap-target w-14 h-14 flex items-center justify-center text-xs font-heading font-semibold text-[var(--text-muted)] active:neu-circle-inset"
        >
          reset
        </button>
      </div>
    </div>
  );
}
