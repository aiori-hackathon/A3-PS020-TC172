import { AlertTriangle, Info } from 'lucide-react';
import type { ReactNode } from 'react';

type NoticeTone = 'amber' | 'red' | 'sky';

const BOX: Record<NoticeTone, string> = {
  amber: 'border-amber-400/25 bg-amber-400/[0.04] text-amber-100/80',
  red: 'border-red-400/25 bg-red-400/[0.04] text-red-100/80',
  sky: 'border-sky-400/20 bg-sky-400/[0.04] text-sky-100/75',
};
const HEAD: Record<NoticeTone, string> = { amber: 'text-amber-300', red: 'text-red-300', sky: 'text-sky-300' };
const ICON: Record<NoticeTone, string> = { amber: 'text-amber-400', red: 'text-red-400', sky: 'text-sky-400' };

/** Inline banner. `title` is rendered in its own <strong> so it stays a distinct text node. */
export function Notice({
  tone,
  title,
  children,
  className = 'mb-4',
}: {
  tone: NoticeTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'sky' ? Info : AlertTriangle;
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed ${BOX[tone]} ${className}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ICON[tone]}`} />
      <div className="min-w-0">
        {title && <strong className={`font-semibold ${HEAD[tone]}`}>{title}</strong>} {children}
      </div>
    </div>
  );
}
