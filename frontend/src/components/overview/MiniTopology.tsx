import { TopologyDiagram } from '../topology/TopologyDiagram';
import { Legend } from '../topology/Legend';
import type { TopologyView } from '../topology/TopologyDiagram';

/** Dashboard topology: compact diagram + legend. The full view lives on the Network Topology page. */
export function MiniTopology({ view = 'overview' }: { view?: TopologyView }) {
  return (
    <div>
      <div className="rounded-lg border border-ink-600/40 bg-ink-950/50 p-3 sm:p-4">
        <TopologyDiagram view={view} compact />
      </div>
      <div className="mt-3">
        <Legend view={view} showFailureTestKey={false} />
      </div>
    </div>
  );
}
