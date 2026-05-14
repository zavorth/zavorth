import type {
  PlatformImplementationState,
  PlatformKey,
  PlatformReadiness,
  PlatformTransport,
} from '../../contracts/PlatformContract.js';

export type CapabilityDescriptor = {
  platform: PlatformKey;
  implementationState: PlatformImplementationState;
  readiness: PlatformReadiness;
  configured: boolean;
  transport: PlatformTransport;
  envKeys: string[];
  notes: string[];
};

export type DiscordBridgeRuntimeStatus = {
  mode: 'bridge' | 'native' | 'unknown';
  enabled: boolean;
  started: boolean;
  lastError: string | null;
};

export type WhatsAppRuntimeStatus = {
  mode: 'stub' | 'cloud-api' | 'baileys' | 'unknown';
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  provider: 'stub' | 'cloud-api' | 'baileys' | 'unknown';
  providerConfigured: boolean;
  providerDecision: string | null;
  webhookConfigured: boolean;
  sessionDirConfigured: boolean;
  lastError: string | null;
};

export type SlackRuntimeStatus = {
  mode: 'stub' | 'native' | 'unknown';
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  transport: 'native' | 'local' | 'stub' | 'unknown';
  nativeConfigured: boolean;
  apiBaseUrl: string | null;
  workspaceConfigured: boolean;
  lastError: string | null;
};

export type PlannedChannelRuntimeStatus = {
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  mode: string;
  transport: PlatformTransport | 'unknown';
  providerConfigured: boolean;
  platform: string | null;
  lastError: string | null;
};

export type PlatformCapabilityRuntime = {
  readDiscordBridgeRuntimeStatus: () => DiscordBridgeRuntimeStatus | null;
  readWhatsAppRuntimeStatus: () => WhatsAppRuntimeStatus | null;
  readSlackRuntimeStatus: () => SlackRuntimeStatus | null;
  readPlannedChannelRuntimeStatus: (filePath: string) => PlannedChannelRuntimeStatus | null;
  envValue: (key: string) => string;
  envList: (key: string) => string[];
  envBoolean: (key: string, fallback?: boolean) => boolean;
};
