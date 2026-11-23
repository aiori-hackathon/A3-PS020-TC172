// Descriptions of what each experiment configures. Text moved verbatim from the original
// ModeSummary / RoutingPage components (which in turn describe src/scripts and src/configs).
// Nothing here is a measurement.

import type { ModeId } from './project';

export interface ModeConfig {
  id: ModeId;
  title: string;
  tagline: string;
  configured: string;
}

export const MODE_CONFIG: Record<ModeId, ModeConfig> = {
  M0: {
    id: 'M0',
    title: 'OSPFv3 baseline',
    tagline: 'Dynamic baseline routing',
    configured: 'FRRouting ospf6d, area 0.0.0.0, point-to-point links, hello 1 s / dead 3 s.',
  },
  M1: {
    id: 'M1',
    title: 'SRv6 path steering',
    tagline: 'Explicit SID-list paths chosen at R1',
    configured: 'End on R2, R3, R4; End.DT6 on R5. P1 via R2; P2 via R3 → R4. Encap at R1.',
  },
  M2: {
    id: 'M2',
    title: 'Failure recovery',
    tagline: 'Measured detection and switch to backup',
    configured: 'Backup P2 installed after 3 consecutive failed probes; one-way switch, no failback.',
  },
};
