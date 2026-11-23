import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDurationMs, fmtInt, fmtPercent, fmtRtt } from '../../lib/format';
import { MODE_META, axisTick, axisTickFaint, cursorFill, gridProps } from '../../lib/theme';
import type { BenchmarkSummaryRow } from '../../types';
import { ChartTooltip } from '../charts/ChartTooltip';

// Re-exported so existing imports of MODE_META from this module keep working.
export { MODE_META };

export function BenchmarkMini({ rows }: { rows: BenchmarkSummaryRow[] }) {
  const data = rows.map((r) => ({
    name: MODE_META[r.mode].label,
    color: MODE_META[r.mode].color,
    value: r.meanTrialAvgRttMs,
  }));

  return (
    <div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 8, left: -8, bottom: 0 }} barCategoryGap="32%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tick={axisTickFaint} axisLine={false} tickLine={false} width={52} label={{ value: 'ms', position: 'insideTopLeft', fill: '#64748b', fontSize: 10, offset: 14 }} />
            <Tooltip cursor={cursorFill} content={<ChartTooltip format={(v) => `${fmtRtt(v)} ms`} />} />
            <Bar dataKey="value" name="Mean trial avg RTT" radius={[5, 5, 0, 0]} isAnimationActive>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
              <LabelList dataKey="value" position="top" formatter={(v: unknown) => fmtRtt(Number(v))} fill="#cbd5e1" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="tbl min-w-[460px]">
          <thead>
            <tr>
              <th>Mode</th>
              <th className="text-right">Received</th>
              <th className="text-right">Loss %</th>
              <th className="text-right">Median RTT</th>
              <th className="text-right">Mean dur.</th>
              <th className="text-right">Max RTT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mode}>
                <td>
                  <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ background: MODE_META[r.mode].color }} />
                  <span className="text-slate-200">{MODE_META[r.mode].label}</span>
                </td>
                <td className="num text-right">
                  {fmtInt(r.received)}/{fmtInt(r.transmitted)}
                </td>
                <td className="num text-right">{fmtPercent(r.packetLossPercent)}</td>
                <td className="num text-right">{fmtRtt(r.medianTrialAvgRttMs)} ms</td>
                <td className="num text-right">{fmtDurationMs(r.meanTrialDurationMs)} ms</td>
                <td className="num text-right">{fmtRtt(r.highestObservedRttMs)} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-600">
        {rows[0]?.trials} trials × 1,000 packets per mode. Highest observed RTTs are kept, not discarded.
      </p>
    </div>
  );
}
