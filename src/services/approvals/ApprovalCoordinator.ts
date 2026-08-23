import {
  parseChannelMeshApprovalCommand,
  parseChannelMeshApprovalToken,
  type ChannelMeshApprovalCommand,
} from '../../channels/commands/ChannelMeshCommandParser.js';
import {
  renderApprovalDecisionReceiptForSurface,
  renderApprovalPromptForSurface,
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

function splitMenuKey(menuKey: string): { platform: string; chatId: string } {
  const key = normalizeMenuKey(menuKey);
  const separator = key.indexOf(':');
  if (separator < 0) {
    return { platform: key, chatId: '' };
  }
  return { platform: key.slice(0, separator), chatId: key.slice(separator + 1) };
}

type ArmedOtherCapture = {
  refList: string[];
  armedAtMs: number;
};

export type PendingApprovalRegistrationInput = {
  sessionId: string;
  ref: string;
  title?: string | null;
  reason?: string | null;
  risk?: string | null;
};

export type PendingApprovalRegistration = {
  leaderRef: string;
  isDuplicate: boolean;
};

/**
 * A surface presenter that rendered a pending-approval prompt and must be
 * dismissed once the referenced approval resolves somewhere else. The gateway
 * turns each dismissal into an edit-in-place update or a follow-up receipt on
 * that chat, so stale actionable prompts never linger across surfaces.
 */
export type ApprovalPresenterDismissal = {
  menuKey: string;
  platform: string;
  chatId: string;
  resolvedRefs: string[];
};

type CoalescedFollowerEntry = {
  ref: string;
  label: string;
};

type CoalescedApprovalGroup = {
  identityKey: string;
  sessionId: string;
  risk: string;
  leaderRef: string;
  leaderLabel: string;
  followers: CoalescedFollowerEntry[];
  registeredAtMs: number;
};

const OTHER_KEYWORDS = new Set(['0', 'other']);

function normalizeMenuKey(value: string): string {
  return String(value || '').trim();
}

function normalizeIdentityToken(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function resolvePendingApprovalLabel(input: PendingApprovalRegistrationInput): string {
  return normalizeMenuKey(input.title || input.reason || input.ref) || input.ref;
}

function buildCoalescingIdentityKey(
  sessionId: string,
  title: string | null | undefined,
  reason: string | null | undefined,
  risk: string | null | undefined,
): string {
  return [
    normalizeIdentityToken(sessionId),
    normalizeIdentityToken(title) || normalizeIdentityToken(reason),
    normalizeIdentityToken(risk),
  ].join('||');
}

function isOtherKeyword(text: string): boolean {
  return OTHER_KEYWORDS.has(String(text || '').trim().toLowerCase());
}

export class ApprovalCoordinator {
  private readonly menus = new Map<string, RegisteredApprovalMenu>();
  private readonly presentersByRef = new Map<string, Set<string>>();
  private readonly armedOtherCaptures = new Map<string, ArmedOtherCapture>();
  private readonly coalescedGroupsByIdentity = new Map<string, CoalescedApprovalGroup>();
  private readonly coalescedGroupsByRef = new Map<string, CoalescedApprovalGroup>();
  private readonly nowMs: () => number;

  constructor(
    private readonly gatewayPort: ApprovalCoordinatorGatewayPort,
    nowMs: () => number = () => Date.now(),
  ) {
    this.nowMs = nowMs;
  }

  /**
   * Registers a pending approval for duplicate-request coalescing. Identical
   * concurrent requests inside one chat session (same title/tool identity and
   * risk) collapse into a single leader entry; later registrations become
   * followers that adopt the leader's decision automatically — except the
   * 'once' scope, which resolves only the leader and re-prompts followers.
   */
  public registerPendingApproval(input: PendingApprovalRegistrationInput): PendingApprovalRegistration {
    const ref = normalizeMenuKey(input.ref);
    if (!ref) {
      return { leaderRef: '', isDuplicate: false };
    }

    const existingGroup = this.coalescedGroupsByRef.get(ref);
    if (existingGroup && this.isLiveCoalescedGroup(existingGroup)) {
      return { leaderRef: existingGroup.leaderRef, isDuplicate: ref !== existingGroup.leaderRef };
    }
    if (existingGroup) {
      this.removeCoalescedGroup(existingGroup);
    }

    const identityKey = buildCoalescingIdentityKey(input.sessionId, input.title, input.reason, input.risk);
    const liveGroup = this.coalescedGroupsByIdentity.get(identityKey);
    if (liveGroup && this.isLiveCoalescedGroup(liveGroup)) {
      if (!liveGroup.followers.some((follower) => follower.ref === ref)) {
        liveGroup.followers.push({ ref, label: resolvePendingApprovalLabel(input) });
        this.coalescedGroupsByRef.set(ref, liveGroup);
      }
      return { leaderRef: liveGroup.leaderRef, isDuplicate: true };
    }
    if (liveGroup) {
      this.removeCoalescedGroup(liveGroup);
    }

    const group: CoalescedApprovalGroup = {
      identityKey,
      sessionId: normalizeIdentityToken(input.sessionId),
      risk: normalizeIdentityToken(input.risk),
      leaderRef: ref,
      leaderLabel: resolvePendingApprovalLabel(input),
      followers: [],
      registeredAtMs: this.nowMs(),
    };
    this.coalescedGroupsByIdentity.set(identityKey, group);
    this.coalescedGroupsByRef.set(ref, group);
    return { leaderRef: ref, isDuplicate: false };
  }

  public registerPendingMenu(menuKey: string, refs: string[]): void {
    const key = normalizeMenuKey(menuKey);
    if (!key || refs.length === 0) {
      return;
    }
    this.menus.set(key, { refs: [...refs], registeredAtMs: this.nowMs() });
    for (const ref of refs) {
      const normalizedRef = normalizeMenuKey(ref);
      if (!normalizedRef) {
        continue;
      }
      let presenterKeys = this.presentersByRef.get(normalizedRef);
      if (!presenterKeys) {
        presenterKeys = new Set<string>();
        this.presentersByRef.set(normalizedRef, presenterKeys);
      }
      presenterKeys.add(key);
    }
  }

  public clearPendingMenu(menuKey: string): void {
    const key = normalizeMenuKey(menuKey);
    this.menus.delete(key);
    this.forgetPresenterMenu(key);
  }

  /**
   * Single source of truth for cross-surface dismissal: given the refs that a
   * decision just resolved, returns every OTHER surface presenter that still
   * renders one of them and immediately retires its canonical state (menu,
   * armed capture, coalescing group). The deciding surfaces listed in
   * excludeMenuKeys never dismiss themselves.
   */
  public collectPresenterDismissals(
    resolvedRefs: string[],
    excludeMenuKeys: string[] = [],
  ): ApprovalPresenterDismissal[] {
    const excluded = new Set(excludeMenuKeys.map(normalizeMenuKey).filter(Boolean));
    const resolvedSet = new Set(resolvedRefs.map(normalizeMenuKey).filter(Boolean));
    const dismissalsByKey = new Map<string, ApprovalPresenterDismissal>();
    const recordDismissal = (key: string, ref: string): void => {
      const existing = dismissalsByKey.get(key);
      if (existing) {
        if (!existing.resolvedRefs.includes(ref)) {
          existing.resolvedRefs.push(ref);
        }
        return;
      }
      const { platform, chatId } = splitMenuKey(key);
      dismissalsByKey.set(key, { menuKey: key, platform, chatId, resolvedRefs: [ref] });
    };
    for (const rawRef of resolvedRefs) {
      const ref = normalizeMenuKey(rawRef);
      const presenterKeys = this.presentersByRef.get(ref);
      if (!presenterKeys) {
        continue;
      }
      for (const key of [...presenterKeys]) {
        if (excluded.has(key)) {
          continue;
        }
        const menu = this.menus.get(key);
        if (!menu || !menu.refs.includes(ref)) {
          this.forgetPresenterEntry(key, ref);
          continue;
        }
        recordDismissal(key, ref);
        this.clearPendingMenu(key);
        this.armedOtherCaptures.delete(key);
        const group = this.findLiveCoalescedGroupByRef(ref);
        if (group && group.leaderRef === ref) {
          this.removeCoalescedGroup(group);
        }
      }
    }
    // An armed free-text capture is itself a rendered presenter state: when
    // its refs resolve elsewhere the capture must die with them.
    for (const [key, capture] of [...this.armedOtherCaptures.entries()]) {
      if (excluded.has(key)) {
        continue;
      }
      const hit = capture.refList.find((ref) => resolvedSet.has(normalizeMenuKey(ref)));
      if (!hit) {
        continue;
      }
      recordDismissal(key, normalizeMenuKey(hit));
      this.armedOtherCaptures.delete(key);
    }
    return [...dismissalsByKey.values()];
  }

  private forgetPresenterMenu(menuKey: string): void {
    for (const [ref, presenterKeys] of [...this.presentersByRef.entries()]) {
      if (!presenterKeys.delete(menuKey)) {
        continue;
      }
      if (presenterKeys.size === 0) {
        this.presentersByRef.delete(ref);
      }
    }
  }

  private forgetPresenterEntry(menuKey: string, ref: string): void {
    const presenterKeys = this.presentersByRef.get(ref);
    if (!presenterKeys) {
      return;
    }
    presenterKeys.delete(menuKey);
    if (presenterKeys.size === 0) {
      this.presentersByRef.delete(ref);
    }
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
        this.clearPendingMenu(menuKey);
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
   * When the reference belongs to a coalescing group, the decision targets
   * the group leader: deny and scoped approvals (session/always) propagate to
   * every follower, while 'once' resolves only the leader and re-prompts the
   * remaining followers. The gateway call is best-effort: an unexpected
   * failure is converted into the not-found receipt so the channel always
   * receives exactly one reply instead of a swallowed error. Surfaces whose
   * resolved presentation is 'none' receive no receipt text at all.
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

    const group = this.findLiveCoalescedGroupByRef(command.ref);
    const followerGroup = group && command.ref !== group.leaderRef ? group : null;
    if (followerGroup) {
      return this.executeDirectFollowerDecision(input, command, presentation, followerGroup);
    }

    const targetRef = group ? group.leaderRef : command.ref;
    if (command.action === 'deny') {
      const rejected = await this.gatewayPort.reject(targetRef).catch(() => null);
      if (group) {
        for (const follower of group.followers) {
          await this.gatewayPort.reject(follower.ref).catch(() => null);
        }
        this.removeCoalescedGroup(group);
      }
      return renderApprovalDecisionReceiptForSurface(
        presentation,
        {
          action: 'deny',
          ref: targetRef,
          found: Boolean(rejected),
        },
        locale,
      );
    }

    const approved = await this.gatewayPort
      .approve(targetRef, {
        choice: command.choice,
        surface: input.surface,
        sessionId: input.sessionId,
      })
      .catch(() => null);
    let rePrompt: string | null = null;
    if (group) {
      if (command.choice === 'once') {
        rePrompt = this.buildFollowerReprompt(group, presentation, locale);
      } else {
        for (const follower of group.followers) {
          await this.gatewayPort
            .approve(follower.ref, {
              choice: command.choice,
              surface: input.surface,
              sessionId: input.sessionId,
            })
            .catch(() => null);
        }
      }
      this.removeCoalescedGroup(group);
    }
    const receipt = renderApprovalDecisionReceiptForSurface(
      presentation,
      {
        action: 'approve',
        ref: targetRef,
        choice: command.choice,
        found: Boolean(approved),
      },
      locale,
    );
    if (receipt && rePrompt) {
      return `${receipt}\n${rePrompt}`;
    }
    return receipt ?? rePrompt;
  }

  /**
   * Resolves a follower directly (its own ref was used as the decision
   * reference). The follower only detaches from its group; the leader and any
   * remaining followers keep their independent pending state.
   */
  private async executeDirectFollowerDecision(
    input: { command: ChannelMeshApprovalCommand; surface: string; sessionId: string; locale?: string | null },
    command: ChannelMeshApprovalCommand,
    presentation: ReturnType<typeof resolveSurfaceCapabilityPresentation>,
    group: CoalescedApprovalGroup,
  ): Promise<string | null> {
    group.followers = group.followers.filter((follower) => follower.ref !== command.ref);
    this.coalescedGroupsByRef.delete(command.ref);
    if (command.action === 'deny') {
      const rejected = await this.gatewayPort.reject(command.ref).catch(() => null);
      return renderApprovalDecisionReceiptForSurface(
        presentation,
        { action: 'deny', ref: command.ref, found: Boolean(rejected) },
        input.locale ?? null,
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
      input.locale ?? null,
    );
  }

  /**
   * Re-prompt rendered after a 'once' approval consumed only the leader of a
   * coalescing group: the followers stay pending and are listed again so the
   * operator decides each one explicitly.
   */
  private buildFollowerReprompt(
    group: CoalescedApprovalGroup,
    presentation: ReturnType<typeof resolveSurfaceCapabilityPresentation>,
    locale: string | null,
  ): string | null {
    if (group.followers.length === 0 || presentation.mode === 'none') {
      return null;
    }
    return renderApprovalPromptForSurface(
      presentation,
      group.followers.map((follower) => ({
        label: follower.label,
        risk: group.risk,
        ref: follower.ref,
      })),
      locale,
    );
  }

  private findLiveCoalescedGroupByRef(ref: string): CoalescedApprovalGroup | null {
    const group = this.coalescedGroupsByRef.get(normalizeMenuKey(ref));
    if (!group) {
      return null;
    }
    if (!this.isLiveCoalescedGroup(group)) {
      this.removeCoalescedGroup(group);
      return null;
    }
    return group;
  }

  private isLiveCoalescedGroup(group: CoalescedApprovalGroup): boolean {
    if (this.nowMs() - group.registeredAtMs >= APPROVAL_MENU_TIMEOUT_MS) {
      return false;
    }
    // A resolved or vanished leader stops representing the group: later
    // identical requests must register as fresh leaders, not silent followers.
    return this.gatewayPort.findPendingApproval(group.leaderRef) !== null;
  }

  private removeCoalescedGroup(group: CoalescedApprovalGroup): void {
    this.coalescedGroupsByIdentity.delete(group.identityKey);
    this.coalescedGroupsByRef.delete(group.leaderRef);
    for (const follower of group.followers) {
      this.coalescedGroupsByRef.delete(follower.ref);
    }
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
      this.clearPendingMenu(key);
      return [];
    }
    return menu.refs;
  }
}
