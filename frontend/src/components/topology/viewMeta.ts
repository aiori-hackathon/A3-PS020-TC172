import { PATHS } from '../../config/project';
import { COLORS } from '../../lib/theme';
import type { SegmentOption } from '../ui/Segmented';
import type { TopologyView } from './TopologyDiagram';

export const VIEW_OPTIONS: SegmentOption<TopologyView>[] = [
  { id: 'overview', label: 'All paths' },
  { id: 'M0', label: 'M0 · OSPFv3', color: COLORS.m0 },
  { id: 'P1', label: 'P1', color: COLORS.p1 },
  { id: 'P2', label: 'P2', color: COLORS.p2 },
  { id: 'M2', label: 'M2 · Failure', color: COLORS.m2 },
];

interface PathInfo {
  id: string;
  nodes: string[];
  segments: string[];
}

/**
 * One-line explanation of what a view shows. P1/P2 node sequences and segment lists come from
 * `paths` (the /api/topology paths) when given, else from the bundled config. The M0 and M2 texts
 * describe recorded experiments.
 */
export function viewNote(view: TopologyView, paths?: PathInfo[]): string {
  const find = (id: 'P1' | 'P2') => paths?.find((x) => x.id === id) ?? PATHS[id];
  const p = (id: 'P1' | 'P2') => find(id).nodes.join(' → ');
  const sids = (id: 'P1' | 'P2') => find(id).segments.join(', ');
  switch (view) {
    case 'overview':
      return `Both configured SRv6 paths. P1: ${p('P1')} · P2: ${p('P2')}.`;
    case 'M0':
      return 'OSPFv3 forwards hop by hop with no SID list. Recorded in the M0 failure test: R1 → R2 → R5 normally, and R1 → R3 → R4 → R5 while R2–R5 was down.';
    case 'P1':
      return `P1 (primary): ${p('P1')}. Segment list installed at R1: ${sids('P1')}.`;
    case 'P2':
      return `P2 (backup): ${p('P2')}. Segment list installed at R1: ${sids('P2')}.`;
    default:
      return 'Recorded scenario: R2–R5 was deliberately failed; after 3 consecutive failed probes the controller installed P2 at R1. Not a live link state.';
  }
}

/** Notes from the bundled config (used where the topology is not loaded, e.g. the Overview page). */
export const VIEW_NOTE: Record<TopologyView, string> = Object.fromEntries(VIEW_OPTIONS.map((o) => [o.id, viewNote(o.id)])) as Record<TopologyView, string>;
