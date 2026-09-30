import { useState, useRef, useEffect } from 'react';
import type { RsvpResponse } from '@/lib/types';

interface RsvpSwitchProps {
  value: RsvpResponse;
  onChange: (v: RsvpResponse) => void;
}

const positions: Record<RsvpResponse, { pct: number; width: number; led: string; ledClass: string; label: string }> = {
  going: { pct: 0, width: 33.33, led: 'var(--green-light)', ledClass: 'led-green', label: 'Going' },
  maybe: { pct: 33.33, width: 33.33, led: 'var(--amber)', ledClass: 'led-amber', label: 'Maybe' },
  cant: { pct: 66.66, width: 33.33, led: 'var(--red)', ledClass: 'led-red', label: "Can't" },
};

export function RsvpSwitch({ value, onChange }: RsvpSwitchProps) {
  const pos = positions[value];
  const [trackWidth, setTrackWidth] = useState(300);

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) setTrackWidth(ref.current.offsetWidth);
  }, []);

  const knobLeft = (pos.pct / 100) * trackWidth;
  const knobWidth = (pos.width / 100) * trackWidth;

  return (
    <div ref={ref} className="rsvp-track relative w-full">
      <div className="absolute inset-0 flex">
        {(['going', 'maybe', 'cant'] as RsvpResponse[]).map((r) => (
          <button
            key={r}
            onClick={() => onChange(r)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-heading font-semibold text-[var(--text-muted)] tap-target"
          >
            <span className={`led ${positions[r].ledClass}`} />
            {positions[r].label}
          </button>
        ))}
      </div>
      <div
        className="rsvp-knob"
        style={{
          left: knobLeft + 'px',
          width: knobWidth - 6 + 'px',
        }}
      >
        <span className="text-xs font-bold text-white">{pos.label}</span>
      </div>
    </div>
  );
}
