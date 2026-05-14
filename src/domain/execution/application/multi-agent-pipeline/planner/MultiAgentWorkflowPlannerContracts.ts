import type { SddOrchestratorService } from '../../../../../services/SddOrchestratorService.js';

export type MultiAgentWorkflowPlannerServiceDeps = {
  sddOrchestrator?: Pick<SddOrchestratorService, 'inspect' | 'isKnownFeature'>;
};
