import { legendFor } from './TopologyDiagram';
import type { TopologyView } from './TopologyDiagram';

export function Legend({ view, showFailureTestKey = false }: { view: TopologyView; showFailureTestKey?: boolean }) {
  const items = legendFor(view);
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <svg width="26" height="6" aria-hidden="true">
            <line x1="1" y1="3" x2="25" y2="3" stroke={i.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={i.dashed ? '2 5' : undefined} />
          </svg>
          {i.label}
        </li>
      ))}
      {showFailureTestKey && view !== 'M2' && (
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded-[4px] border border-[#a8842d] bg-ink-900" aria-hidden="true" />
          Failure-test link (R2–R5)
        </li>
      )}
    </ul>
  );
}
