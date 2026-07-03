export type ZavorthCliRuntimeTuiStatus = 'ready' | 'warning' | 'blocked';

export type ZavorthCliRuntimeTuiRow = {
  id: string;
  label: string;
  value: string;
  status: ZavorthCliRuntimeTuiStatus;
  detail?: string;
};

export type ZavorthCliRuntimeTuiItem = {
  id: string;
  title: string;
  status: string;
  detail: string;
};

export type ZavorthCliRuntimeTuiSnapshot = {
  contractVersion: 'zavorth-cli-runtime-tui/1';
  generatedAt: string;
  projectRoot: string;
  mode: 'snapshot' | 'watch' | 'interactive';
  status: ZavorthCliRuntimeTuiStatus;
  agentKernel: {
    status: string;
    profile: string;
    provider: string;
    model: string;
    intent: string;
    quietAutonomy: string;
    performanceSamples: number;
    missing: string[];
  };
  dailyProduct: {
    status: string;
    headline: string;
    primarySurface: string;
    visibleTabs: string[];
    quietMode: string;
    silentLanes: string[];
    digestLanes: string[];
    approvalBoundaries: string[];
  };
  home: {
    root: string;
    source: string;
    isolated: boolean;
    migrationStatus: string;
    paths: ZavorthCliRuntimeTuiItem[];
  };
  voice: {
    mode: string;
    armedUntil: string | null;
    detector: string;
    configured: boolean;
    lastReceipt: string | null;
  };
  tasks: {
    total: number;
    queued: number;
    running: number;
    waitingApproval: number;
    items: ZavorthCliRuntimeTuiItem[];
  };
  goalLoop: {
    status: string;
    current: string;
    detail: string;
    nextRunAfter: string | null;
    queued: number;
    running: number;
    lines: string[];
  };
  sandbox: {
    posture: string;
    strongProfilesReady: number;
    preferredProfile: string;
    items: ZavorthCliRuntimeTuiItem[];
  };
  connection: {
    gateway: ZavorthCliRuntimeTuiRow;
    daemon: ZavorthCliRuntimeTuiRow;
    zavorthControl: ZavorthCliRuntimeTuiRow;
  };
  chat: {
    total: number;
    recent: ZavorthCliRuntimeTuiItem[];
  };
  timeline: ZavorthCliRuntimeTuiItem[];
  tools: {
    mcpServers: number;
    mcpTools: number;
    skills: number;
    plugins: number;
    items: ZavorthCliRuntimeTuiItem[];
  };
  capabilityActions: {
    status: string;
    exposed: number;
    receipts: number;
    items: ZavorthCliRuntimeTuiItem[];
    nextAction: string;
  };
  approvals: {
    pending: number;
    selectedPlanId: string | null;
    items: ZavorthCliRuntimeTuiItem[];
  };
  diffs: ZavorthCliRuntimeTuiItem[];
  logs: ZavorthCliRuntimeTuiItem[];
  channels: ZavorthCliRuntimeTuiItem[];
  sessions: ZavorthCliRuntimeTuiItem[];
  shortcuts: Array<{
    key: string;
    label: string;
    command: string;
    detail: string;
  }>;
  safety: {
    readOnlySnapshot: true;
    noHostApply: true;
    secretsRedacted: true;
    approvalRequiresExplicitCommand: true;
  };
};
