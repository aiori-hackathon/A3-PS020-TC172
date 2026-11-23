import { LINKS, NODES, PATHS, PROJECT, linksOfPath } from '../config/project';
import { getTopology } from '../services/api';
import type { ApiTopology } from '../types/api';
import { useApiData } from './useApiData';

/** Demo fallback: the same facts, bundled in config/project.ts. */
export const fallbackTopology = async (): Promise<ApiTopology> => ({
  nodes: NODES.map((n) => ({
    id: n.id,
    namespace: n.namespace,
    kind: n.kind,
    interfaces: n.addresses.map((a) => ({ name: a.iface, address: a.address })),
    sid: n.sid?.address ?? null,
    sid_behavior: n.sid?.behavior ?? null,
    status: 'unknown' as const,
  })),
  links: LINKS.map((l) => ({ id: l.id, a: l.a, b: l.b, subnet: l.subnet, failure_link: !!l.failureLink, status: 'unknown' as const })),
  paths: (['P1', 'P2'] as const).map((id) => ({
    id,
    role: PATHS[id].role,
    nodes: PATHS[id].nodes,
    segments: PATHS[id].segments,
    link_ids: linksOfPath(PATHS[id]),
  })),
  failure_link: LINKS.find((l) => l.failureLink)?.id ?? null,
  destination: PROJECT.destination,
  live_status_note: 'Link state is unknown; no live telemetry is available.',
  data_source: { kind: 'repo_config', live_telemetry: false, description: 'Repository topology configuration', files: [], missing_files: [], last_modified: null },
  generated_at: new Date().toISOString(),
  warnings: [],
});

/** `/api/topology` first; labelled bundled config copy if the backend is unavailable. Shared by the topology and steering pages. */
export function useTopology() {
  return useApiData<ApiTopology>(getTopology, fallbackTopology);
}
