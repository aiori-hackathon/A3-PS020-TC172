import { AlertTriangle } from 'lucide-react';
import { Skeleton } from './Skeleton';

/** Shared loading / error placeholder for pages whose data comes from useApiData. */
export function LoadState({ loading, error }: { loading: boolean; error?: Error | null }) {
  if (loading) {
    return (
      <div className="panel space-y-3 p-5" aria-busy="true">
        <p className="text-sm text-slate-400">Loading recorded project data…</p>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <span>Data unavailable: {error.message}</span>
      </div>
    );
  }
  return null;
}
