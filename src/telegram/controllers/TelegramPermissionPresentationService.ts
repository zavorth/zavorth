import type {
  PermissionRequest,
  PermissionStatus,
} from '../../contracts/PermissionRequest.js';
import {
  createSurfaceResponse,
  renderPlainSurfaceResponse,
  type SurfaceReceiptStatus,
  type SurfaceResponse,
  type SurfaceResponseAction,
} from '../../domain/surface/application/surface-response/index.js';
import { TelegramPermissionDecisionPresentationService } from './TelegramPermissionDecisionPresentationService.js';
import { TelegramPermissionPromptPresentationService } from './TelegramPermissionPromptPresentationService.js';
import { TelegramPermissionReadPresentationService } from './TelegramPermissionReadPresentationService.js';
import type { TelegramPermissionPresentationPolicy } from './TelegramPermissionPresentationTypes.js';

export class TelegramPermissionPresentationService {
  private readonly decisionPresentation: TelegramPermissionDecisionPresentationService;
  private readonly promptPresentation: TelegramPermissionPromptPresentationService;
  private readonly readPresentation: TelegramPermissionReadPresentationService;

  constructor(private readonly policy: TelegramPermissionPresentationPolicy) {
    this.decisionPresentation = new TelegramPermissionDecisionPresentationService(policy);
    this.promptPresentation = new TelegramPermissionPromptPresentationService(policy);
    this.readPresentation = new TelegramPermissionReadPresentationService(policy);
  }

  public formatPermissionList(
    permissions: PermissionRequest[],
    status: PermissionStatus | 'all',
  ): string {
    return renderPlainSurfaceResponse(
      this.buildPermissionListSurfaceResponse(permissions, status),
    ).text;
  }

  public formatPermissionDetails(permission: PermissionRequest): string {
    return renderPlainSurfaceResponse(
      this.buildPermissionDetailsSurfaceResponse(permission),
    ).text;
  }

  public formatPermissionDecisionMessage(
    permission: PermissionRequest,
    action: 'approve' | 'reject' | 'edit',
  ): string {
    return renderPlainSurfaceResponse(
      this.buildPermissionDecisionSurfaceResponse(permission, action),
    ).text;
  }

  public formatPermissionCreatedMessage(permission: PermissionRequest): string {
    return renderPlainSurfaceResponse(
      this.buildPermissionCreatedSurfaceResponse(permission),
    ).text;
  }

  public buildPermissionListSurfaceResponse(
    permissions: PermissionRequest[],
    status: PermissionStatus | 'all',
  ): SurfaceResponse {
    const statusLabel = this.policy.describePermissionStatus(status);
    return createSurfaceResponse({
      id: `telegram-permission-list-${status}`,
      intent: 'approval',
      title: `Permissoes (${statusLabel})`,
      summary: `${permissions.length} item(ns) encontrados.`,
      tone: permissions.length > 0 ? 'warning' : 'success',
      blocks: [
        {
          kind: 'text',
          text: this.readPresentation.formatPermissionList(permissions, status),
        },
      ],
      receipts: permissions.slice(0, 5).map((permission) => this.buildPermissionReceipt(permission)),
      actions: [
        {
          id: 'perm-list-refresh',
          label: 'Atualizar',
          kind: 'command',
          command: `/perm list ${status}`,
          style: 'secondary',
        },
      ],
    });
  }

  public buildPermissionDetailsSurfaceResponse(permission: PermissionRequest): SurfaceResponse {
    return createSurfaceResponse({
      id: `telegram-permission-details-${this.policy.shortPermissionId(permission)}`,
      intent: 'approval',
      title: `Permissao ${this.policy.shortPermissionId(permission)}`,
      summary: `${this.policy.describePermissionSubject(permission)} - ${this.policy.describePermissionStatus(permission.status)}.`,
      tone: permission.status === 'pending' ? 'warning' : permission.status === 'approved' ? 'success' : 'danger',
      blocks: [
        {
          kind: 'text',
          text: this.readPresentation.formatPermissionDetails(permission),
        },
      ],
      receipts: [this.buildPermissionReceipt(permission)],
      actions: permission.status === 'pending' ? this.buildPermissionActions(permission) : [],
    });
  }

  public buildPermissionDecisionSurfaceResponse(
    permission: PermissionRequest,
    action: 'approve' | 'reject' | 'edit',
  ): SurfaceResponse {
    const title =
      action === 'approve'
        ? 'Permissao aprovada'
        : action === 'reject'
          ? 'Permissao rejeitada'
          : 'Permissao atualizada';
    return createSurfaceResponse({
      id: `telegram-permission-decision-${this.policy.shortPermissionId(permission)}-${action}`,
      intent: 'receipt',
      title,
      summary: `${this.policy.describePermissionSubject(permission)} - ${this.policy.describePermissionScope(permission.scope)}.`,
      tone: action === 'approve' ? 'success' : action === 'reject' ? 'danger' : 'info',
      blocks: [
        {
          kind: 'text',
          text: this.decisionPresentation.formatPermissionDecisionMessage(permission, action),
        },
      ],
      receipts: [
        this.buildPermissionReceipt(permission, action === 'approve' ? 'allowed' : action === 'reject' ? 'denied' : 'done'),
      ],
    });
  }

  public buildPermissionCreatedSurfaceResponse(permission: PermissionRequest): SurfaceResponse {
    return createSurfaceResponse({
      id: `telegram-permission-created-${this.policy.shortPermissionId(permission)}`,
      intent: 'approval',
      title: `Aprovacao necessaria - ${this.policy.describePermissionSubject(permission)}`,
      summary: 'Decisao explicita exigida antes de continuar.',
      tone: 'warning',
      blocks: [
        {
          kind: 'text',
          text: this.promptPresentation.formatPermissionCreatedMessage(permission),
        },
      ],
      receipts: [this.buildPermissionReceipt(permission, 'require_user_confirmation')],
      actions: this.buildPermissionActions(permission),
    });
  }

  private buildPermissionReceipt(
    permission: PermissionRequest,
    overrideStatus?: SurfaceReceiptStatus,
  ) {
    return {
      id: permission.permission_id,
      title: this.policy.describePermissionSubject(permission),
      status: overrideStatus || this.mapPermissionStatus(permission.status),
      reason: String(permission.reason || permission.decision_note || 'Sem motivo registrado.').trim(),
      policyProfile: String(permission.scope || 'once'),
      redacted: true,
      riskBlocked: permission.status === 'rejected',
      createdAt: permission.updated_at || permission.created_at || null,
      metadata: {
        executor: permission.executor,
        kind: permission.kind,
        taskId: permission.task_id || null,
        workspace: permission.workspace || null,
      },
    };
  }

  private mapPermissionStatus(status: PermissionStatus | undefined): SurfaceReceiptStatus {
    switch (status) {
      case 'approved':
        return 'allowed';
      case 'rejected':
        return 'denied';
      case 'pending':
      default:
        return 'require_user_confirmation';
    }
  }

  private buildPermissionActions(permission: PermissionRequest): SurfaceResponseAction[] {
    const shortId = this.policy.shortPermissionId(permission);

    if (permission.executor === 'external_executor' && permission.kind === 'agent_binding') {
      return [
        this.approveAction('workspace', 'Usar neste projeto', shortId, 'success'),
        this.approveAction('persistent', 'Salvar para futuros pedidos', shortId, 'primary'),
        this.rejectAction(shortId),
      ];
    }

    if (
      (permission.executor === 'external_executor' || permission.executor === 'file_delivery') &&
      permission.kind === 'workspace_access'
    ) {
      return [
        this.approveAction('once', 'Liberar leitura so nesta tarefa', shortId, 'success'),
        this.approveAction('workspace', 'Liberar leitura neste projeto', shortId, 'primary'),
        this.rejectAction(shortId),
      ];
    }

    if (permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission') {
      return [
        this.approveAction('session', 'Aprovar conversa', shortId, 'primary'),
        this.approveAction('once', 'Aprovar uma vez', shortId, 'success'),
        this.rejectAction(shortId),
      ];
    }

    if (permission.executor === 'aistudio' && permission.kind === 'builtin_tool_access') {
      return [
        this.approveAction('once', 'Liberar so esta tarefa', shortId, 'success'),
        this.approveAction('workspace', 'Liberar neste projeto', shortId, 'primary'),
        this.rejectAction(shortId),
      ];
    }

    if (permission.executor === 'aistudio' && permission.kind === 'service_access') {
      return [
        this.approveAction('once', 'Permitir so esta tarefa', shortId, 'success'),
        this.approveAction('workspace', 'Permitir neste projeto', shortId, 'primary'),
        this.rejectAction(shortId),
      ];
    }

    return [
      this.approveAction('once', 'Aprovar', shortId, 'success'),
      this.rejectAction(shortId),
    ];
  }

  private approveAction(
    scope: string,
    label: string,
    shortId: string,
    style: SurfaceResponseAction['style'],
  ): SurfaceResponseAction {
    return {
      id: `perm-approve-${shortId}-${scope}`,
      label,
      kind: 'callback',
      callbackData: `perm:approve:${shortId}:${scope}`,
      style,
      confirmationRequired: true,
    };
  }

  private rejectAction(shortId: string): SurfaceResponseAction {
    return {
      id: `perm-reject-${shortId}`,
      label: 'Rejeitar',
      kind: 'callback',
      callbackData: `perm:reject:${shortId}`,
      style: 'danger',
      confirmationRequired: true,
    };
  }
}
