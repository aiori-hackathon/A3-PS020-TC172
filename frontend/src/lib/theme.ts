import type { BenchmarkMode } from '../types';

/** One colour per experiment / path, used by the topology, charts and badges alike. */
export const COLORS = {
  m0: '#b6c2d6',
  p1: '#22d3ee',
  p2: '#a78bfa',
  m2: '#34d399',
  fail: '#f87171',
  warn: '#fbbf24',
  idle: '#33466f',
  nodeFill: '#0f1830',
  nodeStroke: '#4a5d8a',
  text: '#e2e8f0',
  muted: '#94a3b8',
  faint: '#64748b',
  grid: '#18233c',
} as const;

export const MODE_META: Record<BenchmarkMode, { label: string; short: string; color: string }> = {
  M0_OSPFv3: { label: 'M0 OSPFv3', short: 'M0', color: COLORS.m0 },
  P1_SRv6: { label: 'P1 SRv6', short: 'P1', color: COLORS.p1 },
  P2_SRv6: { label: 'P2 SRv6', short: 'P2', color: COLORS.p2 },
};

/** Shared Recharts props so every chart looks the same. */
export const axisTick = { fill: COLORS.muted, fontSize: 11 } as const;
export const axisTickFaint = { fill: COLORS.faint, fontSize: 11 } as const;
export const gridProps = { stroke: COLORS.grid, vertical: false } as const;
export const cursorFill = { fill: 'rgba(148,163,184,0.06)' } as const;
