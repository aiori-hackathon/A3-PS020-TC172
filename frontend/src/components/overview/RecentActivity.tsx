import type { LogCategory, LogEntry, LogStatus } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { toneDot } from '../ui/Tone';
import type { Tone } from '../ui/Tone';

export const CATEGORY_TONE: Record<LogCategory, Tone> = {
  M0: 'neutral',
  M1: 'info',
  M2: 'ok',
  Benchmark: 'violet',
};

export const STATUS_TONE: Record<LogStatus, Tone> = {
  ok: 'ok',
  warn: 'warn',
  error: 'bad',
  info: 'info',
};

export function RecentActivity({ entries }: { entries: LogEntry[] }) {
  return (
    <ul className="divide-y divide-ink-600/30">
      {entries.map((e) => (
        <li key={e.id} className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[auto_1fr_auto]">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[STATUS_TONE[e.status]]}`} title={e.status} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusBadge tone={CATEGORY_TONE[e.category]}>{e.category}</StatusBadge>
              <span className="text-[13px] leading-snug text-slate-200">{e.description}</span>
            </div>
            {e.sourceFile && <div className="mono mt-1 truncate text-[11px] text-slate-600">{e.sourceFile}</div>}
          </div>
          <time className="num col-start-2 text-[11px] text-slate-500 sm:col-start-3 sm:text-right">{e.timestamp}</time>
        </li>
      ))}
    </ul>
  );
}
