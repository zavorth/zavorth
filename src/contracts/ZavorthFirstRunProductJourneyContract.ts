import type {
  ZavorthProductDailyMode,
  ZavorthProductDetailMode,
} from './ZavorthProductModeContract.js';

export type ZavorthFirstRunProductJourneyStepId =
  | 'mode'
  | 'provider'
  | 'workspace'
  | 'safety'
  | 'channels'
  | 'first-mission';

export type ZavorthFirstRunProductJourneyStepStatus =
  | 'ready'
  | 'recommended'
  | 'needs_input'
  | 'optional'
  | 'done';

export type ZavorthGuidedMissionTemplateId =
  | 'dev-repo-review'
  | 'pdf-summary'
  | 'file-organization'
  | 'daily-assistant'
  | 'safe-audit';

export type ZavorthGuidedMissionTemplate = {
  id: ZavorthGuidedMissionTemplateId;
  label: string;
  summary: string;
  prompt: string;
  defaultRisk: 'low' | 'medium' | 'high';
  requiresMutation: boolean;
  requiresNetwork: boolean;
  recommendedMode: ZavorthProductDailyMode;
  expectedArtifacts: string[];
};

export type ZavorthFirstRunProductJourneyStep = {
  id: ZavorthFirstRunProductJourneyStepId;
  label: string;
  status: ZavorthFirstRunProductJourneyStepStatus;
  command: string;
  summary: string;
  nextAction: string;
};

export type ZavorthFirstRunProductJourneyContract = {
  schemaVersion: 1;
  surface: 'first-run-product-journey';
  generatedAt: string;
  selected: {
    dailyMode: ZavorthProductDailyMode;
    detailMode: ZavorthProductDetailMode;
  };
  status: 'ready' | 'needs_setup' | 'attention';
  primaryCommands: {
    onboard: 'zavorth onboard';
    go: 'zavorth go';
    doctorSimple: 'zavorth doctor --simple';
    doctorAdvanced: 'zavorth doctor --advanced';
    templates: 'zavorth templates';
  };
  steps: ZavorthFirstRunProductJourneyStep[];
  templates: ZavorthGuidedMissionTemplate[];
  safeDemoRun: {
    templateId: ZavorthGuidedMissionTemplateId;
    command: string;
    mutatesWorkspace: false;
    summary: string;
  };
};

export function buildDefaultZavorthGuidedMissionTemplates(): ZavorthGuidedMissionTemplate[] {
  return [
    {
      id: 'dev-repo-review',
      label: 'Dev repo review',
      summary: 'Read the current repository and return risks, broken flows and next actions.',
      prompt: 'Review this repository in read-only mode and list the highest-value risks.',
      defaultRisk: 'low',
      requiresMutation: false,
      requiresNetwork: false,
      recommendedMode: 'personal',
      expectedArtifacts: ['risk-summary', 'file-map', 'next-actions'],
    },
    {
      id: 'pdf-summary',
      label: 'PDF summary',
      summary: 'Summarize a local PDF with citations to page or section evidence when available.',
      prompt: 'Summarize this PDF and separate facts, uncertainty and recommended follow-up.',
      defaultRisk: 'low',
      requiresMutation: false,
      requiresNetwork: false,
      recommendedMode: 'personal',
      expectedArtifacts: ['summary', 'evidence-notes'],
    },
    {
      id: 'file-organization',
      label: 'File organization',
      summary: 'Preview a clean folder organization plan before any move or rename happens.',
      prompt: 'Inspect this folder and propose a safe organization plan before changing files.',
      defaultRisk: 'medium',
      requiresMutation: true,
      requiresNetwork: false,
      recommendedMode: 'personal',
      expectedArtifacts: ['preview-plan', 'rollback-plan'],
    },
    {
      id: 'daily-assistant',
      label: 'Daily assistant',
      summary: 'Prepare a daily local summary using approved sources and clear receipts.',
      prompt: 'Prepare my daily status summary from approved local sources.',
      defaultRisk: 'low',
      requiresMutation: false,
      requiresNetwork: false,
      recommendedMode: 'personal',
      expectedArtifacts: ['daily-summary', 'source-list'],
    },
    {
      id: 'safe-audit',
      label: 'Safe audit',
      summary: 'Run a governed audit with receipts and blocked-action evidence.',
      prompt: 'Audit this workspace for security and reliability issues without mutating it.',
      defaultRisk: 'medium',
      requiresMutation: false,
      requiresNetwork: false,
      recommendedMode: 'governed',
      expectedArtifacts: ['audit-report', 'receipt', 'blocked-actions'],
    },
  ];
}
