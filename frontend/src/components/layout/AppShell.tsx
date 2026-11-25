import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="min-h-screen transition-all duration-300 lg:pl-60">
        <TopBar onMenu={() => setNavOpen(true)} />

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-5 lg:px-8 lg:py-8">
          <div className="animate-in fade-in duration-300">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
