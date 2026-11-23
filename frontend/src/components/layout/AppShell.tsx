import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const COLLAPSE_KEY = 'netnova.sidebar.collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* preference is optional */
    }
  }, [collapsed]);

  // Always start a new page at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />

      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[248px]'}`}>
        <TopBar onMenu={() => setNavOpen(true)} />

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
