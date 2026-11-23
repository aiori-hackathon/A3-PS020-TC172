import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Legend } from '../components/topology/Legend';
import { TopologyDiagram, toDiagramModel } from '../components/topology/TopologyDiagram';
import type { TopologyView } from '../components/topology/TopologyDiagram';
import { VIEW_OPTIONS, viewNote } from '../components/topology/viewMeta';
import { Card } from '../components/ui/Card';
import { KeyValue } from '../components/ui/KeyValue';
import { LoadState } from '../components/ui/LoadState';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { Segmented } from '../components/ui/Segmented';
import { SourceTag } from '../components/ui/SourceTag';
import { StatusBadge } from '../components/ui/StatusBadge';
import { NODES } from '../config/project';
import type { PathId } from '../config/project';
import { useTopology } from '../hooks/useTopology';
import type { ApiTopology } from '../types/api';

type TopoNode = ApiTopology['nodes'][number];

function NodePanel({ node }: { node: TopoNode }) {
  // Display name and one-line role are descriptive text the API does not carry; all facts below are from the API.
  const cfg = NODES.find((x) => x.id === node.id);
  return (
    <div className="animate-slide-in" key={node.id}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-slate-50">{cfg?.name ?? node.id}</div>
          {cfg && <div className="mt-0.5 text-xs text-slate-500">{cfg.role}</div>}
        </div>
        <StatusBadge tone={node.kind === 'router' ? 'info' : 'neutral'}>{node.kind}</StatusBadge>
      </div>
      <div className="mt-3">
        <KeyValue label="Namespace">
          <span className="mono">{node.namespace}</span>
        </KeyValue>
        {node.sid && (
          <KeyValue label={`SID · ${node.sid_behavior ?? 'End'}`}>
            <span className="mono text-violet-300">{node.sid}</span>
          </KeyValue>
        )}
      </div>
      <div className="label mb-1.5 mt-4">Interfaces (IPv6)</div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Interface</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          {node.interfaces.map((a) => (
            <tr key={a.name}>
              <td className="mono">{a.name}</td>
              <td className="mono text-slate-200">{a.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TopologyPage() {
  const topology = useTopology();
  const [view, setView] = useState<TopologyView>('overview');
  const [selected, setSelected] = useState<string>('R1');

  const data = topology.data;
  const model = useMemo(() => (data ? toDiagramModel(data) : null), [data]);
  const selectedNode = data?.nodes.find((n) => n.id === selected) ?? data?.nodes[0];
  const sourceTag = topology.source === 'recorded' ? 'config' : topology.source;
  const links = data?.links ?? [];
  const paths = data?.paths ?? [];
  const onPath = (linkId: string, p: PathId) => paths.find((x) => x.id === p)?.link_ids.includes(linkId) ?? false;

  return (
    <>
      <PageHeader
        title="Network Topology"
        description="Repository-derived Linux namespace topology: five routers in a ring, a source behind R1 and a destination behind R5. Select a view to compare how each experiment forwards traffic."
        actions={
          <button type="button" className="btn" onClick={topology.reload}>
            <RefreshCw className={`h-3.5 w-3.5 ${topology.loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />
      <Notice tone="sky">
        Historical/configuration view only. Link status is <b>UNKNOWN</b>; this dashboard does not monitor live interfaces.
      </Notice>
      <LoadState loading={topology.loading && !data} error={topology.error} />

      {data && data.nodes.length === 0 && (
        <Notice tone="amber" title="No topology data">
          The backend returned no nodes. {data.warnings.join(' · ') || 'Check that the SRv6 scripts directory is available to the backend.'}
        </Notice>
      )}

      {data && data.nodes.length > 0 && (
        <>
          <div className="grid gap-5">
            <Card
              title="Seven-node SRv6 topology"
              subtitle={viewNote(view, data.paths)}
              action={<SourceTag source={sourceTag} />}
            >
              <div className="mb-3">
                <Segmented label="Topology view" options={VIEW_OPTIONS} value={view} onChange={setView} />
              </div>
              <div className="overflow-x-auto rounded-lg border border-ink-600/40 bg-ink-950/50 p-3 sm:p-4">
                <div className="mx-auto min-w-[720px] max-w-[1100px]">
                  <TopologyDiagram view={view} selectedNode={selectedNode?.id ?? null} onSelectNode={setSelected} topology={model ?? undefined} />
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-ink-600/30 bg-ink-900/40 px-3.5 py-3">
                <Legend view={view} showFailureTestKey />
              </div>
              <p className="mt-3 text-[11px] leading-snug text-slate-600">
                Subnets are shown on each link; SID chips show the configured End / End.DT6 SIDs. Select a node for its interfaces and addresses.
              </p>
            </Card>

          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <Card title="Node details" subtitle="Select a node in the diagram" action={<SourceTag source={sourceTag} />}>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {data.nodes.map((n) => (
                  <button key={n.id} type="button" className="chip" aria-pressed={selectedNode?.id === n.id} onClick={() => setSelected(n.id)}>
                    {n.id}
                  </button>
                ))}
              </div>
              {selectedNode && <NodePanel node={selectedNode} />}
            </Card>
            <Card className="xl:col-span-2" title="Links and subnets" subtitle="Each link carries one /64; membership shows which SRv6 paths traverse it">
              <div className="overflow-x-auto">
                <table className="tbl min-w-[520px]">
                  <thead>
                    <tr>
                      <th>Link</th>
                      <th>Subnet</th>
                      <th>Paths</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((l) => (
                      <tr key={l.id}>
                        <td className="whitespace-nowrap text-slate-200">
                          {l.a} ↔ {l.b}
                          {l.failure_link && <span className="ml-2 rounded border border-amber-400/30 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-amber-300">failure test</span>}
                        </td>
                        <td className="mono">{l.subnet ?? 'N/A'}</td>
                        <td>
                          <span className="inline-flex gap-1">
                            {onPath(l.id, 'P1') && <StatusBadge tone="info">P1</StatusBadge>}
                            {onPath(l.id, 'P2') && <StatusBadge tone="violet">P2</StatusBadge>}
                            {!onPath(l.id, 'P1') && !onPath(l.id, 'P2') && <span className="text-slate-600">—</span>}
                          </span>
                        </td>
                        <td>
                          <StatusBadge tone="neutral" dot>
                            unknown
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="xl:col-span-3" title="Nodes" subtitle="Linux network namespaces">
              <div className="overflow-x-auto">
                <table className="tbl min-w-[420px]">
                  <thead>
                    <tr>
                      <th>Node</th>
                      <th>Namespace</th>
                      <th>Kind</th>
                      <th>SID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.nodes.map((n) => (
                      <tr key={n.id} className="cursor-pointer" onClick={() => setSelected(n.id)}>
                        <td className="font-medium text-slate-200">{n.id}</td>
                        <td className="mono">{n.namespace}</td>
                        <td className="text-slate-400">{n.kind}</td>
                        <td className="mono text-violet-300">{n.sid ?? <span className="text-slate-600">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          {data.warnings.length > 0 && <p className="mt-3 text-xs text-amber-300">{data.warnings.join(' · ')}</p>}
        </>
      )}
    </>
  );
}
