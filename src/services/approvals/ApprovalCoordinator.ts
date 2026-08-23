import {
  parseChannelMeshApprovalCommand,
  parseChannelMeshApprovalToken,
  type ChannelMeshApprovalCommand,
} from '../../channels/commands/ChannelMeshCommandParser.js';

/**
 * Pending approval menus expire after this window. Expiry is fail-closed:
 * an expired menu resolves no decision at all, and the chat must request a
 * fresh pending-approval listing before any fast-path token works again.
 */
export const APPROVAL_MENU_TIMEOUT_MS = 15 * 60 * 1000;

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
  reject(ref: string): Promise<unknown>;
};

export type ChannelMeshReplyTargetContext = {
  platform: string;
  chatId: string;
};

export type ApprovalInteractionResolution =
  | { kind: 'explicit-command'; command: ChannelMeshApprovalCommand }
  | { kind: 'fast-path-command'; command: ChannelMeshApprovalCommand }
  | { kind: 'free-prose' };

type RegisteredApprovalMenu = {
  refs: string[];
  registeredAtMs: number;
};

function normalizeMenuKey(value: string): string {
  return String(value || '').trim();
}

export class ApprovalCoordinator {
  private readonly menus = new Map<string, RegisteredApprovalMenu>();
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
   * an approval decision or as free prose belonging to the agent conversation.
   * Explicit slash commands win over menu tokens; menus only resolve while a
   * live (non-expired) menu exists for the chat.
   */
  public resolveApprovalInteraction(menuKey: string, text: string): ApprovalInteractionResolution {
    const explicitCommand = parseChannelMeshApprovalCommand(text);
    if (explicitCommand) {
      this.clearPendingMenu(menuKey);
      return { kind: 'explicit-command', command: explicitCommand };
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
   * Executes an already-parsed decision against the gateway and builds the
   * operator-facing receipt. The gateway call is best-effort: an unexpected
   * failure is converted into the not-found receipt so the channel always
   * receives exactly one reply instead of a swallowed error.
   */
  public async executeApprovalDecision(input: {
    command: ChannelMeshApprovalCommand;
    surface: string;
    sessionId: string;
  }): Promise<string> {
    const { command } = input;
    if (command.action === 'deny') {
      const rejected = await this.gatewayPort.reject(command.ref).catch(() => null);
      return rejected ? `Denied approval ${command.ref}.` : `No pending approval found for ${command.ref}.`;
    }
    const approved = await this.gatewayPort
      .approve(command.ref, {
        choice: command.choice,
        surface: input.surface,
        sessionId: input.sessionId,
      })
      .catch(() => null);
    return approved
      ? `Approved ${command.ref} (${command.choice}).`
      : `No pending approval found for ${command.ref}.`;
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
