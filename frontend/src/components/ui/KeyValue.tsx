import type { ReactNode } from 'react';

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-ink-600/30 py-2.5 text-[13px] last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{children}</span>
    </div>
  );
}
