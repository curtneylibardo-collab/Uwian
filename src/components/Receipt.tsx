import { useEffect, useRef, useState } from 'react';

interface ReceiptLine {
  id: string;
  left: string;
  right: string;
  bold?: boolean;
}

interface ReceiptProps {
  title: string;
  subtitle?: string;
  lines: ReceiptLine[];
  total: string;
  totalLabel?: string;
  footer?: string;
  printing?: boolean;
}

export function Receipt({ title, subtitle, lines, total, totalLabel = 'TOTAL', footer, printing }: ReceiptProps) {
  const prefersReduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const [visibleLines, setVisibleLines] = useState<number>(
    prefersReduced.current ? 999 : 0,
  );

  useEffect(() => {
    if (!printing || prefersReduced.current) {
      setVisibleLines(999);
      return;
    }
    setVisibleLines(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisibleLines(i);
      if (i >= lines.length + 5) clearInterval(interval);
    }, 600 / (lines.length + 5));
    return () => clearInterval(interval);
  }, [printing, lines.length]);

  const showAll = visibleLines >= 999;

  return (
    <div className="receipt max-w-md mx-auto" style={{ opacity: showAll ? 1 : undefined }}>
      <div className={`receipt-curl`} />

      <div className="text-center mb-3" style={{ opacity: showAll || visibleLines > 0 ? 1 : 0 }}>
        <div className="font-bold text-base">{title}</div>
        {subtitle && <div className="text-xs mt-1 opacity-70">{subtitle}</div>}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" style={{ opacity: visibleLines > 1 ? 1 : 0 }} />

      <div className="space-y-1">
        {lines.map((line, i) => (
          <div
            key={line.id}
            className={`flex items-baseline ${line.bold ? 'font-bold' : ''}`}
            style={{
              opacity: showAll || visibleLines > i + 2 ? 1 : 0,
              transform: showAll ? 'none' : visibleLines > i + 2 ? 'translateY(0)' : 'translateY(-8px)',
              transition: 'opacity 0.1s, transform 0.1s',
            }}
          >
            <span className="whitespace-nowrap">{line.left}</span>
            <span className="receipt-leader" />
            <span className="whitespace-nowrap tabular-nums">{line.right}</span>
          </div>
        ))}
      </div>

      <div
        className="receipt-total flex items-baseline justify-between mt-3 font-bold text-sm"
        style={{ opacity: showAll || visibleLines > lines.length + 3 ? 1 : 0 }}
      >
        <span>{totalLabel}</span>
        <span className="tabular-nums">{total}</span>
      </div>

      {footer && (
        <div
          className="text-center text-xs mt-3 opacity-70"
          style={{ opacity: showAll || visibleLines > lines.length + 4 ? 1 : 0 }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
