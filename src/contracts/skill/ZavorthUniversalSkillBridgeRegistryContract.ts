import type { SkillCatalogEntry } from '../skills/SkillCatalogContract.js';
import type {
  ZavorthUniversalSkillBridgeMode,
  ZavorthUniversalSkillBridgeSnapshot,
} from './ZavorthUniversalSkillBridgeRuntimeContract.js';

export const ZAVORTH_UNIVERSAL_SKILL_BRIDGE_REGISTRY_CONTRACT_VERSION = '2026-05-10.checkpoint-4' as const;

export type ZavorthUniversalSkillBridgeRegistryEntryStatus =
  | 'ready'
  | 'approval-required'
  | 'blocked'
  | 'local-only';

export type ZavorthUniversalSkillBridgeRegistryActionKind =
  | 'catalog'
  | 'dry-run'
  | 'live-prepare'
  | 'origin'
  | 'policy';

export type ZavorthUniversalSkillBridgeRegistryAction = {
  id: string;
  kind: ZavorthUniversalSkillBridgeRegistryActionKind;
  label: string;
  command: string;
  apiPath: string;
  requiresApproval: boolean;
  safeDefault: boolean;
  reason: string;
};

export type ZavorthUniversalSkillBridgeRegistryEntry = {
  id: string;
  skillName: string;
  description: string;
  status: ZavorthUniversalSkillBridgeRegistryEntryStatus;
  imported: boolean;
  runtimeEligible: boolean;
  dryRunReady: boolean;
  liveRequiresApproval: boolean;
  sourceId: string | null;
  sourceLabel: string | null;
  sourceTrust: string | null;
  license: string | null;
  riskLevel: string | null;
  reviewRequired: boolean;
  blockers: string[];
  actions: ZavorthUniversalSkillBridgeRegistryAction[];
  catalogEntry: SkillCatalogEntry;
};

export type ZavorthUniversalSkillBridgeRegistrySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_BRIDGE_REGISTRY_CONTRACT_VERSION;
  query: string | null;
  selectedId: string | null;
  mode: ZavorthUniversalSkillBridgeMode;
  channel: string;
  summary: {
    total: number;
    imported: number;
    localOnly: number;
    ready: number;
    approvalRequired: number;
    blocked: number;
    visible: number;
    actions: number;
    invocationPrepared: boolean;
  };
  entries: ZavorthUniversalSkillBridgeRegistryEntry[];
  selected: ZavorthUniversalSkillBridgeRegistryEntry | null;
  invocation: ZavorthUniversalSkillBridgeSnapshot | null;
  actions: ZavorthUniversalSkillBridgeRegistryAction[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  policy: {
    registryDoesNotExecuteSkills: true;
    bridgeRuntimeIsAuthority: true;
    importedSkillsOnlyByDefault: true;
    dryRunSafeDefault: true;
    liveRequiresOwnerApproval: true;
    catalogActionsUseBridgeOnly: true;
  };
  commands: {
    inspect: 'npm run zavorth:universal-skill-bridge-registry -- --skill <name>';
    invokeDryRun: 'npm run zavorth:universal-skill-bridge-registry -- --skill <name> --invoke';
    invokeLive: 'npm run zavorth:universal-skill-bridge-registry -- --skill <name> --invoke --live --approval-id <approval-id>';
    check: 'npm run zavorth:universal-skill-bridge-registry:check --silent';
    nextStage: 'Credential vault - Activation UX and Channel Command Packs';
  };
};
