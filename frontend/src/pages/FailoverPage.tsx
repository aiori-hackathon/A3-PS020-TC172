import { useMemo } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { PhaseBar } from '../components/failover/PhaseBar';
import { KIND_TONE } from '../components/overview/FailoverSummary';
import { Legend } from '../components/topology/Legend';
import { TopologyDiagram, toDiagramModel } from '../components/topology/TopologyDiagram';
import { Card } from '../components/ui/Card';
import { LoadState } from '../components/ui/LoadState';
import { Metric } from '../components/ui/Metric';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { SourceTag } from '../components/ui/SourceTag';
import { StatusBadge } from '../components/ui/StatusBadge';
import type { Tone } from '../components/ui/Tone';
import { useFailoverMonitor } from '../hooks/useRecorded';
import { useTopology } from '../hooks/useTopology';
import { buildPhases } from '../lib/failover';
import { fmtRtt, fmtSeconds } from '../lib/format';
import { clockPart, secondsBetween } from '../lib/time';
import type { FailoverEventKind } from '../types';
import type { ApiFailoverOutcome } from '../types/api';

const KIND_LABEL: Record<FailoverEventKind, string> = {
  run_started: 'Monitor started',
  probe_failed: 'Probe failed',
  failover_started: 'Failover',
  p2_installed: 'P2 installed',
  recovery_verified: 'Recovered',
  recovery_failed: 'Recovery failed',
  error: 'Error',
  timeout: 'Timeout',
  run_completed: 'Monitor completed',
};

const OUTCOME: Record<ApiFailoverOutcome, { label: string; tone: Tone }> = {
  recovered: { label: 'Recovered', tone: 'ok' },
  installed_unverified: { label: 'P2 installed, not verified', tone: 'warn' },
  install_failed: { label: 'P2 install failed', tone: 'bad' },
  timeout: { label: 'Timed out', tone: 'bad' },
  no_failover: { label: 'No failover', tone: 'neutral' },
  incomplete: { label: 'Incomplete', tone: 'neutral' },
};

/** The backend names the failed link "R2-R5"; a topology link is matched regardless of end order or case. */
const sameLink = (a: string, b: string, name: string) => [a, b].map((s) => s.toUpperCase()).sort().join('-') === name.toUpperCase().split('-').sort().join('-');

function offsetLabel(s: number | null): string {
  if (s === null) return '—';
  const sign = s < 0 ? '−' : '+';
  return `${sign}${fmtSeconds(Math.abs(s))} s`;
}

export function FailoverPage() {
  const t = useFailoverMonitor();
  const topo = useTopology();
  const d = t.data?.trial ?? null;
  const x = t.data?.details ?? null; // null in the bundled demo fallback: it only holds the headline trial
  const phases = d ? buildPhases(d) : [];
  const recovered = !!d?.events.some((e) => e.kind === 'recovery_verified');

  // Scenario diagram: nodes/links from /api/topology (or its labelled config fallback); the link drawn as failed
  // is the one /api/failover reports, so the diagram follows the recorded scenario.
  const model = useMemo(() => {
    if (!topo.data) return undefined;
    const m = toDiagramModel(topo.data);
    if (!x?.failureLink) return m;
    const links = m.links.map((l) => ({ ...l, failureLink: sameLink(l.a, l.b, x.failureLink as string) }));
    return links.some((l) => l.failureLink) ? { ...m, links } : m;
  }, [topo.data, x?.failureLink]);
  const topoFail = topo.data?.links.find((l) => l.failure_link);
  const failureLabel = x?.failureLink ? x.failureLink.replace('-', '–').toUpperCase() : topoFail ? `${topoFail.a}–${topoFail.b}` : null;

  return (
    <>
      <PageHeader
        title="Failover Monitoring"
        description="Recorded M2 failure detection, backup-path installation and recovery verification, reconstructed from the controller log of one verified trial."
        actions={
          <button type="button" className="btn" onClick={t.reload}>
            <RefreshCw className={`h-3.5 w-3.5 ${t.loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />
      <Notice tone="sky">
        M2 information is historical. This page does not monitor current connectivity or trigger failover.
        {x && <span className="text-sky-200/60"> {x.dataSourceDescription}</span>}
      </Notice>
      {x && x.warnings.length > 0 && (
        <Notice tone="amber" title={`Backend data warnings (${x.warnings.length}).`}>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {x.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}
      <LoadState loading={t.loading && !d} error={t.error} />

      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Outcome" value={recovered ? 'Recovered' : 'Not verified'} tone={recovered ? 'ok' : 'warn'} hint={recovered ? 'P2 connectivity verified' : 'No recovery verification recorded'} className="xl:col-span-1" />
            <Metric label="First failure → P2 install" value={fmtSeconds(d.metrics.firstFailToInstallS)} unit="s" />
            <Metric label="First failure → recovery" value={fmtSeconds(d.metrics.firstFailToRecoveryS)} unit="s" tone="ok" hint="Headline recovery time" />
            <Metric label="Install → recovery" value={fmtSeconds(d.metrics.installToRecoveryS)} unit="s" />
            <Metric label="Detection threshold" value={d.detectionThreshold} unit="failed probes" hint={`${d.probesSucceededBeforeFailure} successful probes before the first failure`} />
          </div>

          <Card
            className="mt-5"
            title="Recorded recovery timeline"
            subtitle="Phase lengths are differences between logged timestamps; segment widths are proportional"
            action={<SourceTag source={t.source} />}
          >
            <PhaseBar phases={phases} />

            <div className="mt-6 overflow-x-auto">
              <table className="tbl min-w-[560px]">
                <thead>
                  <tr>
                    <th className="w-28">Offset</th>
                    <th className="w-32">Log time</th>
                    <th className="w-40">Event</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {d.events.map((e, i) => {
                    const edge = e.kind === 'run_started' || e.kind === 'run_completed';
                    return (
                      <tr key={`${e.timestamp}-${i}`} className={edge ? 'opacity-60' : ''}>
                        <td className="num text-slate-300">{offsetLabel(secondsBetween(d.metrics.firstFailedProbe, e.timestamp))}</td>
                        <td className="num text-slate-500">{clockPart(e.timestamp) || 'Timestamp unavailable'}</td>
                        <td>
                          <StatusBadge tone={KIND_TONE[e.kind]} dot>
                            {KIND_LABEL[e.kind] ?? e.kind}
                          </StatusBadge>
                        </td>
                        <td className="text-slate-200">{e.message}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-snug text-slate-600">
              Offsets are measured from the first failed probe, which is not the exact physical link-down time. The verification phase includes the controller’s 1 s wait after installing P2 and its {d.verification ? `${d.verification.transmitted} ` : ''}verification pings
              (src/scripts/40_m2_failover.sh).
            </p>
          </Card>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2" title="Scenario" subtitle={`${failureLabel ?? 'The failure-test link'} was deliberately failed; P2 was installed at R1`} action={<SourceTag source="config" />}>
              <div className="rounded-lg border border-ink-600/40 bg-ink-950/50 p-3 sm:p-4">
                <TopologyDiagram view="M2" compact topology={model} />
              </div>
              <div className="mt-3">
                <Legend view="M2" />
              </div>
            </Card>

            <div className="space-y-5">
              <Card title="Verification result" subtitle="Pings sent after P2 was installed" action={<SourceTag source={t.source} />}>
                <div className="mb-3 flex items-center gap-2">
                  {recovered ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <b className="text-emerald-200">Recovery verified</b>
                    </>
                  ) : (
                    <b className="text-amber-200">Recovery not verified</b>
                  )}
                </div>
                {d.verification ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="Pings received" value={`${d.verification.received}/${d.verification.transmitted}`} />
                    <Metric label="Packet loss" value={d.verification.lossPercent} unit="%" />
                    <Metric label="Average RTT" value={fmtRtt(d.verification.rttAvgMs)} unit="ms" />
                    <Metric label="RTT min / max (ms)" value={`${fmtRtt(d.verification.rttMinMs)} / ${fmtRtt(d.verification.rttMaxMs)}`} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Verification metrics unavailable.</p>
                )}
              </Card>

              <Card title="Measurement scope" action={<SourceTag source={t.source} />}>
                <div className="text-lg font-semibold text-white">{x?.measurementScope === 'none' ? 'No verified trial' : 'One verified trial'}</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {x?.scopeNote ?? 'These timings describe the selected recorded run only. They are not an average or a guaranteed recovery time.'}
                </p>
                {x && x.limitations.length > 0 && (
                  <>
                    <div className="label mb-1.5 mt-4">Limitations</div>
                    <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-400">
                      {x.limitations.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </>
                )}
                {x && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>Cross-check against the repository summary:</span>
                    {x.summaryCheck ? (
                      <StatusBadge tone={x.summaryCheck.matches ? 'ok' : 'bad'} dot>
                        {x.summaryCheck.matches ? 'Matches' : 'Mismatch'}
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">No summary file</StatusBadge>
                    )}
                    {x.summaryCheck && <span className="mono break-all text-[11px] text-slate-600">{x.summaryCheck.file}</span>}
                    {x.summaryCheck && !x.summaryCheck.matches && x.summaryCheck.mismatches.length > 0 && (
                      <ul className="w-full list-disc pl-4 text-amber-200/80">
                        {x.summaryCheck.mismatches.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <p className="mono mt-3 break-all text-[11px] text-slate-600">Source: {d.sourceFile}</p>
                {x && (
                  <p className="mono mt-1 text-[11px] text-slate-600">
                    Headline trial: run {x.headlineRunId} · started {d.runStart ?? 'time unavailable'}
                  </p>
                )}
              </Card>
            </div>
          </div>

          {x && x.runs.length > 0 && (
            <Card
              className="mt-5"
              title="Recorded controller runs"
              subtitle={`${x.runsInLog} controller run${x.runsInLog === 1 ? '' : 's'} in the log · ${x.recoveredRuns} reached verified recovery · only run ${x.headlineRunId} supplies the headline figures; runs are not pooled or averaged`}
              action={<SourceTag source={t.source} />}
              bodyClassName="!p-0"
            >
              <div className="overflow-x-auto">
                <table className="tbl min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Started (log time)</th>
                      <th>Outcome</th>
                      <th className="text-right">Probe failures</th>
                      <th className="text-right">Failover attempts</th>
                      <th className="text-right">Errors</th>
                      <th className="text-right">First failure → recovery</th>
                      <th className="text-right">Verification pings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {x.runs.map((r) => (
                      <tr key={r.runId}>
                        <td className="num font-semibold text-slate-100">
                          {r.runId}
                          {r.isHeadline && (
                            <StatusBadge tone="info" className="ml-2">
                              Headline
                            </StatusBadge>
                          )}
                        </td>
                        <td className="num text-slate-400">{r.started}</td>
                        <td>
                          <StatusBadge tone={OUTCOME[r.outcome].tone} dot>
                            {OUTCOME[r.outcome].label}
                          </StatusBadge>
                        </td>
                        <td className="num text-right">{r.probeFailures}</td>
                        <td className="num text-right">{r.failoverAttempts}</td>
                        <td className="num text-right">{r.errorCount}</td>
                        <td className="num text-right">{r.firstFailToRecoveryS === null ? '—' : `${fmtSeconds(r.firstFailToRecoveryS)} s`}</td>
                        <td className="num text-right">{r.verification ? `${r.verification.received}/${r.verification.transmitted}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
