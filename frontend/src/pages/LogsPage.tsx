import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDownUp, FilterX, RefreshCw, Search, X } from 'lucide-react';
import { CATEGORY_TONE, STATUS_TONE } from '../components/overview/RecentActivity';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadState } from '../components/ui/LoadState';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { SourceTag } from '../components/ui/SourceTag';
import { StatusBadge } from '../components/ui/StatusBadge';
import { toneDot } from '../components/ui/Tone';
import { RECORDED_ACTIVITY } from '../data/recorded';
import { useApiData } from '../hooks/useApiData';
import { toLogsView } from '../services/adapters';
import type { LogsView } from '../services/adapters';
import { getLogs } from '../services/api';
import type { LogCategory, LogEntry, LogStatus } from '../types';

const CATEGORIES: LogCategory[] = ['M0', 'M1', 'M2', 'Benchmark'];
const SEVERITIES: LogStatus[] = ['error', 'warn', 'ok', 'info'];
const LOG_LIMIT = 500;
type LogKind = 'event' | 'record';
const KINDS: { id: LogKind; label: string; hint: string }[] = [
  { id: 'event', label: 'Events', hint: 'Individual lines taken from a recorded log' },
  { id: 'record', label: 'Records', hint: 'Summarised results taken from a result file' },
];

/** Bundled fallback: the same recorded results the Overview shows. They are summaries, so they are records. */
const loadFallback = async (): Promise<LogsView> => ({
  entries: RECORDED_ACTIVITY.map((e) => ({ ...e, kind: e.kind ?? 'record' })),
  meta: null,
});

function Highlight({ text, q }: { text: string; q: string }): ReactNode {
  const needle = q.trim();
  if (!needle) return text;
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-cyan-400/20 px-0.5 text-cyan-100">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

export function LogsPage() {
  // /api/logs (up to LOG_LIMIT entries, plus its warnings and notes). Fallback is the labelled, bundled
  // record of the result files that the Overview already uses, instead of an empty list.
  const logs = useApiData(async () => toLogsView(await getLogs({ limit: LOG_LIMIT })), loadFallback);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<'all' | LogCategory>('all');
  const [severity, setSeverity] = useState<'all' | LogStatus>('all');
  const [kind, setKind] = useState<'all' | LogKind>('all');
  const [file, setFile] = useState('all');
  const [reversed, setReversed] = useState(false);

  const all: LogEntry[] = useMemo(() => logs.data?.entries ?? [], [logs.data]);
  const meta = logs.data?.meta ?? null;
  // The backend reuses its benchmark loader, so its response also carries benchmark-run provenance warnings. Those are shown on the Overview and Benchmarks pages; here only log-related warnings are listed.
  const logWarnings = (meta?.warnings ?? []).filter((w) => !/benchmark|per-trial|recovery/i.test(w));
  const demo = logs.source === 'mock';
  const files = useMemo(() => [...new Set(all.map((e) => e.sourceFile).filter((f): f is string => !!f))].sort(), [all]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    all.forEach((e) => {
      c[`cat:${e.category}`] = (c[`cat:${e.category}`] ?? 0) + 1;
      c[`sev:${e.status}`] = (c[`sev:${e.status}`] ?? 0) + 1;
      if (e.kind) c[`kind:${e.kind}`] = (c[`kind:${e.kind}`] ?? 0) + 1;
      if (e.sourceFile) c[`file:${e.sourceFile}`] = (c[`file:${e.sourceFile}`] ?? 0) + 1;
    });
    return c;
  }, [all]);

  const entries = useMemo(() => {
    const needle = q.toLowerCase();
    const list = all.filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (severity === 'all' || e.status === severity) &&
        (kind === 'all' || e.kind === kind) &&
        (file === 'all' || e.sourceFile === file) &&
        `${e.description} ${e.sourceFile ?? ''} ${e.category} ${e.timestamp}`.toLowerCase().includes(needle),
    );
    return reversed ? [...list].reverse() : list;
  }, [all, q, category, severity, kind, file, reversed]);

  const filtered = q !== '' || category !== 'all' || severity !== 'all' || kind !== 'all' || file !== 'all';
  const clearFilters = () => {
    setQ('');
    setCategory('all');
    setSeverity('all');
    setKind('all');
    setFile('all');
  };
  const hasKinds = all.some((e) => e.kind);
  const truncated = meta !== null && meta.totalAvailable > meta.returned;

  return (
    <>
      <PageHeader
        title="Experiment Logs"
        description="Searchable, read-only view of the experiment events and records found in the result files, with the experiment each belongs to and where it came from."
        actions={
          <button type="button" className="btn" onClick={logs.reload}>
            <RefreshCw className={`h-3.5 w-3.5 ${logs.loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />
      <Notice tone="sky">
        Historical, recorded data — {(meta?.description ?? 'derived from the experiment result files; not a live log stream').replace(/\.+$/, '')}. Logs are read as text and displayed as
        recorded; original log files are never modified. Timestamps are shown exactly as written in the source file.
      </Notice>
      {demo && (
        <Notice tone="amber" title="Demo fallback.">
          {logs.backendError ? `The backend could not be reached (${logs.backendError.message}). ` : 'No backend is configured. '}
          Showing the bundled copy of the recorded results ({all.length} entries, records only); individual log events are available only from the backend.
        </Notice>
      )}
      {logWarnings.length > 0 && (
        <Notice tone="amber" title={`Backend data warnings (${logWarnings.length}).`}>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {logWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}
      {meta && truncated && (
        <Notice tone="amber" title="Partial list.">
          Showing the {meta.returned} most recent of {meta.totalAvailable} available entries; filters apply to these only.
        </Notice>
      )}

      <div className="panel mb-4 space-y-3 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search log messages or source…" aria-label="Search logs" className="input pl-9 pr-8" />
            {q && (
              <button type="button" onClick={() => setQ('')} className="absolute right-2 top-2 rounded p-0.5 text-slate-500 hover:text-slate-200" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button type="button" className="chip" aria-pressed={reversed} onClick={() => setReversed((r) => !r)} title="Reverse the order entries are listed in">
            <ArrowDownUp className="h-3 w-3" /> {reversed ? 'Oldest first' : 'Newest first'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by experiment">
            <span className="label mr-1">Experiment</span>
            <button type="button" className="chip" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
              All <span className="num text-slate-500">{all.length}</span>
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
                {c} <span className="num text-slate-500">{counts[`cat:${c}`] ?? 0}</span>
              </button>
            ))}
          </div>
          {hasKinds && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by type">
              <span className="label mr-1">Type</span>
              <button type="button" className="chip" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
                All
              </button>
              {KINDS.map((k) => (
                <button key={k.id} type="button" className="chip" title={k.hint} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                  {k.label} <span className="num text-slate-500">{counts[`kind:${k.id}`] ?? 0}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by severity">
            <span className="label mr-1">Severity</span>
            <button type="button" className="chip" aria-pressed={severity === 'all'} onClick={() => setSeverity('all')}>
              All
            </button>
            {SEVERITIES.map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={severity === s} onClick={() => setSeverity(s)}>
                <span className={`h-1.5 w-1.5 rounded-full ${toneDot[STATUS_TONE[s]]}`} /> {s} <span className="num text-slate-500">{counts[`sev:${s}`] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {files.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="log-source-file" className="label mr-1">
              Source file
            </label>
            <select id="log-source-file" value={file} onChange={(e) => setFile(e.target.value)} className="input mono !w-auto min-w-[260px] max-w-full !py-1.5 text-[12px]">
              <option value="all">All files ({files.length})</option>
              {files.map((f) => (
                <option key={f} value={f}>
                  {f} ({counts[`file:${f}`] ?? 0})
                </option>
              ))}
            </select>
            {filtered && (
              <button type="button" className="chip ml-auto" onClick={clearFilters}>
                <FilterX className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        )}
        {files.length <= 1 && filtered && (
          <div className="flex justify-end">
            <button type="button" className="chip" onClick={clearFilters}>
              <FilterX className="h-3 w-3" /> Clear filters
            </button>
          </div>
        )}
      </div>

      <LoadState loading={logs.loading && !logs.data} error={logs.error} />

      {(logs.data || !logs.loading) && !logs.error && (
        <Card
          title={`${entries.length} log entries`}
          subtitle={filtered ? `Filtered from ${all.length}` : meta ? `Generated ${meta.generatedAt} from recorded result files` : 'Bundled copy of the recorded results'}
          action={logs.data ? <SourceTag source={logs.source} /> : undefined}
          bodyClassName="!p-0"
        >
          {entries.length === 0 ? (
            <EmptyState title="No matching log entries" message={filtered ? 'Try a different search or clear the filters.' : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[800px]">
                <thead>
                  <tr>
                    <th className="w-44">Timestamp</th>
                    <th className="w-28">Experiment</th>
                    <th className="w-24">Severity</th>
                    {hasKinds && <th className="w-20">Type</th>}
                    <th>Event</th>
                    <th className="w-[26%]">Source</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="num whitespace-nowrap text-[11px] text-slate-400">{e.timestamp}</td>
                      <td>
                        <StatusBadge tone={CATEGORY_TONE[e.category]}>{e.category}</StatusBadge>
                      </td>
                      <td>
                        <StatusBadge tone={STATUS_TONE[e.status]} dot>
                          {e.status}
                        </StatusBadge>
                      </td>
                      {hasKinds && <td className="text-[11px] capitalize text-slate-400">{e.kind ?? '—'}</td>}
                      <td className="max-w-xl text-[13px] leading-snug text-slate-200">
                        <Highlight text={e.description} q={q} />
                      </td>
                      <td className="mono break-all text-[11px] text-slate-500">{e.sourceFile ? <Highlight text={e.sourceFile} q={q} /> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {meta && meta.notes.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[11px] leading-relaxed text-slate-500" aria-label="Notes on the recorded logs">
          {meta.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </>
  );
}
