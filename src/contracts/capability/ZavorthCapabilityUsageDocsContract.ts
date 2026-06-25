import type { ZavorthCapabilityActionSurfaceItem } from './ZavorthCapabilityActionSurfaceContract.js';

export const ZAVORTH_CAPABILITY_USAGE_DOCS_CONTRACT_VERSION = '2026-06-02.capability-usage-docs.v1' as const;

export type ZavorthCapabilityUsageDocsSnapshot = {
  contractVersion: typeof ZAVORTH_CAPABILITY_USAGE_DOCS_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'capability-usage-docs';
  status: 'ready' | 'available' | 'attention';
  docPath: string;
  summary: {
    exposed: number;
    receipts: number;
    publicSections: number;
  };
  items: ZavorthCapabilityActionSurfaceItem[];
  publicCommands: {
    list: string;
    lookup: string;
    preview: string;
    approve: string;
    receipts: string;
    usageSignals: string;
    lifecycle: string;
  };
  visibleIn: Array<'dashboard' | 'tui' | 'setup' | 'cli'>;
  safety: {
    publicDocsOnly: true;
    noSecrets: true;
    noInternalMilestoneLanguage: true;
    noLiveActivationByReadingDocs: true;
  };
};
