import type { UniversalAgentRequest, UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export type AgentRunPipelineStageName =
  | 'input'
  | 'policy'
  | 'llm'
  | 'tool-loop'
  | 'evidence'
  | 'response';

export type AgentRunPipelineStageReceipt = {
  stage: AgentRunPipelineStageName;
  status: 'started' | 'completed' | 'failed';
  at: string;
  detail: string;
};

export class AgentRunExecutorPipeline {
  private readonly receipts: AgentRunPipelineStageReceipt[] = [];

  public start(stage: AgentRunPipelineStageName, detail: string): void {
    this.receipts.push({
      stage,
      status: 'started',
      at: new Date().toISOString(),
      detail,
    });
  }

  public complete(stage: AgentRunPipelineStageName, detail: string): void {
    this.receipts.push({
      stage,
      status: 'completed',
      at: new Date().toISOString(),
      detail,
    });
  }

  public fail(stage: AgentRunPipelineStageName, detail: string): void {
    this.receipts.push({
      stage,
      status: 'failed',
      at: new Date().toISOString(),
      detail,
    });
  }

  public snapshot(): AgentRunPipelineStageReceipt[] {
    return [...this.receipts];
  }

  public describeInput(run: UniversalAgentRun, request: UniversalAgentRequest): string {
    const textLength = String(request.text || '').length;
    const channel = request.channel || 'unknown';
    return `run=${run.id || 'unknown'} channel=${channel} textChars=${textLength}`;
  }
}
