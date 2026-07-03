export const ZAVORTH_MNEMOS_MEMORY_UX_VERSION = 'zavorth-mnemos-memory-ux-v1' as const;

export type ZavorthMnemosMemoryUxSurface = 'zavorthControl' | 'cli' | 'telegram';

export type ZavorthMnemosMemoryUxCommand = {
  surface: ZavorthMnemosMemoryUxSurface;
  label: string;
  command: string;
  summary: string;
  requiresApproval: boolean;
};

export type ZavorthMnemosMemoryUxPanel = {
  id: string;
  title: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: string;
  primaryCommand: string;
  commands: ZavorthMnemosMemoryUxCommand[];
};

export type ZavorthMnemosMemoryUxSnapshot = {
  version: typeof ZAVORTH_MNEMOS_MEMORY_UX_VERSION;
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  headline: string;
  panels: ZavorthMnemosMemoryUxPanel[];
  summary: {
    lintStatus: string;
    lintFindings: number;
    proceduralRules: number;
    activeProceduralRules: number;
    surfaces: ZavorthMnemosMemoryUxSurface[];
  };
  safety: {
    providerCall: false;
    networkCall: false;
    durableMutation: false;
    zavorthControlCanWriteMemory: false;
    cliWriteRequiresApproval: true;
    telegramWriteRequiresApproval: true;
    rawJsonHiddenByDefault: true;
  };
  receipt: {
    id: string;
    providerCall: false;
    durableMutation: false;
  };
};
