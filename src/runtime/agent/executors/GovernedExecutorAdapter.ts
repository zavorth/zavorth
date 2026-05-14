import type {
  UniversalAgentExecutor,
  UniversalAgentExecutorInput,
  UniversalAgentExecutorResult,
} from '../UniversalAgentRuntimeTypes.js';

export type GovernedExecutorBoundary = {
  entrypoint: 'AgentRunService';
  resultContract: 'UniversalAgentExecutorResult';
  directExternalInvocationAllowed: false;
  approvalResumeRequiredForRiskyRuns: true;
  failureSemanticsRequired: true;
};

export type GovernedExecutorAdapterOptions = {
  id: string;
  label: string;
  executor: UniversalAgentExecutor;
  boundary?: GovernedExecutorBoundary;
};

export const GOVERNED_EXECUTOR_BOUNDARY: GovernedExecutorBoundary = {
  entrypoint: 'AgentRunService',
  resultContract: 'UniversalAgentExecutorResult',
  directExternalInvocationAllowed: false,
  approvalResumeRequiredForRiskyRuns: true,
  failureSemanticsRequired: true,
};

export class GovernedExecutorAdapter {
  public readonly id: string;
  public readonly label: string;
  public readonly boundary: GovernedExecutorBoundary;
  private readonly executor: UniversalAgentExecutor;

  constructor(options: GovernedExecutorAdapterOptions) {
    this.id = options.id;
    this.label = options.label;
    this.executor = options.executor;
    this.boundary = options.boundary || GOVERNED_EXECUTOR_BOUNDARY;
  }

  public asUniversalAgentExecutor(): UniversalAgentExecutor {
    return (input) => this.execute(input);
  }

  public async execute(input: UniversalAgentExecutorInput): Promise<UniversalAgentExecutorResult> {
    const result = await this.executor(input);
    return {
      ...result,
      metadata: {
        ...(result.metadata || {}),
        governedExecutor: {
          id: this.id,
          label: this.label,
          boundary: this.boundary,
        },
      },
    };
  }
}

export function createGovernedExecutorAdapter(
  options: GovernedExecutorAdapterOptions,
): GovernedExecutorAdapter {
  return new GovernedExecutorAdapter(options);
}
