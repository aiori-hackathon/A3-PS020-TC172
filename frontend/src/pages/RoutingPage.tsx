import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { LoadState } from '../components/ui/LoadState';
import { Metric } from '../components/ui/Metric';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { SourceTag } from '../components/ui/SourceTag';
import { MODE_CONFIG } from '../config/modes';
import { PATHS, PROJECT, pathLabel } from '../config/project';
import { useBenchmarks, useOverview, useTrial } from '../hooks/useRecorded';
import { useTopology } from '../hooks/useTopology';
import { fmtDurationMs, fmtInt, fmtPercent, fmtRtt, fmtSeconds } from '../lib/format';
import { COLORS } from '../lib/theme';
import type { BenchmarkMode, BenchmarkSummaryRow, FailoverTrial } from '../types';
import type { ApiOverview, ApiTopology } from '../types/api';

type ColId = 'M0' | 'P1' | 'P2' | 'M2';

interface Col {
  id: ColId;
  name: string;
  title: string;
  color: string;
  mode?: BenchmarkMode;
}

const COLS: Col[] = [
  { id: 'M0', name: 'M0', title: 'OSPFv3 baseline', color: COLORS.m0, mode: 'M0_OSPFv3' },
  { id: 'P1', name: 'M1 · P1', title: 'SRv6 primary path', color: COLORS.p1, mode: 'P1_SRv6' },
  { id: 'P2', name: 'M1 · P2', title: 'SRv6 backup path', color: COLORS.p2, mode: 'P2_SRv6' },
  { id: 'M2', name: 'M2', title: 'Measured failure recovery', color: COLORS.m2 },
];

const NA = <span className="text-slate-600">—</span>;

/** Small proportional bar under a numeric cell so magnitudes can be compared at a glance. */
function CellValue({ text, ratio, color }: { text: ReactNode; ratio?: number; color: string }) {
  return (
    <div className="min-w-[96px]">
      <div className="num text-slate-100">{text}</div>
      {ratio !== undefined && Number.isFinite(ratio) && (
        <div className="mt-1.5 h-1 w-full rounded-full bg-ink-700" aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

interface Configured {
  mechanism: string;
  path: string;
  sids: string;
  onFailure: string;
}

/** What the routing-mode cards and table show. API data (overview, topology, failover) wins; config text is the fallback. */
interface RoutingContext {
  overview: ApiOverview | null;
  topology: ApiTopology | null;
  /** Failure-detection threshold, from the recorded failover trial. */
  threshold: number;
}

const OVERVIEW_ID: Record<ColId, string> = { M0: 'M0', P1: 'M1-P1', P2: 'M1-P2', M2: 'M2' };

function configuredOf(c: Col, ctx: RoutingContext): Configured {
  const pathOf = (id: 'P1' | 'P2') => {
    const ap = ctx.topology?.paths.find((x) => x.id === id);
    return { label: ap ? ap.nodes.join(' → ') : pathLabel(PATHS[id]), segments: (ap?.segments ?? PATHS[id].segments).join(', ') };
  };
  const mechanism = (fallback: string) => ctx.overview?.modes.find((m) => m.id === OVERVIEW_ID[c.id])?.configured ?? fallback;
  switch (c.id) {
    case 'M0':
      return { mechanism: mechanism(MODE_CONFIG.M0.configured), path: 'Chosen hop by hop by OSPFv3', sids: 'None', onFailure: 'OSPFv3 reconverges (dead interval 3 s)' };
    case 'P1':
    case 'P2': {
      const p = pathOf(c.id);
      return { mechanism: mechanism(MODE_CONFIG.M1.tagline), path: p.label, sids: p.segments, onFailure: 'No automatic reaction (static SID list)' };
    }
    default:
      return {
        mechanism: mechanism(MODE_CONFIG.M2.configured),
        path: 'Starts on P1; R1 switches to P2 after the failure',
        sids: `P2: ${pathOf('P2').segments}`,
        onFailure: `Switch to P2 after ${ctx.threshold} failed probes`,
      };
  }
}

function ModeCard({ col, cfg, row, trial }: { col: Col; cfg: Configured; row?: BenchmarkSummaryRow; trial: FailoverTrial | null }) {
  return (
    <section className="panel animate-fade-up overflow-hidden">
      <div className="h-[3px]" style={{ background: col.color }} />
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">{col.title}</h2>
          <span className="mono font-semibold" style={{ color: col.color }}>
            {col.name}
          </span>
        </div>

        <div className="label mt-4">Configured</div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{cfg.mechanism}</p>
        <p className="mono mt-2 break-words text-[11px] text-slate-500">{cfg.path}</p>

        <div className="label mt-4">Measured</div>
        {col.id === 'M2' ? (
          trial ? (
            <dl className="mt-2 space-y-2 text-sm">
              <Row k="Probe → recovered" v={`${fmtSeconds(trial.metrics.firstFailToRecoveryS)} s`} strong />
              <Row k="Probe → P2 installed" v={`${fmtSeconds(trial.metrics.firstFailToInstallS)} s`} />
              <Row k="Verify pings" v={trial.verification ? `${trial.verification.received} / ${trial.verification.transmitted}` : 'N/A'} />
              <Row k="Trials" v="1 recorded" />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate-500">N/A</p>
          )
        ) : row ? (
          <dl className="mt-2 space-y-2 text-sm">
            <Row k="Mean RTT" v={`${fmtRtt(row.meanTrialAvgRttMs)} ms`} strong />
            <Row k="Packet loss" v={`${fmtPercent(row.packetLossPercent)}%`} />
            <Row k="Received" v={`${fmtInt(row.received)} / ${fmtInt(row.transmitted)}`} />
            <Row k="Trials" v={`${row.trials}`} />
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">N/A</p>
        )}
      </div>
    </section>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-slate-500">{k}</dt>
      <dd className={`num whitespace-nowrap text-right ${strong ? 'font-semibold text-slate-50' : 'text-slate-300'}`}>{v}</dd>
    </div>
  );
}

export function RoutingPage() {
  const b = useBenchmarks();
  const t = useTrial();
  const ov = useOverview();
  const topo = useTopology();
  const rows = b.data ?? [];
  const trial = t.data;
  // First load only: wait for overview/topology so config text is not shown and then swapped for API text.
  const settling = (x: { loading: boolean; source: string }) => x.loading && x.source === 'unavailable';
  const waiting = settling(ov) || settling(topo);
  const threshold = trial?.detectionThreshold ?? PROJECT.failureDetectionThreshold;
  const ctx: RoutingContext = { overview: ov.data, topology: topo.data, threshold };
  const cfgOf = (c: Col) => configuredOf(c, ctx);
  const byMode = (m?: BenchmarkMode) => rows.find((r) => r.mode === m);
  const m0 = byMode('M0_OSPFv3');

  const max = (pick: (r: BenchmarkSummaryRow) => number) => Math.max(...rows.map(pick), 0);
  const maxMean = max((r) => r.meanTrialAvgRttMs);
  const maxPeak = max((r) => r.highestObservedRttMs);

  const reload = () => {
    b.reload();
    t.reload();
    ov.reload();
    topo.reload();
  };

  const section = (label: string) => (
    <tr>
      <td colSpan={COLS.length + 1} className="!border-b-ink-600/60 !bg-ink-900/60 !py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </td>
    </tr>
  );

  /** One benchmark-derived row; M2 is never filled with benchmark numbers (different measurement). */
  const benchRow = (label: string, fn: (r: BenchmarkSummaryRow, c: Col) => ReactNode) => (
    <tr>
      <td className="whitespace-nowrap font-medium text-slate-400">{label}</td>
      {COLS.map((c) => {
        const r = byMode(c.mode);
        return <td key={c.id}>{c.id === 'M2' || !r ? NA : fn(r, c)}</td>;
      })}
    </tr>
  );

  return (
    <>
      <PageHeader
        title="Routing Modes"
        description="Compare the four experiments side by side — configured behaviour first, then what was measured. Benchmarks come from the final 30-trial run; M2 is one recorded failover."
        actions={
          <button type="button" className="btn" onClick={reload}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />
      <Notice tone="sky">Benchmark values are historical measurements, not live route state. M2 is a measured recovery procedure, not a continuously active routing mode.</Notice>
      <LoadState loading={(b.loading && !b.data) || waiting} error={b.error} />

      {rows.length > 0 && !waiting && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLS.map((c) => (
              <ModeCard key={c.id} col={c} cfg={cfgOf(c)} row={byMode(c.mode)} trial={trial} />
            ))}
          </div>

          <Card
            className="mt-5"
            title="Side-by-side comparison"
            subtitle="Benchmark rows use 30 trials × 1,000 packets per mode. M2 is a single failover run, so it is not placed in the benchmark rows."
            action={<SourceTag source={b.source} />}
            bodyClassName="!p-0"
          >
            <div className="overflow-x-auto">
              <table className="tbl min-w-[860px]">
                <thead>
                  <tr>
                    <th className="w-44" />
                    {COLS.map((c) => (
                      <th key={c.id}>
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: c.color }} />
                        <span className="align-middle normal-case tracking-normal text-slate-300">{c.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="align-top">
                  {section('Configured')}
                  <tr>
                    <td className="font-medium text-slate-400">Path selection</td>
                    {COLS.map((c) => (
                      <td key={c.id} className="max-w-[210px] text-xs leading-relaxed text-slate-400">
                        {cfgOf(c).path}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-400">SID list at R1</td>
                    {COLS.map((c) => (
                      <td key={c.id} className="mono max-w-[210px] break-words text-[11px] text-violet-300/90">
                        {cfgOf(c).sids === 'None' ? NA : cfgOf(c).sids}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-400">On link failure</td>
                    {COLS.map((c) => (
                      <td key={c.id} className="max-w-[210px] text-xs leading-relaxed text-slate-400">
                        {cfgOf(c).onFailure}
                      </td>
                    ))}
                  </tr>

                  {section('Measured · benchmark (30 trials)')}
                  {benchRow('Packets received', (r) => <span className="num text-slate-100">{fmtInt(r.received)} / {fmtInt(r.transmitted)}</span>)}
                  {benchRow('Packet loss', (r) => <span className="num text-slate-100">{fmtPercent(r.packetLossPercent)}%</span>)}
                  {benchRow('Mean trial avg RTT', (r, c) => <CellValue text={`${fmtRtt(r.meanTrialAvgRttMs)} ms`} ratio={maxMean ? r.meanTrialAvgRttMs / maxMean : undefined} color={c.color} />)}
                  {benchRow('Median trial avg RTT', (r) => <span className="num text-slate-100">{fmtRtt(r.medianTrialAvgRttMs)} ms</span>)}
                  {benchRow('Highest observed RTT', (r, c) => <CellValue text={`${fmtRtt(r.highestObservedRttMs)} ms`} ratio={maxPeak ? r.highestObservedRttMs / maxPeak : undefined} color={c.color} />)}
                  {benchRow('Mean trial duration', (r) => <span className="num text-slate-100">{fmtDurationMs(r.meanTrialDurationMs)} ms</span>)}
                  {benchRow('Mean RTT vs M0 (derived)', (r, c) => {
                    if (!m0 || c.id === 'M0') return NA;
                    const d = r.meanTrialAvgRttMs - m0.meanTrialAvgRttMs;
                    return <span className="num text-slate-300">{d >= 0 ? '+' : '−'}{fmtRtt(Math.abs(d))} ms</span>;
                  })}

                  {section('Measured · failure recovery (single trial)')}
                  <tr>
                    <td className="font-medium text-slate-400">First failed probe → recovered</td>
                    {COLS.map((c) => (
                      <td key={c.id}>{c.id === 'M2' && trial ? <span className="num font-semibold text-emerald-300">{fmtSeconds(trial.metrics.firstFailToRecoveryS)} s</span> : NA}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-400">Verification pings</td>
                    {COLS.map((c) => (
                      <td key={c.id} className="num text-slate-100">
                        {c.id === 'M2' && trial?.verification ? `${trial.verification.received} / ${trial.verification.transmitted} · avg ${fmtRtt(trial.verification.rttAvgMs)} ms` : NA}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="border-t border-ink-600/40 px-4 py-3 text-[11px] leading-snug text-slate-600">
              “Mean RTT vs M0” is arithmetic on the recorded means. Highest observed RTTs are kept, not discarded. Results apply to this topology, this VM and the timers used.
            </p>
          </Card>

          <Card className="mt-5" title="M2 — Failure detection and recovery" subtitle="What the controller is configured to do">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Detection threshold" value={threshold} unit="failed probes" />
              <Metric label="Recovery behaviour" value="Switch to P2" />
              <Metric label="Telemetry" value={topo.data?.data_source.live_telemetry ? 'Live' : 'Historical only'} />
            </div>
            <p className="mt-3 text-xs text-slate-500">M2 controller performs a one-way switch to the backup path; automatic failback is not implemented.</p>
          </Card>
        </>
      )}
    </>
  );
}
