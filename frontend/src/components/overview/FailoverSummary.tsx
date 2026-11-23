import { fmtRtt, fmtSeconds } from '../../lib/format';
import { buildPhases } from '../../lib/failover';
import { clockPart } from '../../lib/time';
import type { FailoverEventKind, FailoverTrial } from '../../types';
import { PhaseBar } from '../failover/PhaseBar';
import { StatusBadge } from '../ui/StatusBadge';
import { toneDot } from '../ui/Tone';
import type { Tone } from '../ui/Tone';

export const KIND_TONE: Record<FailoverEventKind, Tone> = {
  run_started: 'neutral',
  probe_failed: 'bad',
  failover_started: 'warn',
  p2_installed: 'violet',
  recovery_verified: 'ok',
  recovery_failed: 'bad',
  error: 'bad',
  timeout: 'bad',
  run_completed: 'neutral',
};

const HIDDEN: FailoverEventKind[] = ['run_started', 'run_completed'];

export function FailoverSummary({ trial }: { trial: FailoverTrial }) {
  const { metrics, verification } = trial;
  const events = trial.events.filter((e) => !HIDDEN.includes(e.kind));
  const phases = buildPhases(trial);

  const tiles = [
    { label: 'First failed probe → P2 installed', value: metrics.firstFailToInstallS },
    { label: 'First failed probe → recovery verified', value: metrics.firstFailToRecoveryS, strong: true },
    { label: 'P2 installed → recovery verified', value: metrics.installToRecoveryS },
  ];

  return (
    <div>
      <div className="mb-3">
        <StatusBadge tone="warn">One measured trial — not a guaranteed recovery time</StatusBadge>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-lg border p-2.5 ${t.strong ? 'border-emerald-400/25 bg-emerald-400/[0.05]' : 'border-ink-600/50 bg-ink-800/40'}`}>
            <div className={`num text-lg font-semibold leading-none ${t.strong ? 'text-emerald-300' : 'text-slate-100'}`}>
              {fmtSeconds(t.value)}
              <span className="ml-1 text-xs font-normal text-slate-500">s</span>
            </div>
            <div className="mt-1.5 text-[10px] leading-snug text-slate-500">{t.label}</div>
          </div>
        ))}
      </div>

      {phases.length > 0 && (
        <div className="mt-4">
          <PhaseBar phases={phases} showLegend={false} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {phases.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                {p.label} <span className="num text-slate-400">{fmtSeconds(p.seconds)} s</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {verification && (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Verification: <span className="text-slate-200">{verification.received}/{verification.transmitted}</span> pings
          received, {verification.lossPercent}% loss, average RTT <span className="num text-slate-200">{fmtRtt(verification.rttAvgMs)} ms</span>.
        </p>
      )}

      <ol className="mt-4 space-y-1.5 border-l border-ink-600/70 pl-3">
        {events.map((e, i) => (
          <li key={`${e.timestamp}-${i}`} className="relative flex items-baseline gap-2 text-xs">
            <span className={`absolute -left-[17px] top-1.5 h-2 w-2 rounded-full ring-2 ring-ink-850 ${toneDot[KIND_TONE[e.kind]]}`} />
            <span className="num shrink-0 text-slate-500">{clockPart(e.timestamp)}</span>
            <span className="text-slate-300">{e.message}</span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[11px] leading-snug text-slate-600">
        Timings come from controller log timestamps. The first failed probe is not the exact physical link-down time.
      </p>
    </div>
  );
}
