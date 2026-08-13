import type { ZavorthMutationPlan, ZavorthMutationRiskLevel } from '../../contracts/ZavorthMutationPlaneContract.js';
import type { TrustDecision } from '../TrustDecisionService.js';

export type HardwareProviderId =
  | 'home-assistant'
  | 'mqtt'
  | 'webhook'
  | 'serial'
  | 'hid'
  | 'node-host';

export type HardwareProviderStatus = 'configured' | 'dormant' | 'disabled' | 'blocked';
export type HardwareDeviceType =
  | 'light'
  | 'sensor'
  | 'switch'
  | 'climate'
  | 'lock'
  | 'cover'
  | 'media'
  | 'camera'
  | 'nas'
  | 'printer'
  | 'ups'
  | 'script'
  | 'generic';
export type HardwareDeviceVisibility = 'visible' | 'read-only' | 'hidden';
export type HardwareActionStatus = 'waiting_approval' | 'draft' | 'blocked';
export type HardwareApplyStatus = 'applied' | 'verified' | 'dry_run' | 'blocked' | 'failed';

export type HardwareProviderView = {
  id: HardwareProviderId;
  label: string;
  status: HardwareProviderStatus;
  configured: boolean;
  startsOnRead: false;
  transport: 'rest' | 'mqtt' | 'webhook' | 'serial' | 'hid' | 'node-mesh';
  mutable: boolean;
  summary: string;
  blockers: string[];
};

export type HardwareDeviceRecord = {
  id: string;
  label: string;
  providerId: HardwareProviderId;
  externalId: string | null;
  type: HardwareDeviceType;
  location: string | null;
  riskLevel: ZavorthMutationRiskLevel;
  allowlisted: boolean;
  visibility: HardwareDeviceVisibility;
  allowedActions: string[];
  lastSeenAt: string | null;
  notes: string[];
  metadata: Record<string, unknown>;
};

export type HardwareDeviceView = HardwareDeviceRecord & {
  mutationMode: 'mutable' | 'read_only' | 'hidden';
  providerStatus: HardwareProviderStatus;
  operatorSummary: string;
  blockers: string[];
};

export type HardwareAuditEntry = {
  id: string;
  at: string;
  event: string;
  status: 'previewed' | 'applied' | 'blocked' | 'verified' | 'auto_paused' | 'emergency_stop' | 'noop';
  providerId: HardwareProviderId | null;
  deviceId: string | null;
  action: string | null;
  requestedBy: string | null;
  planId: string | null;
  summary: string;
};

export type HardwareEmergencyStop = {
  active: boolean;
  reason: string | null;
  activatedAt: string | null;
  activatedBy: string | null;
  clearedAt: string | null;
  clearedBy: string | null;
};

export type HardwareAutomationFailureGuard = {
  automationId: string;
  deviceId: string | null;
  failures: number;
  threshold: number;
  lastFailureAt: string | null;
  autoPaused: boolean;
  pausedAt: string | null;
  reason: string | null;
};

export type HardwareActionPlaneState = {
  version: 1;
  updatedAt: string | null;
  emergencyStop: HardwareEmergencyStop;
  devices: Record<string, HardwareDeviceRecord>;
  failureGuards: Record<string, HardwareAutomationFailureGuard>;
  audit: HardwareAuditEntry[];
};

export type HardwareActionPlaneSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    providers: number;
    configuredProviders: number;
    devices: number;
    visibleDevices: number;
    allowlistedDevices: number;
    readOnlyDevices: number;
    hiddenDevices: number;
    pendingHardwarePlans: number;
    emergencyStopActive: boolean;
    autoPausedAutomations: number;
    heavyRuntimesStarted: false;
  };
  policy: {
    actionFlow: ['preview', 'approval', 'apply', 'verify', 'audit'];
    providersStartOnRead: false;
    allowlistRequiredForMutation: true;
    nonAllowlistedDefault: 'read-only';
    emergencyStopBlocksPhysicalActions: true;
    physicalAutomationsAutoPauseAfterFailures: true;
    trustPlaneDomain: 'hardware';
    watchModeVerification: 'optional-after-approval';
    federatedMeshDelegation: 'node-host-provider';
  };
  providers: HardwareProviderView[];
  devices: HardwareDeviceView[];
  emergencyStop: HardwareEmergencyStop;
  automationGuards: HardwareAutomationFailureGuard[];
  pendingPlans: ZavorthMutationPlan[];
  audit: HardwareAuditEntry[];
  actions: Array<{
    id: string;
    label: string;
    command: string;
    severity: 'info' | 'warn' | 'critical';
    reason: string;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export type HardwareProviderActionEvidence = {
  ok: boolean;
  status?: 'applied' | 'verified' | 'failed' | 'blocked';
  summary: string;
  data?: Record<string, unknown> | null;
  verified?: boolean;
};

export type HardwareProviderAdapter = {
  execute: (input: {
    provider: HardwareProviderView;
    device: HardwareDeviceRecord;
    action: string;
    payload: Record<string, unknown>;
    requestedBy: string | null;
  }) => Promise<HardwareProviderActionEvidence> | HardwareProviderActionEvidence;
  verify?: (input: {
    provider: HardwareProviderView;
    device: HardwareDeviceRecord;
    action: string;
    payload: Record<string, unknown>;
  }) => Promise<HardwareProviderActionEvidence> | HardwareProviderActionEvidence;
};

export type HardwarePlanActionInput = {
  deviceId: string;
  action: string;
  payload?: Record<string, unknown> | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  approvalRequired?: boolean | null;
  approvalScope?: 'once' | 'session' | 'host' | null;
};

export type HardwarePlanActionResult = {
  generatedAt: string;
  status: HardwareActionStatus;
  ok: boolean;
  summary: string;
  blockers: string[];
  device: HardwareDeviceView | null;
  mutationPlan: ZavorthMutationPlan | null;
  trustDecision: TrustDecision | null;
  snapshot: HardwareActionPlaneSnapshot;
};

export type HardwareApplyPlanResult = {
  generatedAt: string;
  status: HardwareApplyStatus;
  ok: boolean;
  summary: string;
  blockers: string[];
  device: HardwareDeviceView | null;
  mutationPlan: ZavorthMutationPlan | null;
  evidence: HardwareProviderActionEvidence | null;
  snapshot: HardwareActionPlaneSnapshot;
};

export const PROVIDERS: Array<{
  id: HardwareProviderId;
  label: string;
  transport: HardwareProviderView['transport'];
  mutable: boolean;
}> = [
  { id: 'home-assistant', label: 'Home Assistant', transport: 'rest', mutable: true },
  { id: 'mqtt', label: 'MQTT', transport: 'mqtt', mutable: true },
  { id: 'webhook', label: 'Webhook local', transport: 'webhook', mutable: true },
  { id: 'serial', label: 'Serial/USB', transport: 'serial', mutable: true },
  { id: 'hid', label: 'HID', transport: 'hid', mutable: true },
  { id: 'node-host', label: 'Federated node host', transport: 'node-mesh', mutable: true },
];

export const HIGH_RISK_ACTIONS = new Set([
  'unlock',
  'lock.unlock',
  'disarm',
  'alarm.disarm',
  'open_cover',
  'cover.open',
  'door.open',
  'garage.open',
  'vacuum_start',
  'script.run',
  'run_script',
]);

export const READ_ONLY_ACTIONS = new Set([
  'read',
  'read_state',
  'state.read',
  'sensor.read',
  'status',
  'device.info',
]);
