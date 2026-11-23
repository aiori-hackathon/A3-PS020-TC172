// Experiment Logs: entries, warnings and notes come from /api/logs (fixtures/logs.json is a captured
// response; one event entry is added in the test to exercise the Type filter). The bundled recorded
// results are only the labelled demo fallback.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiLogs } from '../types/api';

const fx = (n: string) => JSON.parse(readFileSync(resolve(__dirname, 'fixtures', `${n}.json`), 'utf8'));
const BACKEND = 'http://backend.test:8000';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Handler = (url: URL) => Response | Promise<Response>;

function stubFetch(apiHandler: Handler | null) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    calls.push(url.href);
    if (url.href.startsWith(BACKEND)) {
      if (!apiHandler) throw new TypeError('Failed to fetch');
      return apiHandler(url);
    }
    return new Response('', { status: 404 });
  }));
  return calls;
}

async function mount(apiUrl: string) {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', apiUrl);
  vi.stubEnv('VITE_USE_MOCK', '');
  const { LogsPage } = await import('../pages/LogsPage');
  return render(
    <MemoryRouter>
      <LogsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const base = fx('logs') as ApiLogs;
const withEvent: ApiLogs = {
  ...base,
  total_available: base.total_available + 1,
  returned: base.returned + 1,
  entries: [
    ...base.entries,
    {
      id: 'evt-m2-1',
      timestamp: '2026-10-30 17:55:01',
      category: 'M2',
      kind: 'event',
      severity: 'error',
      message: 'Probe failed: R2-R5 link down',
      source_file: 'src/results/m2/failover_success_20261030.log',
    },
  ],
};
const backend = (body: unknown = withEvent): Handler => (u) => (u.pathname === '/api/logs' ? json(body) : json({}, 404));
const rowsOf = () => screen.getAllByRole('row').slice(1); // minus header

describe('Experiment Logs + API integration', () => {
  it('lists /api/logs entries, labelled as recorded historical data', async () => {
    const calls = stubFetch(backend());
    await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('Probe failed: R2-R5 link down')).toBeTruthy());
    expect(rowsOf()).toHaveLength(withEvent.entries.length);
    expect(screen.getByText(/Historical, recorded data/)).toBeTruthy();
    expect(screen.getByText('Recorded')).toBeTruthy();
    expect(screen.queryByText('Demo fallback')).toBeNull();
    expect(screen.getByText(/Routine successful probes in the M2 log are not listed/)).toBeTruthy(); // backend note
    expect(calls.some((c) => c.startsWith(`${BACKEND}/api/logs`))).toBe(true);
    const methods = (fetch as unknown as { mock: { calls: [unknown, RequestInit?][] } }).mock.calls.map((c) => c[1]?.method ?? 'GET');
    expect(new Set(methods)).toEqual(new Set(['GET']));
  });

  it('filters by type, source file and search, and clears the filters', async () => {
    stubFetch(backend());
    await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('Probe failed: R2-R5 link down')).toBeTruthy());

    const type = within(screen.getByRole('group', { name: 'Filter by type' }));
    fireEvent.click(type.getByRole('button', { name: /Events/ }));
    expect(rowsOf()).toHaveLength(1);
    fireEvent.click(type.getByRole('button', { name: /Records/ }));
    expect(rowsOf()).toHaveLength(base.entries.length);
    fireEvent.click(type.getByRole('button', { name: /^All/ }));

    fireEvent.change(screen.getByLabelText('Source file'), { target: { value: 'src/results/m0_summary.txt' } });
    expect(rowsOf()).toHaveLength(1);
    expect(screen.getByText('Filtered from 5')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
    expect(rowsOf()).toHaveLength(withEvent.entries.length);

    fireEvent.change(screen.getByLabelText('Search logs'), { target: { value: 'no-such-text' } });
    expect(screen.getByText('No matching log entries')).toBeTruthy();
  });

  it('shows backend warnings and says when the list is partial', async () => {
    stubFetch(backend({ ...withEvent, warnings: ['Missing file: src/results/x.log'], total_available: 900 }));
    await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('Missing file: src/results/x.log')).toBeTruthy());
    expect(screen.getByText(/most recent of 900 available entries/)).toBeTruthy();
  });

  it('falls back to the labelled bundled recorded results when the backend is down', async () => {
    stubFetch(null);
    await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('Demo fallback.')).toBeTruthy());
    expect(screen.getByText('Demo fallback')).toBeTruthy(); // source tag
    expect(rowsOf().length).toBeGreaterThan(0);
    expect(screen.getByText(/Historical, recorded data/)).toBeTruthy();
  });

  it('falls back on an HTTP error as well', async () => {
    stubFetch(() => json({ detail: 'boom' }, 500));
    await mount(BACKEND);
    await waitFor(() => expect(screen.getByText('Demo fallback.')).toBeTruthy());
    expect(rowsOf().length).toBeGreaterThan(0);
  });
});
