/**
 * Controller-log timestamps look like "2026-10-30 23:10:15.324" (VM clock, no zone).
 * They are parsed as UTC purely to take differences between two of them; the absolute
 * value is never shown as a real-world time.
 */
const TS = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/;

export function logTimestampMs(ts: string): number {
  const m = TS.exec(ts);
  if (!m) return NaN;
  const whole = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return whole + (m[7] ? Number(`0.${m[7]}`) * 1000 : 0);
}

/** Seconds from `a` to `b`, or null when either timestamp cannot be parsed. */
export function secondsBetween(a: string, b: string): number | null {
  const d = logTimestampMs(b) - logTimestampMs(a);
  return Number.isFinite(d) ? Math.round(d) / 1000 : null;
}

/** "23:10:15.324" from a full log timestamp. */
export function clockPart(ts: string): string {
  return ts.length > 11 ? ts.slice(11) : ts;
}
