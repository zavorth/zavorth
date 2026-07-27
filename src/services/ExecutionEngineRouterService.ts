import type {
  ExecutionEngineDecision,
  ExecutionEngineId,
  TrustedWorkspaceState,
} from '../contracts/ExecutionEngineContract';
import { ExecutionEngineRegistryService } from './ExecutionEngineRegistryService';

import { GlassBoxTraceService } from './GlassBoxTraceService';
import { TrustedWorkspacePolicyService } from './TrustedWorkspacePolicyService';

export type ExecutionEngineRouteOperation =
  | 'chat'
  | 'read'
  | 'summarize'
  | 'code-question'
  | 'write'
  | 'delete'
  | 'shell'
  | 'network'
  | 'deploy'
  | 'transaction';

export type ExecutionEngineRouteInput = {
  prompt?: string | null;
  operation?: ExecutionEngineRouteOperation;
  targetPath?: string | null;
  command?: string | null;
  content?: string | null;
  requestedEngineId?: ExecutionEngineId | null;
  networkTargets?: string[];
};

const DESTRUCTIVE_PATTERN = /\b(rm\s+-rf|del\s+\/s|remove-item\s+.*-recurse|format\s+[a-z]:|git\s+reset\s+--hard|git\s+clean\s+-fd|drop\s+database)\b/i;
const SECRET_PATTERN = /\b(api[_-]...key|token|secret|private key|password|credential|\.env)\b/i;

function operationFromInput(input: ExecutionEngineRouteInput): ExecutionEngineRouteOperation {
  if (input.operation) return input.operation;
  return 'chat';
}

function traceStatusFor(decision: ExecutionEngineDecision): 'info' | 'success' | 'warning' | 'blocked' {
  if (decision.status === 'blocked') return 'blocked';
  if (decision.status === 'needs-approval') return 'warning';
  return decision.mode === 'express' ? 'success' : 'info';
}

export class ExecutionEngineRouterService {
  public constructor(
    private readonly registry: ExecutionEngineRegistryService,
    private readonly trustedWorkspaces: TrustedWorkspacePolicyService,
    private readonly trace: GlassBoxTraceService,
  ) {}

  public decide(input: ExecutionEngineRouteInput): ExecutionEngineDecision {
    const operation = operationFromInput(input);
    const prompt = input.prompt || '';
    const command = input.command || prompt;
    const target = this.trustedWorkspaces.evaluate(input.targetPath);
    const hardRiskReason = this.findHardRisk({ ...input, operation, command });

    if (hardRiskReason) {
      return this.finish({
        engineId: 'shield',
        mode: 'approval',
        status: 'needs-approval',
        express: false,
        reason: hardRiskReason,
        risk: 'critical',
        workspaceTrust: target.state,
        targetPath: target.path,
        nextSafeAction: 'Open a Shield sandbox preview and ask for approval before touching the host.',
        events: [],
      });
    }

    if (operation === 'chat' || operation === 'read' || operation === 'summarize' || operation === 'code-question') {
      const requested = input.requestedEngineId || this.registry.getActiveEngineId();
      const engineId: ExecutionEngineId = requested === 'shield' ? 'shield' : 'lite';
      return this.finish({
        engineId,
        mode: 'express',
        status: 'ready',
        express: true,
        reason: 'Conversation or read-only work can use the Express mono-agent path.',
        risk: 'low',
        workspaceTrust: target.state,
        targetPath: target.path,
        nextSafeAction: 'Start streaming immediately. Promote only if the request becomes risky.',
        events: [],
      });
    }

    if (operation === 'write') {
      const writeRisk = this.trustedWorkspaces.assertVelocityWrite({
        targetPath: input.targetPath,
        command,
        operation,
        content: input.content,
      });
      if (writeRisk.allowed && this.registry.isAvailable('velocity')) {
        return this.finish({
          engineId: 'velocity',
          mode: 'trusted-workspace',
          status: 'ready',
          express: false,
          reason: writeRisk.reason,
          risk: 'low',
          workspaceTrust: target.state,
          targetPath: target.path,
          nextSafeAction: 'Generate an interactive diff and allow host-direct apply for accepted low-risk changes.',
          events: [],
        });
      }
      const velocityAvailability = this.registry.getAvailability().find((entry) => entry.engineId === 'velocity') ?? {
        engineId: 'velocity' as const,
        available: false,
        reason: 'Velocity availability could not be resolved.',
        nextSafeAction: 'Use Shield.',
      };
      return this.finish({
        engineId: 'shield',
        mode: 'sandbox',
        status: 'needs-approval',
        express: false,
        reason: velocityAvailability.available
          ? writeRisk.reason
          : `${velocityAvailability.reason} ${writeRisk.reason}`,
        risk: target.state === 'sensitive' ? 'critical' : 'medium',
        workspaceTrust: target.state,
        targetPath: target.path,
        nextSafeAction: 'Run the change in sandbox and review the diff before approval.',
        events: [],
      });
    }

    return this.finish({
      engineId: 'shield',
      mode: 'approval',
      status: 'needs-approval',
      express: false,
      reason: 'This operation has side effects and must use Shield.',
      risk: operation === 'deploy' || operation === 'transaction' ? 'critical' : 'high',
      workspaceTrust: target.state,
      targetPath: target.path,
      nextSafeAction: 'Use a governed sandbox, policy broker approval and receipts.',
      events: [],
    });
  }

  private findHardRisk(input: ExecutionEngineRouteInput & {
    operation: ExecutionEngineRouteOperation;
    command: string;
  }): string | null {
    const text = `${input.prompt || ''}\n${input.command || ''}\n${input.content || ''}`;
    if (DESTRUCTIVE_PATTERN.test(input.command || input.prompt || '')) {
      return 'Destructive commands require Shield approval.';
    }
    if (SECRET_PATTERN.test(text) || SECRET_PATTERN.test(input.targetPath || '')) {
      return 'Secrets and credentials require Shield approval.';
    }
    if (input.operation === 'deploy' || input.operation === 'transaction') {
      return 'Deployments and transactions require Shield approval.';
    }
    if (input.operation === 'network' && (input.networkTargets || []).length > 0) {
      return 'External network operations with user data require Shield approval.';
    }
    return null;
  }

  private finish(decision: Omit<ExecutionEngineDecision, 'events'> & {
    events: [];
    workspaceTrust: TrustedWorkspaceState;
  }): ExecutionEngineDecision {
    const event = this.trace.append({
      kind: decision.mode === 'express' ? 'express-route' : 'engine-decision',
      title: decision.mode === 'express' ? 'Express route selected' : `${decision.engineId} selected`,
      detail: decision.reason,
      engineId: decision.engineId,
      status: traceStatusFor(decision as ExecutionEngineDecision),
      metadata: {
        mode: decision.mode,
        targetPath: decision.targetPath,
        workspaceTrust: decision.workspaceTrust,
      },
    });
    return {
      ...decision,
      events: [event],
    };
  }
}
