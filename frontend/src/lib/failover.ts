import type { FailoverTrial } from '../types';
import { secondsBetween } from './time';

export interface FailoverPhase {
  id: 'detection' | 'switch' | 'verification' | 'detection_switch';
  label: string;
  detail: string;
  seconds: number;
  color: string;
}

/**
 * Splits the recorded trial into consecutive phases using only timestamps that exist in the
 * controller log. The phase durations are plain differences between logged timestamps; when
 * the optional "Switching to P2" event is absent, detection and switch are shown as one phase
 * rather than guessing where one ends.
 */
export function buildPhases(trial: FailoverTrial): FailoverPhase[] {
  const { metrics, events } = trial;
  const switching = events.find((e) => e.kind === 'failover_started')?.timestamp;
  const phases: FailoverPhase[] = [];
  const push = (p: Omit<FailoverPhase, 'seconds'>, a: string, b: string) => {
    const s = secondsBetween(a, b);
    if (s !== null && s >= 0) phases.push({ ...p, seconds: s });
  };

  if (switching) {
    push({ id: 'detection', label: 'Detection', detail: `First failed probe → "Switching to P2" (${trial.detectionThreshold} consecutive failed probes)`, color: '#fbbf24' }, metrics.firstFailedProbe, switching);
    push({ id: 'switch', label: 'Path switch', detail: '"Switching to P2" → P2 installed', color: '#a78bfa' }, switching, metrics.p2Installed);
  } else {
    push({ id: 'detection_switch', label: 'Detection and switch', detail: 'First failed probe → P2 installed', color: '#fbbf24' }, metrics.firstFailedProbe, metrics.p2Installed);
  }
  push({ id: 'verification', label: 'Verification', detail: 'P2 installed → connectivity verified', color: '#34d399' }, metrics.p2Installed, metrics.recoveryVerified);
  return phases;
}
