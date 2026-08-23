import {
  parseChannelMeshApprovalCommand,
  parseChannelMeshApprovalToken,
  type ChannelMeshApprovalCommand,
} from '../../channels/commands/ChannelMeshCommandParser.js';
import {
  renderApprovalDecisionReceiptForSurface,
  resolveSurfaceCapabilityPresentation,
} from '../../channels/capabilities/SurfaceCapabilityGate.js';
import {
  formatChannelApprovalString,
  resolveChannelApprovalLocale,
} from '../../channels/approval-strings/ChannelApprovalLocaleCatalog.js';

/**
 * Pending approval menus expire after this window. Expiry is fail-closed:
 * an expired menu resolves no decision at all, and the chat must request a
 * fresh pending-approval listing before any fast-path token works again.
 * The same window applies to the armed free-text capture of the "other"
 * escape option, so stale captures never decide later messages.
 */
export const APPROVAL_MENU_TIMEOUT_MS = 15 * 60 * 1000;

export const BULK_APPROVAL_REF = 'all';

export type ApprovalCoordinatorRunView = {
  id: string;
  sessionId: string;
  approvals: Array<{ id: string; status: 'pending' | 'approved' | 'rejected' }>;
};

export type ApprovalCoordinatorGatewayPort = {
  findPendingApproval(ref: string): {
    run: { id: string };
    approval: { id: string };
  } | null;
  approve(
    ref: string,
    options?: {
      choice?: string | null;
      surface?: string | null;
      sessionId?: string | null;
    },
  ): Promise<unknown>;
  reject(ref: string, options?: { reason?: string | null }): Promise<unknown>;
  listRuns(limit?: number): ApprovalCoordinatorRunView[];
};

export type ApprovalInteractionResolution =
  | { kind: 'explicit-command'; command: ChannelMeshApprovalCommand }
  | { kind: 'fast-path-command'; command: ChannelMeshApprovalCommand }
  | { kind: 'other-armed'; refList: string[] }
  | { kind: 'other-context'; userText: string; refList: string[] }
  | { kind: 'free-prose' };

type RegisteredApprovalMenu = {
  refs: string[];
  registeredAtMs: number;
};

type ArmedOtherCapture = {
  refList: string[];
  armedAtMs: number;
};

const OTHER_KEYWORDS = new Set(['0', 'other']);

function normalizeMenuKey(value: string): string {
  return String(value || '').trim();
}

function isOtherKeyword(text: string): boolean {
  return OTHER_KEYWORDS.has(String(text || '').trim().toLowerCase());
}

export class ApprovalCoordinator {
  private readonly menus = new Map<string, RegisteredApprovalMenu>();
  private readonly armedOtherCaptures = new Map<string, ArmedOtherCapture>();
  private readonly nowMs: () => number;

  constructor(
    private readonly gatewayPort: ApprovalCoordinatorGatewayPort,
    nowMs: () => number = () => Date.now(),
  ) {
    this.nowMs = nowMs;
  }

  public registerPendingMenu(menuKey: string, refs: string[]): void {
    const key = normalizeMenuKey(menuKey);
    if (!key || refs.length === 0) {
      return;
    }
    this.menus.set(key, { refs: [...refs], registeredAtMs: this.nowMs() });
  }

  public clearPendingMenu(menuKey: string): void {
    this.menus.delete(normalizeMenuKey(menuKey));
  }

  public hasLivePendingMenu(menuKey: string): boolean {
    return this.resolveLiveMenuRefs(menuKey).length > 0;
  }

  /**
   * Single entry point used by channel bridges to classify an inbound text as
   * an approval decision, as the "other" escape option, or as free prose
   * belonging to the agent conversation. Explicit slash commands win over
   * menu tokens; menus only resolve while a live (non-expired) menu exists.
   */
  public resolveApprovalInteraction(menuKey: string, text: string): ApprovalInteractionResolution {
    const explicitCommand = parseChannelMeshApprovalCommand(text);
    if (explicitCommand) {
      this.clearPendingMenu(menuKey);
      this.armedOtherCaptures.delete(normalizeMenuKey(menuKey));
      return { kind: 'explicit-command', command: explicitCommand };
    }

    const key = normalizeMenuKey(menuKey);
    const armed = this.armedOtherCaptures.get(key) ?? null;
    const liveArmed = armed && this.nowMs() - armed.armedAtMs < APPROVAL_MENU_TIMEOUT_MS ? armed : null;
    if (armed && !liveArmed) {
      this.armedOtherCaptures.delete(key);
    }

    if (liveArmed) {
      if (isOtherKeyword(text)) {
        liveArmed.armedAtMs = this.nowMs();
        return { kind: 'other-armed', refList: [...liveArmed.refList] };
      }
      this.armedOtherCaptures.delete(key);
      return { kind: 'other-context', userText: String(text || '').trim(), refList: [...liveArmed.refList] };
    }

    if (isOtherKeyword(text)) {
      const menuRefs = this.resolveLiveMenuRefs(menuKey);
      if (menuRefs.length > 0) {
        // The "other" escape replaces the menu: the next chat message is
        // captured verbatim as decision context instead of being parsed.
        this.menus.delete(key);
        this.armedOtherCaptures.set(key, { refList: [...menuRefs], armedAtMs: this.nowMs() });
        return { kind: 'other-armed', refList: [...menuRefs] };
      }
    }

    const fastPathCommand = this.resolveFastPathDecision(menuKey, text);
    if (fastPathCommand) {
      this.clearPendingMenu(menuKey);
      return { kind: 'fast-path-command', command: fastPathCommand };
    }

    if (this.hasLivePendingMenu(menuKey)) {
      // A pending menu exists but the text is neither a token nor a command:
      // free prose belongs to the interview/agent, never to silent approval.
      this.clearPendingMenu(menuKey);
    }
    return { kind: 'free-prose' };
  }

  /**
   * Acknowledgement shown when the operator picks the "other" escape on a
   * pending menu. Ordinals stay universal; only this wording localizes.
   */
  public buildOtherModePrompt(refCount: number, preferredLanguageCode?: string | null): string {
    return formatChannelApprovalString(resolveChannelApprovalLocale(preferredLanguageCode), 'other.armed', {
      count: refCount,
    });
  }

  /**
   * Executes an already-parsed decision against the gateway and builds the
   * operator-facing receipt through the surface capability gate. The bulk
   * reference ("all") resolves every pending approval visible to the chat.
   * The gateway call is best-effort: an unexpected failure is converted into
   * the not-found receipt so the channel always receives exactly one reply
   * instead of a swallowed error. Surfaces whose resolved presentation is
   * 'none' receive no receipt text at all.
   */
  public async executeApprovalDecision(input: {
    command: ChannelMeshApprovalCommand;
    surface: string;
    sessionId: string;
    locale?: string | null;
  }): Promise<string | null> {
    const { command } = input;
    if (command.ref.trim().toLowerCase() === BULK_APPROVAL_REF) {
      return this.executeBulkDecision(input);
    }
    const presentation = resolveSurfaceCapabilityPresentation({ platform: input.surface });
    const locale = input.locale ?? null;
    if (command.action === 'deny') {
      const rejected = await this.gatewayPort.reject(command.ref).catch(() => null);
      return renderApprovalDecisionReceiptForSurface(
        presentation,
        {
          action: 'deny',
          ref: command.ref,
          found: Boolean(rejected),
        },
        locale,
      );
    }
    const approved = await this.gatewayPort
      .approve(command.ref, {
        choice: command.choice,
        surface: input.surface,
        sessionId: input.sessionId,
      })
      .catch(() => null);
    return renderApprovalDecisionReceiptForSurface(
      presentation,
      {
        action: 'approve',
        ref: command.ref,
        choice: command.choice,
        found: Boolean(approved),
      },
      locale,
    );
  }

  /**
   * Denies every referenced approval and records the operator's free-text
   * answer as the rejection context relayed back to the agent. Fail-closed:
   * prose never approves anything, it only denies with context attached.
   */
  public async executeDenyWithReason(input: {
    refList: string[];
    reason: string;
    surface: string;
    sessionId: string;
    locale?: string | null;
  }): Promise<string | null> {
    const presentation = resolveSurfaceCapabilityPresentation({ platform: input.surface });
    let denied = 0;
    for (const ref of input.refList) {
      const rejected = await this.gatewayPort
        .reject(ref, { reason: input.reason })
        .catch(() => null);
      if (rejected) {
        denied += 1;
      }
    }
    if (presentation.mode === 'none') {
      return null;
    }
    if (input.refList.length === 0 || denied === 0) {
      return formatChannelApprovalString(resolveChannelApprovalLocale(input.locale), 'other.referencedNotFound', {});
    }
    return formatChannelApprovalString(resolveChannelApprovalLocale(input.locale), 'other.deniedWithReason', {
      count: denied,
    });
  }

  private listVisiblePendingRefs(sessionId: string): Array<{ runId: string; approvalId: string }> {
    const normalizedSession = String(sessionId || '').trim();
    const visible: Array<{ runId: string; approvalId: string }> = [];
    for (const run of this.gatewayPort.listRuns(200)) {
      if (normalizedSession && run.sessionId !== normalizedSession) {
        continue;
      }
      for (const approval of run.approvals) {
        if (approval.status === 'pending') {
          visible.push({ runId: run.id, approvalId: approval.id });
        }
      }
    }
    return visible;
  }

  private async executeBulkDecision(input: {
    command: ChannelMeshApprovalCommand;
    surface: string;
    sessionId: string;
    locale?: string | null;
  }): Promise<string | null> {
    const presentation = resolveSurfaceCapabilityPresentation({ platform: input.surface });
    const locale = resolveChannelApprovalLocale(input.locale);
    const targets = this.listVisiblePendingRefs(input.sessionId);
    if (targets.length === 0) {
      return presentation.mode === 'none'
        ? null
        : formatChannelApprovalString(locale, 'bulk.notFound', {});
    }

    let resolved = 0;
    for (const target of targets) {
      const outcome =
        input.command.action === 'deny'
          ? await this.gatewayPort.reject(target.approvalId).catch(() => null)
          : await this.gatewayPort
            .approve(target.approvalId, {
              choice: input.command.choice,
              surface: input.surface,
              sessionId: input.sessionId,
            })
            .catch(() => null);
      if (outcome) {
        resolved += 1;
      }
    }

    if (presentation.mode === 'none') {
      return null;
    }
    if (resolved === targets.length) {
      return input.command.action === 'deny'
        ? formatChannelApprovalString(locale, 'bulk.deniedAll', { count: targets.length })
        : formatChannelApprovalString(locale, 'bulk.approvedAll', {
          count: targets.length,
          choice: input.command.choice,
        });
    }
    return input.command.action === 'deny'
      ? formatChannelApprovalString(locale, 'bulk.deniedPartial', { resolved, total: targets.length })
      : formatChannelApprovalString(locale, 'bulk.approvedPartial', {
        resolved,
        total: targets.length,
        choice: input.command.choice,
      });
  }

  private resolveFastPathDecision(menuKey: string, text: string): ChannelMeshApprovalCommand | null {
    const menuRefs = this.resolveLiveMenuRefs(menuKey);
    if (menuRefs.length === 0) {
      return null;
    }
    const token = parseChannelMeshApprovalToken(text);
    if (!token) {
      return null;
    }
    if (token.kind === 'ordinal') {
      const entry = menuRefs[token.ordinal - 1];
      if (!entry) {
        return null;
      }
      return { action: 'approve', ref: entry, choice: 'once' };
    }
    if (token.action === 'approve') {
      return { action: 'approve', ref: menuRefs[0], choice: token.choice };
    }
    return { action: 'deny', ref: menuRefs[0], choice: 'once' };
  }

  private resolveLiveMenuRefs(menuKey: string): string[] {
    const key = normalizeMenuKey(menuKey);
    const menu = this.menus.get(key);
    if (!menu) {
      return [];
    }
    if (this.nowMs() - menu.registeredAtMs >= APPROVAL_MENU_TIMEOUT_MS) {
      this.menus.delete(key);
      return [];
    }
    return menu.refs;
  }
}
