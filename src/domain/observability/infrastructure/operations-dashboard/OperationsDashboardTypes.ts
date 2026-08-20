import type { OperationsHealthSnapshot } from '../../../../observability/OperationsHealthService.js';

export type CockpitStatus = 'healthy' | 'attention' | 'degraded';

export type CockpitAction = {
  id: string;
  label: string;
  command: string;
  reason: string;
  priority: 'high' | 'normal';
};

export type CockpitAlert = {
  level: 'info' | 'warn' | 'error';
  source: string;
  title: string;
  detail: string;
  timestamp: string | null;
};

export type RuntimeStats = {
  uptime_seconds: number;
  ram_mb_rss: number;
  ram_mb_heap: number;
  cpu_arch: string;
  platform: string;
  timestamp: string;
};

export type OperationsCockpitRuntime = {
  now?: () => Date;
  statsProvider?: () => RuntimeStats;
};

export type OperationsCockpitSnapshot = {
  generatedAt: string;
  status: CockpitStatus;
  headline: string;
  highlights: string[];
  runtime: {
    uptimeLabel: string;
    memoryLabel: string;
    heapLabel: string;
    platformLabel: string;
    sampledAt: string | null;
  };
  summary: {
    enabledSidecars: number;
    readySidecars: number;
    recentErrorCount: number;
    freeDiskPercent: number;
    publishAgeLabel: string;
  };
  actions: CockpitAction[];
  alerts: CockpitAlert[];
  operations: OperationsHealthSnapshot;
};
