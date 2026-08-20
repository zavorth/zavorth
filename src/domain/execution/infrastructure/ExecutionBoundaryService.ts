import type {
  ZavorthBoundaryCorrelation,
  ExecutionDecision,
  ExecutionIntent,
  ExecutionOutcome,
} from '../../../contracts/InternalBoundaryContract.js';
import { createBoundaryCorrelation } from '../../../contracts/InternalBoundaryContract.js';
import { IntelligenceRiskGateService } from '../../../services/IntelligenceRiskGateService.js';

import type { ToolCategory } from '../../../tool-runtime/types/IZavorthTool.js';
import { InternalExecutionApiService } from '../../../api/internal/InternalExecutionApiService.js';
import type {
  IntelligenceExecutionProposal,
  IntelligenceProposedAction,
  IntelligenceRiskLevel,
  IntelligenceTrustMode,
} from '../../../contracts/native/IntelligenceFabricContract.js';

type EchoExecutionBoundaryRuntime = {
  executionApi?: Pick<InternalExecutionApiService, 'decide' | 'execute'> | null;
  riskGate?: IntelligenceRiskGateService | null;
  trustMode?: IntelligenceTrustMode | null;
};

type EchoToolIntentInput = {
  prompt: string;
  toolName: string;
  args: Record<string, unknown>;
  category?: ToolCategory;
  dangerLevel?: string | null;
  requiresPermission?: boolean | null;
  sessionId?: string | null;
  approved?: boolean;
  requestedBy?: string | null;
  surface?: string | null;
  correlation?: Partial<ZavorthBoundaryCorrelation> | null;
  metadata?: Record<string, unknown>;
};

export type ExecutionBoundaryRuntime = EchoExecutionBoundaryRuntime;
export type ToolIntentInput = EchoToolIntentInput;

export class ExecutionBoundaryService {
  private readonly executionApi: Pick<InternalExecutionApiService, 'decide' | 'execute'>;
  private readonly riskGate: IntelligenceRiskGateService;
  private readonly trustMode: IntelligenceTrustMode;

  constructor(runtime: EchoExecutionBoundaryRuntime = {}) {
    this.executionApi = runtime.executionApi || new InternalExecutionApiService();
    this.riskGate = runtime.riskGate || new IntelligenceRiskGateService();
    this.trustMode = runtime.trustMode || 'local_owner';
  }

  public buildToolIntent(input: EchoToolIntentInput): ExecutionIntent {
    const correlation = createBoundaryCorrelation({
      ...input.correlation,
      sessionId: input.sessionId || input.correlation?.sessionId || null,
    });
    return {
      objective: `Echo tool ${input.toolName}: ${String(input.prompt || '').trim()}`,
      surface: String(input.surface || 'echo').trim() || 'echo',
      requestedBy: String(input.requestedBy || 'echo').trim() || 'echo',
      sessionId: input.sessionId || correlation.sessionId || null,
      approved: input.approved === true,
      metadata: {
        toolName: input.toolName,
        category: input.category || null,
        dangerLevel: input.dangerLevel || null,
        requiresPermission: input.requiresPermission === true,
        toolArgs: JSON.parse(JSON.stringify(input.args || {})),
        prompt: String(input.prompt || '').trim(),
        ...(input.metadata || {}),
      },
      correlation,
    };
  }

  public async decide(intent: ExecutionIntent): Promise<ExecutionDecision> {
    const proposal = this.buildRiskProposal(intent);
    const riskGate = this.riskGate.evaluate({
      proposal,
      trustMode: this.trustMode,
    });

    if (!riskGate.canExecuteNow) {
      const baseDecision = await this.executionApi.decide({
        ...intent,
        approved: false,
      });
      const blocked = riskGate.overallDecision === 'block';
      const summary = blocked ? 'Echo tool execution was blocked by the shared risk gate.'
        : riskGate.requiresSandbox ? 'Echo tool execution requires sandbox or explicit owner approval before impact.'
          : 'Echo tool execution requires owner approval before impact.';
      return {
        ...baseDecision,
        ok: false,
        decision: blocked ? 'blocked' : 'approval_required',
        summary,
        approval: {
          approvalId: blocked ? null : baseDecision.approval.approvalId,
          required: !blocked,
          summary: blocked ? null : summary,
        },
        metadata: {
          ...baseDecision.metadata,
          intelligenceRiskGate: riskGate,
        },
      };
    }

    const decision = await this.executionApi.decide({
      ...intent,
      approved: true,
    });
    return {
      ...decision,
      metadata: {
        ...decision.metadata,
        intelligenceRiskGate: riskGate,
      },
    };
  }

  public async execute(intent: ExecutionIntent): Promise<ExecutionOutcome> {
    return this.executionApi.execute(intent);
  }

  private buildRiskProposal(intent: ExecutionIntent): IntelligenceExecutionProposal {
    const action = this.buildProposedAction(intent);
    return {
      id: `${intent.correlation?.runId || 'echo'}:${action.id}`,
      summary: `Echo tool intent: ${intent.objective}`,
      mode: 'commit',
      actions: [action],
      riskLevel: action.riskLevel,
      requiresApproval: action.riskLevel >= 4 || action.touchesSecrets,
      requiresSandbox: action.riskLevel >= 4 && (action.kind === 'exec' || action.kind === 'network' || action.kind === 'install'),
      rollbackPlan: action.reversible ? 'Execution can be replayed or ignored without destructive host impact.' : null,
      testsToRun: [],
      liveActionApplied: false,
    };
  }

  private buildProposedAction(intent: ExecutionIntent): IntelligenceProposedAction {
    const metadata = intent.metadata || {};
    const toolName = String(metadata.toolName || '').trim();
    const category = String(metadata.category || '').trim().toUpperCase();
    const dangerLevel = String(metadata.dangerLevel || '').trim().toLowerCase();
    const args = metadata.toolArgs && typeof metadata.toolArgs === 'object'
      ? metadata.toolArgs as Record<string, unknown>
      : {};
    const target = this.resolveTarget(toolName, args);
    const touchesSecrets = this.touchesSecretTarget(target, args);
    const usesNetwork = category === 'IOT'
      || category === 'WEB'
      || /(?:browser|http|mqtt|home_assistant|web|url|network)/i.test(`${toolName} ${target}`);
    const kind = this.resolveActionKind(toolName, category, target);
    const riskLevel = this.resolveRiskLevel({
      toolName,
      category,
      dangerLevel,
      kind,
      touchesSecrets,
      usesNetwork,
      requiresPermission: metadata.requiresPermission === true,
    });
    const reversible = kind === 'read'
      || kind === 'answer'
      || (riskLevel <= 2 && !usesNetwork && !touchesSecrets);

    return {
      id: `echo-tool:${toolName || 'unknown'}`,
      kind,
      target,
      description: `Echo requested tool ${toolName || 'unknown'} from ${category || 'UNKNOWN'} surface.`,
      reversible,
      insideWorkspace: this.isWorkspaceTarget(target),
      touchesSecrets,
      usesNetwork,
      riskLevel,
    };
  }

  private resolveActionKind(
    _toolName: string,
    category: string,
    target: string,
  ): IntelligenceProposedAction['kind'] {
    if (this.touchesSecretTarget(target, {})) {
      return 'secret_access';
    }
    if (category === 'IOT') {
      return 'send';
    }
    if (category === 'WEB') {
      return 'network';
    }
    if (category === 'OS') {
      return 'exec';
    }
    return 'read';
  }

  private resolveRiskLevel(input: {
    toolName: string;
    category: string;
    dangerLevel: string;
    kind: IntelligenceProposedAction['kind'];
    touchesSecrets: boolean;
    usesNetwork: boolean;
    requiresPermission: boolean;
  }): IntelligenceRiskLevel {
    if (input.touchesSecrets || input.kind === 'secret_access' || input.kind === 'deploy' || input.kind === 'delete') {
      return 5;
    }
    if (input.kind === 'install' || input.kind === 'exec' || input.usesNetwork || input.category === 'IOT') {
      return 4;
    }
    if (input.requiresPermission || input.dangerLevel === 'dangerous' || input.dangerLevel === 'moderate') {
      return 3;
    }
    return 1;
  }

  private resolveTarget(toolName: string, args: Record<string, unknown>): string {
    const candidates = [
      args.path,
      args.file,
      args.filePath,
      args.url,
      args.entity_id,
      args.entityId,
      args.command,
      args.app,
      args.topic,
    ];
    const target = candidates
      .map((value) => String(value || '').trim())
      .find((value) => value.length > 0);
    return target || toolName || 'echo-tool';
  }

  private touchesSecretTarget(target: string, args: Record<string, unknown>): boolean {
    const serializedArgs = JSON.stringify(args || {});
    return /(?:^|[\\/])\.env(?:$|[\\/])|id_rsa|credentials.*\.json|secret|token|api[_-]?key|password/i
      .test(`${target} ${serializedArgs}`);
  }

  private isWorkspaceTarget(target: string): boolean {
    const normalized = String(target || '').trim();
    if (!normalized) {
      return false;
    }
    return !/^(?:https?:|mqtt:|ws:|wss:|homeassistant:)/i.test(normalized)
      && !/^[a-z]+_[a-z]+/i.test(normalized);
  }
}

export const EchoExecutionBoundaryService = ExecutionBoundaryService;

