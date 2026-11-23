import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS } from '../../config/nav';
import { PROJECT } from '../../config/project';
import { LogoMark } from '../brand/Logo';

interface Props {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ open, onClose, collapsed, onToggleCollapsed }: Props) {
  // `collapsed` only applies from the lg breakpoint up; the mobile drawer is always expanded.
  const hideWhenCollapsed = collapsed ? 'lg:hidden' : '';

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-600/50 bg-ink-900 transition-[transform,width] duration-200 lg:translate-x-0 ${
          collapsed ? 'lg:w-[72px]' : 'lg:w-[248px]'
        } ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Primary navigation"
      >
        {/* Brand */}
        <div className={`flex h-16 shrink-0 items-center justify-between gap-3 border-b border-ink-600/50 px-4 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark className="h-9 w-9 shrink-0" />
            <div className={`min-w-0 leading-tight ${hideWhenCollapsed}`}>
              <div className="text-[15px] font-semibold tracking-tight text-slate-50">{PROJECT.product}</div>
              <div className="mono mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">
                {PROJECT.problemStatement} · SRv6 lab
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
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group} className="mb-4 last:mb-0">
              <div className={`mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 ${hideWhenCollapsed}`}>{group}</div>
              {collapsed && <div className="mx-3 mb-2 hidden border-t border-ink-600/50 first:hidden lg:block" />}
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((n) => n.group === group).map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={onClose}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
                        isActive ? 'bg-ink-700/70 text-slate-50' : 'text-slate-400 hover:bg-ink-800/80 hover:text-slate-200'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute -left-3 bottom-1.5 top-1.5 w-[3px] rounded-r-full bg-cyan-400" />}
                        <Icon className={`h-[17px] w-[17px] shrink-0 transition-colors ${isActive ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-300'}`} />
                        <span className={`flex-1 truncate ${hideWhenCollapsed}`}>{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-ink-600/50 p-3">
          <div className={`mb-2 rounded-lg border border-ink-600/40 bg-ink-800/40 p-3 ${hideWhenCollapsed}`}>
            <div className="text-xs font-semibold text-slate-300">Team {PROJECT.team}</div>
            <div className="mono mt-0.5 text-[10px] text-slate-500">{PROJECT.code}</div>
            <p className="mt-2 border-t border-ink-600/40 pt-2 text-[10px] leading-relaxed text-slate-500">
              Linux namespace emulation. Results represent the tested environment only.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={`hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-ink-800 hover:text-slate-200 lg:flex ${collapsed ? 'justify-center px-0' : ''}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
