import { useRef, useState, useCallback, type ReactNode } from 'react';

interface LatchProps {
  onLatched: () => void;
  label?: string;
  latchedLabel?: string;
  disabled?: boolean;
  children?: ReactNode;
}

export function Latch({ onLatched, label = 'I-slide para makauwi', latchedLabel = 'Nakauwi na ako', disabled }: LatchProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const [latched, setLatched] = useState(false);
  const startRef = useRef(0);
  const maxRef = useRef(260);

  const updateMax = useCallback(() => {
    if (trackRef.current) {
      maxRef.current = trackRef.current.offsetWidth - 52;
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || latched) return;
    updateMax();
    setDragging(true);
    startRef.current = e.clientX - offset;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    let newOffset = e.clientX - startRef.current;
    newOffset = Math.max(0, Math.min(newOffset, maxRef.current));
    setOffset(newOffset);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (offset >= maxRef.current * 0.9) {
      setOffset(maxRef.current);
      setLatched(true);
      onLatched();
    } else {
      setOffset(0);
    }
  };

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        className="latch-track"
        style={{ '--latch-max': maxRef.current + 'px' } as React.CSSProperties}
      >
        <div
          ref={knobRef}
          className="latch-knob"
          style={{
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className={`led ${latched ? 'led-green' : 'led-red'}`} style={{ width: 14, height: 14 }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-heading font-semibold text-sm" style={{ color: latched ? 'var(--green-light)' : 'var(--text-muted)' }}>
            {latched ? latchedLabel : label}
          </span>
        </div>
      </div>
    </div>
  );
}
