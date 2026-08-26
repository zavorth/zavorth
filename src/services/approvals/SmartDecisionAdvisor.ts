import type { AgentPermissionService } from '../permission/AgentPermissionService.js';

export type SmartDecisionInput = {
  toolName: string;
  pattern: string;
  risk?: string | null;
  workspaceId?: string | null;
  sessionId?: string | null;
  requiresApproval?: boolean;
};

export type SmartDecisionAdvice = {
  action: 'allow' | 'ask' | 'deny';
  source: 'deterministic' | 'smart-model' | 'disabled';
};

export type SmartDecisionAdvisorOptions = {
  permissionService: Pick<AgentPermissionService, 'evaluate'>;
  askModel?: (prompt: string) => Promise<'approve' | 'deny' | null>;
  enabled?: boolean;
};

const SMART_BLOCKED_RISKS = new Set(['danger', 'high', 'critical']);

/**
 * Deterministic-first decision advisor. The permission service always speaks
 * first; the model layer only breaks 'ask' ties for non-dangerous actions
 * while explicitly enabled. Every failure path collapses back to 'ask'
 * fail-closed — the advisor never widens an approval.
 */
export class SmartDecisionAdvisor {
  private readonly permissionService: SmartDecisionAdvisorOptions['permissionService'];
  private readonly askModel: SmartDecisionAdvisorOptions['askModel'];
  private readonly enabled: boolean;

  constructor(options: SmartDecisionAdvisorOptions) {
    this.permissionService = options.permissionService;
    this.askModel = options.askModel;
    this.enabled = options.enabled === true;
  }

  public async advise(input: SmartDecisionInput): Promise<SmartDecisionAdvice> {
    const verdict = this.permissionService.evaluate({
      toolName: input.toolName,
      pattern: input.pattern,
      risk: input.risk ?? null,
      requiresApproval: input.requiresApproval ?? null,
      workspaceId: input.workspaceId ?? null,
      sessionId: input.sessionId ?? null,
    });
    if (verdict.action !== 'ask') {
      return { action: verdict.action, source: 'deterministic' };
    }
    if (!this.enabled || !this.askModel) {
      return { action: 'ask', source: 'disabled' };
    }
    if (isSmartBlockedRisk(input.risk)) {
      return { action: 'ask', source: 'deterministic' };
    }
    try {
      const answer = await this.askModel(buildSmartPrompt(input));
      if (answer === 'approve') {
        return { action: 'allow', source: 'smart-model' };
      }
      if (answer === 'deny') {
        return { action: 'deny', source: 'smart-model' };
      }
      return { action: 'ask', source: 'smart-model' };
    } catch {
      return { action: 'ask', source: 'smart-model' };
    }
  }
}

function isSmartBlockedRisk(risk: string | null | undefined): boolean {
  return SMART_BLOCKED_RISKS.has(String(risk || '').trim().toLowerCase());
}

function buildSmartPrompt(input: SmartDecisionInput): string {
  return [
    `Tool "${input.toolName}" pattern "${input.pattern}" risk "${input.risk ?? 'unknown'}".`,
    'Reply with exactly approve or deny.',
  ].join(' ');
}
