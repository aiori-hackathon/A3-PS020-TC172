import type { ReactNode } from 'react';

interface Entry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

interface Props {
  active?: boolean;
  label?: string | number;
  payload?: Entry[];
  /** Format one row's value (and optionally override its label). */
  format: (value: number, entry: Entry) => ReactNode;
}

/** Tooltip body shared by every chart: dark surface, colour swatch per series. */
export function ChartTooltip({ active, label, payload, format }: Props) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-ink-500/80 bg-ink-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label !== undefined && <div className="mb-1.5 font-medium text-slate-200">{label}</div>}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={`${p.dataKey ?? p.name}-${i}`} className="flex items-center gap-2 text-slate-400">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
            <span>{p.name}</span>
            <span className="num ml-auto pl-3 text-slate-100">{format(Number(p.value), p)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
