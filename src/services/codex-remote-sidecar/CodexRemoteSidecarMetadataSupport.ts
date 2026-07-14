import { config } from '../../config/index.js';
import type { CodexRemoteSessionRecord } from '../CodexRemoteSessionStoreService.js';

type CodexRemoteMetadataSessionShape = Pick<
  CodexRemoteSessionRecord,
  'status' | 'startedAt' | 'finishedAt' | 'lastHeartbeatAt' | 'pid' | 'maxRuntimeSeconds'
>;

export type CodexRemoteRuntimePresenceMetadata = {
  state: 'draft' | 'running' | 'stale' | 'stopped' | 'completed' | 'failed' | 'timed-out' | 'lost';
  alive: boolean;
  pid: number | null;
  runtimeSeconds: number | null;
  heartbeatAgeMs: number | null;
  lastHeartbeatAt: string | null;
  stale: boolean;
  observedAt: string;
};

export type CodexRemoteRuntimeGuardrailMetadata = {
  timeoutSeconds: number | null;
  remainingSeconds: number | null;
  deadlineAt: string | null;
  staleAfterMs: number;
  state: 'inactive' | 'healthy' | 'near-timeout' | 'timed-out' | 'stale';
  summary: string;
};

export class CodexRemoteSidecarMetadataSupport {
  constructor(private readonly now: () => Date) {}

  public buildRuntimeMetadata(
    session: CodexRemoteMetadataSessionShape,
    observedAt = this.now().toISOString(),
    presenceStateOverride?: CodexRemoteRuntimePresenceMetadata['state'],
    guardrailStateOverride?: CodexRemoteRuntimeGuardrailMetadata['state'],
  ): {
    presence: CodexRemoteRuntimePresenceMetadata;
    guardrails: CodexRemoteRuntimeGuardrailMetadata;
  } {
    const presence = this.buildPresenceMetadata(session, observedAt, presenceStateOverride);
    const guardrails = this.buildGuardrailMetadata(session, observedAt, guardrailStateOverride, presence);
    return { presence, guardrails };
  }

  public buildPresenceMetadata(
    session: CodexRemoteMetadataSessionShape,
    observedAt = this.now().toISOString(),
    stateOverride?: CodexRemoteRuntimePresenceMetadata['state'],
  ): CodexRemoteRuntimePresenceMetadata {
    const startedAt = session.startedAt ? Date.parse(session.startedAt) : Number.NaN;
    const heartbeatAt = session.lastHeartbeatAt ? Date.parse(session.lastHeartbeatAt) : Number.NaN;
    const runtimeSeconds = Number.isFinite(startedAt)
      ? Math.max(0, Math.round((Date.parse(observedAt) - startedAt) / 1000))
      : null;
    const heartbeatAgeMs = Number.isFinite(heartbeatAt)
      ? Math.max(0, Date.parse(observedAt) - heartbeatAt)
      : null;
    const stale = session.status === 'running'
      && heartbeatAgeMs !== null
      && heartbeatAgeMs >= config.codexRemoteSessionStaleMs;
    const derivedState = stateOverride
      || (session.status === 'running'
        ? stale
          ? 'stale'
          : 'running'
        : session.status === 'completed'
          ? 'completed'
          : session.status === 'failed'
            ? 'failed'
            : session.status === 'stopped'
              ? 'stopped'
              : 'draft');

    return {
      state: derivedState,
      alive: session.status === 'running' && Boolean(session.pid),
      pid: session.pid || null,
      runtimeSeconds,
      heartbeatAgeMs,
      lastHeartbeatAt: session.lastHeartbeatAt || null,
      stale,
      observedAt,
    };
  }

  public buildGuardrailMetadata(
    session: CodexRemoteMetadataSessionShape,
    observedAt = this.now().toISOString(),
    stateOverride?: CodexRemoteRuntimeGuardrailMetadata['state'],
    presenceOverride?: CodexRemoteRuntimePresenceMetadata,
  ): CodexRemoteRuntimeGuardrailMetadata {
    const presence = presenceOverride || this.buildPresenceMetadata({
      status: session.status,
      startedAt: session.startedAt,
      finishedAt: null,
      lastHeartbeatAt: session.lastHeartbeatAt,
      pid: null,
      maxRuntimeSeconds: session.maxRuntimeSeconds,
    }, observedAt);
    const timeoutSeconds =
      typeof session.maxRuntimeSeconds === 'number' && Number.isFinite(session.maxRuntimeSeconds)
        ? Math.max(1, Math.trunc(session.maxRuntimeSeconds))
        : null;
    const deadlineAt = session.startedAt && timeoutSeconds
      ? new Date(Date.parse(session.startedAt) + timeoutSeconds * 1000).toISOString()
      : null;
    const state = stateOverride
      || (session.status !== 'running'
        ? 'inactive'
        : presence.stale
          ? 'stale'
          : !timeoutSeconds || presence.runtimeSeconds === null
            ? 'healthy'
            : Math.max(0, timeoutSeconds - presence.runtimeSeconds) <= 0
              ? 'timed-out'
              : Math.max(0, timeoutSeconds - presence.runtimeSeconds) <= 60
                ? 'near-timeout'
                : 'healthy');
    const remainingSeconds = !timeoutSeconds || presence.runtimeSeconds === null
      ? null
      : Math.max(0, timeoutSeconds - presence.runtimeSeconds);

    let summary = '';
    if (state === 'inactive') {
      summary = timeoutSeconds
        ? `Guardrail inactive; limite de ${timeoutSeconds}s.`
        : 'Guardrail inativo; sem limite de runtime configurado.';
    } else if (state === 'stale') {
      summary = `Heartbeat stale ha ${Math.round((presence.heartbeatAgeMs || 0) / 1000)}s; a sessao ainda responde.`;
    } else if (state === 'timed-out') {
      summary = timeoutSeconds
        ? `Tempo esgotado apos ${timeoutSeconds}s.`
        : 'Tempo esgotado.';
    } else if (state === 'near-timeout') {
      summary = timeoutSeconds && remainingSeconds !== null
        ? `Guardrail perto do limite; faltam ${remainingSeconds}s de ${timeoutSeconds}s.`
        : 'Guardrail perto do limite.';
    } else {
      summary = timeoutSeconds && remainingSeconds !== null
        ? `Guardrail saudavel; faltam ${remainingSeconds}s de ${timeoutSeconds}s.`
        : 'Guardrail saudavel; sem timeout configurado.';
    }

    return {
      timeoutSeconds,
      remainingSeconds: state === 'inactive' ? null : remainingSeconds,
      deadlineAt,
      staleAfterMs: config.codexRemoteSessionStaleMs,
      state,
      summary,
    };
  }

  public buildNotificationMetadata(metadata: Record<string, any>): Record<string, any> {
    const current = metadata && typeof metadata === 'object' ? metadata : {};
    const currentNotifications = current.codexRemoteNotifications;
    return currentNotifications && typeof currentNotifications === 'object'
      ? { ...currentNotifications }
      : {};
  }

  public shouldNotifyStaleSession(session: CodexRemoteSessionRecord): boolean {
    const notifications = this.buildNotificationMetadata(session.metadata);
    return notifications.lastStaleHeartbeatAt !== session.lastHeartbeatAt;
  }

  public buildStaleSummary(
    session: CodexRemoteSessionRecord,
    presence?: CodexRemoteRuntimePresenceMetadata,
  ): string {
    const snapshot = presence || this.buildPresenceMetadata(session);
    const heartbeatAgeSeconds = snapshot.heartbeatAgeMs !== null
      ? Math.round(snapshot.heartbeatAgeMs / 1000)
      : null;
    const guardrail = this.buildGuardrailMetadata(session, this.now().toISOString(), undefined, snapshot);

    return [
      heartbeatAgeSeconds !== null ? `Heartbeat stale ha ${heartbeatAgeSeconds}s.` : 'Heartbeat stale.',
      guardrail.summary,
    ].join(' ');
  }
}
