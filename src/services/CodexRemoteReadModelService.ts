import { config } from '../config/index.js';
import { CodexRemoteProfileRegistryService } from './CodexRemoteProfileRegistryService.js';
import { PermissionService } from './PermissionService.js';
import {
  CodexRemoteSessionBrokerService,
  type CodexRemoteBrokerSessionDetail,
} from './CodexRemoteSessionBrokerService.js';
import type { CodexRemoteSessionRecord } from './CodexRemoteSessionStoreService.js';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';

type CodexRemoteReadModelRuntime = {
  now?: () => Date;
  profileRegistryService?: Pick<CodexRemoteProfileRegistryService, 'buildSnapshot' | 'resolveExecutionProfile'>;
  permissionService?: Pick<PermissionService, 'listRequests'>;
  sessionBrokerService?: Pick<
    CodexRemoteSessionBrokerService,
    'listSessions' | 'readSession'
  >;
};

export type CodexRemoteReadModelSnapshot = {
  generatedAt: string;
  summary: {
    totalSessions: number;
    runningSessions: number;
    completedSessions: number;
    failedSessions: number;
    stoppedSessions: number;
    activeProfileId: string;
    enabledProfiles: number;
    webAttachReady: boolean;
    pendingApprovals: number;
    visibilityMode: 'full-user-visible';
    staleRunningSessions: number;
  };
  sessions: Array<{
    sessionId: string;
    title: string;
    status: string;
    profileId: string;
    profileLabel: string;
    updatedAt: string;
    runCount: number;
    operatorSummary: string;
    handoffCommand: string | null;
    presenceState: string;
    guardrailState: string;
    guardrailSummary: string;
    heartbeatAgeMs: number | null;
    actions: string[];
  }>;
  selected: CodexRemoteBrokerSessionDetail | null;
  approvals: Array<{
    permissionId: string;
    kind: string;
    reason: string;
    requestedBy: string | null;
    createdAt: string;
    actionId: string | null;
    sessionId: string | null;
    profileId: string | null;
  }>;
  visibility: {
    mode: 'full-user-visible';
    pendingApprovals: number;
    hiddenApprovals: number;
    note: string;
  };
  commands: Array<{
    command: string;
    description: string;
  }>;
  telegramSummary: string;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

type RuntimePresence = {
  state?: string;
  stale?: boolean;
  heartbeatAgeMs?: number | null;
};

type RuntimeGuardrail = {
  state?: string;
  summary?: string;
  timeoutSeconds?: number | null;
  remainingSeconds?: number | null;
};

export class CodexRemoteReadModelService {
  private readonly now: () => Date;
  private readonly profiles: Pick<CodexRemoteProfileRegistryService, 'buildSnapshot' | 'resolveExecutionProfile'>;
  private readonly permissions: Pick<PermissionService, 'listRequests'>;
  private readonly broker: Pick<CodexRemoteSessionBrokerService, 'listSessions' | 'readSession'>;

  constructor(runtime: CodexRemoteReadModelRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.profiles = runtime.profileRegistryService || new CodexRemoteProfileRegistryService();
    this.permissions = runtime.permissionService || new PermissionService();
    this.broker = runtime.sessionBrokerService || new CodexRemoteSessionBrokerService();
  }

  public async buildSnapshot(input: {
    selectedSessionId?: string | null;
  } = {}): Promise<CodexRemoteReadModelSnapshot> {
    const profileSnapshot = this.profiles.buildSnapshot();
    const sessions = this.broker.listSessions();
    const selectedId = String(input.selectedSessionId || '').trim() || sessions[0]?.sessionId || null;
    const selected = selectedId ? await this.broker.readSession(selectedId) : null;
    const enabledProfiles = profileSnapshot.profiles.filter((profile) => profile.enabled).length;
    const approvals = (await this.permissions.listRequests('pending', 100))
      .filter((permission) => permission.executor === 'codex_remote')
      .slice(0, 12)
      .map((permission) => this.serializeApproval(permission));

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        totalSessions: sessions.length,
        runningSessions: sessions.filter((session) => session.status === 'running').length,
        completedSessions: sessions.filter((session) => session.status === 'completed').length,
        failedSessions: sessions.filter((session) => session.status === 'failed').length,
        stoppedSessions: sessions.filter((session) => session.status === 'stopped').length,
        activeProfileId: profileSnapshot.activeProfileId,
        enabledProfiles,
        webAttachReady: Boolean(selected?.canOpenWeb),
        pendingApprovals: selected?.visibility.pendingApprovals || 0,
        visibilityMode: 'full-user-visible',
        staleRunningSessions: sessions.filter((session) => this.isSessionStale(session)).length,
      },
      sessions: sessions.slice(0, 12).map((session) => this.serializeSession(session)),
      selected,
      approvals,
      visibility: {
        mode: 'full-user-visible',
        pendingApprovals: approvals.length,
        hiddenApprovals: 0,
        note: selected?.visibility.note
          || 'no hidden approvals: Codex Remote must expose sensitive requests and events to the operator.',
      },
      commands: this.buildCommands(),
      telegramSummary: this.composeTelegramSummary(),
      narrative: {
        headline: `Codex Remote tracks ${sessions.length} session(s) no broker local.`,
        operatorSummary: sessions.length > 0
          ? `${sessions.filter((session) => session.status === 'running').length} running, ${approvals.length} pending approval(s) e profile active ${profileSnapshot.activeProfileId}.`
          : `No active session. Current profile: ${profileSnapshot.activeProfileId}.`,
      },
    };
  }

  public buildTelegramSummary(): string {
    return this.composeTelegramSummary();
  }

  private serializeSession(session: CodexRemoteSessionRecord): CodexRemoteReadModelSnapshot['sessions'][number] {
    const profile = this.profiles.resolveExecutionProfile(session.profileId);
    const runtimeMetadata = this.readRuntimeMetadata(session);
    const presenceState = this.normalizePresenceState(
      runtimeMetadata.presence?.state,
      session.status,
      Boolean(runtimeMetadata.presence?.stale),
    );
    const guardrailState = this.normalizeGuardrailState(
      runtimeMetadata.guardrails?.state,
      session.status,
      Boolean(runtimeMetadata.presence?.stale),
    );
    const guardrailSummary = runtimeMetadata.guardrails?.summary
      || this.buildGuardrailSummary(guardrailState, runtimeMetadata.guardrails?.timeoutSeconds, runtimeMetadata.guardrails?.remainingSeconds, runtimeMetadata.presence?.heartbeatAgeMs ?? null);
    const actions = ['inspect', 'tail'];
    if (session.status === 'running') {
      actions.push('stop');
    } else {
      actions.push('resume');
    }
    actions.push('web');

    return {
      sessionId: session.sessionId,
      title: session.title,
      status: session.status,
      profileId: session.profileId,
      profileLabel: profile.label,
      updatedAt: session.updatedAt,
      runCount: session.runCount,
      operatorSummary: session.lastOutput
        || session.lastError
        || session.events.slice(-1)[0]?.message
        || 'without evento recente.',
      handoffCommand: session.handoffCommand,
      presenceState,
      guardrailState,
      guardrailSummary,
      heartbeatAgeMs: runtimeMetadata.presence?.heartbeatAgeMs ?? null,
      actions,
    };
  }

  private buildCommands(): Array<{ command: string; description: string }> {
    return [
      { command: '/codexremote', description: 'Control plane, profiles, and sessions summary.' },
      { command: '/codexremote profiles', description: 'Lists available Codex Remote profiles.' },
      { command: '/codexremote profile <id>', description: 'Seleciona o profile active.' },
      { command: '/codexremote approvals', description: 'Lists pending Codex Remote approvals.' },
      { command: '/codexremote approve <permissionId>', description: 'Approves and executes the pending action.' },
      { command: '/codexremote reject <permissionId>', description: 'Rejeita a action pending.' },
      { command: '/codexremote start [title] -- <prompt>', description: 'Creates and starts a new session.' },
      { command: '/codexremote sessions', description: 'Lists sessions tracked by the broker.' },
      { command: '/codexremote inspect <sessionId>', description: 'Opens session details.' },
      { command: '/codexremote tail <sessionId>', description: 'Shows the recent execution tail.' },
      { command: '/codexremote resume <sessionId> [-- <prompt>]', description: 'Resumes the selected session.' },
      { command: '/codexremote stop <sessionId>', description: 'Stops a running session.' },
      { command: '/codexremote web <sessionId>', description: 'Prepares web handoff for the session.' },
    ];
  }

  private composeTelegramSummary(): string {
    return [
      'Codex Remote no Telegram',
      'Visibility: total for the operator; no hidden approvals.',
      '',
      '/codexremote',
      '/codexremote profiles',
      '/codexremote profile <id>',
      '/codexremote approvals',
      '/codexremote approve <permissionId>',
      '/codexremote reject <permissionId>',
      '/codexremote start [title] -- <prompt>',
      '/codexremote sessions',
      '/codexremote inspect <sessionId>',
      '/codexremote tail <sessionId>',
      '/codexremote resume <sessionId> [-- <prompt>]',
      '/codexremote stop <sessionId>',
      '/codexremote web <sessionId>',
    ].join('\n');
  }

  private serializeApproval(permission: PermissionRequest): CodexRemoteReadModelSnapshot['approvals'][number] {
    const metadata = permission.metadata || {};
    return {
      permissionId: permission.permission_id,
      kind: permission.kind,
      reason: permission.reason,
      requestedBy: permission.requested_by || null,
      createdAt: permission.created_at,
      actionId: String(metadata.action_id || '').trim() || null,
      sessionId: String(metadata.session_id || '').trim() || null,
      profileId: String(metadata.profile_id || '').trim() || null,
    };
  }

  private isSessionStale(session: CodexRemoteSessionRecord): boolean {
    const runtimeMetadata = this.readRuntimeMetadata(session);
    if (session.status !== 'running') {
      return false;
    }
    if (runtimeMetadata.presence?.stale) {
      return true;
    }
    if (!session.lastHeartbeatAt) {
      return false;
    }
    const heartbeatAt = Date.parse(session.lastHeartbeatAt);
    if (!Number.isFinite(heartbeatAt)) {
      return false;
    }
    return this.now().getTime() - heartbeatAt >= config.codexRemoteSessionStaleMs;
  }

  private readRuntimeMetadata(session: CodexRemoteSessionRecord): {
    presence: RuntimePresence | null;
    guardrails: RuntimeGuardrail | null;
  } {
    const metadata = session.metadata && typeof session.metadata === 'object' ? session.metadata : {};
    return {
      presence: metadata.codexRemotePresence && typeof metadata.codexRemotePresence === 'object'
        ? metadata.codexRemotePresence as RuntimePresence
        : null,
      guardrails: metadata.codexRemoteGuardrails && typeof metadata.codexRemoteGuardrails === 'object'
        ? metadata.codexRemoteGuardrails as RuntimeGuardrail
        : null,
    };
  }

  private normalizePresenceState(
    metadataState: string | undefined,
    sessionState: CodexRemoteSessionRecord['status'],
    stale: boolean,
  ): string {
    if (metadataState) {
      return metadataState;
    }
    if (sessionState === 'running') {
      return stale ? 'stale' : 'running';
    }
    return sessionState;
  }

  private normalizeGuardrailState(
    metadataState: string | undefined,
    sessionState: CodexRemoteSessionRecord['status'],
    stale: boolean,
  ): string {
    if (metadataState) {
      return metadataState;
    }
    if (sessionState !== 'running') {
      return 'inactive';
    }
    return stale ? 'stale' : 'healthy';
  }

  private buildGuardrailSummary(
    state: string,
    timeoutSeconds: number | null | undefined,
    remainingSeconds: number | null | undefined,
    heartbeatAgeMs: number | null,
  ): string {
    if (state === 'inactive') {
      return timeoutSeconds ? `Guardrail inactive; limite de ${timeoutSeconds}s.`
        : 'Guardrail inactive; without timeout configured.';
    }
    if (state === 'stale') {
      return heartbeatAgeMs !== null ? `Heartbeat stale ha ${Math.round(heartbeatAgeMs / 1000)}s.`
        : 'Heartbeat stale.';
    }
    if (state === 'timed-out') {
      return timeoutSeconds ? `Tempo esgotado after ${timeoutSeconds}s.`
        : 'Tempo esgotado.';
    }
    if (state === 'near-timeout') {
      return timeoutSeconds !== null && remainingSeconds !== null ? `Guardrail perto do limite; missing ${remainingSeconds}s de ${timeoutSeconds}s.`
        : 'Guardrail perto do limite.';
    }
    return timeoutSeconds !== null && remainingSeconds !== null ? `Guardrail healthy; ${remainingSeconds}s remaining out of ${timeoutSeconds}s.`
      : 'Guardrail healthy; no timeout configured.';
  }
}
