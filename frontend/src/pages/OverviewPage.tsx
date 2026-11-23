import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, Gauge, RefreshCw, Timer } from 'lucide-react';
import { BenchmarkMini } from '../components/overview/BenchmarkMini';
import { FailoverSummary } from '../components/overview/FailoverSummary';
import { MiniTopology } from '../components/overview/MiniTopology';
import { ModeSummary } from '../components/overview/ModeSummary';
import { RecentActivity } from '../components/overview/RecentActivity';
import { VIEW_NOTE, VIEW_OPTIONS } from '../components/topology/viewMeta';
import type { TopologyView } from '../components/topology/TopologyDiagram';
import { Card } from '../components/ui/Card';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { KeyValue } from '../components/ui/KeyValue';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { Segmented } from '../components/ui/Segmented';
import { Skeleton } from '../components/ui/Skeleton';
import { SourceTag } from '../components/ui/SourceTag';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import type { Tone } from '../components/ui/Tone';
import { LINKS } from '../config/project';
import { useConnection } from '../context/ConnectionContext';
import { RECORDED_ACTIVITY } from '../data/recorded';
import { useApiData } from '../hooks/useApiData';
import { fmtInt, fmtRtt, fmtSeconds } from '../lib/format';
import { toBenchmarkRows, toFailoverTrial, toLogEntries } from '../services/adapters';
import { getBenchmarks, getFailover, getLogs, getOverview, getTopology } from '../services/api';
import { API_CONFIGURED } from '../services/client';
import { loadBenchmarkSummary, loadFailoverTrial } from '../services/recorded';
import type { ApiOverview, ApiTopology } from '../types/api';

type TopoLinks = Pick<ApiTopology, 'links'>;

/** Demo fallback for the link list: the same facts, bundled in config/project.ts. */
const fallbackTopology = async (): Promise<TopoLinks> => ({
  links: LINKS.map((l) => ({ id: l.id, a: l.a, b: l.b, subnet: l.subnet, failure_link: !!l.failureLink, status: 'unknown' as const })),
});

function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 2 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const conn = useConnection();
  const overview = useApiData<ApiOverview | null>(getOverview, async () => null);
  const bench = useApiData(() => getBenchmarks().then(toBenchmarkRows), loadBenchmarkSummary);
  const trial = useApiData(() => getFailover().then(toFailoverTrial), loadFailoverTrial);
  const topo = useApiData<TopoLinks>(getTopology, fallbackTopology);
  const logs = useApiData(() => getLogs({ kind: 'record', limit: 8 }).then(toLogEntries), async () => RECORDED_ACTIVITY);
  const [view, setView] = useState<TopologyView>('overview');

  const all = [overview, bench, trial, topo, logs];
  const loading = all.some((x) => x.loading) || conn.checking;
  const backendProblem = conn.state === 'error' ? conn.error : (all.find((x) => x.backendError)?.backendError?.message ?? null);
  // Benchmark-run provenance warnings are shown on the Benchmarks page; the Overview lists the rest.
  const apiWarnings = (overview.data?.warnings ?? []).filter((w) => !/benchmark|per-trial|recovery/i.test(w));

  // Overall packet loss across the three final benchmark runs (recorded data, not live).
  const benchTotals = bench.data ? bench.data.reduce((a, r) => ({ tx: a.tx + r.transmitted, rx: a.rx + r.received }), { tx: 0, rx: 0 }) : null;
  const p1 = bench.data?.find((r) => r.mode === 'P1_SRv6');
  const p2 = bench.data?.find((r) => r.mode === 'P2_SRv6');
  const m0 = bench.data?.find((r) => r.mode === 'M0_OSPFv3');

  const benchDate = overview.data?.experiment_dates.benchmark_run ?? (API_CONFIGURED ? null : '2026-10-31');
  const lastUpdated = overview.data?.last_updated ? new Date(overview.data.last_updated).toLocaleString() : null;

  const refresh = () => {
    conn.refresh();
    all.forEach((x) => x.reload());
  };

  const connValue = { demo: 'Demo', connecting: 'Connecting…', connected: 'Backend API', error: 'Offline' }[conn.state];
  const connTone: Tone = conn.state === 'connected' ? 'ok' : conn.state === 'connecting' ? 'info' : conn.state === 'error' ? 'bad' : 'warn';
  const connHint =
    conn.state === 'connected'
      ? `Historical files · API v${conn.health?.version ?? '?'}`
      : conn.state === 'error'
        ? 'Showing demo fallback'
        : conn.state === 'demo'
          ? 'Set VITE_API_BASE_URL for the backend'
          : 'Checking backend…';

  const rttHint = (r: typeof m0) => (r ? `Median ${fmtRtt(r.medianTrialAvgRttMs)} · max ${fmtRtt(r.highestObservedRttMs)} ms` : 'No benchmark data');
  const src = bench.data ? bench.source : 'unavailable';

  return (
    <>
      <PageHeader
        title="Overview"
        description="Local SRv6 path steering and measured failure recovery — five-router Linux namespace topology, compared across OSPFv3, two SRv6 paths and a measured failover."
        actions={
          <button type="button" onClick={refresh} disabled={loading} className="btn">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Loading…' : 'Refresh'}
          </button>
        }
      />

      {!API_CONFIGURED && (
        <Notice tone="amber" title="Demo mode.">
          No backend is configured (<span className="mono">VITE_API_BASE_URL</span>). Benchmarks and the failover trial are bundled copies of the recorded result files; nothing here was fetched from
          the backend.
        </Notice>
      )}
      {API_CONFIGURED && backendProblem && (
        <Notice tone="red" title="Backend unavailable.">
          {backendProblem} Showing the demo fallback (bundled copies of the recorded files). Use Refresh to retry.
        </Notice>
      )}
      {conn.state === 'connected' && !backendProblem && (
        <Notice tone="sky" title="Historical data.">
          Values come from experiment results recorded in the repository and served by the backend. This is not live network telemetry, so live status, active path and link health are not shown.
          {lastUpdated && <span className="text-sky-200/60"> Backend data files last modified {lastUpdated}.</span>}
        </Notice>
      )}
      {apiWarnings.length > 0 && (
        <Notice tone="amber" title={`Backend data warnings (${apiWarnings.length}).`}>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {apiWarnings.slice(0, 4).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}

      {/* ---- KPIs: final benchmark + measured recovery ------------------------ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="M0 · mean RTT" icon={Timer} value={m0 ? fmtRtt(m0.meanTrialAvgRttMs) : 'Unavailable'} unit={m0 ? 'ms' : undefined} hint={rttHint(m0)} source={src} />
        <StatCard label="P1 · mean RTT" icon={Timer} value={p1 ? fmtRtt(p1.meanTrialAvgRttMs) : 'Unavailable'} unit={p1 ? 'ms' : undefined} hint={rttHint(p1)} tone="info" source={src} />
        <StatCard label="P2 · mean RTT" icon={Timer} value={p2 ? fmtRtt(p2.meanTrialAvgRttMs) : 'Unavailable'} unit={p2 ? 'ms' : undefined} hint={rttHint(p2)} tone="violet" source={src} />
        <StatCard
          label="Packet loss"
          icon={Gauge}
          value={benchTotals ? Number((((benchTotals.tx - benchTotals.rx) / benchTotals.tx) * 100).toFixed(3)) : 'Unavailable'}
          unit={benchTotals ? '%' : undefined}
          tone={benchTotals ? (benchTotals.tx === benchTotals.rx ? 'ok' : 'warn') : 'neutral'}
          hint={benchTotals ? `${fmtInt(benchTotals.rx)}/${fmtInt(benchTotals.tx)} received` : 'No benchmark data'}
          source={src}
        />
        <StatCard
          label="M2 · recovery"
          icon={CheckCircle2}
          value={trial.data ? fmtSeconds(trial.data.metrics.firstFailToRecoveryS) : trial.loading ? '…' : 'Unavailable'}
          unit={trial.data ? 's' : undefined}
          tone={trial.data ? 'ok' : 'neutral'}
          hint={trial.data ? 'From first failed probe · one trial' : 'No trial data'}
          source={trial.data ? trial.source : 'unavailable'}
        />
        <StatCard
          label="Benchmark run"
          icon={CalendarClock}
          value={benchDate ?? (overview.loading ? '…' : 'Unavailable')}
          hint={bench.data ? `${bench.data.length} modes · ${bench.data[0].trials} trials each` : 'No benchmark data'}
          source={benchDate ? overview.source : 'unavailable'}
        />
      </div>

      {/* ---- Topology + experiment summary ------------------------------------ */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Network topology"
          subtitle={VIEW_NOTE[view]}
          action={<SourceTag source={topo.data ? (topo.source === 'recorded' ? 'config' : topo.source) : 'unavailable'} />}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented label="Topology view" options={VIEW_OPTIONS} value={view} onChange={setView} />
            <Link to="/topology" className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200">
              Interfaces, SIDs and subnets <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <MiniTopology view={view} />
          <p className="mt-3 text-[11px] leading-snug text-slate-600">Link status is unknown: the backend reads recorded files and does not query the running namespaces.</p>
        </Card>

        <Card title="Experiments" subtitle="Configured behaviour vs measured outcome">
          {bench.loading || trial.loading ? <CardSkeleton lines={6} /> : <ModeSummary activeMode={null} bench={bench.data} trial={trial.data} />}
        </Card>
      </div>

      {/* ---- Benchmark + failover ---------------------------------------------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Latest benchmark comparison"
          subtitle={`Mean of per-trial average RTT${benchDate ? ` · final run ${benchDate}` : ''}`}
          action={
            <>
              <SourceTag source={bench.data ? bench.source : 'unavailable'} />
              <Link to="/benchmarks" className="text-xs font-medium text-cyan-300 hover:text-cyan-200">
                Analytics →
              </Link>
            </>
          }
        >
          {bench.loading ? <CardSkeleton lines={7} /> : bench.error ? <ErrorState message={bench.error.message} onRetry={bench.reload} /> : bench.data && bench.data.length > 0 ? <BenchmarkMini rows={bench.data} /> : <EmptyState title="No benchmark data" />}
        </Card>

        <Card
          title="Failover event summary"
          subtitle="M2 controller log"
          action={
            <>
              <SourceTag source={trial.data ? trial.source : 'unavailable'} />
              <Link to="/failover" className="text-xs font-medium text-cyan-300 hover:text-cyan-200">
                Details →
              </Link>
            </>
          }
        >
          {trial.loading ? <CardSkeleton lines={7} /> : trial.error ? <ErrorState message={trial.error.message} onRetry={trial.reload} /> : trial.data ? <FailoverSummary trial={trial.data} /> : <EmptyState title="No failover trial recorded" />}
        </Card>
      </div>

      {/* ---- Activity + data sources --------------------------------------------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Recent experiment activity"
          subtitle="From the recorded result files"
          action={
            <>
              <SourceTag source={logs.data ? logs.source : 'unavailable'} />
              <Link to="/logs" className="text-xs font-medium text-cyan-300 hover:text-cyan-200">
                All logs →
              </Link>
            </>
          }
        >
          {logs.loading ? <CardSkeleton lines={5} /> : logs.error ? <ErrorState message={logs.error.message} onRetry={logs.reload} /> : logs.data && logs.data.length > 0 ? <RecentActivity entries={logs.data} /> : <EmptyState title="No recorded activity" />}
        </Card>

        <Card title="Data sources" subtitle="Where each figure on this page comes from">
          <KeyValue label="Source">
            <span className="inline-flex items-center gap-2">
              <StatusBadge tone={connTone} dot>
                {connValue}
              </StatusBadge>
            </span>
          </KeyValue>
          <KeyValue label="Detail">
            <span className="text-xs text-slate-400">{connHint}</span>
          </KeyValue>
          <KeyValue label="Benchmarks">
            <SourceTag source={src} />
          </KeyValue>
          <KeyValue label="Failover trial">
            <SourceTag source={trial.data ? trial.source : 'unavailable'} />
          </KeyValue>
          <KeyValue label="Topology & SIDs">
            <SourceTag source="config" />
          </KeyValue>
          <KeyValue label="Live telemetry">
            <StatusBadge tone="neutral">Not monitored</StatusBadge>
          </KeyValue>
          {trial.data?.sourceFile && <p className="mono mt-3 truncate text-[11px] text-slate-600" title={trial.data.sourceFile}>{trial.data.sourceFile}</p>}
        </Card>
      </div>
    </>
  );
}
