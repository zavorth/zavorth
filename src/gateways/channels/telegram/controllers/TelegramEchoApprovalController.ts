import { Context, InlineKeyboard } from 'grammy';
import {
  createSurfaceResponse,
  renderTelegramSurfaceResponse,
  type SurfaceResponse,
} from '../../../../domain/surface/application/surface-response/index.js';
import {
  TelegramEchoSurfaceClient,
  type TelegramEchoPermission,
  type TelegramEchoSurfaceContext,
} from '../../../../gateways/channels/telegram/TelegramEchoSurfaceClient.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';

export type TelegramEchoApprovalClient = Pick<
  TelegramEchoSurfaceClient,
  'getSurfaceContext' | 'readPendingPermissions' | 'resolvePermission'
>;

export type TelegramEchoApprovalControllerDeps = {
  baseUrl?: string;
  clientFactory?: (options: {
    baseUrl?: string;
    chatId: string;
    threadId: string | null;
    userId: string | null;
    sessionId?: string;
    requestedBy?: string;
  }) => TelegramEchoApprovalClient;
};

const ECHO_APPROVAL_PREFIX = 'echo:';
const MAX_LISTED_APPROVALS = 5;

export class TelegramEchoApprovalController {
  constructor(private readonly deps: TelegramEchoApprovalControllerDeps = {}) {}

  public async handleEchoCommand(ctx: Context, args: string): Promise<void> {
    const parsed = this.parseCommand(args);
    const client = this.createClient(ctx);

    if (parsed.action === 'approve' || parsed.action === 'reject') {
      const id = await this.resolvePermissionReference(client, parsed.reference);
      const result = await client.resolvePermission(id, parsed.action === 'approve');
      await replyWithTelegramSurfaceResponse(
        ctx,
        this.buildResolutionSurfaceResponse(
          result.status || parsed.action,
          id,
          client.getSurfaceContext(),
        ),
      );
      return;
    }

    await this.replyWithPendingApprovals(ctx, client);
  }

  public async handleEchoCallback(ctx: Context, data: string): Promise<void> {
    const parsed = this.parseCallback(data);
    if (!parsed) {
      await ctx.answerCallbackQuery({ text: 'Unknown Echo action.' });
      return;
    }

    const client = this.createClient(ctx);
    const id = await this.resolvePermissionReference(client, parsed.reference);
    const result = await client.resolvePermission(id, parsed.approved);
    const response = this.buildResolutionSurfaceResponse(
      result.status || (parsed.approved ? 'approved' : 'denied'),
      id,
      client.getSurfaceContext(),
    );

    await ctx.answerCallbackQuery({ text: parsed.approved ? 'Echo approval approved.' : 'Echo approval denied.' });
    await this.replaceOrReply(ctx, response);
  }

  public buildPendingApprovalsKeyboard(permissions: TelegramEchoPermission[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    permissions.slice(0, MAX_LISTED_APPROVALS).forEach((permission) => {
      const ref = this.shortPermissionId(permission);
      keyboard
        .text(`Approve ${ref}`, `${ECHO_APPROVAL_PREFIX}approve:${ref}`)
        .text(`Deny ${ref}`, `${ECHO_APPROVAL_PREFIX}reject:${ref}`)
        .row();
    });
    return keyboard;
  }

  private async replyWithPendingApprovals(ctx: Context, client: TelegramEchoApprovalClient): Promise<void> {
    const permissions = await client.readPendingPermissions();
    if (permissions.length === 0) {
      await ctx.reply('Echo has no pending approvals right now.');
      return;
    }

    await replyWithTelegramSurfaceResponse(
      ctx,
      this.buildPendingApprovalsSurfaceResponse(permissions, client.getSurfaceContext()),
    );
  }

  private createClient(ctx: Context): TelegramEchoApprovalClient {
    const chatId = normalizeRequired(ctx.chat?.id, 'telegram chatId');
    const threadId = normalizeNullableText((ctx.message as any)?.message_thread_id)
      || normalizeNullableText((ctx.callbackQuery?.message as any)?.message_thread_id);
    const userId = normalizeNullableText(ctx.from?.id);
    const baseUrl = this.deps.baseUrl
      || process.env.ZAVORTH_ECHO_BASE_URL
      || process.env.ZAVORTH_API_BASE_URL
      || 'http://localhost:3000';
    const options = {
      baseUrl,
      chatId,
      threadId,
      userId,
      requestedBy: userId ? `telegram:${userId}` : `telegram:${chatId}`,
    };
    return this.deps.clientFactory
      ? this.deps.clientFactory(options)
      : new TelegramEchoSurfaceClient(options);
  }

  private async resolvePermissionReference(
    client: TelegramEchoApprovalClient,
    reference: string,
  ): Promise<string> {
    const normalized = normalizeRequired(reference, 'approval reference');
    const permissions = await client.readPendingPermissions();
    const matches = permissions.filter((permission) => {
      const ids = [
        permission.id,
        permission.approvalId,
        this.shortPermissionId(permission),
      ].filter(Boolean);
      return ids.some((id) => id === normalized || id.startsWith(normalized));
    });

    if (matches.length === 1) {
      return matches[0].id;
    }

    if (matches.length > 1) {
      throw new Error(`Echo reference "${normalized}" is ambiguous.`);
    }

    return normalized;
  }

  private parseCommand(args: string): {
    action: 'list' | 'approve' | 'reject';
    reference: string;
  } {
    const [actionRaw = 'list', ...rest] = String(args || '').trim().split(/\s+/).filter(Boolean);
    const action = actionRaw.toLowerCase();
    if (['approve', 'aprovar', 'allow'].includes(action)) {
      return { action: 'approve', reference: rest.join(' ') };
    }
    if (['reject', 'deny', 'negar', 'rejeitar'].includes(action)) {
      return { action: 'reject', reference: rest.join(' ') };
    }
    return { action: 'list', reference: '' };
  }

  private parseCallback(data: string): { approved: boolean; reference: string } | null {
    if (!data.startsWith(ECHO_APPROVAL_PREFIX)) {
      return null;
    }
    const [, action, ...rest] = data.split(':');
    const reference = rest.join(':').trim();
    if (!reference) {
      return null;
    }
    if (action === 'approve') {
      return { approved: true, reference };
    }
    if (action === 'reject') {
      return { approved: false, reference };
    }
    return null;
  }

  private formatPendingApprovals(
    permissions: TelegramEchoPermission[],
    context: TelegramEchoSurfaceContext,
  ): string {
    const lines = [
      `Pending Echo approvals (${permissions.length})`,
      `Surface: ${context.surface} | session: ${context.sessionId}`,
      '',
    ];

    permissions.slice(0, MAX_LISTED_APPROVALS).forEach((permission, index) => {
      lines.push(
        `${index + 1}. ${permission.action || 'unknown action'}`,
        `id: ${permission.id}`,
        `runId: ${permission.correlation?.runId || permission.runContext?.runId || 'n/a'}`,
        `source: ${permission.runContext?.surface || 'echo'}`,
        `reason: ${truncate(permission.reason || 'no reason provided', 140)}`,
        '',
      );
    });

    if (permissions.length > MAX_LISTED_APPROVALS) {
      lines.push(`+${permissions.length - MAX_LISTED_APPROVALS} additional approval(s) not shown.`);
    }

    lines.push('Use the buttons below or /echoapprovals approve <id> / /echoapprovals reject <id>.');
    return lines.join('\n').trim();
  }

  private formatResolutionMessage(
    status: string,
    id: string,
    context: TelegramEchoSurfaceContext,
  ): string {
    const label = status === 'approved'
      ? 'approved'
      : status === 'denied'
        ? 'denied'
        : status;
    return [
      `Approval Echo ${label}.`,
      `id: ${id}`,
      `surface: ${context.surface}`,
      `session: ${context.sessionId}`,
    ].join('\n');
  }

  private buildPendingApprovalsSurfaceResponse(
    permissions: TelegramEchoPermission[],
    context: TelegramEchoSurfaceContext,
  ): SurfaceResponse {
    return createSurfaceResponse({
      id: `echo-approvals-${context.sessionId}`,
      intent: 'approval',
      title: `Pending Echo approvals (${permissions.length})`,
      summary: `Surface: ${context.surface} | session: ${context.sessionId}`,
      tone: 'warning',
      blocks: [
        {
          kind: 'text',
          text: this.formatPendingApprovals(permissions, context),
        },
      ],
      receipts: permissions.slice(0, MAX_LISTED_APPROVALS).map((permission) => ({
        id: permission.id,
        title: permission.action || 'unknown action',
        status: 'require_user_confirmation',
        reason: truncate(permission.reason || 'no reason provided', 180),
        policyProfile: permission.runContext?.profile || null,
        redacted: true,
        riskBlocked: false,
        createdAt: permission.requestedAt || null,
        metadata: {
          runId: permission.correlation?.runId || permission.runContext?.runId || null,
          surface: permission.runContext?.surface || 'echo',
        },
      })),
      actions: permissions.slice(0, MAX_LISTED_APPROVALS).flatMap((permission) => {
        const ref = this.shortPermissionId(permission);
        return [
          {
            id: `echo-approve-${ref}`,
            label: `Approve ${ref}`,
            kind: 'callback' as const,
            callbackData: `${ECHO_APPROVAL_PREFIX}approve:${ref}`,
            style: 'success' as const,
            confirmationRequired: false,
          },
          {
            id: `echo-reject-${ref}`,
            label: `Deny ${ref}`,
            kind: 'callback' as const,
            callbackData: `${ECHO_APPROVAL_PREFIX}reject:${ref}`,
            style: 'danger' as const,
            confirmationRequired: false,
          },
        ];
      }),
    });
  }

  private buildResolutionSurfaceResponse(
    status: string,
    id: string,
    context: TelegramEchoSurfaceContext,
  ): SurfaceResponse {
    const approved = status === 'approved' || status === 'approve';
    const denied = status === 'denied' || status === 'reject';
    return createSurfaceResponse({
      id: `echo-approval-resolution-${id}`,
      intent: 'receipt',
      title: approved ? 'Echo approval approved' : denied ? 'Echo approval denied' : 'Echo approval updated',
      summary: `surface: ${context.surface} | session: ${context.sessionId}`,
      tone: approved ? 'success' : denied ? 'danger' : 'info',
      blocks: [
        {
          kind: 'text',
          text: this.formatResolutionMessage(status, id, context),
        },
      ],
      receipts: [
        {
          id,
          title: 'Echo approval',
          status: approved ? 'allowed' : denied ? 'denied' : 'done',
          reason: `Decision recorded via ${context.surface}.`,
          policyProfile: context.surface,
          redacted: true,
          riskBlocked: denied,
        },
      ],
    });
  }

  private async replaceOrReply(ctx: Context, response: SurfaceResponse): Promise<void> {
    const rendered = renderTelegramSurfaceResponse(response);
    try {
      await ctx.editMessageText(rendered.text);
      return;
    } catch (error: unknown) {await replyWithTelegramSurfaceResponse(ctx, response);
    }
  }

  private shortPermissionId(permission: TelegramEchoPermission): string {
    return (permission.approvalId || permission.id).slice(0, 16);
  }
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function normalizeRequired(value: unknown, label: string): string {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}
