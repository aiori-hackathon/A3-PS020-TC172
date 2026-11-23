import type { ReactNode } from 'react';
import { fmtInt, fmtRtt, fmtSeconds } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { MODE_CONFIG } from '../../config/modes';
import type { BenchmarkSummaryRow, FailoverTrial } from '../../types';
import type { ModeId } from '../../config/project';
import { StatusBadge } from '../ui/StatusBadge';

interface Props {
  activeMode: ModeId | null;
  bench: BenchmarkSummaryRow[] | null;
  trial: FailoverTrial | null;
}

const ACCENT: Record<ModeId, string> = { M0: COLORS.m0, M1: COLORS.p1, M2: COLORS.m2 };

function Line({ kind, children }: { kind: 'Configured' | 'Measured'; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-xs leading-relaxed">
      <span className={`mt-px w-[70px] shrink-0 text-[10px] font-semibold uppercase tracking-wide ${kind === 'Configured' ? 'text-violet-400' : 'text-cyan-400'}`}>{kind}</span>
      <span className="text-slate-400">{children}</span>
    </div>
  );
}

export function ModeSummary({ activeMode, bench, trial }: Props) {
  const m0 = bench?.find((r) => r.mode === 'M0_OSPFv3');
  const p1 = bench?.find((r) => r.mode === 'P1_SRv6');
  const p2 = bench?.find((r) => r.mode === 'P2_SRv6');

  const measured: Record<ModeId, ReactNode> = {
    M0: m0 ? `${fmtInt(m0.transmitted)} packets, ${m0.packetLossPercent}% loss, mean trial RTT ${fmtRtt(m0.meanTrialAvgRttMs)} ms.` : 'Unavailable',
    M1: p1 && p2 ? `P1 mean RTT ${fmtRtt(p1.meanTrialAvgRttMs)} ms, P2 ${fmtRtt(p2.meanTrialAvgRttMs)} ms; 0% loss on both.` : 'Unavailable',
    M2: trial ? `One trial: recovery verified ${fmtSeconds(trial.metrics.firstFailToRecoveryS)} s after first failed probe.` : 'Unavailable',
  };

  return (
    <ul className="space-y-3">
      {(['M0', 'M1', 'M2'] as ModeId[]).map((id) => {
        const m = MODE_CONFIG[id];
        const active = id === activeMode;
        return (
          <li key={id} className={`relative overflow-hidden rounded-lg border p-3 pl-4 transition-colors ${active ? 'border-cyan-400/30 bg-cyan-400/5' : 'border-ink-600/50 bg-ink-800/30'}`}>
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: ACCENT[id] }} aria-hidden="true" />
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="mono font-semibold text-slate-100">{id}</span>
                <span className="text-[13px] font-medium text-slate-200">{m.title}</span>
              </div>
              {active && <StatusBadge tone="info">Active</StatusBadge>}
            </div>
            <div className="space-y-1">
              <Line kind="Configured">{m.configured}</Line>
              <Line kind="Measured">{measured[id]}</Line>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
