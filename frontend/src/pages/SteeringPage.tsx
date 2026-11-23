import { useMemo, useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import { TopologyDiagram, toDiagramModel } from '../components/topology/TopologyDiagram';
import { Card } from '../components/ui/Card';
import { KeyValue } from '../components/ui/KeyValue';
import { LoadState } from '../components/ui/LoadState';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { Segmented } from '../components/ui/Segmented';
import { SourceTag } from '../components/ui/SourceTag';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PATHS } from '../config/project';
import type { PathId } from '../config/project';
import { useTopology } from '../hooks/useTopology';
import { COLORS } from '../lib/theme';
import type { ApiTopology } from '../types/api';

const PATH_OPTIONS = [
  { id: 'P1' as PathId, label: 'P1 · Primary', color: COLORS.p1 },
  { id: 'P2' as PathId, label: 'P2 · Backup', color: COLORS.p2 },
];

interface PathView {
  name: string;
  role: string;
  nodes: string[];
  segments: string[];
  linkCount: number;
  r1Interface: string;
  encapMode: string;
}

/**
 * One path as the page shows it, from the /api/topology response. The API has no encapsulation mode, so
 * that comes from config. The R1 interface is the R1 interface the API lists that is named for the link to
 * the path's next hop (namespace-namespace); if none matches, the configured value is used.
 */
function pathView(api: ApiTopology, id: PathId): PathView | null {
  const ap = api.paths.find((x) => x.id === id);
  if (!ap) return null;
  const cfg = PATHS[id];
  const r1 = api.nodes.find((n) => n.id === 'R1');
  const next = api.nodes.find((n) => n.id === ap.nodes[ap.nodes.indexOf('R1') + 1]);
  const wanted = r1 && next ? `${r1.namespace}-${next.namespace}` : '';
  return {
    name: ap.role === 'primary' ? 'Primary path' : 'Backup path',
    role: ap.role,
    nodes: ap.nodes,
    segments: ap.segments,
    linkCount: ap.link_ids.length,
    r1Interface: r1?.interfaces.find((i) => i.name === wanted)?.name ?? cfg.r1Interface,
    encapMode: cfg.encapMode,
  };
}

export function SteeringPage() {
  const [selected, setSelected] = useState<PathId>('P1');
  const topology = useTopology();
  const data = topology.data;
  const model = useMemo(() => (data ? toDiagramModel(data) : null), [data]);
  const views = useMemo(() => (data ? { P1: pathView(data, 'P1'), P2: pathView(data, 'P2') } : null), [data]);
  const sourceTag = topology.source === 'recorded' ? 'config' : topology.source;
  const destination = data?.destination ?? null;
  /** Which router owns a SID - looked up in the API node list, never guessed. */
  const ownerOf = (sid: string) => data?.nodes.find((n) => n.sid === sid);
  const p = views?.[selected] ?? null;
  const color = selected === 'P1' ? COLORS.p1 : COLORS.p2;

  return (
    <>
      <PageHeader
        title="SRv6 Path Steering"
        description="Inspect the segment list and route composition for the configured SRv6 paths. R1 encapsulates traffic for the destination and the SID list decides which routers it visits."
        actions={<Segmented label="Path" options={PATH_OPTIONS} value={selected} onChange={setSelected} />}
      />
      <Notice tone="sky">Read-only path visualization. Selecting P1 or P2 changes only this dashboard view; it does not modify Linux routing tables.</Notice>
      <LoadState loading={topology.loading && !data} error={topology.error} />

      {data && !(views?.P1 && views?.P2 && p) && (
        <Notice tone="amber" title="No path data">
          The backend returned no SRv6 paths. {data.warnings.join(' · ') || 'Check that the SRv6 scripts directory is available to the backend.'}
        </Notice>
      )}

      {data && model && views?.P1 && views?.P2 && p && (
        <>
          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2" title={`${selected} · ${p.name}`} subtitle={p.nodes.join(' → ')} action={<SourceTag source={sourceTag} />}>
              <div className="overflow-x-auto rounded-lg border border-ink-600/40 bg-ink-950/50 p-3 sm:p-4">
                <div className="min-w-[640px]">
                  <TopologyDiagram view={selected} compact topology={model} />
                </div>
              </div>
              <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <div>
                  <KeyValue label="Path role">
                    <StatusBadge tone={selected === 'P1' ? 'info' : 'violet'}>{p.role}</StatusBadge>
                  </KeyValue>
                  <KeyValue label="Encapsulation mode">
                    <span className="mono">{p.encapMode}</span>
                  </KeyValue>
                </div>
                <div>
                  <KeyValue label="Ingress interface at R1">
                    <span className="mono">{p.r1Interface}</span>
                  </KeyValue>
                  <KeyValue label="Links traversed">
                    <span className="num">{p.linkCount}</span>
                  </KeyValue>
                </div>
              </div>
            </Card>

            <Card title="Segment list (SIDs)" subtitle="Configured at R1: route to the destination with seg6 encapsulation" action={<SourceTag source={sourceTag} />}>
              <div className="mb-3 rounded-lg border border-ink-600/40 bg-ink-900/60 px-3 py-2.5 text-xs text-slate-400">
                <span className="mono text-slate-300">{destination ?? 'destination unknown'}/128</span> via <span className="mono text-slate-300">{p.r1Interface}</span>
                , <span className="mono text-slate-300">encap seg6 mode {p.encapMode}</span>
              </div>

              <ol className="relative">
                {p.segments.map((sid, i) => {
                  const owner = ownerOf(sid);
                  return (
                    <li key={sid} className="relative pb-3 last:pb-0">
                      <div className="flex items-center gap-3 rounded-lg border border-ink-600/50 bg-ink-900/60 p-3">
                        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border text-xs font-semibold" style={{ color, borderColor: `${color}66`, background: `${color}14` }}>
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <code className="mono block truncate text-[13px] text-slate-100">{sid}</code>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {owner ? (
                              <>
                                {owner.id} · SRv6 <span className="text-slate-400">{owner.sid_behavior ?? 'End'}</span>
                              </>
                            ) : (
                              'Owner not in topology data'
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-[11px] leading-snug text-slate-600">The final SID is the egress End.DT6 on R5. Values are repository configuration, not live kernel state.</p>
            </Card>
          </div>

          <Card className="mt-5" title="P1 vs P2" subtitle="Both policies use the same destination and encapsulation mode; only the segment list and first hop differ" bodyClassName="!p-0">
            <div className="overflow-x-auto">
              <table className="tbl min-w-[640px]">
                <thead>
                  <tr>
                    <th className="w-48" />
                    {(['P1', 'P2'] as PathId[]).map((id) => (
                      <th key={id}>
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: id === 'P1' ? COLORS.p1 : COLORS.p2 }} />
                        <span className="align-middle normal-case tracking-normal text-slate-300">
                          {id} · {views[id]?.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr>
                    <td className="font-medium text-slate-400">Route</td>
                    {(['P1', 'P2'] as PathId[]).map((id) => (
                      <td key={id} className="mono text-[11px]">
                        {views[id]?.nodes.join(' → ')}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-400">SID list</td>
                    {(['P1', 'P2'] as PathId[]).map((id) => (
                      <td key={id} className="mono text-[11px] leading-relaxed text-violet-300/90">
                        {views[id]?.segments.map((s, i) => (
                          <div key={s} className="flex items-center gap-1.5">
                            {i > 0 && <CornerDownRight className="h-3 w-3 text-slate-600" />}
                            {s}
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-400">Segments / links traversed</td>
                    {(['P1', 'P2'] as PathId[]).map((id) => (
                      <td key={id} className="num text-slate-200">
                        {views[id]?.segments.length} segments · {views[id]?.linkCount} links
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-400">First hop from R1</td>
                    {(['P1', 'P2'] as PathId[]).map((id) => (
                      <td key={id} className="mono">
                        {views[id]?.r1Interface}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
