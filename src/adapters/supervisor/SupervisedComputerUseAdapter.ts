import type { ComputerUseConfig } from '../../agents/ComputerUseAgent.js';
import type {
  SystemOverlordAdapterResult,
  SystemOverlordRuntimeAdapter,
} from '../../contracts/SystemOverlordAdapterContract.js';
import type {
  SystemOverlordActionRequest,
  SystemOverlordCapabilityDecision,
} from '../../contracts/SystemOverlordContract.js';
import { numberField, readStructuredInput, stringField } from './SupervisedAdapterInput.js';

type ComputerUseAgentLike = {
  run(config: ComputerUseConfig): Promise<unknown>;
  stop(): void;
  getSnapshot(): unknown;
};

export class SupervisedComputerUseAdapter implements SystemOverlordRuntimeAdapter {
  public readonly id = 'computer-use-supervised';
  public readonly label = 'Computer Use Visual Supervision Adapter';

  constructor(private readonly agent: ComputerUseAgentLike | null = null) {}

  public canHandle(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): boolean {
    return request.capability === 'computer_use.visual_action' && decision.runtimeTarget === 'desktop';
  }

  public async execute(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): Promise<SystemOverlordAdapterResult> {
    if (!this.agent) {
      return {
        ok: false,
        errorCode: 'computer_use_agent_unavailable',
        errorMessage: 'Computer Use Agent was not injected into the supervised adapter.',
      };
    }

    const input = readStructuredInput(request.command, request.metadata || null);
    const action = stringField(input, 'action', 'computerUseAction') || 'run';

    if (action === 'snapshot') {
      return {
        ok: true,
        stdout: JSON.stringify(this.agent.getSnapshot(), null, 2),
        rollbackAvailable: false,
        metadata: {
          adapterId: this.id,
          action,
          runtimeTarget: decision.runtimeTarget,
        },
      };
    }

    if (action === 'stop') {
      this.agent.stop();
      return {
        ok: true,
        stdout: 'Computer Use stop requested.',
        rollbackAvailable: false,
        metadata: {
          adapterId: this.id,
          action,
          runtimeTarget: decision.runtimeTarget,
        },
      };
    }

    if (action !== 'run') {
      return {
        ok: false,
        errorCode: 'computer_use_action_rejected',
        errorMessage: `Invalid Computer Use action: "${action}".`,
      };
    }

    const targetWindow = stringField(input, 'targetWindow', 'windowTitle', 'window');
    const objective = stringField(input, 'objective', 'goal');
    const maxIterations = Math.min(Math.max(numberField(input, 'maxIterations') || 3, 1), 10);
    const delayBetweenActionsMs = Math.min(Math.max(numberField(input, 'delayBetweenActionsMs') || 1200, 250), 5000);

    if (!targetWindow || !objective) {
      return {
        ok: false,
        errorCode: 'computer_use_missing_scope',
        errorMessage: 'Computer Use requires targetWindow and objective to avoid unscoped visual actions.',
      };
    }

    if (!request.approved) {
      return {
        ok: false,
        errorCode: 'computer_use_approval_required',
        errorMessage: 'Visual Computer Use requires explicit approval before operating the UI.',
      };
    }

    const snapshot = await this.agent.run({
      targetWindow,
      objective,
      maxIterations,
      delayBetweenActionsMs,
    });

    return {
      ok: true,
      stdout: JSON.stringify(snapshot, null, 2),
      rollbackAvailable: false,
      metadata: {
        adapterId: this.id,
        action,
        targetWindow,
        objective,
        maxIterations,
        delayBetweenActionsMs,
        runtimeTarget: decision.runtimeTarget,
      },
    };
  }
}
