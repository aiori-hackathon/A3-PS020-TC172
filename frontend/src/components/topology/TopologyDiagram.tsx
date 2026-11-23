import { LINKS, NODES, PATHS } from '../../config/project';
import { COLORS } from '../../lib/theme';
import type { ApiTopology } from '../../types/api';

/**
 * Topology diagram - drawn from a `DiagramModel` (nodes, links, subnets, SIDs, paths). Pass the
 * model built from `/api/topology` via `toDiagramModel`; without one it falls back to the bundled
 * copy in config/project.ts (used by pages that do not load the topology). Node positions are
 * layout only. Nothing here is measured or live.
 *
 * Views
 *   overview : both configured SRv6 paths shown together
 *   M0       : OSPFv3 hop-by-hop routing as recorded (R1→R2→R5, reroute via R3→R4 during the failure test)
 *   P1 / P2  : one SRv6 path highlighted
 *   M2       : recorded failure scenario - R2–R5 failed, P2 installed at R1
 */
export type TopologyView = 'overview' | 'M0' | 'P1' | 'P2' | 'M2';

/** Everything the diagram needs from the topology; ids are plain strings as the API sends them. */
export interface DiagramModel {
  nodes: { id: string; name: string; kind: string; namespace: string; addresses: string[]; sid: { address: string; behavior: string } | null }[];
  links: { id: string; a: string; b: string; subnet: string | null; failureLink: boolean }[];
  paths: { P1: string[]; P2: string[] };
}

/** Bundled fallback: the same facts as /api/topology, from config/project.ts. */
const CONFIG_MODEL: DiagramModel = {
  nodes: NODES.map((n) => ({ id: n.id, name: n.name, kind: n.kind, namespace: n.namespace, addresses: n.addresses.map((a) => a.address), sid: n.sid ?? null })),
  links: LINKS.map((l) => ({ id: l.id, a: l.a, b: l.b, subnet: l.subnet, failureLink: !!l.failureLink })),
  paths: { P1: PATHS.P1.nodes, P2: PATHS.P2.nodes },
};

/** Backend `/api/topology` response -> diagram model. Display names are the only non-API text. */
export function toDiagramModel(api: ApiTopology): DiagramModel {
  const nodePath = (id: 'P1' | 'P2') => api.paths.find((p) => p.id === id)?.nodes ?? [];
  return {
    nodes: api.nodes.map((n) => ({
      id: n.id,
      name: NODES.find((c) => c.id === n.id)?.name ?? n.id,
      kind: n.kind,
      namespace: n.namespace,
      addresses: n.interfaces.map((i) => i.address),
      sid: n.sid ? { address: n.sid, behavior: n.sid_behavior ?? 'End' } : null,
    })),
    links: api.links.map((l) => ({ id: l.id, a: l.a, b: l.b, subnet: l.subnet, failureLink: l.failure_link })),
    paths: { P1: nodePath('P1'), P2: nodePath('P2') },
  };
}

const POS: Record<string, { x: number; y: number }> = {
  S: { x: 62, y: 210 },
  R1: { x: 262, y: 210 },
  R2: { x: 500, y: 95 },
  R3: { x: 392, y: 335 },
  R4: { x: 608, y: 335 },
  R5: { x: 738, y: 210 },
  D: { x: 938, y: 210 },
};

const NODE_W = 88;
const NODE_H = 50;
const NEUTRAL = '#8196bd';

/** Where each SID chip sits relative to its router (chosen so chips never touch a link). */
const SID_CHIP: Record<string, { dx: number; dy: number }> = {
  R2: { dx: 0, dy: -62 },
  R3: { dx: 0, dy: 62 },
  R4: { dx: 0, dy: 62 },
  R5: { dx: 52, dy: 62 },
};

/** Captions for nodes that carry no SID; SID nodes are captioned with their SID behavior. */
const NODE_CAPTION: Record<string, string> = { S: 'source', R1: 'ingress', D: 'destination' };

interface Hop {
  id: string;
  from: string;
  to: string;
}

function hopsOf(model: DiagramModel, nodes: string[]): Hop[] {
  const hops: Hop[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const link = model.links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
    if (link) hops.push({ id: link.id, from: a, to: b });
  }
  return hops;
}

interface LinkStyle {
  from: string;
  to: string;
  stroke: string;
  width: number;
  opacity: number;
  dash?: string;
  flow?: boolean;
  failed?: boolean;
}

function buildStyles(view: TopologyView, model: DiagramModel): Record<string, LinkStyle> {
  const s: Record<string, LinkStyle> = {};
  const put = (hops: Hop[], style: Omit<LinkStyle, 'from' | 'to'>) => hops.forEach((h) => (s[h.id] = { from: h.from, to: h.to, ...style }));
  const P1_HOPS = hopsOf(model, model.paths.P1);
  const P2_HOPS = hopsOf(model, model.paths.P2);
  const P2_IDS = new Set(P2_HOPS.map((h) => h.id));

  if (view === 'overview') {
    put(P1_HOPS, { stroke: COLORS.p1, width: 3.5, opacity: 0.9 });
    put(P2_HOPS, { stroke: COLORS.p2, width: 3.5, opacity: 0.9 });
    put(P1_HOPS.filter((h) => P2_IDS.has(h.id)), { stroke: NEUTRAL, width: 3.5, opacity: 1 }); // shared links
  } else if (view === 'P1') {
    put(P2_HOPS, { stroke: COLORS.p2, width: 2, opacity: 0.35, dash: '2 7' });
    put(P1_HOPS, { stroke: COLORS.p1, width: 4.5, opacity: 1, flow: true });
  } else if (view === 'P2') {
    put(P1_HOPS, { stroke: COLORS.p1, width: 2, opacity: 0.35, dash: '2 7' });
    put(P2_HOPS, { stroke: COLORS.p2, width: 4.5, opacity: 1, flow: true });
  } else if (view === 'M0') {
    put(P2_HOPS, { stroke: COLORS.m0, width: 2.5, opacity: 0.65, dash: '8 6' });
    put(P1_HOPS, { stroke: COLORS.m0, width: 4, opacity: 1, flow: true });
  } else {
    // M2: P1 was in use, the failure link failed, P2 installed at R1.
    put(P1_HOPS, { stroke: COLORS.p1, width: 2.5, opacity: 0.3, dash: '2 7' });
    put(P2_HOPS, { stroke: COLORS.p2, width: 4.5, opacity: 1, flow: true });
    model.links.filter((l) => l.failureLink).forEach((l) => {
      s[l.id] = { from: l.a, to: l.b, stroke: COLORS.fail, width: 4, opacity: 1, dash: '7 6', failed: true };
    });
  }
  return s;
}

function nodeAccent(view: TopologyView, id: string, model: DiagramModel): { stroke: string; fill: string; dim: boolean } {
  const on1 = model.paths.P1.includes(id);
  const on2 = model.paths.P2.includes(id);
  const shared = on1 && on2;
  const idle = { stroke: COLORS.nodeStroke, fill: COLORS.nodeFill, dim: true };
  const failEnd = model.links.some((l) => l.failureLink && (l.a === id || l.b === id)) && on1 && !on2;
  switch (view) {
    case 'overview':
      return shared ? { stroke: NEUTRAL, fill: '#142142', dim: false } : { stroke: on1 ? COLORS.p1 : COLORS.p2, fill: '#101b36', dim: false };
    case 'P1':
      return on1 ? { stroke: COLORS.p1, fill: '#0f2a3c', dim: false } : idle;
    case 'P2':
      return on2 ? { stroke: COLORS.p2, fill: '#1c1a3d', dim: false } : idle;
    case 'M0':
      return on1 ? { stroke: COLORS.m0, fill: '#1a2540', dim: false } : idle;
    default:
      return on2 ? { stroke: COLORS.p2, fill: '#1c1a3d', dim: false } : failEnd ? { stroke: COLORS.fail, fill: '#2a1420', dim: false } : idle;
  }
}

interface Props {
  view?: TopologyView;
  /** Compact: no subnet labels / SID chips and larger node text; for dashboards. */
  compact?: boolean;
  selectedNode?: string | null;
  onSelectNode?: (id: string) => void;
  className?: string;
  /** Topology to draw (from `toDiagramModel(apiResponse)`). Defaults to the bundled config copy. */
  topology?: DiagramModel;
}

export function TopologyDiagram({ view = 'overview', compact = false, selectedNode = null, onSelectNode, className = '', topology = CONFIG_MODEL }: Props) {
  const styles = buildStyles(view, topology);
  // Layout positions exist only for the known node ids; anything else is not drawn.
  const nodes = topology.nodes.filter((n) => POS[n.id]);
  const links = topology.links.filter((l) => POS[l.a] && POS[l.b]);
  const viewBox = compact ? '6 52 988 326' : '0 6 1000 420';

  return (
    <svg viewBox={viewBox} className={`h-auto w-full ${className}`} role="img" aria-label={`SRv6 topology, ${view} view: source, routers R1 to R5, destination`}>
      {/* ---- links ---------------------------------------------------- */}
      {links.map((l) => {
        const st = styles[l.id];
        const a = POS[st?.from ?? l.a];
        const b = POS[st?.to ?? l.b];
        const stroke = st?.stroke ?? COLORS.idle;
        return (
          <g key={l.id}>
            <title>{`${l.a} — ${l.b} · ${l.subnet ?? 'subnet unknown'}${l.failureLink ? ' · designated failure-test link' : ''}${st?.failed ? ' · failed in the recorded M2 scenario' : ''}`}</title>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeOpacity={st?.opacity ?? 0.8} strokeWidth={st?.width ?? 2} strokeLinecap="round" strokeDasharray={st?.dash} />
            {st?.flow && <line className="flow-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.4} strokeLinecap="round" />}
          </g>
        );
      })}

      {/* ---- subnet labels (full view) --------------------------------- */}
      {!compact &&
        links.filter((l) => l.subnet).map((l) => {
          const a = POS[l.a];
          const b = POS[l.b];
          const failed = view === 'M2' && l.failureLink;
          const t = failed ? 0.36 : 0.5;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          const ring = failed ? COLORS.fail : l.failureLink ? '#a8842d' : '#2b3c63';
          return (
            <g key={`lbl-${l.id}`} pointerEvents="none">
              <rect x={x - 49} y={y - 11} width={98} height={22} rx={6} fill="#0a101e" stroke={ring} strokeWidth={1} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fill={failed ? '#fca5a5' : COLORS.muted} fontFamily="JetBrains Mono, ui-monospace, monospace">
                {l.subnet}
              </text>
            </g>
          );
        })}

      {/* ---- failure marker ---------------------------------------------- */}
      {view === 'M2' &&
        links.filter((l) => l.failureLink).map((l) => {
          const a = POS[l.a];
          const b = POS[l.b];
          const x = a.x + (b.x - a.x) * 0.64;
          const y = a.y + (b.y - a.y) * 0.64;
          return (
            <g key={`x-${l.id}`} pointerEvents="none">
              <circle cx={x} cy={y} r={13} fill="#2a1420" stroke={COLORS.fail} strokeWidth={2} />
              <path d={`M${x - 5} ${y - 5} L${x + 5} ${y + 5} M${x + 5} ${y - 5} L${x - 5} ${y + 5}`} stroke={COLORS.fail} strokeWidth={2.4} strokeLinecap="round" />
            </g>
          );
        })}

      {/* ---- SID chips (full view) ---------------------------------------- */}
      {!compact &&
        nodes.filter((n) => n.sid).map((n) => {
          const off = SID_CHIP[n.id];
          if (!off || !n.sid) return null;
          const p = POS[n.id];
          const cx = p.x + off.dx;
          const cy = p.y + off.dy;
          return (
            <g key={`sid-${n.id}`} pointerEvents="none">
              <rect x={cx - 60} y={cy - 17} width={120} height={34} rx={7} fill="#0a101e" stroke="#2b3c63" />
              <text x={cx} y={cy - 3} textAnchor="middle" fontSize={10} fill={COLORS.faint} letterSpacing="0.06em">
                SID · {n.sid.behavior.toUpperCase()}
              </text>
              <text x={cx} y={cy + 11} textAnchor="middle" fontSize={12} fill="#c4b5fd" fontFamily="JetBrains Mono, ui-monospace, monospace">
                {n.sid.address}
              </text>
            </g>
          );
        })}

      {/* ---- nodes ---------------------------------------------------------- */}
      {nodes.map((n) => {
        const p = POS[n.id];
        const acc = nodeAccent(view, n.id, topology);
        const selected = selectedNode === n.id;
        const endpoint = n.kind === 'endpoint';
        const interactive = !!onSelectNode;
        const addr = n.addresses[0];
        return (
          <g
            key={n.id}
            transform={`translate(${p.x} ${p.y})`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `${n.name}${addr ? `, ${addr}` : ''}` : undefined}
            aria-pressed={interactive ? selected : undefined}
            onClick={interactive ? () => onSelectNode(n.id) : undefined}
            onKeyDown={interactive ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelectNode(n.id)) : undefined}
            style={{ cursor: interactive ? 'pointer' : undefined, outline: 'none' }}
          >
            <title>{`${n.name} · namespace ${n.namespace}${n.addresses.length ? ` · ${n.addresses.join(', ')}` : ''}`}</title>
            {selected && <rect x={-NODE_W / 2 - 6} y={-NODE_H / 2 - 6} width={NODE_W + 12} height={NODE_H + 12} rx={15} fill="none" stroke={acc.stroke} strokeOpacity={0.45} strokeWidth={2} />}
            <rect
              x={-NODE_W / 2}
              y={-NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={endpoint ? 25 : 10}
              fill={acc.fill}
              stroke={acc.stroke}
              strokeWidth={acc.dim ? 1.5 : 2.2}
              strokeOpacity={acc.dim ? 0.75 : 1}
            />
            <text y={compact ? 7 : -1} textAnchor="middle" fontSize={compact ? 21 : 18} fontWeight={600} fill={acc.dim ? COLORS.muted : COLORS.text}>
              {n.id}
            </text>
            {!compact && (
              <text y={14} textAnchor="middle" fontSize={11} fill={COLORS.faint}>
                {n.sid?.behavior ?? NODE_CAPTION[n.id] ?? n.kind}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Legend entries for a given view (kept next to the diagram so they cannot drift apart). */
export function legendFor(view: TopologyView): { label: string; color: string; dashed?: boolean }[] {
  switch (view) {
    case 'P1':
      return [
        { label: 'P1 primary (active in this view)', color: COLORS.p1 },
        { label: 'P2 backup (inactive)', color: COLORS.p2, dashed: true },
      ];
    case 'P2':
      return [
        { label: 'P2 backup (active in this view)', color: COLORS.p2 },
        { label: 'P1 primary (inactive)', color: COLORS.p1, dashed: true },
      ];
    case 'M0':
      return [
        { label: 'OSPFv3 route recorded before / after the failure test', color: COLORS.m0 },
        { label: 'OSPFv3 reroute recorded during the failure test', color: COLORS.m0, dashed: true },
      ];
    case 'M2':
      return [
        { label: 'R2–R5 failed (recorded scenario)', color: COLORS.fail, dashed: true },
        { label: 'P2 installed at R1 after 3 failed probes', color: COLORS.p2 },
        { label: 'P1 before the failure', color: COLORS.p1, dashed: true },
      ];
    default:
      return [
        { label: 'P1 primary', color: COLORS.p1 },
        { label: 'P2 backup', color: COLORS.p2 },
        { label: 'Shared by both', color: NEUTRAL },
      ];
  }
}

