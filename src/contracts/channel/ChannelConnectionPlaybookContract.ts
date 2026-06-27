import type { ChannelReadinessProof } from './ChannelMeshContract.js';
import type { PlatformKey } from '../PlatformContract.js';
import type { ChannelInstallMode } from '../../services/ChannelInstallScaffoldService.js';

export const CHANNEL_CONNECTION_PLAYBOOK_VERSION = 'channel-connection-playbook/v1' as const;

export type ChannelConnectionPlaybookStatus =
  | 'needs-channel'
  | 'needs-scaffold'
  | 'needs-config'
  | 'ready-to-validate'
  | 'live-ready'
  | 'default-route-ready';

export type ChannelConnectionStepStatus = 'done' | 'next' | 'pending' | 'blocked';

export type ChannelConnectionStepId =
  | 'choose-channel'
  | 'prepare-scaffold'
  | 'fill-secrets'
  | 'configure-webhook'
  | 'set-allowlist'
  | 'run-doctor'
  | 'prove-live'
  | 'send-test';

export type ChannelConnectionPlaybookStep = {
  id: ChannelConnectionStepId;
  label: string;
  status: ChannelConnectionStepStatus;
  command: string | null;
  details: string[];
};

export type ChannelConnectionPlaybookCommands = {
  inspect: string;
  apply: string;
  doctor: string;
  liveProof: string;
  sendTest: string;
};

export type ChannelConnectionPlaybookReadiness = {
  configured: boolean;
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  readinessProof: ChannelReadinessProof;
  defaultBlockReason: string | null;
};

export type ChannelConnectionPlaybookSafety = {
  rawSecretsSerialized: false;
  catalogSupportIsNotLiveProof: true;
  defaultRouteRequiresLiveProof: true;
  outboxOnlyIsNotLive: true;
};

export type ChannelConnectionPlaybook = {
  channelId: PlatformKey;
  label: string;
  mode: ChannelInstallMode | null;
  status: ChannelConnectionPlaybookStatus;
  summary: string;
  nextAction: string;
  requiredInputKeys: string[];
  missingInputKeys: string[];
  webhookUrl: string | null;
  readiness: ChannelConnectionPlaybookReadiness;
  commands: ChannelConnectionPlaybookCommands;
  steps: ChannelConnectionPlaybookStep[];
  safety: ChannelConnectionPlaybookSafety;
};

export type ChannelConnectionPlaybookSummary = {
  total: number;
  needsScaffold: number;
  needsConfig: number;
  readyToValidate: number;
  liveReady: number;
  defaultRouteAllowed: number;
};

export type ChannelConnectionPlaybookSnapshot = {
  generatedAt: string;
  version: typeof CHANNEL_CONNECTION_PLAYBOOK_VERSION;
  status: 'ready' | 'needs-setup' | 'attention';
  selected: ChannelConnectionPlaybook | null;
  playbooks: ChannelConnectionPlaybook[];
  summary: ChannelConnectionPlaybookSummary;
  operatorSummary: string;
};
