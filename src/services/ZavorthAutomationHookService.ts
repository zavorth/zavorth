import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';

export type ZavorthAutomationHookAction =
  | {
      type: 'mnemos.write_summary';
      summaryTemplate?: string;
    }
  | {
      type: 'receipt.create';
      title?: string;
      summary?: string;
    }
  | {
      type: 'notification.create';
      channel?: 'local' | 'zavorthControl' | 'telegram' | 'discord' | 'slack' | 'email';
      title?: string;
      message?: string;
      requiresApproval?: boolean;
    }
  | {
      type: 'doctor.run';
      command?: string;
      requiresApproval?: boolean;
    };

export type ZavorthAutomationHookDefinition = {
  contractVersion: 'zavorth-automation-hook/1';
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
  event: string;
  aliases?: string[];
  safety: {
    noSecrets: true;
    requiresPolicy: true;
    canSendExternalData: boolean;
  };
  actions: ZavorthAutomationHookAction[];
};

export type ZavorthAutomationHookContext = Record<string, unknown>;

export type ZavorthAutomationHookRunInput = {
  workspace: string;
  event: string;
  context?: ZavorthAutomationHookContext;
  dryRun?: boolean;
};

export type ZavorthAutomationHookActionResult = {
  hookId: string;
  actionType: string;
  status: 'planned' | 'executed' | 'blocked_requires_approval' | 'blocked_invalid';
  path?: string;
  reason?: string;
};

export type ZavorthAutomationHookRunResult = {
  event: string;
  workspace: string;
  matchedHooks: number;
  executedActions: number;
  blockedActions: number;
  receiptPaths: string[];
  actionResults: ZavorthAutomationHookActionResult[];
  ok: boolean;
};

type ZavorthAutomationHookRuntime = {
  now?: () => Date;
};

const CONTRACT_VERSION = 'zavorth-automation-hook/1';

export class ZavorthAutomationHookService {
  private readonly now: () => Date;

  constructor(runtime: ZavorthAutomationHookRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public listHooks(workspace: string): ZavorthAutomationHookDefinition[] {
    const hooksRoot = this.hooksRoot(workspace);
    if (!fs.existsSync(hooksRoot)) {
      return [];
    }
    return fs.readdirSync(hooksRoot)
      .filter((entry) => entry.toLowerCase().endsWith('.json'))
      .map((entry) => path.join(hooksRoot, entry))
      .map((filePath) => this.readHook(filePath))
      .filter((hook): hook is ZavorthAutomationHookDefinition => hook !== null);
  }

  public async runEvent(input: ZavorthAutomationHookRunInput): Promise<ZavorthAutomationHookRunResult> {
    const workspace = path.resolve(input.workspace);
    const event = this.normalizeEvent(input.event);
    const context = this.redactValue(input.context || {}) as ZavorthAutomationHookContext;
    const dryRun = input.dryRun === true;
    const hooks = this.listHooks(workspace).filter((hook) => hook.enabled && this.matchesEvent(hook, event));
    const actionResults: ZavorthAutomationHookActionResult[] = [];
    const receiptPaths: string[] = [];

    for (const hook of hooks) {
      for (const action of hook.actions || []) {
        const result = await this.runAction({
          workspace,
          event,
          hook,
          action,
          context,
          dryRun,
        });
        actionResults.push(result);
        if (result.path && result.actionType === 'receipt.create') {
          receiptPaths.push(result.path);
        }
      }
    }

    const executedActions = actionResults.filter((entry) => entry.status === 'executed' || entry.status === 'planned').length;
    const blockedActions = actionResults.filter((entry) => entry.status.startsWith('blocked')).length;
    const invalidActions = actionResults.filter((entry) => entry.status === 'blocked_invalid').length;
    return {
      event,
      workspace,
      matchedHooks: hooks.length,
      executedActions,
      blockedActions,
      receiptPaths,
      actionResults,
      ok: invalidActions === 0,
    };
  }

  private async runAction(input: {
    workspace: string;
    event: string;
    hook: ZavorthAutomationHookDefinition;
    action: ZavorthAutomationHookAction;
    context: ZavorthAutomationHookContext;
    dryRun: boolean;
  }): Promise<ZavorthAutomationHookActionResult> {
    const actionType = String(input.action.type || '').trim();
    if (!this.isAllowedAction(actionType)) {
      return {
        hookId: input.hook.id,
        actionType,
        status: 'blocked_invalid',
        reason: 'Unknown automation action type.',
      };
    }

    if (input.dryRun) {
      return {
        hookId: input.hook.id,
        actionType,
        status: 'planned',
        reason: 'Dry-run only; no automation artifact was written.',
      };
    }

    switch (input.action.type) {
      case 'mnemos.write_summary':
        return this.writeMnemosSummary({ ...input, action: input.action });
      case 'receipt.create':
        return this.writeReceipt(input, {
          title: input.action.title || input.hook.title,
          summary: input.action.summary || input.hook.description || 'Automation receipt created.',
          actionType,
        });
      case 'notification.create':
        return this.writeNotification({ ...input, action: input.action });
      case 'doctor.run':
        return this.writeDoctorRequest({ ...input, action: input.action });
      default:
        return {
          hookId: input.hook.id,
          actionType,
          status: 'blocked_invalid',
          reason: 'Unsupported automation action.',
        };
    }
  }

  private writeMnemosSummary(input: {
    workspace: string;
    event: string;
    hook: ZavorthAutomationHookDefinition;
    action: Extract<ZavorthAutomationHookAction, { type: 'mnemos.write_summary' }>;
    context: ZavorthAutomationHookContext;
  }): ZavorthAutomationHookActionResult {
    const summary = this.interpolate(
      input.action.summaryTemplate || '{{event}} completed through {{toolName}}.',
      input.context,
      input.event,
    );
    const filePath = this.safeArtifactPath(input.workspace, ['.zavorth', 'mnemos', 'automation-summaries.jsonl']);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify({
      contractVersion: 'zavorth-automation-summary/1',
      id: this.artifactId(input.hook.id),
      hookId: input.hook.id,
      event: input.event,
      summary,
      context: input.context,
      createdAt: this.now().toISOString(),
    })}\n`, 'utf8');
    return {
      hookId: input.hook.id,
      actionType: input.action.type,
      status: 'executed',
      path: filePath,
    };
  }

  private writeNotification(input: {
    workspace: string;
    event: string;
    hook: ZavorthAutomationHookDefinition;
    action: Extract<ZavorthAutomationHookAction, { type: 'notification.create' }>;
    context: ZavorthAutomationHookContext;
  }): ZavorthAutomationHookActionResult {
    const channel = input.action.channel || 'local';
    const external = !['local', 'zavorthControl'].includes(channel);
    const status = external || input.action.requiresApproval === true || input.hook.safety.canSendExternalData !== true ? 'blocked_requires_approval'
      : 'executed';
    const filePath = this.safeArtifactPath(input.workspace, [
      '.zavorth',
      'automation',
      'outbox',
      `${this.artifactId(input.hook.id)}.json`,
    ]);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify({
      contractVersion: 'zavorth-automation-notification/1',
      id: this.artifactId(input.hook.id),
      hookId: input.hook.id,
      event: input.event,
      channel,
      status,
      title: this.interpolate(input.action.title || input.hook.title, input.context, input.event),
      message: this.interpolate(input.action.message || input.hook.description || '', input.context, input.event),
      context: input.context,
      createdAt: this.now().toISOString(),
    }, null, 2)}\n`, 'utf8');
    return {
      hookId: input.hook.id,
      actionType: input.action.type,
      status,
      path: filePath,
      reason: status === 'blocked_requires_approval'
        ? 'External or policy-sensitive notification was staged locally and requires explicit approval.'
        : undefined,
    };
  }

  private writeDoctorRequest(input: {
    workspace: string;
    event: string;
    hook: ZavorthAutomationHookDefinition;
    action: Extract<ZavorthAutomationHookAction, { type: 'doctor.run' }>;
    context: ZavorthAutomationHookContext;
  }): ZavorthAutomationHookActionResult {
    const filePath = this.safeArtifactPath(input.workspace, [
      '.zavorth',
      'automation',
      'pending-actions',
      `${this.artifactId(input.hook.id)}.json`,
    ]);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify({
      contractVersion: 'zavorth-automation-pending-action/1',
      id: this.artifactId(input.hook.id),
      hookId: input.hook.id,
      event: input.event,
      action: 'doctor.run',
      command: input.action.command || 'zavorth doctor',
      status: 'requires_approval',
      context: input.context,
      createdAt: this.now().toISOString(),
    }, null, 2)}\n`, 'utf8');
    return {
      hookId: input.hook.id,
      actionType: input.action.type,
      status: 'blocked_requires_approval',
      path: filePath,
      reason: 'Automation never runs diagnostic commands directly; it stages a governed pending action.',
    };
  }

  private writeReceipt(input: {
    workspace: string;
    event: string;
    hook: ZavorthAutomationHookDefinition;
    action: ZavorthAutomationHookAction;
    context: ZavorthAutomationHookContext;
  }, receipt: {
    title: string;
    summary: string;
    actionType: string;
  }): ZavorthAutomationHookActionResult {
    const filePath = this.safeArtifactPath(input.workspace, [
      '.zavorth',
      'automation',
      'receipts',
      `${this.artifactId(input.hook.id)}.json`,
    ]);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify({
      contractVersion: 'zavorth-automation-receipt/1',
      id: this.artifactId(input.hook.id),
      hookId: input.hook.id,
      event: input.event,
      actionType: receipt.actionType,
      title: this.interpolate(receipt.title, input.context, input.event),
      summary: this.interpolate(receipt.summary, input.context, input.event),
      context: input.context,
      createdAt: this.now().toISOString(),
    }, null, 2)}\n`, 'utf8');
    return {
      hookId: input.hook.id,
      actionType: 'receipt.create',
      status: 'executed',
      path: filePath,
    };
  }

  private readHook(filePath: string): ZavorthAutomationHookDefinition | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed?.contractVersion !== CONTRACT_VERSION) {
        return null;
      }
      const hook = this.normalizeHook(parsed);
      return hook;
    } catch (error: unknown) {logger.warn('[Zavorth Automation Hook] JSON parse failed', error); return null; }
  }

  private normalizeHook(raw: unknown): ZavorthAutomationHookDefinition | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const hook = raw as Record<string, unknown>;
    const id = String(hook.id || hook.name || '').trim();
    const event = String(hook.event || '').trim();
    if (!id || !event || !Array.isArray(hook.actions)) {
      return null;
    }
    const safety = hook.safety && typeof hook.safety === 'object' ? hook.safety as Record<string, unknown> : {};
    return {
      contractVersion: CONTRACT_VERSION,
      id,
      title: String(hook.title || id).trim(),
      description: String(hook.description || '').trim() || undefined,
      enabled: hook.enabled === true,
      event: this.normalizeEvent(event),
      aliases: Array.isArray(hook.aliases) ? (hook.aliases as unknown[]).map((entry: unknown) => this.normalizeEvent(String(entry))) : [],
      safety: {
        noSecrets: true,
        requiresPolicy: true,
        canSendExternalData: safety.canSendExternalData === true,
      },
      actions: (hook.actions as unknown[]).filter((action: unknown) => action && typeof action === 'object') as ZavorthAutomationHookAction[],
    };
  }

  private hooksRoot(workspace: string): string {
    return this.safeArtifactPath(workspace, ['.zavorth', 'hooks']);
  }

  private matchesEvent(hook: ZavorthAutomationHookDefinition, event: string): boolean {
    return this.normalizeEvent(hook.event) === event
      || (hook.aliases || []).some((alias) => this.normalizeEvent(alias) === event);
  }

  private isAllowedAction(actionType: string): boolean {
    return [
      'mnemos.write_summary',
      'receipt.create',
      'notification.create',
      'doctor.run',
    ].includes(actionType);
  }

  private interpolate(template: string, context: ZavorthAutomationHookContext, event: string): string {
    return this.redactText(String(template || '')
      .replace(/\{\{event\}\}/g, event)
      .replace(/\{\{([A-Za-z0-9_.-]+)\}\}/g, (_match, key) => {
        const value = this.lookupContext(context, String(key));
        return value === undefined || value === null ? '' : String(value);
      }));
  }

  private lookupContext(context: ZavorthAutomationHookContext, key: string): unknown {
    return key.split('.').reduce<unknown>((current, part) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      return (current as Record<string, unknown>)[part];
    }, context);
  }

  private redactValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.redactValue(entry));
    }
    if (value && typeof value === 'object') {
      const output: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        output[key] = /secret|token|password|api[-_]...key|credential/i.test(key) ? '[redacted]'
          : this.redactValue(entry);
      }
      return output;
    }
    return typeof value === 'string' ? this.redactText(value) : value;
  }

  private redactText(value: string): string {
    return String(value || '')
      .replace(/(sk-[A-Za-z0-9_-]{8,})/g, '[redacted]')
      .replace(/([A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/g, '[redacted]');
  }

  private normalizeEvent(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  private artifactId(hookId: string): string {
    const stamp = this.now().toISOString().replace(/[:.]/g, '-');
    const suffix = crypto.createHash('sha256').update(`${hookId}:${stamp}`).digest('hex').slice(0, 8);
    return `${stamp}-${this.slug(hookId)}-${suffix}`;
  }

  private slug(value: string): string {
    return String(value || 'hook').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'hook';
  }

  private safeArtifactPath(workspace: string, segments: string[]): string {
    const root = path.resolve(workspace);
    const target = path.resolve(root, ...segments);
    if (target !== root && !target.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) {
      throw new Error('Automation hook artifact path escaped the workspace.');
    }
    return target;
  }
}
