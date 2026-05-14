export type TranslationValues = Record<string, string | number | boolean | Date>;

export type CloudflaredTunnelPhase =
  | "unsupported"
  | "not_installed"
  | "stopped"
  | "starting"
  | "running"
  | "error";

export type CloudflaredTunnelStatus = {
  supported: boolean;
  installed: boolean;
  managedInstall: boolean;
  installSource: string | null;
  binaryPath: string | null;
  running: boolean;
  pid: number | null;
  publicUrl: string | null;
  apiUrl: string | null;
  targetUrl: string;
  phase: CloudflaredTunnelPhase;
  lastError: string | null;
  logPath: string;
};

export type TunnelNotice = {
  type: "success" | "error" | "info";
  message: string;
};

export type EndpointModelsData = {
  chat: any[];
  embeddings: any[];
  images: any[];
  rerank: any[];
  audioTranscription: any[];
  audioSpeech: any[];
  moderation: any[];
  music: any[];
};

export type EndpointPageClientViewState = {
  t: (key: string, values?: TranslationValues) => string;
  tc: (key: string, values?: TranslationValues) => string;
  translateOrFallback: (key: string, fallback: string, values?: TranslationValues) => string;
  copied: string | null;
  copy: (value: string, copyKey?: string) => void;
  loading: boolean;
  resolvedMachineId: string;
  allModels: any[];
  endpointData: EndpointModelsData;
  expandedEndpoint: string | null;
  setExpandedEndpoint: (value: any) => void;
  cloudEnabled: boolean;
  cloudStatus: { type: "success" | "error" | "warning"; message: string } | null;
  cloudSyncing: boolean;
  cloudConfigured: boolean;
  cloudBaseUrl: string | null;
  cloudEndpointCurrent: string;
  showCloudModal: boolean;
  setShowCloudModal: (value: boolean) => void;
  showDisableModal: boolean;
  setShowDisableModal: (value: boolean) => void;
  viewTab: string;
  setViewTab: (value: string) => void;
  syncStep: string;
  modalSuccess: boolean;
  selectedProvider: any;
  setSelectedProvider: (value: any) => void;
  mcpStatus: any;
  a2aStatus: any;
  searchProviders: any[];
  cloudflaredStatus: CloudflaredTunnelStatus | null;
  cloudflaredBusy: boolean;
  cloudflaredNotice: TunnelNotice | null;
  setCloudflaredNotice: (value: TunnelNotice | null) => void;
  setCloudStatus: (value: { type: "success" | "error" | "warning"; message: string } | null) => void;
  cloudflaredPhaseMeta: Record<CloudflaredTunnelPhase, { label: string; className: string }>;
  cloudflaredActionLabel: string;
  cloudflaredUrlNotice: string;
  mcpOnline: boolean;
  a2aOnline: boolean;
  mcpToolCount: number;
  a2aActiveStreams: number;
  baseUrl: string;
  currentEndpoint: string;
  handleCloudToggle: (checked: boolean) => void;
  handleEnableCloud: () => Promise<void>;
  handleConfirmDisable: () => Promise<void>;
  handleCloudflaredAction: (action: "enable" | "disable") => Promise<void>;
};
