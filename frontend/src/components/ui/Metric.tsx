import type { ReactNode } from 'react';
import { toneText } from './Tone';
import type { Tone } from './Tone';

/** A single figure with label, optional unit and hint. Used inside cards and metric rows. */
export function Metric({
  label,
  value,
  unit,
  hint,
  tone = 'neutral',
  className = '',
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={`panel-inset p-3.5 ${className}`}>
      <div className="label">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`num text-xl font-semibold leading-none ${tone === 'neutral' ? 'text-slate-100' : toneText[tone]}`}>{value}</span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[11px] leading-snug text-slate-500">{hint}</div>}
    </div>
  );
}
