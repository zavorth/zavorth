import { createHash } from 'node:crypto';
import {
  ZAVORTH_SENSITIVE_ACTION_FLOW_CONTRACT_VERSION,
  type ZavorthSensitiveActionApproval,
  type ZavorthSensitiveActionExecution,
  type ZavorthSensitiveActionFlowDecision,
  type ZavorthSensitiveActionFlowSnapshot,
  type ZavorthSensitiveActionFlowStatus,
  type ZavorthSensitiveActionKind,
  type ZavorthSensitiveActionPreview,
  type ZavorthSensitiveActionRollback,
} from '../contracts/ZavorthSensitiveActionFlowContract.js';
import type { ZavorthMissionRiskLevel } from '../contracts/ZavorthMissionContract.js';
import type { ZavorthVisualReceiptContract } from '../contracts/ZavorthVisualReceiptContract.js';
import {
  decideSecurityPolicy,
  type SecurityPolicyBrokerDecision,
  type SecurityPolicyBrokerSurface,
} from '../security/SecurityPolicyBroker.js';
import {
  detectSensitiveData,
  redactSensitiveText,
} from '../security/SensitiveDataGuard.js';

export type ZavorthSensitiveActionFlowInput = {
  request?: string | null;
  decision?: ZavorthSensitiveActionFlowDecision | null;
  approvalId?: string | null;
  sandboxReady?: boolean | null;
  source?: 'cli' | 'web' | 'channel' | 'scheduler' | 'internal';
};

type ZavorthSensitiveActionFlowRuntime = {
  now?: () => Date;
};

export class ZavorthSensitiveActionFlowService {
  private readonly now: () => Date;

  constructor(runtime: ZavorthSensitiveActionFlowRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ZavorthSensitiveActionFlowInput = {}): ZavorthSensitiveActionFlowSnapshot {
    const generatedAt = this.now().toISOString();
    const rawRequest = String(input.request || 'Review this workspace in read-only mode.').trim();
    const request = redactSensitiveText(rawRequest);
    const preview = this.buildPreview(rawRequest);
    const risk = this.resolveRisk(preview);
    const policy = this.decidePolicy({
      preview,
      risk,
      generatedAt,
      source: input.source || 'cli',
    });
    const decision = normalizeDecision(input.decision);
    const approval = this.buildApproval({
      decision,
      preview,
      risk,
      policy,
    });
    const execution = this.buildExecution({
      approval,
      preview,
      policy,
      sandboxReady: input.sandboxReady === true,
    });
    const rollback = this.buildRollback({
      preview,
      generatedAt,
      approval,
    });
    const status = resolveStatus({ approval, execution, policy, preview });
    const receipt = this.buildReceipt({
      generatedAt,
      preview,
      approval,
      execution,
      rollback,
      risk,
      status,
    });

    return {
      contractVersion: ZAVORTH_SENSITIVE_ACTION_FLOW_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'sensitive-action-flow',
      generatedAt,
      id: stableId('saf', `${generatedAt}:${request}`),
      status,
      request,
      risk,
      decision,
      preview,
      policy: {
        action: policy.action,
        allowed: policy.allowed,
        receipt: policy.receipt,
      },
      approval,
      execution,
      rollback,
      receipt,
      timeline: [
        { id: 'intent', status: 'done', summary: 'Intent normalized before any host action.' },
        { id: 'preview', status: 'done', summary: 'Preview prepared without mutating the workspace.' },
        { id: 'risk', status: 'done', summary: `Risk classified as ${risk}.` },
        {
          id: 'approval',
          status: approval.required && approval.status === 'pending' ? 'pending' : approval.status === 'denied' ? 'blocked' : 'done',
          summary: approval.simpleText,
        },
        {
          id: 'execution',
          status: execution.mode === 'blocked' ? 'blocked' : execution.executed ? 'done' : 'pending',
          summary: execution.why,
        },
        {
          id: 'receipt',
          status: 'done',
          summary: 'Visual receipt generated with redaction and rollback evidence.',
        },
      ],
      zavorthControlProjection: {
        route: '/control',
        endpoint: '/api/sensitive-action-flow',
        executionAuthority: false,
        renderAsActionCard: true,
      },
      invariants: [
        {
          id: 'preview-before-apply',
          status: 'passed',
          detail: 'Every sensitive flow creates a preview before execution.',
        },
        {
          id: 'approval-before-mutation',
          status: 'passed',
          detail: 'Mutable, command, network or message actions require approval before live execution.',
        },
        {
          id: 'receipt-after-decision',
          status: 'passed',
          detail: 'The flow always emits a visual receipt, even when blocked or dry-run only.',
        },
        {
          id: 'rollback-before-apply',
          status: 'passed',
          detail: 'Rollback metadata is prepared before applying mutable work.',
        },
        {
          id: 'zavorthControl-no-authority',
          status: 'passed',
          detail: 'ZavorthControl can render action cards but cannot execute actions by itself.',
        },
      ],
      nextAction: buildNextAction({ status, approval, execution }),
    };
  }

  public renderText(snapshot: ZavorthSensitiveActionFlowSnapshot): string {
    const lines = [
      '[sensitive-action-flow]',
      `status=${snapshot.status}`,
      `risk=${snapshot.risk}`,
      `policy=${snapshot.policy.action}`,
      `approval=${snapshot.approval.status}`,
      `execution=${snapshot.execution.mode}`,
      '',
      '[preview]',
      snapshot.preview.summary,
      `actions=${snapshot.preview.actionKinds.join(', ')}`,
      `files_changed=${snapshot.preview.filesChanged} commands=${snapshot.preview.commands} network=${snapshot.preview.networkCalls} messages=${snapshot.preview.messages}`,
      '',
      '[approval]',
      snapshot.approval.simpleText,
      '',
      '[rollback]',
      snapshot.rollback.summary,
      '',
      '[receipt]',
      snapshot.receipt.simpleText,
      '',
      `next=${snapshot.nextAction}`,
      '',
    ];
    return lines.join('\n');
  }

  private buildPreview(rawRequest: string): ZavorthSensitiveActionPreview {
    const request = redactSensitiveText(rawRequest);
    const normalized = request.toLowerCase();
    const kinds = new Set<ZavorthSensitiveActionKind>();
    if (/\b(edit|change|alter|write|create|update|patch|modify|salv|crie|edite|altere)\b/i.test(request)) kinds.add('write');
    if (/\b(delete|remove|erase|rm\b|apague|delet|exclu)\b/i.test(request)) kinds.add('delete');
    if (/\b(move|rename|mv\b|mova|renome)\b/i.test(request)) kinds.add('move');
    if (/\b(run|execute|command|shell|powershell|cmd|npm|git|rode|execute)\b/i.test(request)) kinds.add('command');
    if (/\b(fetch|download|upload|http|https|web|url|network|rede|site)\b/i.test(request)) kinds.add('network');
    if (/\b(send|message|telegram|discord|whatsapp|email|post|envie|mande)\b/i.test(request)) kinds.add('message');
    if (kinds.size === 0) kinds.add('read');

    const secrets = detectSensitiveData(rawRequest);
    const actionKinds = Array.from(kinds);
    const filesChanged = actionKinds.some((kind) => ['write', 'delete', 'move'].includes(kind)) ? 1 : 0;
    const commands = actionKinds.includes('command') ? 1 : 0;
    const networkCalls = actionKinds.includes('network') ? 1 : 0;
    const messages = actionKinds.includes('message') ? 1 : 0;

    return {
      id: stableId('preview', request),
      title: 'Sensitive action preview',
      summary: actionKinds.includes('read')
        ? 'Zavorth can handle this as read-only work.'
        : 'Zavorth prepared a safe preview before any live action.',
      requestedAction: normalized.slice(0, 240),
      actionKinds,
      affectedResources: inferResources(request),
      filesRead: 1,
      filesChanged,
      commands,
      networkCalls,
      messages,
      secretsDetected: secrets.length,
      rawSecretsPresent: false,
    };
  }

  private resolveRisk(preview: ZavorthSensitiveActionPreview): ZavorthMissionRiskLevel {
    if (preview.secretsDetected > 0 || preview.actionKinds.includes('delete') || preview.actionKinds.includes('command')) {
      return 'high';
    }
    if (
      preview.filesChanged > 0
      || preview.networkCalls > 0
      || preview.messages > 0
      || preview.actionKinds.includes('move')
    ) {
      return 'medium';
    }
    return 'low';
  }

  private decidePolicy(input: {
    preview: ZavorthSensitiveActionPreview;
    risk: ZavorthMissionRiskLevel;
    generatedAt: string;
    source: string;
  }): SecurityPolicyBrokerDecision {
    const surface = resolveSurface(input.preview);
    return decideSecurityPolicy({
      surface,
      operation: input.preview.actionKinds.join('+'),
      target: input.preview.affectedResources.join(', ') || 'workspace',
      risk: input.risk === 'low' ? 'safe' : input.risk === 'medium' ? 'review' : 'dangerous',
      userConfirmationRequired: input.risk !== 'low',
      redaction: {
        applied: input.preview.secretsDetected > 0,
        findingCount: input.preview.secretsDetected,
        reasons: input.preview.secretsDetected > 0 ? ['Potential raw secret was redacted before receipt output.'] : [],
      },
      reasons: [
        'Sensitive action flow requires preview, policy, approval and receipt before live execution.',
        `Request source: ${input.source}.`,
      ],
    }, {
      now: () => new Date(input.generatedAt),
    });
  }

  private buildApproval(input: {
    decision: ZavorthSensitiveActionFlowDecision;
    preview: ZavorthSensitiveActionPreview;
    risk: ZavorthMissionRiskLevel;
    policy: SecurityPolicyBrokerDecision;
  }): ZavorthSensitiveActionApproval {
    const required = input.policy.requiresUserConfirmation || input.risk !== 'low';
    const id = required ? stableId('approval', `${input.preview.id}:${input.risk}`) : null;
    const status = !required
      ? 'not_required'
      : input.decision === 'approve'
        ? 'approved'
        : input.decision === 'deny'
          ? 'denied'
          : 'pending';
    const prompt = input.preview.filesChanged > 0
      ? `Zavorth wants to change ${input.preview.filesChanged} file(s). Allow once?`
      : input.preview.commands > 0
        ? 'Zavorth wants to run a command. Allow once?'
        : input.preview.networkCalls > 0 || input.preview.messages > 0
          ? 'Zavorth wants to use an external surface. Allow once?'
          : 'Zavorth can continue in read-only mode.';

    return {
      required,
      id,
      status,
      prompt,
      options: required ? ['allow_once', 'deny', 'view_preview', 'view_rollback'] : ['view_preview'],
      simpleText: required
        ? `${prompt} Current decision: ${status}.`
        : 'No approval required for read-only work.',
      advancedText: `Policy action=${input.policy.action}; risk=${input.risk}; approvalId=${id || 'none'}.`,
    };
  }

  private buildExecution(input: {
    approval: ZavorthSensitiveActionApproval;
    preview: ZavorthSensitiveActionPreview;
    policy: SecurityPolicyBrokerDecision;
    sandboxReady: boolean;
  }): ZavorthSensitiveActionExecution {
    const mutating = input.preview.filesChanged > 0 || input.preview.commands > 0 || input.preview.networkCalls > 0 || input.preview.messages > 0;
    if (!input.policy.allowed && !input.policy.requiresUserConfirmation) {
      return {
        mode: 'blocked',
        zavorthControlCanExecute: false,
        policyBrokerRequired: true,
        approvalRequiredForMutation: mutating,
        executed: false,
        why: 'Policy Broker denied this action before execution.',
      };
    }
    if (input.approval.status === 'denied') {
      return {
        mode: 'blocked',
        zavorthControlCanExecute: false,
        policyBrokerRequired: true,
        approvalRequiredForMutation: mutating,
        executed: false,
        why: 'User denied the action; execution remains blocked.',
      };
    }
    if (!mutating) {
      return {
        mode: 'read_only',
        zavorthControlCanExecute: false,
        policyBrokerRequired: true,
        approvalRequiredForMutation: false,
        executed: false,
        why: 'Read-only work is ready; no live mutation was executed by this projection.',
      };
    }
    if (input.approval.status !== 'approved') {
      return {
        mode: 'dry_run',
        zavorthControlCanExecute: false,
        policyBrokerRequired: true,
        approvalRequiredForMutation: true,
        executed: false,
        why: 'Live action is waiting for approval; only preview/dry-run is allowed.',
      };
    }
    if (!input.sandboxReady) {
      return {
        mode: 'dry_run',
        zavorthControlCanExecute: false,
        policyBrokerRequired: true,
        approvalRequiredForMutation: true,
        executed: false,
        why: 'Approval exists, but no strong sandbox is ready; mutation remains dry-run.',
      };
    }
    return {
      mode: 'sandbox_after_approval',
      zavorthControlCanExecute: false,
      policyBrokerRequired: true,
      approvalRequiredForMutation: true,
      executed: false,
      why: 'Approval and sandbox are ready; a separate executor may apply this exact approved scope.',
    };
  }

  private buildRollback(input: {
    preview: ZavorthSensitiveActionPreview;
    generatedAt: string;
    approval: ZavorthSensitiveActionApproval;
  }): ZavorthSensitiveActionRollback {
    const available = input.preview.filesChanged > 0 && input.preview.secretsDetected === 0;
    const artifactId = available ? stableId('rollback', `${input.preview.id}:${input.generatedAt}`) : null;
    return {
      available,
      requiredBeforeApply: input.preview.filesChanged > 0,
      artifactId,
      summary: available
        ? 'Rollback metadata is required before applying this file mutation.'
        : input.preview.filesChanged > 0
          ? 'Rollback is blocked because sensitive data was detected in the request.'
          : 'Rollback is not required for read-only or non-file actions.',
      command: artifactId && input.approval.id ? `zavorth sensitive-flow rollback --approval-id=${input.approval.id}` : null,
    };
  }

  private buildReceipt(input: {
    generatedAt: string;
    preview: ZavorthSensitiveActionPreview;
    approval: ZavorthSensitiveActionApproval;
    execution: ZavorthSensitiveActionExecution;
    rollback: ZavorthSensitiveActionRollback;
    risk: ZavorthMissionRiskLevel;
    status: ZavorthSensitiveActionFlowStatus;
  }): ZavorthVisualReceiptContract {
    const approvals = input.approval.required ? 1 : 0;
    return {
      schemaVersion: 1,
      surface: 'visual-receipt',
      id: stableId('receipt', `${input.preview.id}:${input.status}`),
      missionId: input.preview.id,
      generatedAt: input.generatedAt,
      mode: 'simple',
      summary: {
        title: 'Sensitive action flow receipt',
        risk: input.risk,
        outcome: input.execution.why,
        filesRead: input.preview.filesRead,
        filesChanged: input.preview.filesChanged,
        actionsBlocked: input.execution.mode === 'blocked' || input.execution.mode === 'dry_run' ? 1 : 0,
        networkUsed: 0,
        networkBlocked: input.preview.networkCalls,
        approvals,
        rollbackAvailable: input.rollback.available,
      },
      simpleText: `Preview ready. Risk ${input.risk}. Approval ${input.approval.status}. Execution ${input.execution.mode}.`,
      advanced: {
        policyBroker: 'required',
        trustPlane: 'active',
        zavorthControlCanExecute: false,
        sandboxMutationMode: input.execution.mode === 'sandbox_after_approval' ? 'sandbox' : input.execution.mode === 'blocked' ? 'blocked' : 'dry-run',
        approvalOptions: input.approval.options,
        artifacts: [
          input.preview.id,
          input.rollback.artifactId,
        ].filter(Boolean) as string[],
      },
      redaction: {
        rawSecretsPresent: false,
        policy: 'secretrefs-only',
      },
    };
  }
}

function resolveStatus(input: {
  approval: ZavorthSensitiveActionApproval;
  execution: ZavorthSensitiveActionExecution;
  policy: SecurityPolicyBrokerDecision;
  preview: ZavorthSensitiveActionPreview;
}): ZavorthSensitiveActionFlowStatus {
  if (input.execution.mode === 'blocked') {
    return input.approval.status === 'denied' ? 'denied' : 'blocked';
  }
  if (input.execution.mode === 'read_only') return 'read_only_ready';
  if (input.approval.required && input.approval.status === 'pending') return 'needs_approval';
  if (input.execution.mode === 'dry_run') return 'dry_run_only';
  if (input.execution.mode === 'sandbox_after_approval') return 'approved_ready';
  return input.preview.filesChanged > 0 ? 'preview_ready' : 'read_only_ready';
}

function resolveSurface(preview: ZavorthSensitiveActionPreview): SecurityPolicyBrokerSurface {
  if (preview.actionKinds.includes('network')) return 'web-fetch';
  if (preview.actionKinds.includes('message')) return 'plugin';
  if (preview.actionKinds.includes('command')) return 'tool';
  if (preview.filesChanged > 0) return 'local-write';
  return 'workspace';
}

function normalizeDecision(value: unknown): ZavorthSensitiveActionFlowDecision {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'approve' || normalized === 'approved' || normalized === 'allow') return 'approve';
  if (normalized === 'deny' || normalized === 'denied' || normalized === 'reject') return 'deny';
  return 'none';
}

function inferResources(request: string): string[] {
  const resources = new Set<string>();
  for (const match of request.matchAll(/(?:^|\s)([A-Za-z]:\\[^\s]+|\.{0,2}\/[^\s]+|[\w.-]+\.(?:ts|tsx|js|json|md|txt|pdf|yml|yaml))/g)) {
    resources.add(redactSensitiveText(match[1]));
  }
  if (resources.size === 0) resources.add('workspace');
  return Array.from(resources).slice(0, 8);
}

function buildNextAction(input: {
  status: ZavorthSensitiveActionFlowStatus;
  approval: ZavorthSensitiveActionApproval;
  execution: ZavorthSensitiveActionExecution;
}): string {
  if (input.status === 'needs_approval') return 'Review the preview, then choose allow once or deny.';
  if (input.status === 'dry_run_only') return 'Enable a strong sandbox or keep this as preview-only work.';
  if (input.status === 'approved_ready') return 'Hand this approved scope to a governed executor.';
  if (input.status === 'denied') return 'No action will be executed; adjust the request if needed.';
  if (input.status === 'read_only_ready') return 'Continue with read-only execution through the normal mission runtime.';
  return input.execution.why;
}

function stableId(prefix: string, value: string): string {
  const hash = createHash('sha256').update(value).digest('hex').slice(0, 12);
  return `${prefix}_${hash}`;
}
