import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '../components/charts/ChartTooltip';
import { Card } from '../components/ui/Card';
import { LoadState } from '../components/ui/LoadState';
import { Metric } from '../components/ui/Metric';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { SourceTag } from '../components/ui/SourceTag';
import { useBenchmarkAnalytics } from '../hooks/useRecorded';
import { fmtDurationMs, fmtInt, fmtPercent, fmtRtt } from '../lib/format';
import { COLORS, MODE_META, axisTick, axisTickFaint, cursorFill, gridProps } from '../lib/theme';
import type { BenchmarkMode } from '../types';

const MODES: BenchmarkMode[] = ['M0_OSPFv3', 'P1_SRv6', 'P2_SRv6'];
const legendStyle = { fontSize: 12, color: COLORS.muted, paddingTop: 8 } as const;

/** Powers of ten that bracket the data, for a readable log axis. */
function logAxis(values: number[]): { domain: [number, number]; ticks: number[] } {
  const pos = values.filter((v) => v > 0);
  const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...pos))));
  const hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...pos))));
  const ticks: number[] = [];
  for (let v = lo; v <= hi * 1.0001; v *= 10) ticks.push(Number(v.toPrecision(6)));
  return { domain: [lo, hi], ticks };
}

export function BenchmarksPage() {
  const b = useBenchmarkAnalytics();
  const rows = b.data?.rows ?? [];
  const series = b.data?.series ?? null;
  const warnings = b.data?.warnings ?? [];
  const mixedRuns = b.data?.mixedRuns ?? false;

  const chart = rows.map((r) => ({
    mode: MODE_META[r.mode].label,
    color: MODE_META[r.mode].color,
    mean: r.meanTrialAvgRttMs,
    median: r.medianTrialAvgRttMs,
    max: r.highestObservedRttMs,
    duration: r.meanTrialDurationMs,
    tx: r.transmitted,
    rx: r.received,
  }));

  // Rows are keyed by the recorded trial number (not array position), so a trial the backend
  // excluded as invalid leaves a gap instead of silently renumbering the rest. Modes with no
  // per-trial data are left out rather than drawn as empty legend entries.
  const perTrial = useMemo(() => {
    if (!series) return null;
    const modes = MODES.filter((m) => series[m].length > 0);
    const byTrial = new Map<number, Record<string, number | undefined>>();
    modes.forEach((m) =>
      series[m].forEach((p) => {
        const row = byTrial.get(p.trial) ?? { trial: p.trial };
        row[`${m}_avg`] = p.avgMs;
        row[`${m}_max`] = p.maxMs;
        byTrial.set(p.trial, row);
      }),
    );
    const data = [...byTrial.values()].sort((x, y) => (x.trial as number) - (y.trial as number));
    return data.length > 0 ? { data, modes } : null;
  }, [series]);

  const maxAxis = useMemo(
    () => (perTrial ? logAxis(perTrial.data.flatMap((r) => perTrial.modes.map((m) => r[`${m}_max`]).filter((v): v is number => typeof v === 'number'))) : null),
    [perTrial],
  );

  const reload = b.reload;

  return (
    <>
      <PageHeader
        title="Benchmark Analytics"
        description="Final benchmark generation comparing OSPFv3 (M0) with the two SRv6 paths (P1, P2): 30 trials of 1,000 packets per mode."
        actions={
          <button type="button" className="btn" onClick={reload}>
            <RefreshCw className={`h-3.5 w-3.5 ${b.loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />
      {b.source === 'recorded' && (
        <Notice tone="sky">
          Primary source: latest benchmark run{b.data?.runDate ? ` (${b.data.runDate})` : ''}, served by the backend. Earlier benchmark runs are intentionally excluded from this comparison.
        </Notice>
      )}
      {b.source === 'mock' && <Notice tone="sky">Primary source: final benchmark generation (2026-10-31). Earlier benchmark runs are intentionally excluded from this comparison.</Notice>}
      {(mixedRuns || warnings.length > 0) && (
        <Notice tone="amber" title={mixedRuns ? 'Cross-run comparison.' : `Backend data warnings (${warnings.length}).`}>
          {mixedRuns && 'M0 and P1/P2 were recorded in different runs, so the per-trial lines and summary comparisons below compare measurements taken at different times. Trials are not merged.'}
          {warnings.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      <LoadState loading={b.loading && !b.data} error={b.error} />

      {rows.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {rows.map((r) => (
              <Metric
                key={r.mode}
                label={`${MODE_META[r.mode].label} mean RTT`}
                value={fmtRtt(r.meanTrialAvgRttMs)}
                unit="ms"
                tone={r.mode === 'P1_SRv6' ? 'info' : r.mode === 'P2_SRv6' ? 'violet' : 'neutral'}
                hint={`${r.trials} trials · ${fmtPercent(r.packetLossPercent)}% packet loss`}
              />
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Card title="Mean and median RTT" subtitle="Per-trial average RTT, summarised over 30 trials · milliseconds" action={<SourceTag source={b.source} />}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chart} margin={{ top: 8, right: 8, left: -4, bottom: 0 }} barCategoryGap="26%">
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="mode" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTickFaint} axisLine={false} tickLine={false} width={56} />
                  <Tooltip cursor={cursorFill} content={<ChartTooltip format={(v) => `${fmtRtt(v)} ms`} />} />
                  <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                  <Bar dataKey="mean" name="Mean" fill={COLORS.p1} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="median" name="Median" fill="#6d7ea6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Highest observed RTT" subtitle="Single worst packet across all trials · milliseconds · kept, not discarded" action={<SourceTag source={b.source} />}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chart} margin={{ top: 22, right: 8, left: -4, bottom: 0 }} barCategoryGap="32%">
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="mode" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTickFaint} axisLine={false} tickLine={false} width={56} />
                  <Tooltip cursor={cursorFill} content={<ChartTooltip format={(v) => `${fmtRtt(v)} ms`} />} />
                  <Bar dataKey="max" name="Highest observed RTT" radius={[5, 5, 0, 0]}>
                    {chart.map((d) => (
                      <Cell key={d.mode} fill={d.color} />
                    ))}
                    <LabelList dataKey="max" position="top" formatter={(v: unknown) => fmtRtt(Number(v))} fill="#cbd5e1" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="xl:col-span-2" title="Average RTT per trial" subtitle="Each point is one trial of 1,000 packets · milliseconds" action={<SourceTag source={b.source} />}>
              {b.loading ? (
                <p className="py-10 text-center text-sm text-slate-500">Loading per-trial results…</p>
              ) : !perTrial ? (
                <p className="py-10 text-center text-sm text-slate-500">Per-trial results are unavailable ({b.data?.seriesError ?? 'no data'}). Summary charts above are unaffected.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={perTrial.data} margin={{ top: 8, right: 12, left: -4, bottom: 4 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="trial" tick={axisTickFaint} axisLine={false} tickLine={false} label={{ value: 'Trial', position: 'insideBottomRight', offset: -2, fill: COLORS.faint, fontSize: 11 }} />
                    <YAxis tick={axisTickFaint} axisLine={false} tickLine={false} width={56} />
                    <Tooltip content={<ChartTooltip format={(v) => `${fmtRtt(v)} ms`} />} />
                    <Legend wrapperStyle={legendStyle} iconType="plainline" />
                    {perTrial.modes.map((m) => (
                      <Line key={m} type="linear" dataKey={`${m}_avg`} name={MODE_META[m].label} stroke={MODE_META[m].color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="xl:col-span-2" title="Maximum RTT per trial" subtitle="Worst packet in each trial · logarithmic axis · shows where the highest observed values occurred" action={<SourceTag source={b.source} />}>
              {perTrial && maxAxis ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={perTrial.data} margin={{ top: 8, right: 12, left: -4, bottom: 4 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="trial" tick={axisTickFaint} axisLine={false} tickLine={false} label={{ value: 'Trial', position: 'insideBottomRight', offset: -2, fill: COLORS.faint, fontSize: 11 }} />
                    <YAxis scale="log" domain={maxAxis.domain} ticks={maxAxis.ticks} allowDataOverflow tick={axisTickFaint} axisLine={false} tickLine={false} width={56} />
                    <Tooltip content={<ChartTooltip format={(v) => `${fmtRtt(v)} ms`} />} />
                    <Legend wrapperStyle={legendStyle} iconType="plainline" />
                    {perTrial.modes.map((m) => (
                      <Line key={m} type="linear" dataKey={`${m}_max`} name={MODE_META[m].label} stroke={MODE_META[m].color} strokeWidth={1.8} dot={{ r: 2.5 }} activeDot={{ r: 4.5 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">Per-trial results are unavailable.</p>
              )}
            </Card>

            <Card title="Packet delivery" subtitle="Packets received of packets transmitted, all trials" action={<SourceTag source={b.source} />}>
              <ul className="space-y-5 py-1">
                {rows.map((r) => {
                  const pct = r.transmitted > 0 ? (r.received / r.transmitted) * 100 : 0;
                  return (
                    <li key={r.mode}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 text-slate-200">
                          <span className="h-2 w-2 rounded-sm" style={{ background: MODE_META[r.mode].color }} />
                          {MODE_META[r.mode].label}
                        </span>
                        <span className="num text-xs text-slate-400">
                          {fmtInt(r.received)} / {fmtInt(r.transmitted)} · <span className="text-slate-100">{fmtPercent(r.packetLossPercent)}% loss</span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700" role="img" aria-label={`${MODE_META[r.mode].label}: ${fmtPercent(pct)} percent of packets received`}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: MODE_META[r.mode].color }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title="Mean trial duration" subtitle="Time to complete one trial of 1,000 packets · milliseconds" action={<SourceTag source={b.source} />}>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={chart} margin={{ top: 22, right: 8, left: -4, bottom: 0 }} barCategoryGap="32%">
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="mode" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTickFaint} axisLine={false} tickLine={false} width={56} />
                  <Tooltip cursor={cursorFill} content={<ChartTooltip format={(v) => `${fmtDurationMs(v)} ms`} />} />
                  <Bar dataKey="duration" name="Mean trial duration" radius={[5, 5, 0, 0]}>
                    {chart.map((d) => (
                      <Cell key={d.mode} fill={d.color} />
                    ))}
                    <LabelList dataKey="duration" position="top" formatter={(v: unknown) => fmtDurationMs(Number(v))} fill="#cbd5e1" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card className="mt-5" title="Benchmark detail table" subtitle="Values as recorded in the final comparison summary" bodyClassName="!p-0">
            <div className="overflow-x-auto">
              <table className="tbl min-w-[760px]">
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th className="text-right">Trials</th>
                    <th className="text-right">Tx / Rx</th>
                    <th className="text-right">Loss</th>
                    <th className="text-right">Mean RTT (ms)</th>
                    <th className="text-right">Median RTT (ms)</th>
                    <th className="text-right">Max RTT (ms)</th>
                    <th className="text-right">Mean duration (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.mode}>
                      <td className="font-semibold text-slate-100">
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ background: MODE_META[r.mode].color }} />
                        {r.mode}
                      </td>
                      <td className="num text-right">{r.trials}</td>
                      <td className="num text-right">
                        {fmtInt(r.transmitted)} / {fmtInt(r.received)}
                      </td>
                      <td className="num text-right">{fmtPercent(r.packetLossPercent)}%</td>
                      <td className="num text-right text-slate-100">{r.meanTrialAvgRttMs.toFixed(5)}</td>
                      <td className="num text-right">{r.medianTrialAvgRttMs.toFixed(5)}</td>
                      <td className="num text-right">{r.highestObservedRttMs.toFixed(3)}</td>
                      <td className="num text-right">{r.meanTrialDurationMs.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
