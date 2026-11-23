// Failover Monitoring: scenario, runs, scope, limitations and summary check come from /api/failover;
// the bundled trial.json is only the labelled demo fallback. The "backend" replays responses captured
// from the real FastAPI backend (fixtures/failover.json, fixtures/topology.json).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toFailoverMonitor } from '../services/adapters';
import type { ApiFailover } from '../types/api';

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
  const { FailoverPage } = await import('../pages/FailoverPage');
  return render(
    <MemoryRouter>
      <FailoverPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const backendWith = (failover: unknown = fx('failover')): Handler => (u) =>
  u.pathname === '/api/failover' ? json(failover) : u.pathname === '/api/topology' ? json(fx('topology')) : json({}, 404);

describe('Failover Monitoring + API integration', () => {
  it('shows the scenario, runs, scope, limitations and verification from the backend', async () => {
    const api = fx('failover') as ApiFailover;
    const calls = stubFetch(backendWith());
    await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('Recorded controller runs')).toBeTruthy());

    expect(calls.some((c) => c.startsWith(`${BACKEND}/api/failover`))).toBe(true);
    expect(calls.filter((c) => c.includes('/data/'))).toHaveLength(0); // no bundled trial.json
    expect(screen.queryByText('Demo fallback')).toBeNull();

    // headline trial + metrics (unchanged behaviour)
    expect(screen.getAllByText('11.405').length).toBeGreaterThan(0);
    expect(screen.getByText('Recovery verified')).toBeTruthy();

    // scope note and limitations: the backend's own wording
    expect(screen.getByText(api.scope_note)).toBeTruthy();
    for (const l of api.limitations) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.queryByText(/not an average or a guaranteed recovery time/)).toBeNull(); // bundled wording is demo-only

    // recorded vs live: the backend's own description of the data source
    expect(screen.getByText(/not live telemetry/)).toBeTruthy();

    // summary cross-check
    expect(screen.getByText('Matches')).toBeTruthy();
    expect(screen.getByText(api.summary_file_check!.file)).toBeTruthy();

    // scenario + headline details
    expect(screen.getByText('R2–R5 was deliberately failed; P2 was installed at R1')).toBeTruthy();
    expect(screen.getByText(/Headline trial: run 5 · started 2026-10-30 23:09:59\.337/)).toBeTruthy();

    // runs table: every run in the log, outcomes as recorded, one headline
    const table = screen.getByText('Recorded controller runs').closest('section')!;
    expect(within(table).getByText(/5 controller runs in the log · 2 reached verified recovery · only run 5/)).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(1 + api.runs.length);
    expect(within(table).getAllByText('Headline')).toHaveLength(1);
    for (const label of ['P2 installed, not verified', 'P2 install failed', 'Timed out']) expect(within(table).getByText(label)).toBeTruthy();
    expect(within(table).getAllByText('Recovered')).toHaveLength(2);
  });

  it('draws the failure link the backend reports', async () => {
    const api = { ...fx('failover'), failure_link: 'R3-R4' };
    stubFetch(backendWith(api));
    const { container } = await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('R3–R4 was deliberately failed; P2 was installed at R1')).toBeTruthy());
    const titles = [...container.querySelectorAll('svg title')].map((t) => t.textContent ?? '');
    expect(titles.find((t) => t.startsWith('R3 — R4'))).toContain('failed in the recorded M2 scenario');
    expect(titles.find((t) => t.startsWith('R2 — R5'))).not.toContain('failed in the recorded M2 scenario');
  });

  it('reports a summary mismatch instead of hiding it', async () => {
    const api = fx('failover');
    api.summary_file_check = { ...api.summary_file_check, matches: false, expected: { first_fail_to_recovery_s: 99.999 }, computed: { first_fail_to_recovery_s: 11.405 } };
    stubFetch(backendWith(api));
    await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('Mismatch')).toBeTruthy());
    expect(screen.getByText(/first_fail_to_recovery_s: file=99\.999 recomputed=11\.405/)).toBeTruthy();
    expect(screen.queryByText('Matches')).toBeNull();
  });

  it('shows backend warnings and a missing summary file honestly', async () => {
    const api = { ...fx('failover'), warnings: ['Missing file: src/results/m2/failover_summary.txt'], summary_file_check: null };
    stubFetch(backendWith(api));
    await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('Missing file: src/results/m2/failover_summary.txt')).toBeTruthy());
    expect(screen.getByText('No summary file')).toBeTruthy();
  });

  it('falls back to the labelled bundled trial when the backend is down', async () => {
    const calls = stubFetch(null);
    await mount(BACKEND);
    await waitFor(() => expect(screen.getAllByText('Demo fallback').length).toBeGreaterThan(0));
    expect(calls.some((c) => c.endsWith('/data/m2/trial.json'))).toBe(true);
    expect(screen.getAllByText('11.405').length).toBeGreaterThan(0);
    expect(screen.getByText(/not an average or a guaranteed recovery time/)).toBeTruthy(); // bundled scope text
    expect(screen.getByText('Recovery verified')).toBeTruthy();
    expect(screen.getByText('R2–R5 was deliberately failed; P2 was installed at R1')).toBeTruthy(); // from the bundled topology config
    // nothing the bundled copy cannot supply is invented
    expect(screen.queryByText('Recorded controller runs')).toBeNull();
    expect(screen.queryByText('Limitations')).toBeNull();
    expect(screen.queryByText('Matches')).toBeNull();
    expect(screen.queryByText(/not live telemetry/)).toBeNull();
    expect(screen.getByText(/M2 information is historical/)).toBeTruthy(); // recorded-not-live notice stays
  });

  it('treats an unusable payload as a backend failure and falls back', async () => {
    stubFetch(backendWith({ ...fx('failover'), headline_trial: null }));
    await mount(BACKEND);
    await waitFor(() => expect(screen.getAllByText('Demo fallback').length).toBeGreaterThan(0));
    expect(screen.queryByText('Recorded controller runs')).toBeNull();
  });

  it('demo mode (no backend URL) makes no API requests', async () => {
    const calls = stubFetch(backendWith());
    await mount('');
    await waitFor(() => expect(screen.getAllByText('Demo fallback').length).toBeGreaterThan(0));
    expect(calls.filter((c) => c.includes('/api/'))).toHaveLength(0);
  });
});

describe('toFailoverMonitor', () => {
  const api = fx('failover') as ApiFailover;

  it('keeps the headline trial and adds scenario details', () => {
    const m = toFailoverMonitor(api);
    expect(m.trial.metrics.firstFailToRecoveryS).toBe(11.405);
    const d = m.details!;
    expect(d.failureLink).toBe('R2-R5');
    expect(d.headlineRunId).toBe(5);
    expect(d.runs.map((r) => r.outcome)).toEqual(['installed_unverified', 'recovered', 'install_failed', 'timeout', 'recovered']);
    expect(d.runs.filter((r) => r.isHeadline).map((r) => r.runId)).toEqual([5]);
    expect(d.runs[4]).toMatchObject({ firstFailToRecoveryS: 11.405, verification: { received: 5, transmitted: 5 } });
    expect(d.runs[3].firstFailToRecoveryS).toBeNull(); // no measurement is invented for a run that never failed over
    expect(d.summaryCheck).toEqual({ file: 'src/results/m2/failover_summary.txt', matches: true, mismatches: [] });
    expect(d.liveTelemetry).toBe(false);
  });

  it('takes the detection threshold from the response when the trial lacks it', () => {
    const copy = structuredClone(api);
    copy.headline_trial!.detection_threshold = null;
    copy.detection_threshold = 4;
    expect(toFailoverMonitor(copy).trial.detectionThreshold).toBe(4);
  });
});
