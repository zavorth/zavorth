export const ADVANCED_INTERACTION_CONTRACT_VERSION = 'zavorth-control-advanced-interaction/v1';

export interface ZavorthControlAdvancedInteractionToolCallCard {
  toolName: string;
}

export interface ZavorthControlAdvancedInteractionSubagentCard {
  subagentName: string;
}

export interface ZavorthControlAdvancedInteractionApprovalCard {
  approvalId: string;
}

export interface ZavorthControlAdvancedInteractionContextMeter {
  tokensUsed: number;
}

export interface ZavorthControlAdvancedInteractionMermaidDiagram {
  syntax: string;
}

export interface ZavorthControlAdvancedInteractionMessageQueueItem {
  id: string;
}
