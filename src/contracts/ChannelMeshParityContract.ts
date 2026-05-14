import type {
  ChannelAdapterStatus,
  ChannelFeatureSet,
} from './ChannelMeshContract.js';
import type { CapabilitySourceMapping } from './CapabilityNormalizationContract.js';
import type { ZavorthPluginManifest } from './PluginManifestContract.js';

export const ZAVORTH_CHANNEL_MESH_PARITY_CONTRACT_VERSION = '2026-05-04.phase-5';

export type ChannelMeshParityStatus =
  | 'native'
  | 'adapter-backed'
  | 'webhook-template'
  | 'bridge-template'
  | 'template-ready'
  | 'unsupported'
  | 'unmapped';

export type ChannelMeshParityTransportStrategy =
  | 'native-runtime'
  | 'gateway-adapter'
  | 'webhook-runtime'
  | 'local-bridge'
  | 'bot-api-template'
  | 'generic-webhook-template'
  | 'template-required'
  | 'unsupported';

export type ChannelMeshAuthKind =
  | 'none'
  | 'bot_token'
  | 'webhook_secret'
  | 'oauth'
  | 'api_key'
  | 'local_pairing'
  | 'device_pairing'
  | 'manual';

export type ChannelMeshCredentialPolicy = {
  authKind: ChannelMeshAuthKind;
  credentialRefs: string[];
  secretValuesSerialized: false;
  requiresOperatorConfiguration: boolean;
};

export type ChannelMeshConnectorRoute = {
  routeId: string;
  sourceName: string;
  canonicalChannelId: string;
  label: string;
  adapterTarget: string;
  transportStrategy: ChannelMeshParityTransportStrategy;
  webhookPath: string | null;
  doctorCommand: string;
  features: ChannelFeatureSet;
};

export type ChannelMeshParitySimulation = {
  inbound: {
    channelId: string;
    sessionId: string;
    userId: string;
    text: string;
    normalized: boolean;
    metadata: Record<string, string | boolean>;
  };
  outbound: {
    channelId: string;
    recipients: string[];
    text: string;
    dryRun: true;
    attachmentsSupported: boolean;
  };
  receipts: Array<{
    kind: 'channel.inbound.simulated' | 'channel.outbound.simulated';
    channelId: string;
    summary: string;
  }>;
};

export type ChannelMeshParityEntry = {
  sourceName: string;
  normalizedSourceName: string;
  canonicalChannelId: string;
  status: ChannelMeshParityStatus;
  mapping: CapabilitySourceMapping;
  route: ChannelMeshConnectorRoute;
  gatewayStatus: ChannelAdapterStatus | null;
  generatedPluginManifest: ZavorthPluginManifest;
  credentialPolicy: ChannelMeshCredentialPolicy;
  simulation: ChannelMeshParitySimulation;
  smokeGate: {
    id: string;
    command: string;
    liveSendRequired: false;
    expected: string;
  };
  findings: string[];
};

export type ChannelMeshParitySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CHANNEL_MESH_PARITY_CONTRACT_VERSION;
  primitiveId: 'channel.message';
  summary: {
    sourceChannels: number;
    native: number;
    adapterBacked: number;
    webhookTemplates: number;
    bridgeTemplates: number;
    templateReady: number;
    unsupported: number;
    unmapped: number;
    generatedPluginManifests: number;
    secretValuesSerialized: false;
  };
  entries: ChannelMeshParityEntry[];
  unsupported: ChannelMeshParityEntry[];
  generatedPluginManifests: ZavorthPluginManifest[];
};
