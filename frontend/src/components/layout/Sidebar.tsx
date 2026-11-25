import { NavLink } from 'react-router-dom';
import { X, ChevronRight, Shield, Network } from 'lucide-react';
import { NAV_ITEMS } from '../../config/nav';
import { PROJECT } from '../../config/project';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: Props) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-600/60 bg-ink-900 transition-transform duration-200 lg:w-60 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Primary navigation"
      >
        {/* Brand */}
        <div className="flex h-[68px] items-center justify-between gap-3 border-b border-ink-600/60 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 to-blue-500/10 shadow-lg shadow-cyan-950/20">
              <img src="/favicon.svg" alt="" className="h-6 w-6" />
            </div>

            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide text-slate-100">
                {PROJECT.name}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-400/70">
                <Network className="h-3 w-3" />
                Network Operations
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-ink-700 hover:text-slate-200 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <div className="px-4 pb-1 pt-5">
          <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Workspace
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'border border-cyan-400/15 bg-gradient-to-r from-cyan-400/10 to-transparent text-cyan-300 shadow-sm shadow-cyan-950/10'
                    : 'border border-transparent text-slate-400 hover:bg-ink-800/80 hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-cyan-400" />
                  )}

                  <Icon
                    className={`h-[17px] w-[17px] shrink-0 transition-colors ${
                      isActive
                        ? 'text-cyan-400'
                        : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />

                  <span className="flex-1 truncate">{label}</span>

                  {isActive && (
                    <ChevronRight className="h-3.5 w-3.5 text-cyan-400/70" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-ink-600/60 p-4">
          <div className="rounded-xl border border-ink-600/50 bg-ink-800/50 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/10">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-300">
                  Team {PROJECT.team}
                </div>
                <div className="text-[10px] text-slate-500">
                  Experimental environment
                </div>
              </div>
            </div>

            <div className="mt-2.5 border-t border-ink-600/40 pt-2 text-[10px] leading-relaxed text-slate-500">
              Linux namespace emulation. Results represent the tested environment only.
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
