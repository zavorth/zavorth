// @ts-nocheck
import type { ZavorthActionDefinition, ZavorthActionHandlerInput, ZavorthActionResult, ZavorthActionSchema } from '../runtime/actions/ZavorthActionContracts.js';
import { AgentChainBuilder, type AgentChainConfig } from './AgentChainBuilder.js';
import { ZavorthExternalAgentGatewayService } from '../services/ZavorthExternalAgentGatewayService.js';
import { logger } from '../logger.js';

const SURFACE: ZavorthActionDefinition['surface'] = ['cli', 'dashboard', 'tui', 'api', 'channel', 'llm'];
const TEST_REFS = ['tests/agents/AgentChainBuilder.test.ts'];

const outputSchema: ZavorthActionSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    actionId: { type: 'string' },
    operation: { type: 'string' },
    status: { type: 'string' },
    summary: { type: 'string' },
    lines: { type: 'array', items: { type: 'string' } },
    data: { type: 'object' },
  },
};

function result(partial: Partial<ZavorthActionResult> & { ok: boolean; actionId: string; operation: string; status: string; summary: string }): ZavorthActionResult {
  return {
    lines: [],
    data: {},
    ...partial,
  };
}

function action(input: Omit<ZavorthActionDefinition, 'capabilityId' | 'verificationStatus' | 'surface' | 'testRefs'>): ZavorthActionDefinition {
  return { ...input, capabilityId: 'agent-chain', verificationStatus: 'verified', surface: SURFACE, testRefs: TEST_REFS };
}

function parseChainConfig(input: Record<string, unknown>): AgentChainConfig {
  const steps = Array.isArray(input.steps) ? input.steps : [];
  return {
    id: typeof input.id === 'string' ? input.id : undefined,
    name: typeof input.name === 'string' ? input.name : undefined,
    description: typeof input.description === 'string' ? input.description : undefined,
    steps: steps.map((step: Record<string, unknown>, index: number) => ({
      id: typeof step.id === 'string' ? step.id : `step-${index}`,
      kind: (typeof step.kind === 'string' ? step.kind : 'agent') as 'agent' | 'local' | 'transform',
      agent: typeof step.agent === 'string' ? step.agent : undefined,
      prompt: typeof step.prompt === 'string' ? step.prompt : '',
      input: typeof step.input === 'string' ? step.input : undefined,
      command: typeof step.command === 'string' ? step.command : undefined,
      fallback: typeof step.fallback === 'string' ? step.fallback : undefined,
      timeoutMs: typeof step.timeoutMs === 'number' ? step.timeoutMs : undefined,
      retries: typeof step.retries === 'number' ? step.retries : undefined,
      parallelGroup: typeof step.parallelGroup === 'string' ? step.parallelGroup : undefined,
      dependsOn: Array.isArray(step.dependsOn) ? step.dependsOn.map(String) : undefined,
    })),
    stopOnError: typeof input.stopOnError === 'boolean' ? input.stopOnError : undefined,
    parallel: typeof input.parallel === 'boolean' ? input.parallel : undefined,
    maxConcurrency: typeof input.maxConcurrency === 'number' ? input.maxConcurrency : undefined,
    approvalRequired: typeof input.approvalRequired === 'boolean' ? input.approvalRequired : undefined,
    requestedBy: typeof input.requestedBy === 'string' ? input.requestedBy : undefined,
  };
}

export function createAgentChainActionModule(externalAgentGateway: ZavorthExternalAgentGatewayService) {
  const chainBuilder = new AgentChainBuilder({ externalAgentGateway, logger });

  async function chainRun(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
    const args = (input.args || {}) as Record<string, unknown>;
    const chainConfig = parseChainConfig(args);

    if (chainConfig.steps.length === 0) {
      return result({
        ok: false,
        actionId: input.actionId,
        operation: input.operation,
        status: 'error',
        summary: 'Chain must have at least one step.',
      });
    }

    const availableAgents = chainBuilder.listAvailableAgents();
    const stepSummary = chainConfig.steps.map((s) => {
      const fallback = s.fallback ? ` (fallback: ${s.fallback})` : '';
      const parallelGroup = s.parallelGroup ? ` [group: ${s.parallelGroup}]` : '';
      const dependsOn = s.dependsOn ? ` [depends: ${s.dependsOn.join(', ')}]` : '';
      return `${s.id}: ${s.kind}${s.agent ? `(${s.agent})` : ''}${fallback}${parallelGroup}${dependsOn}`;
    });

    if (input.operation === 'preview') {
      const agentLines = availableAgents.length > 0
        ? availableAgents.map((a) => `  - ${a.id}: ${a.label} (${a.adapter}) live=${a.liveReady}`)
        : ['  (none registered)'];

      return result({
        ok: true,
        actionId: input.actionId,
        operation: 'preview',
        status: 'preview',
        summary: `Chain "${chainConfig.name || 'unnamed'}" with ${chainConfig.steps.length} steps will execute.`,
        lines: [
          `Chain: ${chainConfig.name || chainConfig.id || 'unnamed'}`,
          `Steps: ${chainConfig.steps.length}`,
          `Parallel: ${chainConfig.parallel === true}`,
          `Max concurrency: ${chainConfig.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY}`,
          `Stop on error: ${chainConfig.stopOnError !== false}`,
          '',
          'Available agents:',
          ...agentLines,
          '',
          'Step plan:',
          ...stepSummary.map((s) => `  - ${s}`),
        ],
        data: { chainConfig, stepCount: chainConfig.steps.length, availableAgents },
      });
    }

    try {
      logger.info(`[AgentChainAction] Executing chain "${chainConfig.name || chainConfig.id}"...`);
      const execution = await chainBuilder.executeChain(chainConfig);
      const summary = chainBuilder.formatExecutionSummary(execution);

      return result({
        ok: execution.status === 'completed',
        actionId: input.actionId,
        operation: input.operation,
        status: execution.status,
        summary: `Chain "${chainConfig.name || execution.chainId}" ${execution.status}: ${execution.successCount}/${chainConfig.steps.length} steps succeeded.`,
        lines: summary.split('\n'),
        data: { execution },
      });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[AgentChainAction] Chain execution failed: ${errorMsg}`);
      return result({
        ok: false,
        actionId: input.actionId,
        operation: input.operation,
        status: 'error',
        summary: `Chain execution failed: ${errorMsg}`,
      });
    }
  }

  function chainPreview(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
    return chainRun({ ...input, operation: 'preview' });
  }

  return {
    id: 'agent-chain',
    manifestId: 'agent-chain',
    actions: [
      action({
        id: 'agents.chain.run',
        title: 'Run agent chain',
        description: 'Execute a chain of agents with automatic fallback, retry, input chaining, and parallel execution. Discovers available agents dynamically from the external agent gateway.',
        aliases: ['agent chain', 'chain run', 'run chain'],
        domains: ['agents', 'orchestration', 'automation'],
        risk: 'danger',
        mutationDomain: 'capability',
        mutationRisk: 'high',
        effects: ['external_send', 'shell'],
        scope: 'agents',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Chain name for identification.' },
            description: { type: 'string', description: 'What this chain does.' },
            parallel: { type: 'boolean', description: 'Execute steps in parallel when possible (default: false).' },
            maxConcurrency: { type: 'number', description: 'Maximum concurrent steps in parallel mode (default: 5).' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique step identifier.' },
                  kind: { type: 'string', enum: ['agent', 'local', 'transform'], description: 'Step type.' },
                  agent: { type: 'string', description: 'External agent profile ID. If not found, searches by partial match. If no agents available, returns error with available agents list.' },
                  prompt: { type: 'string', description: 'Prompt or template. Use ${stepId.output} to reference previous outputs.' },
                  command: { type: 'string', description: 'Shell command (for local kind).' },
                  fallback: { type: 'string', description: 'Fallback agent profile ID if primary fails.' },
                  timeoutMs: { type: 'number', description: 'Step timeout in milliseconds.' },
                  retries: { type: 'number', description: 'Number of retries before fallback.' },
                  parallelGroup: { type: 'string', description: 'Group name for parallel execution. Steps in the same group run concurrently.' },
                  dependsOn: { type: 'array', items: { type: 'string' }, description: 'Step IDs that must complete before this step runs.' },
                },
                required: ['id', 'kind', 'prompt'],
              },
              description: 'Ordered list of steps to execute.',
            },
            stopOnError: { type: 'boolean', description: 'Stop chain on first error (default: true).' },
            requestedBy: { type: 'string', description: 'Who requested this chain.' },
          },
          required: ['steps'],
        },
        outputSchema,
        handler: chainRun,
      }),
      action({
        id: 'agents.chain.preview',
        title: 'Preview agent chain',
        description: 'Preview an agent chain execution plan with available agents discovery.',
        aliases: ['chain preview', 'preview chain'],
        domains: ['agents', 'orchestration'],
        risk: 'safe',
        effects: ['read'],
        scope: 'agents',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            parallel: { type: 'boolean' },
            maxConcurrency: { type: 'number' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  kind: { type: 'string', enum: ['agent', 'local', 'transform'] },
                  agent: { type: 'string' },
                  prompt: { type: 'string' },
                  fallback: { type: 'string' },
                  parallelGroup: { type: 'string' },
                  dependsOn: { type: 'array', items: { type: 'string' } },
                },
                required: ['id', 'kind', 'prompt'],
              },
            },
          },
          required: ['steps'],
        },
        outputSchema,
        handler: chainPreview,
      }),
    ],
  };
}
