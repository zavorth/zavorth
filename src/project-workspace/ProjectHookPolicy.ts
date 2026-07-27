import type {
  ProjectErrorClassification,
  ProjectLogRiskLevel,
} from './ProjectErrorClassifier.js';
import type {
  ProjectManifestHook,
  ProjectManifestMode,
  ProjectManifestPolicy,
  ResolvedProjectManifest,
} from './ProjectManifestContract.js';
import type { ProjectProcessLogEntry } from './ProjectProcessContract.js';

export type ProjectHookPolicyAction =
  | 'record-only'
  | 'create-agent-run'
  | 'manual'
  | 'blocked';

export type ProjectHookPolicyDecision = {
  allowed: boolean;
  mode: ProjectManifestMode;
  action: ProjectHookPolicyAction;
  reason: string;
  requiresApproval: boolean;
  risk: ProjectLogRiskLevel;
  blockedScopes: string[];
  auditTags: string[];
};

export type ProjectHookPolicyInput = {
  resolved: ResolvedProjectManifest;
  hook: ProjectManifestHook;
  log: ProjectProcessLogEntry;
  classification: ProjectErrorClassification;
};

const AUTO_APPLY_APPROVAL_SCOPES = [
  'filesystem.write',
  'process.kill',
  'network.public',
  'selfmod.apply',
  'credentials',
  'secrets',
] as const;

const HIGH_RISK_CATEGORIES = new Map<string, string[]>([
  ['credential_or_auth', ['credentials']],
  ['destructive_command', ['process.kill', 'destructive.command']],
]);

const HIGH_RISK_SIGNALS = new Map<string, string[]>([
  ['credential_or_auth', ['credentials']],
  ['destructive_command', ['destructive.command']],
]);

export class ProjectHookPolicy {
  public evaluate(input: ProjectHookPolicyInput): ProjectHookPolicyDecision {
    const mode = input.hook.action.mode || input.resolved.manifest.policy.defaultMode;
    const baseTags = this.buildBaseTags(input, mode);

    if (mode === 'observe') {
      return {
        allowed: true,
        mode,
        action: 'record-only',
        reason: 'Modo observe registra o evento e deixa a decision para o operador.',
        requiresApproval: false,
        risk: input.classification.risk,
        blockedScopes: [],
        auditTags: [...baseTags, 'action:record-only'],
      };
    }

    if (mode === 'manual') {
      return {
        allowed: false,
        mode,
        action: 'manual',
        reason: 'Manual mode requires explicit operator action before any agent run.',
        requiresApproval: true,
        risk: input.classification.risk,
        blockedScopes: ['operator.action'],
        auditTags: [...baseTags, 'action:manual'],
      };
    }

    if (mode === 'suggest') {
      return {
        allowed: true,
        mode,
        action: 'create-agent-run',
        reason: 'Modo suggest cria um agent run de diagnostic without aplicar changes automaticamente.',
        requiresApproval: false,
        risk: input.classification.risk,
        blockedScopes: [],
        auditTags: [...baseTags, 'action:suggest'],
      };
    }

    return this.evaluateApply(input, baseTags);
  }

  private evaluateApply(
    input: ProjectHookPolicyInput,
    baseTags: string[],
  ): ProjectHookPolicyDecision {
    const blockedScopes = this.resolveAutoApplyBlockers(
      input.resolved.manifest.policy,
      input.classification,
    );
    if (blockedScopes.length > 0) {
      return {
        allowed: false,
        mode: 'apply',
        action: 'blocked',
        reason: [
          'Apply mode was blocked by ProjectHookPolicy.',
          'Auto-healing can proceed without approval only when risk is low and no sensitive scope requires approval.',
        ].join(' '),
        requiresApproval: true,
        risk: input.classification.risk,
        blockedScopes,
        auditTags: [...baseTags, 'action:apply-blocked'],
      };
    }

    return {
      allowed: true,
      mode: 'apply',
      action: 'create-agent-run',
      reason: 'Apply mode approved: low-risk classification and policy without auto-apply blockers.',
      requiresApproval: false,
      risk: input.classification.risk,
      blockedScopes: [],
      auditTags: [...baseTags, 'action:apply-authorized'],
    };
  }

  private resolveAutoApplyBlockers(
    policy: ProjectManifestPolicy,
    classification: ProjectErrorClassification,
  ): string[] {
    const blockers = new Set<string>();
    const requiredApprovalScopes = new Set(
      policy.requireApprovalFor.map((scope) => normalizeScope(scope)),
    );

    for (const scope of AUTO_APPLY_APPROVAL_SCOPES) {
      if (requiredApprovalScopes.has(scope)) {
        blockers.add(scope);
      }
    }

    if (classification.risk !== 'low') {
      blockers.add(`risk.${classification.risk}`);
    }
    if (!classification.autoApplySafe) {
      blockers.add('classification.not_auto_apply_safe');
    }

    for (const scope of HIGH_RISK_CATEGORIES.get(classification.category) || []) {
      blockers.add(scope);
    }
    for (const signal of classification.signals) {
      for (const scope of HIGH_RISK_SIGNALS.get(signal) || []) {
        blockers.add(scope);
      }
    }

    return Array.from(blockers).sort();
  }

  private buildBaseTags(
    input: ProjectHookPolicyInput,
    mode: ProjectManifestMode,
  ): string[] {
    return [
      'project-log-watch',
      `mode:${mode}`,
      `hook:${input.hook.id}`,
      `process:${input.log.processId}`,
      `category:${input.classification.category}`,
      `risk:${input.classification.risk}`,
    ];
  }
}

function normalizeScope(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}
