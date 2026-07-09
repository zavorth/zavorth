import fs from 'fs';
import path from 'path';
import type { ComputerUseAction, ComputerUseAgent, ComputerUseConfig, ComputerUseSnapshot } from '../../agents/ComputerUseAgent.js';
import type { CapabilityLifecycleService } from '../CapabilityLifecycleService.js';
import type { ZavorthRuntimeStabilityControlPlaneService } from '../ZavorthRuntimeStabilityControlPlaneService.js';
import type { TrustDecisionService } from '../TrustDecisionService.js';
import { logger } from '../../logger.js';
import type {
ComputerUseWatchModeState,
  InternalWatchModeRun,
  StartWatchModeRunInput,
  WatchModeArtifactEntry,
  WatchModeApproval,
  WatchModeApprovalDecision,
  WatchModeAllowlistStatus,
  WatchModeMutationPreview,
  WatchModeRunBudget,
  WatchModeRunSnapshot,
  WatchModeRunStatus,
  WatchModeSnapshot,
  WatchModeTimelineEntry,
  WatchModeTimelineType,
  WatchModeRiskLevel,
} from './ComputerUseWatchModeSharedTypes.js';

type ComputerUseWatchModeLifecycleSupportDeps = {
  state: ComputerUseWatchModeState;
  createAgent: () => ComputerUseAgent;
  isExecutionAllowed?: () => boolean;
  mutationGuardEnabled: boolean;
  persistSnapshot: () => WatchModeSnapshot;
  previewMutation: (input: {
    actionId: 'start';
    targetWindow?: string | null;
    objective?: string | null;
    siteUrl?: string | null;
    strictApproval?: boolean | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }) => Promise<WatchModeMutationPreview>;
  trustDecisionService: Pick<TrustDecisionService, 'evaluate'>;
  capabilityLifecycleService: Pick<CapabilityLifecycleService, 'shouldBootCapability' | 'registerCapabilityDemand' | 'enableCapability' | 'registerCapabilityUsage'>;
  runtimeStabilityControlPlaneService: Pick<ZavorthRuntimeStabilityControlPlaneService, 'buildSnapshot'>;
};

export class ComputerUseWatchModeLifecycleSupport {
  constructor(private readonly deps: ComputerUseWatchModeLifecycleSupportDeps) {}

  public buildSnapshot(limit: number = 6): WatchModeSnapshot {
    const runs = this.listRuns(limit);
    const activeRun = runs.find((entry) => entry.status === 'running' || entry.status === 'paused' || entry.status === 'waiting_approval') || null;
    const pendingApprovals = runs.reduce((total, run) => total + run.pendingApprovalCount, 0);
    const artifactEntries = runs.reduce((total, run) => total + run.buffers.artifactEntries, 0);
    const throttledScreenshots = runs.reduce((total, run) => total + run.buffers.throttledScreenshots, 0);
    const droppedTimelineEntries = runs.reduce((total, run) => total + run.buffers.droppedTimelineEntries, 0);
    const expiredArtifacts = runs.reduce((total, run) => total + run.buffers.expiredArtifacts, 0);
    const deletedScreenshotBytes = runs.reduce((total, run) => total + run.buffers.deletedScreenshotBytes, 0);
    const activeVisualHandles = Array.from(this.deps.state.runs.values())
      .filter((run) => Boolean(run.activeAgent)).length;
    const approvalDecisions = runs.reduce((total, run) => total + run.buffers.approvalDecisions, 0);
    const approvalLatencyTotalMs = runs.reduce(
      (total, run) => total + (run.buffers.averageApprovalLatencyMs * run.buffers.approvalDecisions),
      0,
    );
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalRuns: this.deps.state.runOrder.length,
        runningRuns: runs.filter((entry) => entry.status === 'running').length,
        pausedRuns: runs.filter((entry) => entry.status === 'paused').length,
        waitingApprovalRuns: runs.filter((entry) => entry.status === 'waiting_approval').length,
        pendingApprovals,
        artifactEntries,
        throttledScreenshots,
        droppedTimelineEntries,
        expiredArtifacts,
        deletedScreenshotBytes,
        activeVisualHandles,
        averageApprovalLatencyMs: approvalDecisions > 0
          ? Math.round(approvalLatencyTotalMs / approvalDecisions)
          : 0,
        lastStatus: runs[0]?.status || 'idle',
      },
      policy: {
        strictApprovalDefault: this.deps.state.strictApprovalDefault,
        allowedApps: [...this.deps.state.allowedApps],
        allowedSites: [...this.deps.state.allowedSites],
        screenshotTtlMs: this.deps.state.defaultBudget.screenshotTtlMs,
        maxScreenshotBytes: this.deps.state.defaultBudget.maxScreenshotBytes,
        screenshotRedactionMode: this.deps.state.defaultBudget.screenshotRedactionMode,
        sensitiveScreenPolicy: this.deps.state.defaultBudget.sensitiveScreenPolicy,
        defaultBudget: { ...this.deps.state.defaultBudget },
      },
      activeRun,
      runs,
    };
  }

  public listRuns(limit: number = 10): WatchModeRunSnapshot[] {
    return this.deps.state.runOrder
      .slice(0, Math.max(1, limit))
      .map((runId) => this.deps.state.runs.get(runId))
      .filter((entry): entry is InternalWatchModeRun => Boolean(entry))
      .map((entry) => this.toSnapshot(entry));
  }

  public getRun(runId: string): WatchModeRunSnapshot | null {
    const run = this.deps.state.runs.get(String(runId || '').trim());
    return run ? this.toSnapshot(run) : null;
  }

  public getActiveRun(): WatchModeRunSnapshot | null {
    const active = this.findActiveRun();
    return active ? this.toSnapshot(active) : null;
  }

  public async startRun(input: StartWatchModeRunInput): Promise<WatchModeRunSnapshot> {
    if (this.deps.isExecutionAllowed && !this.deps.isExecutionAllowed()) {
      throw new Error(
        'Computer Use visual bloqueado por seguranca. Defina ZAVORTH_COMPUTER_USE_ENABLED=true '
        + 'ou ZAVORTH_COMPUTER_USE_PROFILE=trusted|dangerous para liberar explicitamente.',
      );
    }

    const active = this.findActiveRun();
    if (active) {
      throw new Error('Ja existe um Watch Mode ativo. Pause, finalize ou cancele o run atual antes de iniciar outro.');
    }

    const targetWindow = String(input.targetWindow || '').trim();
    const objective = String(input.objective || '').trim();
    const siteUrl = this.normalizeOptional(input.siteUrl);
    if (!targetWindow || !objective) {
      throw new Error('targetWindow e objective sao obrigatorios para iniciar o Watch Mode.');
    }

    this.ensureRuntimeStabilityAllowsStart();

    if (this.deps.mutationGuardEnabled && !input.approvedPlanId) {
      await this.ensureStartAllowed({ ...input, targetWindow, objective, siteUrl });
    }

    const allowlist = this.inspectAllowlist(targetWindow, siteUrl);
    const strictApproval = typeof input.strictApproval === 'boolean'
      ? input.strictApproval
      : this.deps.state.strictApprovalDefault;
    const budget = this.resolveRunBudget(input);
    const runId = `watch-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const run: InternalWatchModeRun = {
      runId,
      status: 'running',
      requestedBy: this.normalizeOptional(input.requestedBy),
      targetWindow,
      objective,
      siteUrl,
      strictApproval,
      budget,
      allowlist,
      startedAt,
      finishedAt: null,
      updatedAt: startedAt,
      latestScreenshotPath: null,
      pendingApprovalId: null,
      lastError: null,
      timeline: [],
      artifacts: [],
      buffers: {
        timelineLimit: this.deps.state.timelineLimit,
        artifactLimit: this.deps.state.artifactLimit,
        screenshotThrottleMs: this.deps.state.screenshotThrottleMs,
        throttledScreenshots: 0,
        droppedTimelineEntries: 0,
        persistedArtifacts: 0,
        approvalLatencyTotalMs: 0,
        approvalDecisions: 0,
        expiredArtifacts: 0,
        deletedScreenshotBytes: 0,
        lastScreenshotTimelineAt: null,
      },
      approvals: [],
      agentSnapshot: null,
      activeAgent: null,
      waiterByApprovalId: new Map(),
    };
    this.rememberRun(run);
    this.pushTimeline(run, {
      type: 'started',
      summary: `Watch Mode iniciado para ${targetWindow}.`,
      iteration: null,
      riskLevel: allowlist.mode === 'allowlisted' ? 'medium' : 'high',
      action: null,
      result: null,
      screenshotPath: null,
      approvalId: null,
    });

    const agent = this.deps.createAgent();
    run.activeAgent = agent;
    const config: ComputerUseConfig = {
      targetWindow,
      objective,
      maxIterations: budget.maxIterations,
      delayBetweenActionsMs: budget.delayBetweenActionsMs,
      hooks: {
        onScreenshot: async ({ snapshot, screenshotPath }) => {
          run.agentSnapshot = snapshot;
          run.latestScreenshotPath = screenshotPath;
          this.recordScreenshotArtifact(run, snapshot.iteration, screenshotPath);
          if (this.shouldThrottleScreenshotTimeline(run)) {
            run.buffers.throttledScreenshots += 1;
            run.updatedAt = new Date().toISOString();
            this.deps.persistSnapshot();
            return;
          }
          run.buffers.lastScreenshotTimelineAt = new Date().toISOString();
          this.pushTimeline(run, {
            type: 'screenshot',
            summary: screenshotPath
              ? `Screenshot capturado na iteracao ${snapshot.iteration}.`
              : `Screenshot indisponivel na iteracao ${snapshot.iteration}.`,
            iteration: snapshot.iteration,
            riskLevel: 'low',
            action: snapshot.lastAction || null,
            result: null,
            screenshotPath,
            approvalId: null,
          });
        },
        onActionPlanned: async ({ snapshot, action }) => {
          run.agentSnapshot = snapshot;
          this.pushTimeline(run, {
            type: 'planned',
            summary: this.buildPlannedSummary(action, snapshot.iteration),
            iteration: snapshot.iteration,
            riskLevel: this.getRiskLevel(action, allowlist),
            action,
            result: null,
            screenshotPath: run.latestScreenshotPath,
            approvalId: null,
          });
          if (!this.requiresApproval(action, run)) {
            run.status = 'running';
            run.updatedAt = new Date().toISOString();
            return action;
          }
          const approval = this.createApproval(run, snapshot.iteration, action);
          run.pendingApprovalId = approval.approvalId;
          run.status = 'waiting_approval';
          this.pushTimeline(run, {
            type: 'approval_requested',
            summary: `Approval pendente para ${action.action}.`,
            iteration: snapshot.iteration,
            riskLevel: approval.riskLevel,
            action,
            result: null,
            screenshotPath: run.latestScreenshotPath,
            approvalId: approval.approvalId,
          });
          const decision = await new Promise<WatchModeApprovalDecision>((resolve) => {
            run.waiterByApprovalId.set(approval.approvalId, { resolve });
          });
          run.pendingApprovalId = null;
          run.status = 'running';
          this.pushTimeline(run, {
            type: 'approval_decided',
            summary: decision === 'approve'
              ? `Approval liberado para ${action.action}.`
              : `Approval negado para ${action.action}; o agente vai observar de novo antes de agir.`,
            iteration: snapshot.iteration,
            riskLevel: approval.riskLevel,
            action,
            result: decision,
            screenshotPath: run.latestScreenshotPath,
            approvalId: approval.approvalId,
          });
          if (decision === 'approve') {
            return action;
          }
          return {
            action: 'list-elements',
            windowTitle: action.windowTitle || run.targetWindow,
            reasoning: 'Approval negado; faca somente observacao adicional antes de qualquer acao mutavel.',
          };
        },
        onActionExecuted: async ({ snapshot, action, result }) => {
          run.agentSnapshot = snapshot;
          this.pushTimeline(run, {
            type: 'executed',
            summary: `Acao ${action.action} executada.`,
            iteration: snapshot.iteration,
            riskLevel: this.getRiskLevel(action, allowlist),
            action,
            result,
            screenshotPath: run.latestScreenshotPath,
            approvalId: null,
          });
        },
      },
    };

    let budgetExpired = false;
    const budgetTimer = setTimeout(() => {
      if (!run.activeAgent || run.finishedAt) {
        return;
      }
      budgetExpired = true;
      run.activeAgent.stop();
      run.activeAgent = null;
      run.status = 'cancelled';
      run.finishedAt = new Date().toISOString();
      run.updatedAt = run.finishedAt;
      run.lastError = `Budget de duracao excedido (${budget.maxDurationMs}ms).`;
      run.pendingApprovalId = null;
      this.rejectPendingWaiters(run);
      this.cleanupRunArtifacts(run);
      this.pushTimeline(run, {
        type: 'cancelled',
        summary: run.lastError,
        iteration: run.agentSnapshot?.iteration || null,
        riskLevel: 'high',
        action: run.agentSnapshot?.lastAction || null,
        result: run.lastError,
        screenshotPath: run.latestScreenshotPath,
        approvalId: null,
      });
    }, budget.maxDurationMs);
    budgetTimer.unref?.();

    agent.run(config)
      .then((snapshot) => {
        if (budgetExpired) {
          return;
        }
        run.agentSnapshot = snapshot;
        run.activeAgent = null;
        run.finishedAt = snapshot.finishedAt || new Date().toISOString();
        run.updatedAt = run.finishedAt;
        run.lastError = snapshot.error || null;
        run.status = this.mapFinalStatus(snapshot.status);
        this.pushTimeline(run, {
          type: this.toFinishedTimelineType(run.status),
          summary: this.buildFinishSummary(run.status, snapshot.error),
          iteration: snapshot.iteration,
          riskLevel: snapshot.error ? 'high' : 'low',
          action: snapshot.lastAction || null,
          result: snapshot.error || null,
          screenshotPath: snapshot.lastScreenshotPath || run.latestScreenshotPath,
          approvalId: null,
        });
      })
      .catch((error: any) => {
        if (budgetExpired) {
          return;
        }
        run.activeAgent = null;
        run.status = 'failed';
        run.finishedAt = new Date().toISOString();
        run.updatedAt = run.finishedAt;
        run.lastError = error?.message || 'Falha ao executar Watch Mode.';
        this.pushTimeline(run, {
          type: 'failed',
          summary: run.lastError || 'Falha ao executar Watch Mode.',
          iteration: null,
          riskLevel: 'high',
          action: null,
          result: run.lastError,
          screenshotPath: run.latestScreenshotPath,
          approvalId: null,
        });
      })
      .finally(() => {
        clearTimeout(budgetTimer);
        this.cleanupRunArtifacts(run);
        this.deps.persistSnapshot();
      });

    this.deps.persistSnapshot();
    return this.toSnapshot(run);
  }

  public pauseRun(runId: string, requestedBy: string | null = null): WatchModeRunSnapshot {
    const run = this.requireRun(runId);
    if (run.status === 'running' && run.activeAgent) {
      run.activeAgent.pause();
      run.status = 'paused';
      run.updatedAt = new Date().toISOString();
      this.pushTimeline(run, {
        type: 'paused',
        summary: `Watch Mode pausado${requestedBy ? ` por ${requestedBy}` : ''}.`,
        iteration: run.agentSnapshot?.iteration || null,
        riskLevel: 'medium',
        action: run.agentSnapshot?.lastAction || null,
        result: null,
        screenshotPath: run.latestScreenshotPath,
        approvalId: null,
      });
    }
    this.deps.persistSnapshot();
    return this.toSnapshot(run);
  }

  public resumeRun(runId: string, requestedBy: string | null = null): WatchModeRunSnapshot {
    const run = this.requireRun(runId);
    if (run.status === 'paused' && run.activeAgent) {
      run.activeAgent.resume();
      run.status = 'running';
      run.updatedAt = new Date().toISOString();
      this.pushTimeline(run, {
        type: 'resumed',
        summary: `Watch Mode retomado${requestedBy ? ` por ${requestedBy}` : ''}.`,
        iteration: run.agentSnapshot?.iteration || null,
        riskLevel: 'medium',
        action: run.agentSnapshot?.lastAction || null,
        result: null,
        screenshotPath: run.latestScreenshotPath,
        approvalId: null,
      });
    }
    this.deps.persistSnapshot();
    return this.toSnapshot(run);
  }

  public stopRun(runId: string, requestedBy: string | null = null): WatchModeRunSnapshot {
    const run = this.requireRun(runId);
    run.activeAgent?.stop();
    run.activeAgent = null;
    run.status = 'cancelled';
    run.finishedAt = new Date().toISOString();
    run.updatedAt = run.finishedAt;
    run.pendingApprovalId = null;
    this.rejectPendingWaiters(run);
    this.cleanupRunArtifacts(run);
    this.pushTimeline(run, {
      type: 'stopped',
      summary: `Stop solicitado${requestedBy ? ` por ${requestedBy}` : ''}.`,
      iteration: run.agentSnapshot?.iteration || null,
      riskLevel: 'high',
      action: run.agentSnapshot?.lastAction || null,
      result: null,
      screenshotPath: run.latestScreenshotPath,
      approvalId: null,
    });
    this.deps.persistSnapshot();
    return this.toSnapshot(run);
  }

  public decideApproval(input: {
    runId: string;
    approvalId: string;
    decision: WatchModeApprovalDecision;
    requestedBy?: string | null;
    note?: string | null;
  }): WatchModeRunSnapshot {
    const run = this.requireRun(input.runId);
    const approval = run.approvals.find((entry) => entry.approvalId === input.approvalId);
    if (!approval) {
      throw new Error('Approval do Watch Mode nao encontrado.');
    }
    if (approval.status !== 'pending') {
      throw new Error('Approval do Watch Mode ja foi decidido.');
    }
    approval.status = input.decision === 'approve' ? 'approved' : 'rejected';
    approval.decidedAt = new Date().toISOString();
    approval.decidedBy = this.normalizeOptional(input.requestedBy);
    approval.note = this.normalizeOptional(input.note);
    const requestedAt = Date.parse(approval.requestedAt);
    const decidedAt = Date.parse(approval.decidedAt);
    if (Number.isFinite(requestedAt) && Number.isFinite(decidedAt) && decidedAt >= requestedAt) {
      run.buffers.approvalLatencyTotalMs += decidedAt - requestedAt;
      run.buffers.approvalDecisions += 1;
    }
    run.updatedAt = approval.decidedAt;
    const waiter = run.waiterByApprovalId.get(approval.approvalId);
    if (!waiter) {
      throw new Error('Approval do Watch Mode nao possui handoff ativo.');
    }
    run.waiterByApprovalId.delete(approval.approvalId);
    waiter.resolve(input.decision);
    this.deps.persistSnapshot();
    return this.toSnapshot(run);
  }

  public resolveScreenshotPath(runId: string, entryId?: string | null): string | null {
    const run = this.requireRun(runId);
    if (run.budget.screenshotRedactionMode === 'metadata-only') {
      return null;
    }
    const targetEntry = entryId
      ? run.timeline.find((entry) => entry.entryId === entryId && entry.screenshotPath)
      : [...run.timeline].reverse().find((entry) => entry.screenshotPath);
    const screenshotPath = targetEntry?.screenshotPath || run.latestScreenshotPath;
    if (!screenshotPath || !fs.existsSync(screenshotPath)) {
      return null;
    }
    return path.resolve(screenshotPath);
  }

  private async ensureStartAllowed(input: StartWatchModeRunInput): Promise<void> {
    const stability = this.deps.runtimeStabilityControlPlaneService.buildSnapshot({ deepDoctor: false });
    if (stability?.gate?.status === 'failed') {
      throw new Error('Watch Mode bloqueado: Runtime Stability Gate esta failed.');
    }
    if (!this.deps.capabilityLifecycleService.shouldBootCapability('watch-mode')) {
      const preview = await this.deps.previewMutation({
        actionId: 'start',
        targetWindow: input.targetWindow,
        objective: input.objective,
        siteUrl: input.siteUrl,
        strictApproval: input.strictApproval,
        requestedBy: input.requestedBy || null,
        sourceSurface: 'watch-mode',
      });
      throw new Error(`Watch Mode dormente; approval necessario antes do start. Plan: ${preview.mutationPlan.id}.`);
    }
    const decision = await this.deps.trustDecisionService.evaluate({
      domain: 'watch',
      actionId: 'start',
      requestedBy: input.requestedBy || null,
      sourceSurface: 'watch-mode',
      riskLevel: 'high',
      approvalRequired: true,
      capabilityId: 'watch-mode',
      reason: 'Start visual supervisionado exige trust decision.',
      payload: {
        targetWindow: input.targetWindow,
        objective: input.objective,
        siteUrl: input.siteUrl || null,
      },
    });
    if (decision.decision !== 'allowed') {
      const preview = await this.deps.previewMutation({
        actionId: 'start',
        targetWindow: input.targetWindow,
        objective: input.objective,
        siteUrl: input.siteUrl,
        strictApproval: input.strictApproval,
        requestedBy: input.requestedBy || null,
        sourceSurface: 'watch-mode',
      });
      throw new Error(`${decision.reason} Plan: ${preview.mutationPlan.id}.`);
    }
  }

  private buildPlannedSummary(action: ComputerUseAction, iteration: number): string {
    const suffix = action.targetText || action.payload || action.windowTitle || 'sem alvo textual';
    return `Iteracao ${iteration}: agente planejou ${action.action} (${suffix}).`;
  }

  private buildFinishSummary(status: WatchModeRunStatus, error: string | null): string {
    if (status === 'completed') {
      return 'Watch Mode concluiu o objetivo.';
    }
    if (status === 'cancelled') {
      return 'Watch Mode foi cancelado antes de concluir o objetivo.';
    }
    if (status === 'failed') {
      return error || 'Watch Mode falhou durante a execucao.';
    }
    return `Watch Mode terminou com status ${status}.`;
  }

  private buildNextOperatorStep(run: InternalWatchModeRun): string {
    if (run.pendingApprovalId) {
      return 'Revise o screenshot e decida o approval pendente antes de liberar a proxima acao.';
    }
    if (run.buffers.throttledScreenshots > 0) {
      return `Replay visual com throttling ativo: ${run.buffers.throttledScreenshots} screenshot(s) agregados para reduzir ruido.`;
    }
    if (run.buffers.droppedTimelineEntries > 0) {
      return `Timeline compactada: ${run.buffers.droppedTimelineEntries} evento(s) antigos sairam do buffer local.`;
    }
    if (run.status === 'paused') {
      return 'Retome o run quando quiser continuar a supervisao visual.';
    }
    if (run.status === 'failed') {
      return 'Revise o ultimo erro, ajuste o objetivo ou a allowlist e rode novamente.';
    }
    if (run.status === 'completed') {
      return 'Compare o replay visual, valide o resultado e reutilize o run como baseline.';
    }
    if (run.allowlist.mode !== 'allowlisted') {
      return 'Considere allowlist do app/site para reduzir friccao nas proximas acoes visuais.';
    }
    return 'Acompanhe a timeline e use pause/stop se a proxima acao parecer arriscada.';
  }

  private mapFinalStatus(status: ComputerUseSnapshot['status']): WatchModeRunStatus {
    if (status === 'completed') {
      return 'completed';
    }
    if (status === 'cancelled') {
      return 'cancelled';
    }
    if (status === 'paused') {
      return 'paused';
    }
    if (status === 'failed') {
      return 'failed';
    }
    return 'completed';
  }

  private toFinishedTimelineType(status: WatchModeRunStatus): WatchModeTimelineType {
    if (status === 'failed') {
      return 'failed';
    }
    if (status === 'cancelled') {
      return 'cancelled';
    }
    return 'completed';
  }

  private inspectAllowlist(targetWindow: string, siteUrl: string | null): WatchModeAllowlistStatus {
    const normalizedWindow = targetWindow.trim().toLowerCase();
    const host = this.extractSiteHost(siteUrl);
    const appConfigured = this.deps.state.allowedApps.length > 0;
    const siteConfigured = this.deps.state.allowedSites.length > 0;
    const appMatched = appConfigured && this.deps.state.allowedApps.some((entry) => normalizedWindow.includes(entry));
    const siteMatched = siteConfigured && !!host && this.deps.state.allowedSites.some((entry) => host === entry || host.endsWith(`.${entry}`));
    return {
      appConfigured,
      appMatched,
      siteConfigured,
      siteMatched,
      mode: appMatched || siteMatched ? 'allowlisted' : 'guarded',
    };
  }

  private extractSiteHost(siteUrl: string | null): string | null {
    const normalized = this.normalizeOptional(siteUrl);
    if (!normalized) {
      return null;
    }
    try {
      const target = normalized.match(/^https?:\/\//i) ? normalized : `https://${normalized}`;
      return new URL(target).hostname.trim().toLowerCase();
    } catch (error: any) { logger.warn('[Computer Use Watch Mode Lifecycle] network request failed', error); return null; }
  }

  private pushTimeline(
    run: InternalWatchModeRun,
    entry: Omit<WatchModeTimelineEntry, 'entryId' | 'createdAt'>,
  ): void {
    const createdAt = new Date().toISOString();
    run.updatedAt = createdAt;
    run.timeline.unshift({
      entryId: `watch-entry-${Date.now()}-${run.timeline.length + 1}`,
      createdAt,
      ...entry,
      action: entry.action ? { ...entry.action } : null,
    });
    if (run.timeline.length > run.buffers.timelineLimit) {
      run.buffers.droppedTimelineEntries += run.timeline.length - run.buffers.timelineLimit;
      run.timeline = run.timeline.slice(0, run.buffers.timelineLimit);
    }
    this.deps.persistSnapshot();
  }

  private createApproval(run: InternalWatchModeRun, iteration: number, action: ComputerUseAction): WatchModeApproval {
    const approval: WatchModeApproval = {
      approvalId: `watch-approval-${Date.now()}-${run.approvals.length + 1}`,
      iteration,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
      note: null,
      action: { ...action },
      riskLevel: this.getRiskLevel(action, run.allowlist),
      screenshotPath: run.latestScreenshotPath,
      screenshotRedactionMode: run.budget.screenshotRedactionMode,
      sensitiveScreenPolicy: run.budget.sensitiveScreenPolicy,
    };
    run.approvals.unshift(approval);
    run.updatedAt = approval.requestedAt;
    return approval;
  }

  private requiresApproval(action: ComputerUseAction, run: InternalWatchModeRun): boolean {
    if (!this.isMutatingAction(action)) {
      return false;
    }
    if (run.strictApproval) {
      return true;
    }
    return run.allowlist.mode !== 'allowlisted';
  }

  private isMutatingAction(action: ComputerUseAction): boolean {
    return action.action === 'click-element' || action.action === 'type-text' || action.action === 'press-key';
  }

  private getRiskLevel(action: ComputerUseAction, allowlist: WatchModeAllowlistStatus): WatchModeRiskLevel {
    if (!this.isMutatingAction(action)) {
      return 'low';
    }
    return allowlist.mode === 'allowlisted' ? 'medium' : 'high';
  }

  private requireRun(runId: string): InternalWatchModeRun {
    const run = this.deps.state.runs.get(String(runId || '').trim());
    if (!run) {
      throw new Error('Run do Watch Mode nao encontrado.');
    }
    return run;
  }

  private rememberRun(run: InternalWatchModeRun): void {
    this.deps.state.runs.set(run.runId, run);
    this.deps.state.runOrder.unshift(run.runId);
    while (this.deps.state.runOrder.length > this.deps.state.maxRuns) {
      const removed = this.deps.state.runOrder.pop();
      if (removed) {
        this.deps.state.runs.delete(removed);
      }
    }
  }

  private findActiveRun(): InternalWatchModeRun | null {
    for (const runId of this.deps.state.runOrder) {
      const run = this.deps.state.runs.get(runId);
      if (!run) {
        continue;
      }
      if (run.status === 'running' || run.status === 'paused' || run.status === 'waiting_approval') {
        return run;
      }
    }
    return null;
  }

  private toSnapshot(run: InternalWatchModeRun): WatchModeRunSnapshot {
    return {
      runId: run.runId,
      status: run.status,
      requestedBy: run.requestedBy,
      targetWindow: run.targetWindow,
      objective: run.objective,
      siteUrl: run.siteUrl,
      strictApproval: run.strictApproval,
      budget: { ...run.budget },
      allowlist: { ...run.allowlist },
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      updatedAt: run.updatedAt,
      latestScreenshotPath: run.latestScreenshotPath,
      pendingApprovalId: run.pendingApprovalId,
      pendingApprovalCount: run.approvals.filter((entry) => entry.status === 'pending').length,
      nextOperatorStep: this.buildNextOperatorStep(run),
      lastError: run.lastError,
      buffers: {
        timelineEntries: run.timeline.length,
        timelineLimit: run.buffers.timelineLimit,
        artifactEntries: run.artifacts.length,
        artifactLimit: run.buffers.artifactLimit,
        screenshotThrottleMs: run.buffers.screenshotThrottleMs,
        throttledScreenshots: run.buffers.throttledScreenshots,
        droppedTimelineEntries: run.buffers.droppedTimelineEntries,
        persistedArtifacts: run.buffers.persistedArtifacts,
        approvalDecisions: run.buffers.approvalDecisions,
        averageApprovalLatencyMs: run.buffers.approvalDecisions > 0
          ? Math.round(run.buffers.approvalLatencyTotalMs / run.buffers.approvalDecisions)
          : 0,
        expiredArtifacts: run.buffers.expiredArtifacts,
        deletedScreenshotBytes: run.buffers.deletedScreenshotBytes,
        activeVisualHandles: run.activeAgent ? 1 : 0,
      },
      agent: run.agentSnapshot ? {
        ...run.agentSnapshot,
        history: [...run.agentSnapshot.history],
      } : null,
      approvals: run.approvals.map((entry) => ({ ...entry })),
      timeline: run.timeline.map((entry) => ({ ...entry, action: entry.action ? { ...entry.action } : null })),
      artifacts: run.artifacts.map((entry) => ({ ...entry })),
    };
  }

  private shouldThrottleScreenshotTimeline(run: InternalWatchModeRun): boolean {
    const lastEventAt = Date.parse(String(run.buffers.lastScreenshotTimelineAt || ''));
    if (!Number.isFinite(lastEventAt)) {
      return false;
    }
    return Date.now() - lastEventAt < run.buffers.screenshotThrottleMs;
  }

  private ensureRuntimeStabilityAllowsStart(): void {
    const stability = this.deps.runtimeStabilityControlPlaneService.buildSnapshot({ deepDoctor: false });
    if (stability?.gate?.status === 'failed' || stability?.summary?.posture === 'critical') {
      throw new Error('Watch Mode bloqueado: Runtime Stability Gate esta failed/critical.');
    }
  }

  private resolveRunBudget(input: StartWatchModeRunInput): WatchModeRunBudget {
    const base = this.deps.state.defaultBudget;
    return {
      maxIterations: this.positiveNumber(input.maxIterations, base.maxIterations),
      maxDurationMs: this.positiveNumber(input.maxDurationMs, base.maxDurationMs),
      maxScreenshots: this.positiveNumber(input.maxScreenshots, base.maxScreenshots),
      maxMemoryMb: this.positiveNumber(input.maxMemoryMb, base.maxMemoryMb),
      idleTtlMs: this.positiveNumber(input.idleTtlMs, base.idleTtlMs),
      delayBetweenActionsMs: this.positiveNumber(input.delayBetweenActionsMs, base.delayBetweenActionsMs),
      screenshotTtlMs: this.positiveNumber(input.screenshotTtlMs, base.screenshotTtlMs),
      maxScreenshotBytes: this.positiveNumber(input.maxScreenshotBytes, base.maxScreenshotBytes),
      screenshotRedactionMode: this.normalizeRedactionMode(input.screenshotRedactionMode, base.screenshotRedactionMode),
      sensitiveScreenPolicy: this.normalizeSensitiveScreenPolicy(input.sensitiveScreenPolicy, base.sensitiveScreenPolicy),
    };
  }

  private cleanupRunArtifacts(run: InternalWatchModeRun): void {
    const nowMs = Date.now();
    const retained: WatchModeArtifactEntry[] = [];
    for (const artifact of run.artifacts) {
      const expiresAtMs = Date.parse(String(artifact.expiresAt || ''));
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs) {
        run.buffers.expiredArtifacts += 1;
        this.deleteScreenshotArtifact(run, artifact);
        continue;
      }
      retained.push(artifact);
    }
    run.artifacts = retained;
    this.enforceScreenshotByteBudget(run);
  }

  private enforceScreenshotByteBudget(run: InternalWatchModeRun): void {
    let totalBytes = run.artifacts.reduce((total, artifact) => total + this.screenshotSize(artifact.screenshotPath), 0);
    while (run.artifacts.length > 0 && totalBytes > run.budget.maxScreenshotBytes) {
      const removed = run.artifacts.pop();
      if (!removed) {
        break;
      }
      totalBytes -= this.screenshotSize(removed.screenshotPath);
      this.deleteScreenshotArtifact(run, removed);
    }
  }

  private deleteScreenshotArtifact(run: InternalWatchModeRun, artifact: WatchModeArtifactEntry): void {
    const screenshotPath = this.normalizeOptional(artifact.screenshotPath);
    if (!screenshotPath || !fs.existsSync(screenshotPath)) {
      return;
    }
    try {
      const stats = fs.statSync(screenshotPath);
      if (!stats.isFile()) {
        return;
      }
      fs.unlinkSync(screenshotPath);
      run.buffers.deletedScreenshotBytes += stats.size;
    } catch (error: any) {
      // Artefatos travados nao podem quebrar stop/finalizacao.
      logger.warn('[Computer Use Watch Mode Lifecycle] file cleanup failed', error);
    }
  }

  private screenshotSize(screenshotPath: string | null): number {
    const normalized = this.normalizeOptional(screenshotPath);
    if (!normalized || !fs.existsSync(normalized)) {
      return 0;
    }
    try {
      const stats = fs.statSync(normalized);
      return stats.isFile() ? stats.size : 0;
    } catch (error: any) { logger.warn('[Computer Use Watch Mode Lifecycle] filesystem operation failed', error); return 0; }
  }

  private rejectPendingWaiters(run: InternalWatchModeRun): void {
    for (const waiter of run.waiterByApprovalId.values()) {
      waiter.resolve('reject');
    }
    run.waiterByApprovalId.clear();
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : fallback;
  }

  private normalizeRedactionMode(value: unknown, fallback: WatchModeRunBudget['screenshotRedactionMode']): WatchModeRunBudget['screenshotRedactionMode'] {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'metadata-only' || normalized === 'raw' || normalized === 'redacted') {
      return normalized;
    }
    return fallback;
  }

  private normalizeSensitiveScreenPolicy(value: unknown, fallback: WatchModeRunBudget['sensitiveScreenPolicy']): WatchModeRunBudget['sensitiveScreenPolicy'] {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'redact' || normalized === 'allow' || normalized === 'pause') {
      return normalized;
    }
    return fallback;
  }

  private recordScreenshotArtifact(
    run: InternalWatchModeRun,
    iteration: number,
    screenshotPath: string | null,
  ): void {
    this.cleanupRunArtifacts(run);
    const resolvedPath = this.normalizeOptional(screenshotPath);
    if (!resolvedPath) {
      return;
    }
    if (run.budget.screenshotRedactionMode === 'metadata-only') {
      run.buffers.throttledScreenshots += 1;
      return;
    }
    if (run.artifacts.length >= run.budget.maxScreenshots) {
      const removed = run.artifacts.pop();
      if (removed) {
        this.deleteScreenshotArtifact(run, removed);
      }
    }
    const artifact: WatchModeArtifactEntry = {
      artifactId: `watch-artifact-${Date.now()}-${run.artifacts.length + 1}`,
      kind: 'screenshot',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + run.budget.screenshotTtlMs).toISOString(),
      iteration: Number.isFinite(iteration) ? iteration : null,
      screenshotPath: path.resolve(resolvedPath),
      redactionMode: run.budget.screenshotRedactionMode,
      sensitiveScreenPolicy: run.budget.sensitiveScreenPolicy,
      sensitive: false,
    };
    run.artifacts.unshift(artifact);
    run.buffers.persistedArtifacts += 1;
    if (run.artifacts.length > run.buffers.artifactLimit) {
      const removed = run.artifacts.splice(run.buffers.artifactLimit);
      removed.forEach((entry) => this.deleteScreenshotArtifact(run, entry));
    }
    this.enforceScreenshotByteBudget(run);
  }

  private normalizeOptional(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
