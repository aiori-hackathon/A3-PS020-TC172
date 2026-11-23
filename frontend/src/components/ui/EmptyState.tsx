import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <Inbox className="h-6 w-6 text-slate-600" />
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {message && <p className="max-w-sm text-xs text-slate-500">{message}</p>}
    </div>
  );
}

export function ErrorState({
  title = 'Could not load data',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-400" />
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="max-w-sm text-xs text-slate-500">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn mt-1">
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      )}
    </div>
  );
}
