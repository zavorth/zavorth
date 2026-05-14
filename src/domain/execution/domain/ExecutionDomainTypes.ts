import type {
  ExecutionDecision,
  ExecutionIntent,
  ExecutionOutcome,
} from '../../../contracts/InternalBoundaryContract.js';

export type ExecutionBoundaryPort = {
  decide(intent: ExecutionIntent): Promise<ExecutionDecision>;
  execute(intent: ExecutionIntent): Promise<ExecutionOutcome>;
};

export type ExecutionDomainReadiness = {
  generatedAt: string;
  decisionPipelineReady: boolean;
  continuityLinked: boolean;
  approvalLinked: boolean;
  summary: string;
  details: string[];
};

export type ExecutionDomainRuntimeFlags = {
  continuityLinked?: boolean | null;
  approvalLinked?: boolean | null;
};
