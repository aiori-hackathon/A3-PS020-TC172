import { useApiData } from './useApiData';
import { toBenchmarkAnalytics, toBenchmarkRows, toFailoverMonitor, toFailoverTrial } from '../services/adapters';
import type { BenchmarkAnalytics, FailoverMonitor } from '../services/adapters';
import { getBenchmarks, getFailover, getOverview } from '../services/api';
import { loadBenchmarkSummary, loadFailoverTrial } from '../services/recorded';
import { loadTrialSeries } from '../services/trialSeries';
import type { ApiOverview } from '../types/api';

/** Same data path the original pages used: backend first, labelled bundled fallback second. */
export function useBenchmarks() {
  return useApiData(async () => toBenchmarkRows(await getBenchmarks()), loadBenchmarkSummary);
}

/**
 * Benchmark Analytics: summary + per-trial series from `/api/benchmarks?include_trials=true`.
 * Only if the backend is unavailable does it fall back (labelled as demo data) to the bundled
 * summary and per-trial CSVs. A missing per-trial CSV does not hide the summary.
 */
export function useBenchmarkAnalytics() {
  return useApiData<BenchmarkAnalytics>(
    async () => toBenchmarkAnalytics(await getBenchmarks(true)),
    async () => {
      const [rows, seriesResult] = await Promise.all([
        loadBenchmarkSummary(),
        loadTrialSeries().then(
          (series) => ({ series, error: null as string | null }),
          (e: unknown) => ({ series: null, error: e instanceof Error ? e.message : String(e) }),
        ),
      ]);
      return { rows, series: seriesResult.series, seriesError: seriesResult.error, warnings: [], runDate: null, mixedRuns: false };
    },
  );
}

export function useTrial() {
  return useApiData(async () => toFailoverTrial(await getFailover()), loadFailoverTrial);
}

/**
 * Failover Monitoring: the headline trial plus run list, scope, limitations and summary check, all from
 * `/api/failover`. The bundled fallback only has the headline trial, so `details` is null in demo mode.
 */
export function useFailoverMonitor() {
  return useApiData<FailoverMonitor>(
    async () => toFailoverMonitor(await getFailover()),
    async () => ({ trial: await loadFailoverTrial(), details: null }),
  );
}

/** `/api/overview` (per-mode configuration text). There is no bundled copy, so the fallback is `null` and pages use their config text. */
export function useOverview() {
  return useApiData<ApiOverview | null>(getOverview, async () => null);
}
