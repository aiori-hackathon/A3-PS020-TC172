import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { DataSource } from '../../types';
import { SourceTag } from './SourceTag';
import { toneText } from './Tone';
import type { Tone } from './Tone';

interface Props {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  source: DataSource;
}

/**
 * Compact KPI tile. The page already states where its data comes from, so a source tag is
 * only drawn when the value is NOT the ordinary recorded/config/live data (i.e. when it is
 * a demo fallback or unavailable) - that is the case the reader must never miss.
 */
export function StatCard({ label, value, unit, hint, icon: Icon, tone = 'neutral', source }: Props) {
  const flagged = source === 'mock' || source === 'unavailable';
  return (
    <div className="panel animate-fade-up p-4 transition-colors hover:border-ink-500/80">
      <div className="flex items-center justify-between gap-2">
        <span className="label">{label}</span>
        <Icon className={`h-4 w-4 shrink-0 ${toneText[tone]}`} />
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className={`num truncate text-[22px] font-semibold leading-none ${tone === 'neutral' ? 'text-slate-100' : toneText[tone]}`}>
          {value}
        </span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
      <div className="mt-2.5 min-h-[18px]">
        <div className="text-[11px] leading-snug text-slate-500">{hint}</div>
        {flagged && (
          <div className="mt-2">
            <SourceTag source={source} />
          </div>
        )}
      </div>
    </div>
  );
}
