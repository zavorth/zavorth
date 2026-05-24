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
  connection: {
    gateway: ZavorthCliRuntimeTuiRow;
    daemon: ZavorthCliRuntimeTuiRow;
    dashboard: ZavorthCliRuntimeTuiRow;
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
