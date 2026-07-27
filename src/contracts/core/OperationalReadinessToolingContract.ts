import type { PluginRegistrySnapshot } from '../../services/PluginRegistryService.js';
import type { ZavorthPluginManifest } from './PluginManifestContract.js';

export const ZAVORTH_OPERATIONAL_READINESS_TOOLING_CONTRACT_VERSION = '2026-05-04.gate-8';

export type OperationalReadinessPhaseId =
  | 'gate-1-consistency-matrix'
  | 'gate-2-plugin-os'
  | 'gate-3-capability-normalization'
  | 'gate-4-provider-mesh'
  | 'gate-5-channel-mesh'
  | 'gate-6-satellite-apps'
  | 'gate-7-memory-artifacts'
  | 'gate-8-operational-tooling';

export type OperationalReadinessStatus = 'passed' | 'attention' | 'blocked';

export type OperationalReadinessGapSeverity = 'p0' | 'p1' | 'p2';

export type OperationalReadinessGateKind =
  | 'static-check'
  | 'jest'
  | 'typecheck'
  | 'doctor'
  | 'documentation';

export type OperationalReadinessGate = {
  id: string;
  phaseId: OperationalReadinessPhaseId;
  kind: OperationalReadinessGateKind;
  command: string;
  required: boolean;
  status: OperationalReadinessStatus;
  reason: string;
};

export type OperationalReadinessGap = {
  id: string;
  phaseId: OperationalReadinessPhaseId;
  severity: OperationalReadinessGapSeverity;
  status: 'open' | 'tracked' | 'decision-required';
  surface: string;
  count: number;
  reason: string;
  nextAction: string;
  command: string;
};

export type OperationalReadinessPhaseRecord = {
  id: OperationalReadinessPhaseId;
  title: string;
  status: OperationalReadinessStatus;
  document: string;
  service: string | null;
  checkCommand: string;
  testCommand: string | null;
  summary: Record<string, number | string | boolean>;
  gapCount: number;
  generatedPluginManifests: number;
  notes: string[];
};

export type OperationalReadinessPluginInventoryItem = {
  pluginId: string;
  moduleKind: ZavorthPluginManifest['moduleKind'];
  capabilityCount: number;
  permissionCount: number;
  source: string;
  defaultTrust: string;
  requiresApproval: boolean;
};

export type OperationalReadinessSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_OPERATIONAL_READINESS_TOOLING_CONTRACT_VERSION;
  status: OperationalReadinessStatus;
  summary: {
    phases: number;
    passed: number;
    attention: number;
    blocked: number;
    staticGates: number;
    jestGates: number;
    doctorCommands: number;
    privateSourceModules: number;
    normalizedSourceModules: number;
    sourceModulesNeedingReview: number;
    generatedPluginManifests: number;
    pluginCapabilities: number;
    openGaps: number;
    p0Gaps: number;
    p1Gaps: number;
    p2Gaps: number;
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    liveDeviceRequired: false;
    liveMemoryWriteRequired: false;
    filesystemReadRequired: false;
    secretValuesSerialized: false;
  };
  phases: OperationalReadinessPhaseRecord[];
  gates: OperationalReadinessGate[];
  gaps: OperationalReadinessGap[];
  pluginRegistry: PluginRegistrySnapshot;
  pluginInventory: OperationalReadinessPluginInventoryItem[];
  generatedPluginManifests: ZavorthPluginManifest[];
  commands: {
    doctor: string;
    doctorJson: string;
    staticGate: string;
    focusedTests: string[];
    typecheck: string;
    nextAction: string;
  };
  certification: {
    releaseReady: boolean;
    reason: string;
    minimumNextAction: string;
  };
  policy: {
    operationalToolingOnly: true;
    noExternalCalls: true;
    noLiveSends: true;
    noDeviceAccess: true;
    noMemoryWrites: true;
    noArtifactBodyReads: true;
    secretsSerialized: false;
  };
};
