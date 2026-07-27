import { renderSessionCommandMarkdown } from './WebAppRuntimeSessionCommandMarkdown.js';
import { logger } from '../logger.js';
import { randomUUID } from 'crypto';
import * as http from 'http';
import type { GatewayCanonicalStatePayload } from '../contracts/GatewayContract.js';
import type {
  WebAppRuntimeRouteDeps,
} from '../domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';
import type {
  WebAppRuntimeSessionMutationHelpers,
} from './WebAppRuntimeSessionMutationService.js';

import { ZavorthProviderModelCatalogService } from './ZavorthProviderModelCatalogService.js';

type RuntimeRecord = Record<string, unknown>;

export type WebAppRuntimeSessionCommandInput = {
  command: string;
  sessionId?: string | null;
  args?: string | null;
  composerSettings?: RuntimeRecord | null;
  experienceProfile?: string | null;
  queueLength?: number | null;
  clientContext?: RuntimeRecord | null;
};

type WebAppRuntimeSessionCommandRuntime = {
  providerModelCatalog?: Pick<ZavorthProviderModelCatalogService, 'buildSnapshot'>;
};

export class WebAppRuntimeSessionCommandService {
  private readonly providerModelCatalog: Pick<ZavorthProviderModelCatalogService, 'buildSnapshot'>;

  constructor(runtime: WebAppRuntimeSessionCommandRuntime = {}) {
    this.providerModelCatalog = runtime.providerModelCatalog || new ZavorthProviderModelCatalogService();
  }

  public async handleCommand(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    commandHint: string,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeSessionMutationHelpers,
  ): Promise<boolean> {
    try {
      const url = new URL(req.url || 'http://localhost/', 'http://localhost');
      const body = this.recordOrNull(req.method === 'GET' ? {} : await deps.readJsonBody(req)) || {};
      const payload = await this.executeCanonicalCommand({
        command: String(body.command || url.searchParams.get('command') || commandHint || '').trim(),
        sessionId: String(body.sessionId || url.searchParams.get('sessionId') || '').trim(),
        args: String(body.args || body.message || url.searchParams.get('args') || '').trim(),
        composerSettings: this.recordOrNull(body.composerSettings),
        experienceProfile: String(body.experienceProfile || url.searchParams.get('experienceProfile') || '').trim(),
        queueLength: Number(body.queueLength || url.searchParams.get('queueLength') || 0) || 0,
        clientContext: this.recordOrNull(body.clientContext),
      }, deps, helpers);
      deps.writeJson(res, payload, 200);
    } catch (error: unknown) {logger.error('[WebAppRuntimeSessionCommandService] command failed', error);
      deps.writeJson(res, {
        ok: false,
        error: 'Failed to run comando de session.',
        rawSecretsSerialized: false,
      }, 500);
    }
    return true;
  }

  public async executeCanonicalCommand(
    input: WebAppRuntimeSessionCommandInput,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeSessionMutationHelpers,
  ): Promise<RuntimeRecord> {
    const command = this.normalizeCommand(input.command);
    if (!command) {
      throw new Error('Comando de session required.');
    }
    const args = String(input.args || '').trim();
    if (command === 'model') {
      this.validateModelCommandArgs(args);
    }
    const sessionId = String(input.sessionId || '').trim() || deps.realtime.createSession();
    deps.realtime.ensureSession(sessionId);

    let metadata: RuntimeRecord | null = null;
    if (command === 'model' && args && !['status', 'list', 'models'].includes(args.toLowerCase())) {
      metadata = this.patchModelRoute(sessionId, args, deps);
      await deps.realtime.captureBaseline(sessionId);
    }

    const canonicalState = await helpers.buildCanonicalStatePayload(sessionId, {
      includeSessionsList: false,
      historyMode: 'fast',
      sessionPlaneMode: 'summary',
      snapshotMode: 'resolved',
      includeMemoryRecall: false,
      includeGateway: false,
      includeApprovalPlane: true,
      includeCapabilityPlane: true,
      includeArtifactPlane: false,
      includeSelfmodPlane: false,
      includeResourcePlane: false,
      includeCompanionPlane: false,
      includeModeEscalation: true,
    });

    const commandResult = await this.buildCommandResult(command, {
      input,
      args,
      sessionId,
      metadata,
      canonicalState,
      deps,
    });
    const responseMarkdown = renderSessionCommandMarkdown(commandResult);
    const receipt = {
      receiptId: `session-command-${command}-${randomUUID()}`,
      kind: `session.command.${command}`,
      generatedAt: new Date().toISOString(),
      command,
      sessionId,
      mutationPerformed: Boolean(commandResult.mutationPerformed),
      approvalRequired: false,
      rawSecretsSerialized: false,
    };
    return this.redactRecord({
      ok: true,
      sessionId,
      command,
      commandResult,
      responseMarkdown,
      receipt,
      snapshot: this.redactRecord(canonicalState.snapshot || null),
      session: this.redactRecord(canonicalState.session || null),
      sessionPlane: this.redactRecord(canonicalState.sessionPlane || null),
      approvalPlane: this.redactRecord(canonicalState.approvalPlane || null),
      capabilityPlane: this.redactRecord(canonicalState.capabilityPlane || null),
      runtimeWarnings: this.redactRecord(canonicalState.runtimeWarnings || []),
      actionRecommendations: this.redactRecord(canonicalState.actionRecommendations || []),
    });
  }

  private async buildCommandResult(
    command: string,
    context: {
      input: WebAppRuntimeSessionCommandInput;
      args: string;
      sessionId: string;
      metadata: RuntimeRecord | null;
      canonicalState: GatewayCanonicalStatePayload;
      deps: WebAppRuntimeRouteDeps;
    },
  ): Promise<RuntimeRecord> {
    switch (command) {
      case 'status':
        return this.buildStatusResult(context);
      case 'usage':
        return this.buildUsageResult(context);
      case 'model':
        return this.buildModelResult(context);
      case 'models':
        return this.buildModelsResult(context);
      case 'profile':
        return this.buildProfileResult(context);
      case 'tools':
        return this.buildToolsResult(context);
      case 'skills':
        return this.buildSkillsResult(context);
      case 'agents':
        return this.buildAgentsResult(context);
      case 'whoami':
        return this.buildWhoamiResult(context);
      case 'context':
        return this.buildContextResult(context);
      case 'plan-review':
        return this.buildPlanReviewResult(context);
      case 'brief-reply':
        return this.buildBriefReplyResult(context);
      case 'test-loop':
        return this.buildTestLoopResult(context);
      default:
        throw new Error(`Comando de session without backend dedicado: ${command}.`);
    }
  }

  private buildStatusResult(context: {
    input: WebAppRuntimeSessionCommandInput;
    sessionId: string;
    canonicalState: GatewayCanonicalStatePayload;
  }): RuntimeRecord {
    const snapshot = this.recordOrNull(context.canonicalState.snapshot) || {};
    const permissions = this.arrayOfRecords(snapshot.permissions);
    const pendingApprovals = this.countUniquePending([
      ...permissions,
      ...this.arrayOfRecords(this.recordOrNull(context.canonicalState.approvalPlane)?.pending),
    ]);
    const activeRun = this.resolveActiveRun(context.canonicalState);
    const composer = this.recordOrNull(context.input.composerSettings) || {};
    return {
      kind: 'status',
      sessionId: context.sessionId,
      profile: this.cleanLabel(context.input.experienceProfile) || 'personal',
      modelRoute: this.cleanLabel(composer.model) || this.cleanLabel(this.recordOrNull(context.canonicalState.session)?.modelProfile) || 'auto',
      effort: this.cleanLabel(composer.effort) || 'balanced',
      thinking: Boolean(composer.thinking),
      fast: Boolean(composer.fast),
      activeRun,
      queueLength: Number(context.input.queueLength || 0) || 0,
      pendingApprovals,
      openTasks: this.arrayOfRecords(snapshot.tasks).filter((task) => !this.isClosedStatus(task.status)).length,
      activeWorkflows: this.arrayOfRecords(snapshot.workflowRuns).filter((run) => !this.isClosedStatus(run.status)).length,
      runtimeWarnings: this.arrayOfStrings(context.canonicalState.runtimeWarnings).slice(0, 6),
      mutationPerformed: false,
    };
  }

  private buildUsageResult(context: {
    args: string;
    canonicalState: GatewayCanonicalStatePayload;
  }): RuntimeRecord {
    const snapshot = this.recordOrNull(context.canonicalState.snapshot) || {};
    const agentRuntime = this.recordOrNull(context.canonicalState.agentRuntime) || {};
    const runs = this.mergeUniqueRecords([
      ...this.arrayOfRecords(agentRuntime.runs),
      ...this.arrayOfRecords(snapshot.runs),
    ]);
    const toolRuns = this.arrayOfRecords(snapshot.toolRuns);
    const usageRecords = [
      this.recordOrNull(snapshot.usage),
      ...runs.map((run) => this.recordOrNull(run.usage) || run),
      ...toolRuns.map((run) => this.recordOrNull(run.usage) || run),
    ].filter(Boolean) as RuntimeRecord[];
    const totalTokens = usageRecords.reduce((sum, record) => sum + this.readTokenCount(record), 0);
    const totalCostUsd = usageRecords.reduce((sum, record) => sum + this.readCostUsd(record), 0);
    return {
      kind: 'usage',
      mode: context.args.toLowerCase() === 'full' ? 'full' : 'summary',
      visibleRuns: runs.length,
      toolRuns: toolRuns.length,
      activeRun: this.resolveActiveRun(context.canonicalState),
      totalTokens,
      totalCostUsd,
      recentRuns: runs.slice(0, 6).map((run) => ({
        id: this.cleanLabel(run.id || run.runId) || 'run',
        status: this.cleanLabel(run.status) || 'unknown',
        tokens: this.readTokenCount(this.recordOrNull(run.usage) || run),
        costUsd: this.readCostUsd(this.recordOrNull(run.usage) || run),
      })),
      mutationPerformed: false,
    };
  }

  private buildModelResult(context: {
    args: string;
    metadata: RuntimeRecord | null;
    canonicalState: GatewayCanonicalStatePayload;
  }): RuntimeRecord {
    const raw = context.args.trim();
    const normalized = raw ? this.normalizeModelRoute(raw) : '';
    const statusOnly = !normalized || ['status', 'list', 'models'].includes(normalized.toLowerCase());
    const current = this.cleanLabel(context.metadata?.modelProfile)
      || this.cleanLabel(this.recordOrNull(context.canonicalState.session)?.modelProfile)
      || 'auto';
    return {
      kind: 'model',
      modelRoute: statusOnly ? current : normalized,
      currentModelRoute: current,
      mutationPerformed: !statusOnly,
      examples: this.modelExamples(),
      safety: {
        metadataOnly: !statusOnly,
        providerProbePerformed: false,
        rawSecretsSerialized: false,
      },
    };
  }

  private async buildModelsResult(context: {
    canonicalState: GatewayCanonicalStatePayload;
  }): Promise<RuntimeRecord> {
    const catalog = await this.providerModelCatalog.buildSnapshot({
      live: false,
      allowAllLive: false,
    }).catch(() => null);
    return {
      kind: 'models',
      currentModelRoute: this.cleanLabel(this.recordOrNull(context.canonicalState.session)?.modelProfile) || 'auto',
      examples: this.modelExamples(),
      catalog: catalog
        ? this.redactRecord({
            status: catalog.status,
            activeProvider: catalog.activeProvider,
            activeModel: catalog.activeModel,
            summary: catalog.summary,
            providers: this.arrayOfRecords(this.recordOrNull(catalog)?.providers).slice(0, 12).map((provider) => ({
              id: this.cleanLabel(provider.id),
              status: this.cleanLabel(provider.status),
              liveReady: Boolean(provider.liveReady),
              defaultRouteAllowed: Boolean(provider.defaultRouteAllowed),
              modelSample: this.arrayOfStrings(provider.modelSample).slice(0, 6),
            })),
            safety: catalog.safety,
          })
        : null,
      configuredOnly: true,
      providerProbePerformed: false,
      mutationPerformed: false,
    };
  }

  private buildProfileResult(context: {
    input: WebAppRuntimeSessionCommandInput;
    args: string;
  }): RuntimeRecord {
    const available = ['personal', 'creator', 'developer', 'business', 'power'];
    const requested = this.cleanLabel(context.args).toLowerCase();
    return {
      kind: 'profile',
      currentProfile: this.cleanLabel(context.input.experienceProfile) || 'personal',
      requestedProfile: available.includes(requested) ? requested : null,
      available,
      mutationPerformed: false,
      backendPersistsProfile: false,
    };
  }

  private buildToolsResult(context: {
    canonicalState: GatewayCanonicalStatePayload;
  }): RuntimeRecord {
    const tools = this.arrayOfRecords(context.canonicalState.gatewaySessionTools?.tools)
      .map((tool) => this.compactItem(tool, 'tool'))
      .filter(Boolean);
    return {
      kind: 'tools',
      items: tools,
      count: tools.length,
      mutationPerformed: false,
    };
  }

  private async buildSkillsResult(context: {
    canonicalState: GatewayCanonicalStatePayload;
    deps: WebAppRuntimeRouteDeps;
  }): Promise<RuntimeRecord> {
    const capabilitySkills = this.arrayOfRecords(this.recordOrNull(context.canonicalState.capabilityPlane)?.skills)
      .map((skill) => this.compactItem(skill, 'skill'))
      .filter(Boolean);
    let catalogSkills: RuntimeRecord[] = [];
    try {
      const catalog = await context.deps.getComposerCatalog().getCatalog(null);
      catalogSkills = this.arrayOfRecords(this.recordOrNull(catalog)?.skills)
        .map((skill) => this.compactItem(skill, 'skill'))
        .filter(Boolean);
    } catch (error: unknown) {logger.warn('[Web App Runtime Session Command] array operation failed', error);
    catalogSkills = [];
  }
    const byId = new Map<string, RuntimeRecord>();
    for (const skill of [...capabilitySkills, ...catalogSkills]) {
      byId.set(String(skill.id || skill.title), skill);
    }
    const items = Array.from(byId.values());
    return {
      kind: 'skills',
      items,
      count: items.length,
      mutationPerformed: false,
    };
  }

  private buildAgentsResult(context: {
    canonicalState: GatewayCanonicalStatePayload;
  }): RuntimeRecord {
    const snapshot = this.recordOrNull(context.canonicalState.snapshot) || {};
    const agentRuntime = this.recordOrNull(context.canonicalState.agentRuntime) || {};
    return {
      kind: 'agents',
      activeRun: this.resolveActiveRun(context.canonicalState),
      runs: this.arrayOfRecords(agentRuntime.runs).slice(0, 12).map((run) => this.compactItem(run, 'run')),
      tasks: this.arrayOfRecords(snapshot.tasks).slice(0, 12).map((task) => this.compactItem(task, 'task')),
      workflowRuns: this.arrayOfRecords(snapshot.workflowRuns).slice(0, 12).map((run) => this.compactItem(run, 'workflow')),
      mutationPerformed: false,
    };
  }

  private buildWhoamiResult(context: {
    input: WebAppRuntimeSessionCommandInput;
    sessionId: string;
    canonicalState: GatewayCanonicalStatePayload;
  }): RuntimeRecord {
    return {
      kind: 'whoami',
      sessionId: context.sessionId,
      profile: this.cleanLabel(context.input.experienceProfile) || 'personal',
      modelRoute: this.cleanLabel(this.recordOrNull(context.canonicalState.session)?.modelProfile) || 'auto',
      runtimeUserId: this.cleanLabel(this.recordOrNull(context.canonicalState.session)?.runtimeUserId) || null,
      platform: this.cleanLabel(this.recordOrNull(context.canonicalState.session)?.platform) || 'web',
      mutationPerformed: false,
    };
  }

  private buildContextResult(context: {
    input: WebAppRuntimeSessionCommandInput;
    sessionId: string;
    canonicalState: GatewayCanonicalStatePayload;
  }): RuntimeRecord {
    const clientContext = this.recordOrNull(context.input.clientContext) || {};
    const snapshot = this.recordOrNull(context.canonicalState.snapshot) || {};
    const composer = this.recordOrNull(context.input.composerSettings) || {};
    const attachments = this.arrayOfRecords(clientContext.attachments);
    const selectedSkills = this.arrayOfRecords(clientContext.selectedSkills);
    const selectedTools = (selectedSkills.length > 0
      ? selectedSkills
      : this.arrayOfRecords(clientContext.selectedTools))
      .map((entry) => this.compactItem(entry, 'tool'));
    const workspaceSelection = this.recordOrNull(clientContext.workspaceSelection);
    const workflowIntent = this.recordOrNull(clientContext.workflowIntent);
    return {
      kind: 'context',
      sessionId: context.sessionId,
      messagesCount: this.arrayOfRecords(snapshot.messages).length,
      attachmentsCount: attachments.length,
      attachments: attachments.slice(0, 8).map((entry, index) => ({
        id: this.cleanLabel(entry.id || entry.name || `attachment-${index}`),
        name: this.cleanLabel(entry.name || entry.filename || `attachment-${index}`),
        kind: this.cleanLabel(entry.kind || entry.type) || 'attachment',
        status: this.cleanLabel(entry.status) || 'pending',
      })),
      selectedTools,
      workspaceSelection: workspaceSelection
        ? {
            root: this.cleanLabel(workspaceSelection.root || workspaceSelection.path),
            label: this.cleanLabel(workspaceSelection.label || workspaceSelection.name),
            note: this.cleanLabel(workspaceSelection.note || workspaceSelection.summary),
          }
        : null,
      workflowIntent: workflowIntent
        ? {
            kind: this.cleanLabel(workflowIntent.kind),
            objective: this.cleanLabel(workflowIntent.objective || workflowIntent.prompt || workflowIntent.request),
          }
        : null,
      composer: {
        model: this.cleanLabel(composer.model) || 'auto',
        effort: this.cleanLabel(composer.effort) || 'balanced',
        thinking: Boolean(composer.thinking),
        tools: composer.tools !== false,
      },
      openTasks: this.arrayOfRecords(snapshot.tasks).filter((task) => !this.isClosedStatus(task.status)).length,
      pendingApprovals: this.countUniquePending(this.arrayOfRecords(snapshot.permissions)),
      mutationPerformed: false,
      rawSecretsSerialized: false,
    };
  }

  private buildPlanReviewResult(context: {
    input: WebAppRuntimeSessionCommandInput;
    args: string;
    sessionId: string;
  }): RuntimeRecord {
    const objective = this.cleanLabel(context.args) || 'review the current plan';
    return {
      kind: 'plan-review',
      nativeSkillId: 'guided-plan-review',
      publicCommand: '/grill-me',
      sessionId: context.sessionId,
      profile: this.cleanLabel(context.input.experienceProfile) || 'personal',
      objectivePreview: objective,
      questionPolicy: 'one-question-at-a-time',
      decisionRecord: {
        status: 'draft',
        persistence: 'receipt-only',
        editable: true,
        approvalRequiredForMutation: true,
      },
      nextAction: 'Ask exactly one focused question, then wait for the operator decision before continuing.',
      mutationPerformed: false,
      rawSecretsSerialized: false,
    };
  }

  private buildBriefReplyResult(context: {
    input: WebAppRuntimeSessionCommandInput;
    args: string;
    sessionId: string;
  }): RuntimeRecord {
    const target = this.cleanLabel(context.args) || 'next reply';
    return {
      kind: 'brief-reply',
      nativeSkillId: 'compact-channel-reply',
      publicCommand: '/brief',
      aliases: ['/brief', '/short', '/caveman'],
      sessionId: context.sessionId,
      profile: this.cleanLabel(context.input.experienceProfile) || 'personal',
      targetPreview: target,
      mode: 'compact-channel-ready',
      maxLines: 5,
      styleRules: [
        'Lead with the answer.',
        'Keep only necessary context.',
        'Use one clear next action when useful.',
      ],
      mutationPerformed: false,
      rawSecretsSerialized: false,
    };
  }

  private buildTestLoopResult(context: {
    input: WebAppRuntimeSessionCommandInput;
    args: string;
    sessionId: string;
  }): RuntimeRecord {
    const request = this.cleanLabel(context.args) || 'the requested implementation';
    return {
      kind: 'test-loop',
      nativeSkillId: 'governed-test-loop',
      publicCommand: '/tdd',
      sessionId: context.sessionId,
      profile: this.cleanLabel(context.input.experienceProfile) || 'developer',
      requestPreview: request,
      loop: [
        'Red: write or identify the failing test first.',
        'Preview: show command and file scope before mutation.',
        'Green: implement the smallest safe change.',
        'Verify: rerun focused tests and relevant gates.',
        'Receipt: record commands, files, outcome and rollback note.',
      ],
      terminalGateRequired: true,
      approvalRequiredForWrites: true,
      sandboxOrDryRunRequired: true,
      mutationPerformed: false,
      rawSecretsSerialized: false,
    };
  }

  private patchModelRoute(
    sessionId: string,
    args: string,
    deps: WebAppRuntimeRouteDeps,
  ): RuntimeRecord | null {
    const normalized = this.normalizeModelRoute(args);
    const modelProfile = ['auto', 'default', 'inherit', 'clear', 'reset'].includes(normalized.toLowerCase())
      ? null
      : normalized;
    if (!deps.gatewaySessionReadModel) {
      return { modelProfile };
    }
    return deps.gatewaySessionReadModel.patchSessionMetadata({
      userId: deps.runtime.webUserId,
      fallbackRuntimeUserId: deps.runtime.webUserId,
      platform: 'web',
      chatId: deps.realtime.getChatId(sessionId),
      sessionId,
      sourceUserId: sessionId,
      modelProfile,
    }) as RuntimeRecord | null;
  }

  private validateModelCommandArgs(args: string): void {
    const raw = String(args || '').trim();
    if (!raw || ['status', 'list', 'models'].includes(raw.toLowerCase())) {
      return;
    }
    this.normalizeModelRoute(raw);
  }

  private normalizeModelRoute(value: string): string {
    const text = String(value || '').trim();
    if (!text || text.length > 180) {
      throw new Error('Rota de modelo invalid.');
    }
    if (!/^[a-z0-9][a-z0-9._:/@+-]*$/i.test(text)) {
      throw new Error('Rota de modelo invalid: use only provider/model ou model-id.');
    }
    return text;
  }

  private normalizeCommand(value: string): string {
    const normalized = String(value || '').trim().replace(/^\//, '').toLowerCase().replace(/_/g, '-');
    const aliases: Record<string, string> = {
      model: 'model',
      models: 'models',
      status: 'status',
      usage: 'usage',
      tools: 'tools',
      toolsets: 'tools',
      skill: 'skills',
      skills: 'skills',
      agents: 'agents',
      tasks: 'agents',
      subagents: 'agents',
      profile: 'profile',
      whoami: 'whoami',
      context: 'context',
      'grill-me': 'plan-review',
      grill: 'plan-review',
      plan: 'plan-review',
      'plan-review': 'plan-review',
      'review-plan': 'plan-review',
      brief: 'brief-reply',
      short: 'brief-reply',
      concise: 'brief-reply',
      caveman: 'brief-reply',
      'brief-reply': 'brief-reply',
      tdd: 'test-loop',
      tests: 'test-loop',
      'test-loop': 'test-loop',
      'red-green': 'test-loop',
    };
    return aliases[normalized] || normalized;
  }

  private resolveActiveRun(state: GatewayCanonicalStatePayload): RuntimeRecord | null {
    const snapshot = this.recordOrNull(state.snapshot) || {};
    const agentRuntime = this.recordOrNull(state.agentRuntime) || {};
    const direct = this.recordOrNull(agentRuntime.activeRun)
      || this.recordOrNull(snapshot.activeRun);
    if (direct) return this.compactItem(direct, 'run');
    const runs = this.mergeUniqueRecords([
      ...this.arrayOfRecords(agentRuntime.runs),
      ...this.arrayOfRecords(snapshot.runs),
    ]);
    const active = runs.find((run) => !this.isClosedStatus(run.status));
    return active ? this.compactItem(active, 'run') : null;
  }

  private mergeUniqueRecords(records: RuntimeRecord[]): RuntimeRecord[] {
    const byKey = new Map<string, RuntimeRecord>();
    records.forEach((record, index) => {
      const key = this.recordIdentity(record, index);
      if (!byKey.has(key)) {
        byKey.set(key, record);
        return;
      }
      byKey.set(key, {
        ...record,
        ...this.recordOrNull(byKey.get(key)),
        usage: this.recordOrNull(byKey.get(key)?.usage) || this.recordOrNull(record.usage) || undefined,
      });
    });
    return Array.from(byKey.values());
  }

  private recordIdentity(record: RuntimeRecord, index: number): string {
    const direct = this.cleanLabel(
      record.id
      || record.runId
      || record.taskId
      || record.traceId
      || record.requestId,
    );
    if (direct) return direct;
    return [
      this.cleanLabel(record.sessionId),
      this.cleanLabel(record.status),
      this.cleanLabel(record.title || record.summary || record.kind),
      this.cleanLabel(record.createdAt || record.updatedAt),
    ].filter(Boolean).join('|') || `record-${index}`;
  }

  private compactItem(item: RuntimeRecord, fallbackKind: string): RuntimeRecord {
    return this.redactRecord({
      id: this.cleanLabel(item.id || item.runId || item.taskId || item.task_id || item.permissionId) || fallbackKind,
      title: this.cleanLabel(item.title || item.name || item.toolName || item.summary) || fallbackKind,
      status: this.cleanLabel(item.status || item.readiness) || 'unknown',
      kind: this.cleanLabel(item.kind || item.type) || fallbackKind,
    });
  }

  private readTokenCount(record: RuntimeRecord): number {
    const input = Number(record.inputTokens || record.promptTokens || 0) || 0;
    const output = Number(record.outputTokens || record.completionTokens || 0) || 0;
    const total = Number(record.totalTokens || record.tokens || record.tokensUsed || 0) || 0;
    return total || input + output;
  }

  private readCostUsd(record: RuntimeRecord): number {
    return Number(record.totalCostUsd || record.costUsd || record.cost || 0) || 0;
  }

  private countUniquePending(items: RuntimeRecord[]): number {
    const seen = new Set<string>();
    for (const item of items) {
      if (String(item.status || '').toLowerCase() !== 'pending') {
        continue;
      }
      const id = this.cleanLabel(item.id || item.approvalId || item.permissionId || item.taskId || item.runId)
        || `pending-${seen.size}`;
      seen.add(id);
    }
    return seen.size;
  }

  private isClosedStatus(value: unknown): boolean {
    return ['done', 'completed', 'failed', 'cancelled', 'canceled', 'rejected'].includes(String(value || '').toLowerCase());
  }

  private arrayOfRecords(value: unknown): RuntimeRecord[] {
    return Array.isArray(value)
      ? value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) as RuntimeRecord[]
      : [];
  }

  private arrayOfStrings(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((entry) => this.redactText(String(entry || ''))).filter(Boolean)
      : [];
  }

  private recordOrNull(value: unknown): RuntimeRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as RuntimeRecord
      : null;
  }

  private cleanLabel(value: unknown): string {
    return this.redactText(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, 220);
  }

  private modelExamples(): string[] {
    return [
      '/model auto',
      '/model openai/gpt-5.5',
      '/model anthropic/claude-opus',
      '/model local/llama',
    ];
  }

  private redactRecord<T>(value: T): T {
    if (typeof value === 'string') {
      return this.redactText(value) as T;
    }
    if (Array.isArray(value)) {
      return value.map((entry) => this.redactRecord(entry)) as T;
    }
    if (value && typeof value === 'object') {
      const next: RuntimeRecord = {};
      for (const [key, entry] of Object.entries(value as RuntimeRecord)) {
        next[key] = this.redactRecord(entry);
      }
      return next as T;
    }
    return value;
  }

  private redactText(value: string): string {
    return String(value || '')
      .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, 'sk-[redacted]')
      .replace(/\b(xox[baprs]-[A-Za-z0-9-]{8,})\b/g, 'xox-[redacted]')
      .replace(/\b(gh[pousr]_[A-Za-z0-9_]{8,})\b/g, 'gh_[redacted]')
      .replace(/\b([A-Za-z0-9+/]{40,}={0,2})\b/g, '[redacted-secret-like-token]')
      .replace(/\b([A-Z0-9_]*(?:API[_-]...KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|AUTHORIZATION)[A-Z0-9_]*)\s*[:=]\s*([^\s"'`,;]+)/gi, '$1=[redacted]');
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
