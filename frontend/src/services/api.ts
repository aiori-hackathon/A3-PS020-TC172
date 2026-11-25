import type {
  ApiBenchmarks,
  ApiFailover,
  ApiHealth,
  ApiLiveStatus,
  ApiLogs,
  ApiOverview,
  ApiRoutingModes,
  ApiSystemConfig,
  ApiTopology,
} from '../types/api';
import { getJson } from './client';

/**
 * Typed endpoint calls for the read-only FastAPI backend. The application surfaces
 * connection errors and never substitutes bundled or mock experiment measurements.
 */
export const getHealth = () => getJson<ApiHealth>('/api/health', 4000);
export const getOverview = () => getJson<ApiOverview>('/api/overview');
export const getTopology = () => getJson<ApiTopology>('/api/topology');
export const getRoutingModes = () => getJson<ApiRoutingModes>('/api/routing-modes');
export const getSteering = () => getJson<ApiTopology>('/api/steering');
export const getBenchmarks = (includeTrials = false) => getJson<ApiBenchmarks>(`/api/benchmarks${includeTrials ? '?include_trials=true' : ''}`);
export const getFailover = () => getJson<ApiFailover>('/api/failover');
export const getSystemConfig = () => getJson<ApiSystemConfig>('/api/config');
export const getLiveStatus = () => getJson<ApiLiveStatus>('/api/live/status', 15000);
export const getLogs = (params: { limit?: number; kind?: 'event' | 'record'; category?: string; severity?: string } = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
  const qs = q.toString();
  return getJson<ApiLogs>(`/api/logs${qs ? `?${qs}` : ''}`);
};
