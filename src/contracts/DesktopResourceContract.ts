export type DesktopResourceOwner = 'zavorth' | 'companion' | 'external' | 'unknown';

export type DesktopResourcePressureLevel = 'low' | 'moderate' | 'high' | 'critical';

export type DesktopResourceKind =
  | 'process'
  | 'wsl-distro'
  | 'virtual-machine'
  | 'docker-runtime'
  | 'companion-app';

export type DesktopResourceControlId =
  | 'zavorth'
  | 'wsl'
  | 'docker-desktop'
  | 'zavorthBridge'
  | 'codex-companion';

export type DesktopResourceActionId =
  | 'inspect'
  | 'hibernate'
  | 'resume'
  | 'stop-idle'
  | 'trim'
  | 'restart-safe';

export type DesktopResourceActionSafety = 'safe' | 'cautious' | 'approval-required';

export type DesktopResourceMetrics = {
  cpuSeconds: number;
  workingSetMb: number;
  pagedMemoryMb: number;
  privateMemoryMb: number;
  readTransferMb: number;
  writeTransferMb: number;
};

export type DesktopResourceActionDescriptor = {
  actionId: DesktopResourceActionId;
  label: string;
  description: string;
  safety: DesktopResourceActionSafety;
  requiresApproval: boolean;
  controlId?: DesktopResourceControlId | null;
  command?: string | null;
};

export type DesktopResourceProcessSample = {
  pid: number;
  processName: string;
  executablePath: string | null;
  commandLine: string | null;
  cpuSeconds: number;
  workingSetMb: number;
  pagedMemoryMb: number;
  privateMemoryMb: number;
  readTransferMb: number;
  writeTransferMb: number;
  mainWindowTitle: string | null;
  startTime: string | null;
  responding: boolean | null;
};

export type DesktopResourceWslDistroSample = {
  name: string;
  state: string;
  version: string;
  isDefault: boolean;
};

export type DesktopDockerDesktopSample = {
  detected: boolean;
  status: 'running' | 'idle' | 'stopped' | 'unavailable';
  runningContainerCount: number | null;
  contextName: string | null;
  warnings: string[];
};

export type DesktopResourceCollection = {
  generatedAt: string;
  host: {
    hostname: string;
    platform: string;
    totalVisibleMemoryMb: number;
    freePhysicalMemoryMb: number;
    totalPhysicalMemoryMb: number;
    memoryLoadPercent: number | null;
  };
  processes: DesktopResourceProcessSample[];
  wsl: {
    ok: boolean;
    distros: DesktopResourceWslDistroSample[];
    message: string;
    warnings: string[];
  };
  docker: DesktopDockerDesktopSample;
};

export type DesktopResourceItem = {
  id: string;
  label: string;
  owner: DesktopResourceOwner;
  kind: DesktopResourceKind;
  pressure: DesktopResourcePressureLevel;
  controlId: DesktopResourceControlId | null;
  status: string;
  summary: string;
  details: string[];
  metrics: DesktopResourceMetrics;
  process: {
    pid: number;
    processName: string;
    executablePath: string | null;
    commandLine: string | null;
    mainWindowTitle: string | null;
  } | null;
};

export type DesktopResourceGroup = {
  id: string;
  label: string;
  owner: DesktopResourceOwner;
  pressure: DesktopResourcePressureLevel;
  summary: string;
  metrics: DesktopResourceMetrics;
  itemCount: number;
  itemIds: string[];
  actions: DesktopResourceActionDescriptor[];
};

export type DesktopResourceSnapshot = {
  version: 1;
  generatedAt: string;
  host: DesktopResourceCollection['host'] & {
    pressure: DesktopResourcePressureLevel;
    usedPhysicalMemoryMb: number;
  };
  signals: {
    wsl: DesktopResourceCollection['wsl'];
    docker: DesktopDockerDesktopSample;
  };
  totals: {
    processesTracked: number;
    groupsTracked: number;
    memoryTrackedMb: number;
    companionMemoryMb: number;
    zavorthMemoryMb: number;
    externalMemoryMb: number;
  };
  groups: DesktopResourceGroup[];
  items: DesktopResourceItem[];
  topConsumers: DesktopResourceItem[];
  recommendedActions: DesktopResourceActionDescriptor[];
  warnings: string[];
  recommendations: string[];
};
