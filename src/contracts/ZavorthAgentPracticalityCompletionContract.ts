import type { SurfaceResponse } from '../domain/surface/application/surface-response/index.js';

export const ZAVORTH_AGENT_PRACTICALITY_COMPLETION_VERSION =
  '2026-05-11.agent-practicality-phase-6' as const;

export type ZavorthAgentPracticalitySurface =
  | 'cli'
  | 'web'
  | 'telegram'
  | 'discord'
  | 'whatsapp'
  | 'signal'
  | 'imessage';

export type ZavorthAgentPracticalityStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthAgentPracticalityAxis = {
  id: string;
  label: string;
  status: ZavorthAgentPracticalityStatus;
  evidence: string;
};

export type ZavorthAgentPracticalitySurfaceProjection = {
  surface: ZavorthAgentPracticalitySurface;
  status: ZavorthAgentPracticalityStatus;
  commandCount: number;
  primaryCommands: string[];
  fallbackTextAvailable: boolean;
  interactiveActionsAvailable: boolean;
  evidence: string;
};

export type ZavorthAgentPracticalityCompletionSnapshot = {
  contractVersion: typeof ZAVORTH_AGENT_PRACTICALITY_COMPLETION_VERSION;
  generatedAt: string;
  source: 'ZavorthAgentPracticalityCompletionService';
  status: ZavorthAgentPracticalityStatus;
  axes: ZavorthAgentPracticalityAxis[];
  surfaceProjections: ZavorthAgentPracticalitySurfaceProjection[];
  runtimeSurface: {
    response: SurfaceResponse;
    commands: string[];
    actionIds: string[];
  };
  commandCenterProjection: {
    available: boolean;
    operationalFieldsRequired: string[];
    actionsRequired: string[];
    timelineRequired: true;
    receiptsRequired: true;
    noVisualMutation: true;
  };
  safety: {
    noWorkspaceMutation: true;
    noExternalIo: true;
    noRawSecretsSerialized: true;
    mutationStillRequiresApproval: true;
    visualChangesRequireOwnerApproval: true;
  };
  nextArchitectureSuggestion: {
    title: 'Vision, Computer And Device Control Plane';
    shouldSuggestAfterPhase6: true;
    scope: string[];
  };
};
