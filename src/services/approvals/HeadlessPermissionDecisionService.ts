import type { PermissionRequest, PermissionScope } from '../../contracts/PermissionRequest.js';
import type { TelegramPermissionApprovalPatch } from '../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';
import {
  renderPlainSurfaceResponse,
  type SurfaceResponse,
  type SurfaceResponseAction,
} from '../../domain/surface/application/surface-response/index.js';
import type { SurfaceDecisionChoice } from './SurfaceDecisionContract.js';

export const INLINE_PERMISSION_REJECTION_NOTE = 'Inline rejection from Telegram.';

export type HeadlessPermissionInlineButton = { text: string; callbackData: string };

/**
 * Transport-neutral outcome of a permission decision: plain-text receipt plus
 * an optional inline-button spec that keyboard-capable transports may render.
 */
export type HeadlessPermissionDecisionOutcome = {
  resolved: boolean;
  receiptText: string | null;
  keyboardSpec: HeadlessPermissionInlineButton[][] | null;
};

export type HeadlessPermissionDecisionInput = {
  reference: string;
  action: 'approve' | 'deny';
  scopeWord: string | null;
  actorId: string;
};

export type HeadlessPermissionDecisionServiceDeps = {
  approveRequest: (
    permissionId: string,
    decidedBy: string | null,
    patch: TelegramPermissionApprovalPatch,
  ) => Promise<PermissionRequest>;
  rejectRequest: (
    permissionId: string,
    decidedBy: string | null,
    note?: string | null,
  ) => Promise<PermissionRequest>;
  resolvePermissionReference: (ref: string) => Promise<PermissionRequest>;
  normalizePermissionScope: (input: string) => PermissionScope;
  buildDecisionSurfaceResponse: (
    permission: PermissionRequest,
    action: 'approve' | 'reject',
  ) => SurfaceResponse;
  externalExecutorAgentId?: string | null;
};

/**
 * Pure planner shared by the interactive Telegram callback path and the
 * headless spine path. Reproduces the legacy patch semantics exactly: the
 * explicit scope word is normalized when present, and external-executor
 * permissions fall back to their suggested agent id, then the configured
 * default executor, then "main".
 */
export function buildPermissionApprovalPatch(input: {
  permission: Pick<PermissionRequest, 'executor' | 'resolved_value' | 'metadata'>;
  scopeWord: string | null;
  normalizeScope: (value: string) => PermissionScope;
  externalExecutorAgentId: string | null | undefined;
}): TelegramPermissionApprovalPatch {
  const patch: TelegramPermissionApprovalPatch = {};
  if (input.scopeWord) {
    patch.scope = input.normalizeScope(input.scopeWord);
  }
  if (!patch.resolved_value && input.permission.executor === 'external_executor') {
    patch.resolved_value =
      input.permission.resolved_value ||
      String(input.permission.metadata?.suggested_agent_id || input.externalExecutorAgentId || 'main');
  }
  return patch;
}

/**
 * Maps the unified surface choice vocabulary back onto the permission scope
 * words understood by the permission registry ('workspace'/'persistent'
 * collapse onto "always" in the unified vocabulary).
 */
export function surfaceChoiceToPermissionScopeWord(choice: SurfaceDecisionChoice): string | null {
  switch (choice) {
    case 'session':
      return 'session';
    case 'always':
      return 'persistent';
    default:
      return 'once';
  }
}

function buildHeadlessKeyboardSpec(
  actions: SurfaceResponseAction[] | undefined,
): HeadlessPermissionInlineButton[][] | null {
  const buttons = (actions || [])
    .filter((action) => !action.confirmationRequired && action.kind !== 'url')
    .map((action) => ({
      text: action.label,
      callbackData: action.callbackData || action.command || action.id,
    }));
  if (buttons.length === 0) {
    return null;
  }
  const rows: HeadlessPermissionInlineButton[][] = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return rows;
}

/**
 * Headless permission decision engine: resolves a reference against the
 * permission registry, applies the pure approval plan, mutates the store via
 * the injected permission service calls, and returns a transport-neutral
 * receipt. Failures collapse into an unresolved error receipt so callers
 * always get exactly one speakable outcome.
 */
export class HeadlessPermissionDecisionService {
  constructor(private readonly deps: HeadlessPermissionDecisionServiceDeps) {}

  public async decide(input: HeadlessPermissionDecisionInput): Promise<HeadlessPermissionDecisionOutcome> {
    try {
      const permission = await this.deps.resolvePermissionReference(input.reference);
      if (input.action === 'deny') {
        const rejected = await this.deps.rejectRequest(
          permission.permission_id,
          input.actorId || null,
          INLINE_PERMISSION_REJECTION_NOTE,
        );
        return this.render(rejected, 'reject');
      }
      const patch = buildPermissionApprovalPatch({
        permission,
        scopeWord: input.scopeWord,
        normalizeScope: this.deps.normalizePermissionScope,
        externalExecutorAgentId: this.deps.externalExecutorAgentId,
      });
      const approved = await this.deps.approveRequest(permission.permission_id, input.actorId || null, patch);
      return this.render(approved, 'approve');
    } catch (error: unknown) {
      return {
        resolved: false,
        receiptText: error instanceof Error ? error.message : 'Failed to process the permission.',
        keyboardSpec: null,
      };
    }
  }

  private render(permission: PermissionRequest, action: 'approve' | 'reject'): HeadlessPermissionDecisionOutcome {
    const response = this.deps.buildDecisionSurfaceResponse(permission, action);
    const rendered = renderPlainSurfaceResponse(response);
    return {
      resolved: true,
      receiptText: rendered.text,
      keyboardSpec: buildHeadlessKeyboardSpec(response.actions),
    };
  }
}
