import type { PluginRegistrySnapshot } from '../services/PluginRegistryService.js';
import type { ZavorthPluginManifest } from './PluginManifestContract.js';

export const ZAVORTH_OPERATIONAL_PARITY_TOOLING_CONTRACT_VERSION = '2026-05-04.phase-8';

export type OperationalParityPhaseId =
  | 'phase-1-parity-matrix'
  | 'phase-2-plugin-os'
  | 'phase-3-capability-normalization'
  | 'phase-4-provider-mesh'
  | 'phase-5-channel-mesh'
  | 'phase-6-satellite-apps'
  | 'phase-7-memory-artifacts'
  | 'phase-8-operational-tooling';

export type OperationalParityStatus = 'passed' | 'attention' | 'blocked';

export type OperationalParityGapSeverity = 'p0' | 'p1' | 'p2';

export type OperationalParityGateKind =
  | 'static-check'
  | 'jest'
  | 'typecheck'
  | 'doctor'
  | 'documentation';

export type OperationalParityGate = {
  id: string;
  phaseId: OperationalParityPhaseId;
  kind: OperationalParityGateKind;
  command: string;
  required: boolean;
  status: OperationalParityStatus;
  reason: string;
};

export type OperationalParityGap = {
  id: string;
  phaseId: OperationalParityPhaseId;
  severity: OperationalParityGapSeverity;
  status: 'open' | 'tracked' | 'decision-required';
  surface: string;
  count: number;
  reason: string;
  nextAction: string;
  command: string;
};

export type OperationalParityPhaseRecord = {
  id: OperationalParityPhaseId;
  title: string;
  status: OperationalParityStatus;
  document: string;
  service: string | null;
  checkCommand: string;
  testCommand: string | null;
  summary: Record<string, number | string | boolean>;
  gapCount: number;
  generatedPluginManifests: number;
  notes: string[];
};

export type OperationalParityPluginInventoryItem = {
  pluginId: string;
  moduleKind: ZavorthPluginManifest['moduleKind'];
  capabilityCount: number;
  permissionCount: number;
  source: string;
  defaultTrust: string;
  requiresApproval: boolean;
};

export type OperationalParitySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_OPERATIONAL_PARITY_TOOLING_CONTRACT_VERSION;
  status: OperationalParityStatus;
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
  phases: OperationalParityPhaseRecord[];
  gates: OperationalParityGate[];
  gaps: OperationalParityGap[];
  pluginRegistry: PluginRegistrySnapshot;
  pluginInventory: OperationalParityPluginInventoryItem[];
  generatedPluginManifests: ZavorthPluginManifest[];
  commands: {
    doctor: string;
    doctorJson: string;
    staticGate: string;
    focusedTests: string[];
    typecheck: string;
    nextPhase: string;
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
