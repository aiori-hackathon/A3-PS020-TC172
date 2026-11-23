import { parseCsv } from '../lib/csv';
import type { BenchmarkMode } from '../types';

/**
 * Per-trial rows of the final (2026-10-31) benchmark. These CSVs are copied byte-for-byte
 * from src/results/final by scripts/sync-data.mjs and are now ONLY the demo fallback, used
 * when the backend is unavailable. With a backend, the same series comes from
 * `/api/benchmarks?include_trials=true` (see `toBenchmarkAnalytics` in adapters.ts).
 */
export interface TrialPoint {
  trial: number;
  avgMs: number;
  minMs: number | null;
  maxMs: number;
  durationMs: number;
  transmitted: number;
  received: number;
}

export type TrialSeries = Record<BenchmarkMode, TrialPoint[]>;

const FILES: Record<BenchmarkMode, string> = {
  M0_OSPFv3: 'final/m0_benchmark_20261031.csv',
  P1_SRv6: 'final/p1_benchmark_20261031.csv',
  P2_SRv6: 'final/p2_benchmark_20261031.csv',
};

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

async function loadOne(path: string): Promise<TrialPoint[]> {
  const res = await fetch(`${DATA_BASE}/${path}`);
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status}).`);
  const rows = parseCsv(await res.text());
  const points = rows
    .map((r) => ({
      trial: Number(r.trial),
      avgMs: Number(r.avg_ms),
      minMs: Number(r.min_ms),
      maxMs: Number(r.max_ms),
      durationMs: Number(r.duration_ms),
      transmitted: Number(r.transmitted),
      received: Number(r.received),
    }))
    .filter((p) => Number.isFinite(p.trial) && Number.isFinite(p.avgMs));
  if (points.length === 0) throw new Error(`${path} contained no trial rows.`);
  return points;
}

export async function loadTrialSeries(): Promise<TrialSeries> {
  const [m0, p1, p2] = await Promise.all([loadOne(FILES.M0_OSPFv3), loadOne(FILES.P1_SRv6), loadOne(FILES.P2_SRv6)]);
  return { M0_OSPFv3: m0, P1_SRv6: p1, P2_SRv6: p2 };
}
