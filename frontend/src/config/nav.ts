import { Activity, BarChart3, Layers, LayoutDashboard, Network, Route, ScrollText, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavGroup = 'Monitor' | 'Experiments' | 'Analytics' | 'System';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
}

// Routes are unchanged from the original application.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, group: 'Monitor' },
  { to: '/topology', label: 'Network Topology', icon: Network, group: 'Monitor' },
  { to: '/routing', label: 'Routing Modes', icon: Layers, group: 'Experiments' },
  { to: '/steering', label: 'SRv6 Path Steering', icon: Route, group: 'Experiments' },
  { to: '/failover', label: 'Failover Monitoring', icon: Activity, group: 'Experiments' },
  { to: '/benchmarks', label: 'Benchmark Analytics', icon: BarChart3, group: 'Analytics' },
  { to: '/logs', label: 'Experiment Logs', icon: ScrollText, group: 'Analytics' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'System' },
];

export const NAV_GROUPS: NavGroup[] = ['Monitor', 'Experiments', 'Analytics', 'System'];
