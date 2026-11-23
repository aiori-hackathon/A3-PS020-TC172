import { fmtSeconds } from '../../lib/format';
import type { FailoverPhase } from '../../lib/failover';

/** Horizontal bar whose segment widths are proportional to the recorded phase durations. */
export function PhaseBar({ phases, showLegend = true }: { phases: FailoverPhase[]; showLegend?: boolean }) {
  const total = phases.reduce((a, p) => a + p.seconds, 0);
  if (phases.length === 0 || total <= 0) return null;
  return (
    <div>
      <div className="flex h-3.5 w-full gap-[3px] overflow-hidden rounded-md" role="img" aria-label={`Recovery phases: ${phases.map((p) => `${p.label} ${fmtSeconds(p.seconds)} seconds`).join(', ')}`}>
        {phases.map((p) => (
          <div key={p.id} title={`${p.label}: ${fmtSeconds(p.seconds)} s`} className="h-full rounded-[3px] first:rounded-l-md last:rounded-r-md" style={{ flex: `${p.seconds} 1 0`, background: p.color, minWidth: 6 }} />
        ))}
      </div>
      {showLegend && (
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
          {phases.map((p) => (
            <li key={p.id} className="flex items-start gap-2 text-xs">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
              <span className="min-w-0">
                <span className="text-slate-200">{p.label}</span>
                <span className="num ml-2 text-slate-300">{fmtSeconds(p.seconds)} s</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{p.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
