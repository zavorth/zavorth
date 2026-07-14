import { config } from '../config/index.js';
import { CodexRemoteProfileRegistryService } from './CodexRemoteProfileRegistryService.js';
import {
  CodexRemoteSessionStoreService,
  type CodexRemoteSessionRecord,
} from './CodexRemoteSessionStoreService.js';
import {
  CodexRemoteSidecarService,
  type CodexRemoteSessionTailSnapshot,
} from './CodexRemoteSidecarService.js';
import {
  GatewaySessionStoreService,
  type GatewaySessionSpawnSnapshot,
} from './GatewaySessionStoreService.js';


type CodexRemoteSessionBrokerRuntime = {
  now?: () => Date;
  profileRegistryService?: Pick<CodexRemoteProfileRegistryService, 'resolveExecutionProfile' | 'buildSnapshot'>;
  sessionStoreService?: Pick<
    CodexRemoteSessionStoreService,
    'listSessions' | 'getSession' | 'createSession' | 'updateSession' | 'appendEvent'
  >;
  sidecarService?: Pick<
    CodexRemoteSidecarService,
    'startSession' | 'stopSession' | 'readTail' | 'ensureSessionFresh'
  >;
  gatewaySessionStoreService?: Pick<GatewaySessionStoreService, 'createSession' | 'canSpawn'>;
};

export type CodexRemoteBrokerSessionDetail = {
  record: CodexRemoteSessionRecord;
  tail: CodexRemoteSessionTailSnapshot;
  operatorSummary: string;
  canResume: boolean;
  canStop: boolean;
  canOpenWeb: boolean;
  presence: {
    alive: boolean;
    processId: number | null;
    runtimeSeconds: number | null;
    lastHeartbeatAt: string | null;
    heartbeatAgeMs: number | null;
    observedAt: string;
    stale: boolean;
    state: 'draft' | 'running' | 'stale' | 'stopped' | 'completed' | 'failed' | 'lost';
  };
  guardrails: {
    timeoutSeconds: number | null;
    remainingSeconds: number | null;
    deadlineAt: string | null;
    staleAfterMs: number;
    state: 'inactive' | 'healthy' | 'near-timeout' | 'timed-out' | 'stale';
    summary: string;
  };
  visibility: {
    mode: 'full-user-visible';
    pendingApprovals: number;
    approvalBridge: 'visible-when-present';
    note: string;
  };
};

type RuntimePresenceMetadata = {
  state?: string;
  alive?: boolean;
  pid?: number | null;
  runtimeSeconds?: number | null;
  heartbeatAgeMs?: number | null;
  lastHeartbeatAt?: string | null;
  stale?: boolean;
  observedAt?: string;
};

type RuntimeGuardrailMetadata = {
  timeoutSeconds?: number | null;
  remainingSeconds?: number | null;
  deadlineAt?: string | null;
  staleAfterMs?: number;
  state?: string;
  summary?: string;
};

export class CodexRemoteSessionBrokerService {
  private readonly now: () => Date;
  private readonly profiles: Pick<CodexRemoteProfileRegistryService, 'resolveExecutionProfile' | 'buildSnapshot'>;
  private readonly sessions: Pick<
    CodexRemoteSessionStoreService,
    'listSessions' | 'getSession' | 'createSession' | 'updateSession' | 'appendEvent'
  >;
  private readonly sidecar: Pick<
    CodexRemoteSidecarService,
    'startSession' | 'stopSession' | 'readTail' | 'ensureSessionFresh'
  >;
  private readonly gatewaySessions: Pick<GatewaySessionStoreService, 'createSession' | 'canSpawn'>;

  constructor(runtime: CodexRemoteSessionBrokerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.profiles = runtime.profileRegistryService || new CodexRemoteProfileRegistryService();
    this.sessions = runtime.sessionStoreService || new CodexRemoteSessionStoreService();
    this.sidecar = runtime.sidecarService || new CodexRemoteSidecarService();
    this.gatewaySessions = runtime.gatewaySessionStoreService || new GatewaySessionStoreService();
  }

  public listSessions(): CodexRemoteSessionRecord[] {
    return this.sessions.listSessions();
  }

  public async readSession(sessionId: string): Promise<CodexRemoteBrokerSessionDetail | null> {
    const normalized = String(sessionId || '').trim();
    if (!normalized) {
      return null;
    }
    const existing = this.sessions.getSession(normalized);
    if (!existing) {
      return null;
    }
    const record = await this.sidecar.ensureSessionFresh(normalized);
    const tail = await this.sidecar.readTail(normalized);
    return {
      record,
      tail,
      operatorSummary: this.buildOperatorSummary(record, tail),
      canResume: record.status !== 'running',
      canStop: record.status === 'running',
      canOpenWeb: this.gatewaySessions.canSpawn('web'),
      presence: this.buildPresence(record),
      guardrails: this.buildGuardrails(record),
      visibility: this.buildVisibility(record),
    };
  }

  public async startSession(input: {
    prompt: string;
    title?: string | null;
    profileId?: string | null;
    workspaceRoot?: string | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
    sourceChatId?: string | null;
  }): Promise<CodexRemoteBrokerSessionDetail> {
    const prompt = String(input.prompt || '').trim();
    if (!prompt) {
      throw new Error('Codex Remote start requires a prompt.');
    }
    const profile = this.profiles.resolveExecutionProfile(input.profileId);
    const session = this.sessions.createSession({
      title: input.title,
      prompt,
      profileId: profile.id,
      workspaceRoot: String(input.workspaceRoot || profile.workspaceRoot || config.defaultWorkspace).trim() || config.defaultWorkspace,
      requestedBy: String(input.requestedBy || '').trim() || 'unknown',
      sourceSurface: input.sourceSurface,
      sourceChatId: input.sourceChatId,
      metadata: {
        profileLabel: profile.label,
      },
      maxRuntimeSeconds: config.codexRemoteSessionTimeoutSeconds,
    });
    await this.sidecar.startSession({
      sessionId: session.sessionId,
      requestedBy: input.requestedBy,
    });
    return (await this.readSession(session.sessionId)) as CodexRemoteBrokerSessionDetail;
  }

  public async resumeSession(input: {
    sessionId: string;
    prompt?: string | null;
    requestedBy?: string | null;
  }): Promise<CodexRemoteBrokerSessionDetail> {
    const current = this.sessions.getSession(String(input.sessionId || '').trim());
    if (!current) {
      throw new Error(`Sessao Codex Remote nao encontrada: ${input.sessionId}.`);
    }
    const nextPrompt = String(input.prompt || '').trim();
    if (nextPrompt) {
      this.sessions.updateSession(current.sessionId, {
        prompt: nextPrompt,
      });
      this.sessions.appendEvent(current.sessionId, {
        type: 'note',
        message: 'Prompt atualizado antes da retomada.',
      });
    }
    await this.sidecar.startSession({
      sessionId: current.sessionId,
      prompt: nextPrompt || null,
      requestedBy: input.requestedBy,
    });
    return (await this.readSession(current.sessionId)) as CodexRemoteBrokerSessionDetail;
  }

  public async stopSession(sessionId: string): Promise<CodexRemoteBrokerSessionDetail> {
    const record = await this.sidecar.stopSession(sessionId);
    const detail = await this.readSession(record.sessionId);
    return detail as CodexRemoteBrokerSessionDetail;
  }

  public openWebSession(input: {
    sessionId: string;
    runtimeUserId: string;
  }): GatewaySessionSpawnSnapshot {
    const current = this.sessions.getSession(String(input.sessionId || '').trim());
    if (!current) {
      throw new Error(`Sessao Codex Remote nao encontrada: ${input.sessionId}.`);
    }
    if (!this.gatewaySessions.canSpawn('web')) {
      throw new Error('O runtime atual nao pode abrir sessoes web para o Codex Remote.');
    }
    const spawnedSession = this.gatewaySessions.createSession({
      userId: String(input.runtimeUserId || '').trim() || 'web',
      platform: 'web',
    });
    this.sessions.updateSession(current.sessionId, {
      handoffWebSessionId: spawnedSession.sessionId,
      handoffCommand: spawnedSession.handoffCommand,
    });
    this.sessions.appendEvent(current.sessionId, {
      type: 'attached',
      message: `Handoff web preparado em ${spawnedSession.sessionId}.`,
    });
    return spawnedSession;
  }

  public attachSpawnedWebSession(input: {
    sessionId: string;
    spawnedSession: GatewaySessionSpawnSnapshot;
  }): GatewaySessionSpawnSnapshot {
    const current = this.sessions.getSession(String(input.sessionId || '').trim());
    if (!current) {
      throw new Error(`Sessao Codex Remote nao encontrada: ${input.sessionId}.`);
    }
    const spawnedSession = input.spawnedSession;
    this.sessions.updateSession(current.sessionId, {
      handoffWebSessionId: spawnedSession.sessionId,
      handoffCommand: spawnedSession.handoffCommand,
    });
    this.sessions.appendEvent(current.sessionId, {
      type: 'attached',
      message: `Handoff web preparado em ${spawnedSession.sessionId}.`,
    });
    return spawnedSession;
  }

  private buildOperatorSummary(
    record: CodexRemoteSessionRecord,
    tail: CodexRemoteSessionTailSnapshot,
  ): string {
    const profile = this.profiles.resolveExecutionProfile(record.profileId);
    const lastSignal = tail.lastOutput || tail.lastError || tail.logLines.slice(-1)[0] || 'Sem saida recente.';
    const presence = this.buildPresence(record);
    const guardrails = this.buildGuardrails(record);
    return [
      `${record.title} (${record.sessionId})`,
      `Status: ${record.status} via perfil ${profile.label}.`,
      `Workspace: ${record.workspaceRoot}.`,
      presence.runtimeSeconds !== null ? `Runtime: ${presence.runtimeSeconds}s.` : 'Runtime: n/d.',
      `Heartbeat: ${presence.state}.`,
      guardrails.summary ? `Guardrail: ${guardrails.summary}` : 'Guardrail: n/d.',
      `Ultimo sinal: ${lastSignal}`,
    ].join(' ');
  }

  private buildPresence(record: CodexRemoteSessionRecord): CodexRemoteBrokerSessionDetail['presence'] {
    const now = this.now().getTime();
    const metadata = this.readRuntimeMetadata(record.metadata);
    const startedAt = record.startedAt ? Date.parse(record.startedAt) : NaN;
    const heartbeatAt = record.lastHeartbeatAt ? Date.parse(record.lastHeartbeatAt) : NaN;
    const runtimeSeconds = Number.isFinite(startedAt) ? Math.max(0, Math.round((now - startedAt) / 1000)) : null;
    const heartbeatAgeMs = Number.isFinite(heartbeatAt) ? Math.max(0, now - heartbeatAt) : null;
    const stale = record.status === 'running'
      && heartbeatAgeMs !== null
      && heartbeatAgeMs >= config.codexRemoteSessionStaleMs;
    const state = this.normalizePresenceState(
      metadata.presence?.state,
      record.status,
      stale,
    );
    return {
      alive: metadata.presence?.alive ?? (record.status === 'running' && Boolean(record.pid)),
      processId: metadata.presence?.pid ?? record.pid ?? null,
      runtimeSeconds: metadata.presence?.runtimeSeconds ?? runtimeSeconds,
      lastHeartbeatAt: metadata.presence?.lastHeartbeatAt || record.lastHeartbeatAt,
      heartbeatAgeMs: metadata.presence?.heartbeatAgeMs ?? heartbeatAgeMs,
      observedAt: metadata.presence?.observedAt || new Date(now).toISOString(),
      stale: metadata.presence?.stale ?? stale,
      state,
    };
  }

  private buildGuardrails(record: CodexRemoteSessionRecord): CodexRemoteBrokerSessionDetail['guardrails'] {
    const metadata = this.readRuntimeMetadata(record.metadata);
    const presence = this.buildPresence(record);
    const timeoutSeconds = metadata.guardrails?.timeoutSeconds
      ?? (typeof record.maxRuntimeSeconds === 'number' && Number.isFinite(record.maxRuntimeSeconds)
        ? Math.max(1, Math.trunc(record.maxRuntimeSeconds))
        : null);
    const deadlineAt = metadata.guardrails?.deadlineAt
      || (record.startedAt && timeoutSeconds
        ? new Date(Date.parse(record.startedAt) + timeoutSeconds * 1000).toISOString()
        : null);
    const remainingSeconds = metadata.guardrails?.remainingSeconds
      ?? (timeoutSeconds !== null && presence.runtimeSeconds !== null
        ? Math.max(0, timeoutSeconds - presence.runtimeSeconds)
        : null);
    const state = this.normalizeGuardrailState(
      metadata.guardrails?.state,
      record.status,
      presence,
      timeoutSeconds,
      remainingSeconds,
    );
    const summary = metadata.guardrails?.summary || this.buildGuardrailSummary(state, timeoutSeconds, remainingSeconds, presence);
    return {
      timeoutSeconds,
      remainingSeconds,
      deadlineAt,
      staleAfterMs: metadata.guardrails?.staleAfterMs || config.codexRemoteSessionStaleMs,
      state,
      summary,
    };
  }

  private buildVisibility(record: CodexRemoteSessionRecord): CodexRemoteBrokerSessionDetail['visibility'] {
    const pendingApprovals = record.events.filter((event) => event.type === 'approval-required').length;
    return {
      mode: 'full-user-visible',
      pendingApprovals,
      approvalBridge: 'visible-when-present',
      note: pendingApprovals > 0
        ? 'Existem pedidos de aprovacao pendentes e eles devem aparecer ao operador nesta mesma surface.'
        : 'Sem aprovacoes ocultas: qualquer pedido sensivel deve aparecer ao operador na mesma surface.',
    };
  }

  private readRuntimeMetadata(metadata: Record<string, any> | null | undefined): {
    presence: RuntimePresenceMetadata | null;
    guardrails: RuntimeGuardrailMetadata | null;
  } {
    const current = metadata && typeof metadata === 'object' ? metadata : {};
    return {
      presence: current.codexRemotePresence && typeof current.codexRemotePresence === 'object'
        ? current.codexRemotePresence as RuntimePresenceMetadata
        : null,
      guardrails: current.codexRemoteGuardrails && typeof current.codexRemoteGuardrails === 'object'
        ? current.codexRemoteGuardrails as RuntimeGuardrailMetadata
        : null,
    };
  }

  private normalizePresenceState(
    metadataState: string | undefined,
    sessionState: CodexRemoteSessionRecord['status'],
    stale: boolean,
  ): CodexRemoteBrokerSessionDetail['presence']['state'] {
    if (metadataState === 'running' || metadataState === 'stale' || metadataState === 'stopped' || metadataState === 'completed' || metadataState === 'failed' || metadataState === 'lost' || metadataState === 'draft') {
      return metadataState;
    }
    if (sessionState === 'running') {
      return stale ? 'stale' : 'running';
    }
    if (sessionState === 'completed') {
      return 'completed';
    }
    if (sessionState === 'failed') {
      return 'failed';
    }
    if (sessionState === 'stopped') {
      return 'stopped';
    }
    return 'draft';
  }

  private normalizeGuardrailState(
    metadataState: string | undefined,
    sessionState: CodexRemoteSessionRecord['status'],
    presence: CodexRemoteBrokerSessionDetail['presence'],
    timeoutSeconds: number | null,
    remainingSeconds: number | null,
  ): CodexRemoteBrokerSessionDetail['guardrails']['state'] {
    if (metadataState === 'inactive' || metadataState === 'healthy' || metadataState === 'near-timeout' || metadataState === 'timed-out' || metadataState === 'stale') {
      return metadataState;
    }
    if (sessionState !== 'running') {
      return 'inactive';
    }
    if (presence.stale) {
      return 'stale';
    }
    if (!timeoutSeconds || remainingSeconds === null) {
      return 'healthy';
    }
    if (remainingSeconds <= 0) {
      return 'timed-out';
    }
    return remainingSeconds <= 60 ? 'near-timeout' : 'healthy';
  }

  private buildGuardrailSummary(
    state: CodexRemoteBrokerSessionDetail['guardrails']['state'],
    timeoutSeconds: number | null,
    remainingSeconds: number | null,
    presence: CodexRemoteBrokerSessionDetail['presence'],
  ): string {
    if (state === 'inactive') {
      return timeoutSeconds
        ? `Guardrail inactive; limite de ${timeoutSeconds}s.`
        : 'Guardrail inativo; sem timeout configurado.';
    }
    if (state === 'stale') {
      const ageSeconds = presence.heartbeatAgeMs !== null ? Math.round(presence.heartbeatAgeMs / 1000) : null;
      return ageSeconds !== null
        ? `Heartbeat stale ha ${ageSeconds}s.`
        : 'Heartbeat stale.';
    }
    if (state === 'timed-out') {
      return timeoutSeconds
        ? `Tempo esgotado apos ${timeoutSeconds}s.`
        : 'Tempo esgotado.';
    }
    if (state === 'near-timeout') {
      return timeoutSeconds !== null && remainingSeconds !== null
        ? `Guardrail perto do limite; faltam ${remainingSeconds}s de ${timeoutSeconds}s.`
        : 'Guardrail perto do limite.';
    }
    return timeoutSeconds !== null && remainingSeconds !== null
      ? `Guardrail saudavel; faltam ${remainingSeconds}s de ${timeoutSeconds}s.`
      : 'Guardrail saudavel; sem timeout configurado.';
  }
}
