// Benchmark Analytics: summary AND per-trial charts must come from one backend response
// (/api/benchmarks?include_trials=true); the bundled CSVs are only the labelled demo fallback.
// The "backend" replays a response captured from the real FastAPI backend (fixtures/benchmarks_trials.json).
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toBenchmarkAnalytics } from '../services/adapters';
import type { ApiBenchmarks } from '../types/api';

const fx = (n: string) => JSON.parse(readFileSync(resolve(__dirname, 'fixtures', `${n}.json`), 'utf8'));
const pub = (p: string) => readFileSync(resolve(__dirname, '../../public', p), 'utf8');
const BACKEND = 'http://backend.test:8000';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Handler = (url: URL) => Response | Promise<Response>;

function stubFetch(apiHandler: Handler | null) {
  const calls: string[] = [];
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    calls.push(url.href);
    if (url.href.startsWith(BACKEND)) {
      if (!apiHandler) throw new TypeError('Failed to fetch');
      return apiHandler(url);
    }
    if (url.pathname.startsWith('/data/')) {
      try { return new Response(pub(url.pathname.slice(1))); } catch { return new Response('', { status: 404 }); }
    }
    return new Response('', { status: 404 });
  }));
  return calls;
}

async function mount(apiUrl: string) {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', apiUrl);
  vi.stubEnv('VITE_USE_MOCK', '');
  const { BenchmarksPage } = await import('../pages/BenchmarksPage');
  return render(
    <MemoryRouter>
      <BenchmarksPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const backend: Handler = (u) => (u.pathname === '/api/benchmarks' ? json(fx('benchmarks_trials')) : json({}, 404));

describe('Benchmark Analytics + API integration', () => {
  it('requests per-trial rows from the backend and does not read the bundled trial CSVs', async () => {
    const calls = stubFetch(backend);
    await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('Benchmark detail table')).toBeTruthy());
    expect(calls).toContain(`${BACKEND}/api/benchmarks?include_trials=true`);
    expect(calls.filter((c) => c.includes('/data/'))).toHaveLength(0); // no stale bundled CSVs
    // Current backend values (M0 20261121 + validated P1 recovery run), not the bundled 2026-10-31 ones (0.05693).
    expect(screen.getAllByText(/0\.01133/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/0\.05693/)).toBeNull();
    expect(screen.queryByText('Demo fallback')).toBeNull();
    expect(screen.getByText(/latest benchmark run \(2026-11-21\)/)).toBeTruthy();
    expect(screen.queryByText(/2026-10-31/)).toBeNull();
    expect(screen.queryByText(/Per-trial results are unavailable/)).toBeNull();
  });

  it('keeps the backend\'s cross-run warnings visible', async () => {
    stubFetch(backend);
    await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('Cross-run comparison.')).toBeTruthy());
    for (const w of fx('benchmarks_trials').warnings as string[]) expect(screen.getByText(w)).toBeTruthy();
    expect(screen.getAllByText(/separate recorded run/).length).toBeGreaterThan(0);
  });

  it('falls back to the labelled bundled CSVs when the backend is down', async () => {
    const calls = stubFetch(null);
    await mount(BACKEND);
    await waitFor(() => expect(screen.getAllByText(/0\.05693/).length).toBeGreaterThan(0));
    expect(screen.getAllByText('Demo fallback').length).toBeGreaterThan(0);
    expect(screen.getByText(/final benchmark generation \(2026-10-31\)/)).toBeTruthy();
    expect(screen.queryByText('Cross-run comparison.')).toBeNull();
    expect(calls.some((c) => c.endsWith('/data/final/p1_benchmark_20261031.csv'))).toBe(true);
    expect(screen.queryByText(/Per-trial results are unavailable/)).toBeNull();
  });

  it('shows the summary and says so when the backend sends no per-trial rows', async () => {
    const api = fx('benchmarks_trials');
    for (const m of api.latest.modes) m.trial_rows = null;
    stubFetch((u) => (u.pathname === '/api/benchmarks' ? json(api) : json({}, 404)));
    await mount(BACKEND);
    await waitFor(() => expect(screen.getAllByText(/Per-trial results are unavailable/).length).toBeGreaterThan(0));
    expect(screen.getByText(/the backend returned no per-trial rows/)).toBeTruthy();
    expect(screen.getAllByText(/0\.01133/).length).toBeGreaterThan(0); // summary unaffected
  });
});

describe('toBenchmarkAnalytics', () => {
  const api = fx('benchmarks_trials') as ApiBenchmarks;

  it('maps every backend trial row into the chart series', () => {
    const a = toBenchmarkAnalytics(api);
    expect(a.series).not.toBeNull();
    for (const m of api.latest!.modes) {
      const key = m.mode as 'M0_OSPFv3';
      expect(a.series![key]).toHaveLength(m.trials);
      expect(a.series![key][0]).toMatchObject({ trial: m.trial_rows![0].trial, avgMs: m.trial_rows![0].avg_rtt_ms, maxMs: m.trial_rows![0].max_rtt_ms });
    }
    expect(a.runDate).toBe('2026-11-21');
    expect(a.mixedRuns).toBe(true);
    expect(a.warnings).toEqual(api.warnings);
  });

  it('keeps recorded trial numbers when the backend excluded an invalid trial', () => {
    const copy = structuredClone(api);
    copy.latest!.modes[1].trial_rows = copy.latest!.modes[1].trial_rows!.filter((t) => t.trial !== 3);
    const trials = toBenchmarkAnalytics(copy).series!.P1_SRv6.map((p) => p.trial);
    expect(trials).toHaveLength(29);
    expect(trials.slice(0, 4)).toEqual([1, 2, 4, 5]);
  });

  it('is not flagged as mixed when every mode comes from one result directory', () => {
    const one = fx('benchmarks') as ApiBenchmarks; // captured from the single-run 2026-10-31 benchmark
    expect(toBenchmarkAnalytics(one).mixedRuns).toBe(false);
  });
});
