import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { KeyValue } from '../components/ui/KeyValue';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PROJECT } from '../config/project';
import { useConnection } from '../context/ConnectionContext';
import { API_BASE_URL, API_CONFIGURED } from '../services/client';

export default function SettingsPage() {
  const conn = useConnection();
  const [refreshInterval, setRefreshInterval] = useState('manual');

  return (
    <>
      <PageHeader
        title="Settings"
        description="Connection and project configuration. Values come from environment variables."
        actions={
          <button type="button" className="btn" onClick={conn.refresh} disabled={!API_CONFIGURED}>
            <RefreshCw className={`h-3.5 w-3.5 ${conn.checking ? 'animate-spin' : ''}`} /> Re-check connection
          </button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Backend connection" subtitle="Read-only FastAPI service that serves recorded results">
          <KeyValue label="Mode">
            <StatusBadge tone={conn.state === 'connected' ? 'ok' : conn.state === 'error' ? 'bad' : 'warn'} dot>
              {conn.state === 'connected' ? 'Backend API (historical data)' : conn.state === 'error' ? 'Unreachable · demo fallback' : conn.state === 'connecting' ? 'Connecting…' : 'Demo fallback'}
            </StatusBadge>
          </KeyValue>
          <KeyValue label="VITE_API_BASE_URL">
            <span className="mono">{API_BASE_URL || '(not set)'}</span>
          </KeyValue>
          <KeyValue label="Backend configured">{API_CONFIGURED ? 'Yes' : 'No (demo mode)'}</KeyValue>
          {conn.health && (
            <>
              <KeyValue label="API version">
                <span className="mono">{conn.health.version}</span>
              </KeyValue>
              <KeyValue label="Backend host OS">{conn.health.host_os}</KeyValue>
              <KeyValue label="Result files found">
                <span className="num">{conn.health.data_dir.files_found}</span>
              </KeyValue>
              <KeyValue label="Backend status">
                <StatusBadge tone={conn.health.status === 'ok' ? 'ok' : 'warn'}>{conn.health.status}</StatusBadge>
              </KeyValue>
            </>
          )}
          <KeyValue label="Connection state">
            <span className="mono">{conn.state}</span>
          </KeyValue>
          <KeyValue label="Last checked">
            <span className="mono">{conn.lastChecked ? conn.lastChecked.toLocaleTimeString() : '—'}</span>
          </KeyValue>
          {conn.error && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-300">{conn.error}</p>}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Set <span className="mono">VITE_API_BASE_URL</span> in <span className="mono">frontend/.env.local</span> and restart the dev server. The backend is read-only: it serves recorded results and
            repository configuration, never live network state.
          </p>
        </Card>

        <div className="space-y-5">
          <Card title="Dashboard preferences">
            <KeyValue label="Refresh interval">
              <select value={refreshInterval} onChange={(e) => setRefreshInterval(e.target.value)} aria-label="Refresh interval" className="input !w-auto !py-1 !text-xs">
                <option value="manual">Manual refresh</option>
                <option value="30">30 seconds (preference only)</option>
                <option value="60">1 minute (preference only)</option>
                <option value="300">5 minutes (preference only)</option>
              </select>
            </KeyValue>
            <p className="mt-3 text-xs text-slate-500">This selection is a UI preference indicator; automatic polling is not enabled in this read-only stage.</p>
          </Card>

          <Card title="Project">
            <KeyValue label="Title">{PROJECT.title}</KeyValue>
            <KeyValue label="Project code">
              <span className="mono">{PROJECT.code}</span>
            </KeyValue>
            <KeyValue label="Team">{PROJECT.team}</KeyValue>
            <KeyValue label="Probe destination">
              <span className="mono">{PROJECT.destination}</span>
            </KeyValue>
            <KeyValue label="Failure detection">{PROJECT.failureDetectionThreshold} consecutive failed probes</KeyValue>
          </Card>
        </div>
      </div>
    </>
  );
}
