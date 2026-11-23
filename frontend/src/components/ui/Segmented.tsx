export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  /** Optional colour dot identifying the experiment / path. */
  color?: string;
}

/** Compact single-select control (view switcher). Buttons expose aria-pressed. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-ink-600/70 bg-ink-900/80 p-0.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              on ? 'bg-ink-700 text-slate-50 shadow-sm' : 'text-slate-500 hover:text-slate-200'
            }`}
          >
            {o.color && <span className="h-2 w-2 rounded-full" style={{ background: o.color, opacity: on ? 1 : 0.55 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
