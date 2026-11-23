import type { ApiBenchmarks, ApiFailover, ApiFailoverOutcome, ApiLogs } from '../types/api';
import type { BenchmarkMode, BenchmarkSummaryRow, FailoverEventKind, FailoverTrial, LogEntry } from '../types';
import type { TrialSeries } from './trialSeries';

/** Backend responses -> the shapes the existing Stage 1 components already render. */

export function toBenchmarkRows(api: ApiBenchmarks): BenchmarkSummaryRow[] {
  const rows = (api.latest?.modes ?? []).map((m) => ({
    mode: m.mode as BenchmarkSummaryRow['mode'],
    trials: m.trials,
    transmitted: m.transmitted,
    received: m.received,
    packetLossPercent: m.packet_loss_percent,
    meanTrialAvgRttMs: m.mean_trial_avg_rtt_ms,
    medianTrialAvgRttMs: m.median_trial_avg_rtt_ms,
    meanTrialDurationMs: m.mean_trial_duration_ms,
    highestObservedRttMs: m.max_rtt_ms,
  }));
  if (rows.length === 0) throw new Error('The backend returned no benchmark data (see its warnings).');
  return rows;
}

/** Everything the Benchmark Analytics page shows, from ONE response so summary and per-trial charts can never disagree. */
export interface BenchmarkAnalytics {
  rows: BenchmarkSummaryRow[];
  /** Per-trial points; null when none are available (see `seriesError`). */
  series: TrialSeries | null;
  seriesError: string | null;
  /** Backend warnings, verbatim (includes any "separate recorded run" provenance). */
  warnings: string[];
  /** Run date of the latest run as reported by the backend; null for the bundled demo copy. */
  runDate: string | null;
  /** True when the modes shown were recorded in different runs / result directories. */
  mixedRuns: boolean;
}

/** `/api/benchmarks?include_trials=true` -> summary rows + per-trial series (trial numbers kept as recorded). */
export function toBenchmarkAnalytics(api: ApiBenchmarks): BenchmarkAnalytics {
  const rows = toBenchmarkRows(api);
  const modes = api.latest?.modes ?? [];
  const series: TrialSeries = { M0_OSPFv3: [], P1_SRv6: [], P2_SRv6: [] };
  for (const m of modes) {
    if (!(m.mode in series)) continue;
    series[m.mode as BenchmarkMode] = (m.trial_rows ?? []).map((t) => ({
      trial: t.trial,
      avgMs: t.avg_rtt_ms,
      minMs: t.min_rtt_ms,
      maxMs: t.max_rtt_ms,
      durationMs: t.duration_ms,
      transmitted: t.transmitted,
      received: t.received,
    }));
  }
  const hasPoints = Object.values(series).some((s) => s.length > 0);
  const dirs = new Set(modes.map((m) => m.source_file.replace(/\/[^/]*$/, '')));
  return {
    rows,
    series: hasPoints ? series : null,
    seriesError: hasPoints ? null : 'the backend returned no per-trial rows',
    warnings: api.warnings ?? [],
    runDate: api.latest?.run_date ?? null,
    mixedRuns: dirs.size > 1,
  };
}

export function toFailoverTrial(api: ApiFailover): FailoverTrial {
  const t = api.headline_trial;
  const m = t?.metrics;
  if (!t || !m || m.first_fail_to_install_s == null || m.first_fail_to_recovery_s == null || m.install_to_recovery_s == null) {
    throw new Error('The backend found no verified failover recovery in the recorded log.');
  }
  const ev = (k: string) => t.events.find((e) => e.kind === k)?.timestamp ?? '';
  const v = t.verification;
  return {
    sourceFile: api.source_log ?? '',
    runStart: t.run_start,
    detectionThreshold: t.detection_threshold ?? api.detection_threshold ?? 3,
    probesSucceededBeforeFailure: t.probes_succeeded_before_failure,
    events: t.events.map((e) => ({ timestamp: e.timestamp, kind: e.kind as FailoverEventKind, message: e.message })),
    metrics: {
      firstFailedProbe: ev('probe_failed'),
      p2Installed: ev('p2_installed'),
      recoveryVerified: ev('recovery_verified'),
      firstFailToInstallS: m.first_fail_to_install_s,
      firstFailToRecoveryS: m.first_fail_to_recovery_s,
      installToRecoveryS: m.install_to_recovery_s,
    },
    verification:
      v && v.rtt_min_ms != null && v.rtt_avg_ms != null && v.rtt_max_ms != null && v.rtt_mdev_ms != null
        ? {
            transmitted: v.transmitted,
            received: v.received,
            lossPercent: v.packet_loss_percent,
            rttMinMs: v.rtt_min_ms,
            rttAvgMs: v.rtt_avg_ms,
            rttMaxMs: v.rtt_max_ms,
            rttMdevMs: v.rtt_mdev_ms,
          }
        : null,
  };
}

/** One controller run in the M2 log, as listed in the recorded-runs table. */
export interface FailoverRunRow {
  runId: number;
  started: string;
  outcome: ApiFailoverOutcome;
  isHeadline: boolean;
  probeFailures: number;
  failoverAttempts: number;
  errorCount: number;
  firstFailToRecoveryS: number | null;
  verification: { received: number; transmitted: number } | null;
}

/** Everything `/api/failover` says beyond the headline trial. Absent (null) in the bundled demo fallback. */
export interface FailoverDetails {
  measurementScope: 'single_trial' | 'none';
  scopeNote: string;
  limitations: string[];
  /** Link that was failed, as the backend names it (e.g. "R2-R5"). */
  failureLink: string | null;
  runsInLog: number;
  recoveredRuns: number;
  headlineRunId: number;
  runs: FailoverRunRow[];
  /** Backend cross-check against the repository's own summary file; null if no summary file exists. */
  summaryCheck: { file: string; matches: boolean; mismatches: string[] } | null;
  dataSourceDescription: string;
  liveTelemetry: boolean;
  warnings: string[];
}

export interface FailoverMonitor {
  trial: FailoverTrial;
  details: FailoverDetails | null;
}

/** `/api/failover` -> the existing headline-trial shape plus the scenario/run details around it. */
export function toFailoverMonitor(api: ApiFailover): FailoverMonitor {
  const trial = toFailoverTrial(api);
  const check = api.summary_file_check;
  const mismatches = check
    ? Object.keys(check.expected).filter((k) => !(k in check.computed) || Math.abs(check.expected[k] - check.computed[k]) > 5e-4).map((k) => `${k}: file=${check.expected[k]} recomputed=${check.computed[k] ?? 'n/a'}`)
    : [];
  return {
    trial,
    details: {
      measurementScope: api.measurement_scope,
      scopeNote: api.scope_note,
      limitations: api.limitations ?? [],
      failureLink: api.failure_link,
      runsInLog: api.runs_in_log,
      recoveredRuns: api.recovered_runs,
      headlineRunId: api.headline_trial?.run_id ?? -1,
      runs: (api.runs ?? []).map((r) => ({
        runId: r.run_id,
        started: r.started,
        outcome: r.outcome,
        isHeadline: r.is_headline,
        probeFailures: r.probe_failures,
        failoverAttempts: r.failover_attempts,
        errorCount: r.error_count,
        firstFailToRecoveryS: r.metrics?.first_fail_to_recovery_s ?? null,
        verification: r.verification ? { received: r.verification.received, transmitted: r.verification.transmitted } : null,
      })),
      summaryCheck: check ? { file: check.file, matches: check.matches, mismatches: check.matches ? [] : mismatches } : null,
      dataSourceDescription: api.data_source.description,
      liveTelemetry: api.data_source.live_telemetry,
      warnings: api.warnings ?? [],
    },
  };
}

export function toLogEntries(api: ApiLogs): LogEntry[] {
  return api.entries.map((e) => ({
    id: e.id,
    timestamp: e.timestamp ?? 'no timestamp recorded',
    category: e.category,
    description: e.message,
    status: e.severity,
    sourceFile: e.source_file,
    kind: e.kind,
  }));
}

/** `/api/logs` entries plus the response metadata the Logs page shows (null in the bundled demo fallback). */
export interface LogsView {
  entries: LogEntry[];
  meta: {
    totalAvailable: number;
    returned: number;
    description: string;
    generatedAt: string;
    warnings: string[];
    missingFiles: string[];
    notes: string[];
  } | null;
}

export function toLogsView(api: ApiLogs): LogsView {
  return {
    entries: toLogEntries(api),
    meta: {
      totalAvailable: api.total_available,
      returned: api.returned,
      description: api.data_source.description,
      generatedAt: api.generated_at,
      warnings: api.warnings ?? [],
      missingFiles: api.data_source.missing_files ?? [],
      notes: api.notes ?? [],
    },
  };
}
