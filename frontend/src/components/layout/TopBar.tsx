import { Menu, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../../config/nav';
import { PROJECT } from '../../config/project';
import { useConnection } from '../../context/ConnectionContext';
import type { ConnectionState } from '../../context/ConnectionContext';
import { StatusBadge } from '../ui/StatusBadge';
import type { Tone } from '../ui/Tone';

const CONNECTION_UI: Record<ConnectionState, { label: string; tone: Tone; pulse: boolean }> = {
  demo: { label: 'Demo data', tone: 'warn', pulse: false },
  connecting: { label: 'Connecting…', tone: 'info', pulse: true },
  connected: { label: 'API connected', tone: 'ok', pulse: true },
  error: { label: 'API unreachable · demo data', tone: 'bad', pulse: false },
};

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { state, health, error, lastChecked, checking, refresh } = useConnection();
  const { pathname } = useLocation();
  const conn = CONNECTION_UI[state];
  const page = NAV_ITEMS.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)));

  const detail =
    error ??
    (state === 'connected' && health
      ? `Backend on ${health.host_os} · last checked ${lastChecked?.toLocaleTimeString() ?? '—'}`
      : lastChecked
        ? `Last checked ${lastChecked.toLocaleTimeString()}`
        : '');

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-600/40 bg-ink-950/85 px-4 backdrop-blur-xl lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-lg border border-ink-600/50 bg-ink-800/60 p-2 text-slate-400 transition-colors hover:bg-ink-700 hover:text-white lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="font-medium text-slate-400">{PROJECT.product}</span>
          <span aria-hidden="true">/</span>
          <span className="mono hidden text-[10px] tracking-wider sm:inline">{PROJECT.problemStatement}</span>
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-slate-100">{page?.label ?? 'Dashboard'}</div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <span className="hidden text-[11px] text-slate-500 xl:inline">
          Local SRv6 path steering · <span className="mono text-[10px] tracking-wider">{PROJECT.code}</span>
        </span>
        <span className="hidden h-5 w-px bg-ink-600/60 xl:block" aria-hidden="true" />

        {state === 'connected' && (
          <span className="hidden md:inline-flex">
            <StatusBadge tone="neutral">Recorded results · not live telemetry</StatusBadge>
          </span>
        )}

        <div title={detail} className="max-w-[190px] sm:max-w-none">
          <StatusBadge tone={conn.tone} dot pulse={conn.pulse}>
            {conn.label}
          </StatusBadge>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={state === 'demo'}
          className="rounded-lg border border-ink-600/50 bg-ink-800/60 p-2 text-slate-400 transition-colors hover:bg-ink-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Re-check backend connection"
          title={state === 'demo' ? 'No backend configured' : 'Re-check backend connection'}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
}
