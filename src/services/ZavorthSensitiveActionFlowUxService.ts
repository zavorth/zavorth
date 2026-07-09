import {
  ZAVORTH_SENSITIVE_ACTION_FLOW_UX_CONTRACT_VERSION,
  type ZavorthSensitiveActionFlowUxAction,
  type ZavorthSensitiveActionFlowUxCard,
  type ZavorthSensitiveActionFlowUxSnapshot,
  type ZavorthSensitiveActionFlowUxStep,
  type ZavorthSensitiveActionFlowUxTone,
} from '../contracts/ZavorthSensitiveActionFlowUxContract.js';
import type {
  ZavorthSensitiveActionFlowInput,
} from './ZavorthSensitiveActionFlowService.js';
import {
  ZavorthSensitiveActionFlowService,
} from './ZavorthSensitiveActionFlowService.js';

import type { ZavorthSensitiveActionFlowSnapshot } from '../contracts/ZavorthSensitiveActionFlowContract.js';

export type ZavorthSensitiveActionFlowUxRuntime = {
  now?: () => Date;
  flow?: Pick<ZavorthSensitiveActionFlowService, 'buildSnapshot'>;
};

export class ZavorthSensitiveActionFlowUxService {
  private readonly now: () => Date;
  private readonly flow: Pick<ZavorthSensitiveActionFlowService, 'buildSnapshot'>;

  constructor(runtime: ZavorthSensitiveActionFlowUxRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.flow = runtime.flow || new ZavorthSensitiveActionFlowService({ now: this.now });
  }

  public buildSnapshot(input: ZavorthSensitiveActionFlowInput = {}): ZavorthSensitiveActionFlowUxSnapshot {
    const source = sanitizeUxSource(this.flow.buildSnapshot(input));
    const card = buildCard(source);
    return {
      contractVersion: ZAVORTH_SENSITIVE_ACTION_FLOW_UX_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'sensitive-action-flow-ux',
      generatedAt: this.now().toISOString(),
      status: card.status === 'blocked' || card.status === 'denied'
        ? 'blocked'
        : card.approval.required || card.tone === 'warn'
          ? 'attention'
          : 'ready',
      card,
      source,
      zavorthControlProjection: {
        route: '/control',
        renderMode: 'action-card',
        executionAuthority: false,
      },
      nextAction: source.nextAction,
    };
  }

  public renderText(snapshot: ZavorthSensitiveActionFlowUxSnapshot): string {
    const card = snapshot.card;
    return [
      '[sensitive-action-card]',
      `status=${card.status}`,
      `risk=${card.risk}`,
      `approval=${card.approval.status}`,
      `execution=${card.execution.mode}`,
      card.subtitle,
      '',
      '[steps]',
      ...card.steps.map((step) => `- ${step.status} ${step.label}: ${step.summary}`),
      '',
      '[actions]',
      ...card.actions.map((action) => `- ${action.id}: ${action.command} | mutates=${action.mutatesState}`),
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }
}

function buildCard(source: ZavorthSensitiveActionFlowSnapshot): ZavorthSensitiveActionFlowUxCard {
  return {
    id: source.id,
    title: titleForFlow(source),
    subtitle: subtitleForFlow(source),
    status: source.status,
    risk: source.risk,
    tone: toneForFlow(source),
    request: source.request,
    preview: {
      filesChanged: source.preview.filesChanged,
      commands: source.preview.commands,
      networkCalls: source.preview.networkCalls,
      messages: source.preview.messages,
      affectedResources: source.preview.affectedResources,
      rawSecretsPresent: false,
    },
    approval: {
      required: source.approval.required,
      status: source.approval.status,
      simpleText: source.approval.simpleText,
    },
    execution: {
      mode: source.execution.mode,
      executed: false,
      why: source.execution.why,
    },
    rollback: {
      available: source.rollback.available,
      command: source.rollback.command,
      summary: source.rollback.summary,
    },
    receipt: {
      id: source.receipt.id,
      simpleText: source.receipt.simpleText,
      rollbackAvailable: source.receipt.summary.rollbackAvailable,
      rawSecretsPresent: false,
    },
    steps: buildSteps(source),
    actions: buildActions(source),
    safety: {
      zavorthControlCanExecute: false,
      policyBrokerRequired: true,
      previewBeforeApply: true,
      receiptAlwaysGenerated: true,
      rawSecretsSerialized: false,
    },
  };
}

function buildSteps(source: ZavorthSensitiveActionFlowSnapshot): ZavorthSensitiveActionFlowUxStep[] {
  return [
    step('request', 'Request', 'done', 'info', 'Intent was normalized before host action.'),
    step('preview', 'Preview', 'done', 'ok', source.preview.summary),
    step('risk', 'Risk', 'done', source.risk === 'high' ? 'danger' : source.risk === 'medium' ? 'warn' : 'ok', `Risk classified as ${source.risk}.`),
    step('approval', 'Approval', source.approval.required && source.approval.status === 'pending' ? 'pending' : source.approval.status === 'denied' ? 'blocked' : 'done', source.approval.required ? 'warn' : 'ok', source.approval.simpleText),
    step('execution', 'Execution', source.execution.mode === 'blocked' ? 'blocked' : source.execution.mode === 'dry_run' ? 'pending' : 'done', source.execution.mode === 'blocked' ? 'danger' : source.execution.mode === 'dry_run' ? 'warn' : 'ok', source.execution.why),
    step('receipt', 'Receipt', 'done', 'ok', source.receipt.simpleText),
    step('rollback', 'Rollback', source.rollback.requiredBeforeApply && !source.rollback.available ? 'blocked' : source.rollback.available ? 'done' : 'pending', source.rollback.available ? 'ok' : source.rollback.requiredBeforeApply ? 'danger' : 'info', source.rollback.summary),
  ];
}

function buildActions(source: ZavorthSensitiveActionFlowSnapshot): ZavorthSensitiveActionFlowUxAction[] {
  const actions: ZavorthSensitiveActionFlowUxAction[] = [
    {
      id: 'view-preview',
      label: 'View preview',
      command: `zavorth sensitive-flow --request="${escapeCommandValue(source.request)}" --json`,
      kind: 'preview',
      requiresApproval: false,
      mutatesState: false,
      zavorthControlCanExecute: false,
    },
    {
      id: 'inspect-receipt',
      label: 'Inspect receipt',
      command: `zavorth receipts ${source.receipt.id} --advanced`,
      kind: 'inspect_receipt',
      requiresApproval: false,
      mutatesState: false,
      zavorthControlCanExecute: false,
    },
  ];
  if (source.approval.required && source.approval.status === 'pending') {
    actions.push(
      {
        id: 'approve-once',
        label: 'Allow once',
        command: `zavorth sensitive-flow --request="${escapeCommandValue(source.request)}" --decision=approve --sandbox-ready`,
        kind: 'approve_once',
        requiresApproval: true,
        mutatesState: false,
        zavorthControlCanExecute: false,
      },
      {
        id: 'deny',
        label: 'Deny',
        command: `zavorth sensitive-flow --request="${escapeCommandValue(source.request)}" --decision=deny`,
        kind: 'deny',
        requiresApproval: false,
        mutatesState: false,
        zavorthControlCanExecute: false,
      },
    );
  }
  if (source.rollback.available) {
    actions.push({
      id: 'rollback',
      label: 'Prepare rollback',
      command: source.rollback.command || `zavorth rollback ${source.preview.id} --preview`,
      kind: 'rollback',
      requiresApproval: true,
      mutatesState: true,
      zavorthControlCanExecute: false,
    });
  }
  return actions;
}

function step(
  id: ZavorthSensitiveActionFlowUxStep['id'],
  label: string,
  status: ZavorthSensitiveActionFlowUxStep['status'],
  tone: ZavorthSensitiveActionFlowUxTone,
  summary: string,
): ZavorthSensitiveActionFlowUxStep {
  return { id, label, status, tone, summary };
}

function titleForFlow(source: ZavorthSensitiveActionFlowSnapshot): string {
  if (source.status === 'needs_approval') return 'Approval needed';
  if (source.status === 'approved_ready') return 'Ready for governed executor';
  if (source.status === 'denied') return 'Action denied';
  if (source.status === 'blocked') return 'Action blocked';
  if (source.status === 'dry_run_only') return 'Dry-run only';
  return 'Sensitive action preview';
}

function subtitleForFlow(source: ZavorthSensitiveActionFlowSnapshot): string {
  return `${source.risk} risk · ${source.preview.filesChanged} file change(s) · ${source.preview.commands} command(s) · ${source.preview.networkCalls} network call(s)`;
}

function toneForFlow(source: ZavorthSensitiveActionFlowSnapshot): ZavorthSensitiveActionFlowUxTone {
  if (source.status === 'denied' || source.status === 'blocked' || source.risk === 'high') return 'danger';
  if (source.status === 'needs_approval' || source.status === 'dry_run_only' || source.risk === 'medium') return 'warn';
  return 'ok';
}

function escapeCommandValue(value: string): string {
  return redactUxText(value).replace(/["`$\\]/g, ' ').slice(0, 240);
}

function sanitizeUxSource(source: ZavorthSensitiveActionFlowSnapshot): ZavorthSensitiveActionFlowSnapshot {
  return redactUxValue(source) as ZavorthSensitiveActionFlowSnapshot;
}

function redactUxValue(value: unknown): unknown {
  if (typeof value === 'string') return redactUxText(value);
  if (Array.isArray(value)) return value.map((entry) => redactUxValue(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, redactUxValue(entry)]),
  );
}

function redactUxText(value: string): string {
  return value
    .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*[^\s"'`]+/gi, '$1=[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{4,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b(?:ghp|github_pat|xoxb|xoxp|xoxa)-[A-Za-z0-9_-]{4,}\b/g, '[REDACTED_SECRET]');
}
