export const ZAVORTH_CAPABILITY_ATLAS_CONTRACT_VERSION =
  '2026-06-02.capability-atlas.v1' as const;

export type ZavorthCapabilityAtlasStatus = 'ready' | 'partial' | 'missing';

export type ZavorthCapabilityAtlasCategory =
  | 'agent-core'
  | 'memory'
  | 'voice'
  | 'channels'
  | 'providers'
  | 'skills'
  | 'automation'
  | 'execution'
  | 'interfaces'
  | 'extensions'
  | 'governance';

export type ZavorthCapabilityAtlasSurface = {
  llm: boolean;
  actionHarness: boolean;
  cli: boolean;
  zavorthControl: boolean;
  tui: boolean;
  docs: boolean;
};

export type ZavorthCapabilityAtlasEntry = {
  id: string;
  title: string;
  shortName: string;
  category: ZavorthCapabilityAtlasCategory;
  description: string;
  dailyUse: string;
  aliases: string[];
  actionIds: string[];
  commands: string[];
  keyFiles: string[];
  docs: string[];
  surfaces: ZavorthCapabilityAtlasSurface;
  status: ZavorthCapabilityAtlasStatus;
  statusReason: string;
  missing: string[];
  riskPosture: 'safe-read' | 'approval-gated' | 'sandboxed' | 'external-gated';
};

export type ZavorthCapabilityAtlasSnapshot = {
  contractVersion: typeof ZAVORTH_CAPABILITY_ATLAS_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'capability-atlas';
  projectRoot: string;
  status: ZavorthCapabilityAtlasStatus;
  summary: {
    total: number;
    ready: number;
    partial: number;
    missing: number;
    llmVisible: number;
    actionHarnessBacked: number;
    cliVisible: number;
    zavorthControlVisible: number;
    tuiVisible: number;
  };
  categories: Record<ZavorthCapabilityAtlasCategory, number>;
  entries: ZavorthCapabilityAtlasEntry[];
  llmContextBlock: string;
  commands: {
    status: string;
    json: string;
    lookup: string;
    actionLookup: string;
  };
  safety: {
    readOnlyInventory: true;
    noSecretsSerialized: true;
    missingMeansNotDiscoverableNotAbsent: true;
    actionHarnessRemainsSourceForMutation: true;
  };
};
