import { Menu, Activity } from 'lucide-react';
import { PROJECT } from '../../config/project';
import { useConnection } from '../../context/ConnectionContext';
import type { ConnectionState } from '../../context/ConnectionContext';
import { useClock } from '../../hooks/useClock';
import { StatusBadge } from '../ui/StatusBadge';
import type { Tone } from '../ui/Tone';

const CONNECTION_UI: Record<ConnectionState, { label: string; tone: Tone; pulse: boolean }> = {
  demo: { label: 'Demo data', tone: 'warn', pulse: false },
  connecting: { label: 'Connecting…', tone: 'info', pulse: true },
  connected: { label: 'API connected', tone: 'ok', pulse: true },
  error: { label: 'API unreachable · demo data', tone: 'bad', pulse: false },
};

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { state, health, demo, error, lastChecked } = useConnection();
  const now = useClock();
  const conn = CONNECTION_UI[state];

  const env = state === 'connected' && health ? `Backend · ${health.host_os}` : 'Demo';
  const envTone: Tone = state === 'connected' ? 'ok' : demo ? 'warn' : 'neutral';

  const date = now.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = now.toLocaleTimeString(undefined, { hour12: false });

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-600/40 bg-ink-900/90 px-4 backdrop-blur-xl lg:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-xl border border-ink-600/50 bg-ink-800/60 p-2 text-slate-400 transition-colors hover:bg-ink-700 hover:text-white lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/10 sm:flex">
          <Activity className="h-4 w-4 text-cyan-400" />
        </div>

        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold tracking-wide text-slate-100">
            {PROJECT.name}
          </div>
          <div className="mono mt-1 truncate text-[10px] tracking-wider text-slate-500">
            {PROJECT.code}
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3 lg:gap-4">
        <div className="hidden items-center gap-2 rounded-xl border border-ink-600/40 bg-ink-800/40 px-3 py-2 md:flex">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Environment
          </span>
          <StatusBadge tone={envTone}>{env}</StatusBadge>
        </div>

        <div
          className="max-w-[170px] sm:max-w-none"
          title={error ?? (lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : '')}
        >
          <StatusBadge tone={conn.tone} dot pulse={conn.pulse}>
            {conn.label}
          </StatusBadge>
        </div>

        <div className="hidden rounded-xl border border-ink-600/40 bg-ink-800/40 px-3 py-2 text-right leading-tight sm:block">
          <div className="mono text-xs font-medium tracking-wide text-slate-200">
            {time}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            {date}
          </div>
        </div>
      </div>
    </header>
  );
}
