import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { SnapshotRequest } from '../../../../contracts/InternalBoundaryContract.js';
import { InternalControlPlaneApiService } from '../../../../api/internal/InternalControlPlaneApiService.js';
import type { ZavorthEvalControlPlaneService } from '../../../../services/ZavorthEvalControlPlaneService.js';
import type { ZavorthQaControlPlaneService } from '../../../../services/ZavorthQaControlPlaneService.js';
import type { ZavorthGovernanceControlPlaneService } from '../../../../services/ZavorthGovernanceControlPlaneService.js';
import type { ZavorthReplayLearningControlPlaneService } from '../../../../services/ZavorthReplayLearningControlPlaneService.js';
import type { ZavorthEcosystemControlPlaneService } from '../../../../services/ZavorthEcosystemControlPlaneService.js';
import type { ZavorthDistributedRuntimeControlPlaneService } from '../../../../services/ZavorthDistributedRuntimeControlPlaneService.js';
import type { ZavorthRuntimeStabilityControlPlaneService } from '../../../../services/ZavorthRuntimeStabilityControlPlaneService.js';
import type { ZavorthRolloutReadinessControlPlaneService } from '../../../../services/ZavorthRolloutReadinessControlPlaneService.js';
import type { ZavorthNaturalSetupControlPlaneService } from '../../../../services/ZavorthNaturalSetupControlPlaneService.js';
import {
  buildReportSurfaceResponse,
  renderPlainSurfaceResponse,
  type SurfaceReceiptStatus,
} from '../../application/surface-response/index.js';

type SharedSurfaceControlPlaneCommandPackDeps = {
  evalControlPlaneService: Pick<ZavorthEvalControlPlaneService, 'buildSnapshot'>;
  qaControlPlaneService: Pick<ZavorthQaControlPlaneService, 'buildSnapshot' | 'renderReport'>;
  governanceControlPlaneService: Pick<ZavorthGovernanceControlPlaneService, 'buildSnapshot' | 'renderReport'>;
  replayLearningControlPlaneService: Pick<ZavorthReplayLearningControlPlaneService, 'buildSnapshot' | 'renderReport'>;
  ecosystemControlPlaneService: Pick<ZavorthEcosystemControlPlaneService, 'buildSnapshot' | 'renderReport'>;
  distributedRuntimeControlPlaneService: Pick<
    ZavorthDistributedRuntimeControlPlaneService,
    'buildSnapshot' | 'renderReport'
  >;
  runtimeStabilityControlPlaneService: Pick<
    ZavorthRuntimeStabilityControlPlaneService,
    'buildSnapshot' | 'renderReport'
  >;
  rolloutReadinessControlPlaneService: Pick<
    ZavorthRolloutReadinessControlPlaneService,
    'buildSnapshot' | 'renderReport'
  >;
  naturalSetupControlPlaneService: Pick<ZavorthNaturalSetupControlPlaneService, 'buildSnapshot' | 'renderReport'>;
};

type EvalControlPlaneSnapshot = {
  summary: {
    posture: string;
    scorecards: string;
    datasets: string;
    regressions: string;
  };
  narrative: { operatorSummary: string };
  telemetry: {
    status: string;
    totalEvents: number;
    traceCount: number;
    failureEvents: number;
    recommendation?: string;
    traces?: Array<{ source: string; status: string; eventCount: number; lastEventType: string }>;
  };
  history: {
    entries: number;
    recommendation?: string;
    delta: { regressions: number; traceCount: number };
    trend?: Array<{ posture: string; generatedAt: string }>;
  };
  regressions?: Array<{ label: string; severity: string }>;
};

export class SharedSurfaceControlPlaneCommandPack {
  private readonly controlPlaneApi: InternalControlPlaneApiService;

  constructor(private readonly deps: SharedSurfaceControlPlaneCommandPackDeps) {
    this.controlPlaneApi = new InternalControlPlaneApiService({
      planes: [
        {
          id: 'evals',
          label: 'Eval observability evals',
          buildSnapshot: (request) =>
            this.deps.evalControlPlaneService.buildSnapshot(this.readEvalsQuery(request.query)),
        },
        {
          id: 'qa',
          label: 'QA release QA',
          buildSnapshot: (request) =>
            this.deps.qaControlPlaneService.buildSnapshot({
              profile: this.readString(request.query, 'profile') || undefined,
            }),
          renderReport: (request) =>
            this.deps.qaControlPlaneService.renderReport({
              profile: this.readString(request.query, 'profile') || undefined,
            }),
        },
        {
          id: 'governance',
          label: 'Governance governance',
          buildSnapshot: (request) =>
            this.deps.governanceControlPlaneService.buildSnapshot({
              limit: this.readNumber(request.query, 'limit') || undefined,
            }),
          renderReport: (request) =>
            this.deps.governanceControlPlaneService.renderReport({
              limit: this.readNumber(request.query, 'limit') || undefined,
            }),
        },
        {
          id: 'replay-learning',
          label: 'Replay learning replay learning',
          buildSnapshot: (request) =>
            this.deps.replayLearningControlPlaneService.buildSnapshot({
              userId: this.readNullableString(request.query, 'userId'),
              platform: this.readNullableString(request.query, 'platform'),
              chatId: this.readNullableString(request.query, 'chatId'),
              limit: this.readNumber(request.query, 'limit') || undefined,
            }),
          renderReport: (request) =>
            this.deps.replayLearningControlPlaneService.renderReport({
              userId: this.readNullableString(request.query, 'userId'),
              platform: this.readNullableString(request.query, 'platform'),
              chatId: this.readNullableString(request.query, 'chatId'),
              limit: this.readNumber(request.query, 'limit') || undefined,
            }),
        },
        {
          id: 'ecosystem',
          label: 'Ecosystem ecosystem',
          buildSnapshot: (request) =>
            this.deps.ecosystemControlPlaneService.buildSnapshot({
              selectedId: this.readNullableString(request.query, 'selectedId'),
              query: this.readNullableString(request.query, 'query'),
            }),
          renderReport: (request) =>
            this.deps.ecosystemControlPlaneService.renderReport({
              selectedId: this.readNullableString(request.query, 'selectedId'),
              query: this.readNullableString(request.query, 'query'),
            }),
        },
        {
          id: 'distributed-runtime',
          label: 'Distributed runtime distributed runtime',
          buildSnapshot: (request) =>
            this.deps.distributedRuntimeControlPlaneService.buildSnapshot({
              selectedId: this.readNullableString(request.query, 'selectedId'),
              query: this.readNullableString(request.query, 'query'),
            }),
          renderReport: (request) =>
            this.deps.distributedRuntimeControlPlaneService.renderReport({
              selectedId: this.readNullableString(request.query, 'selectedId'),
              query: this.readNullableString(request.query, 'query'),
            }),
        },
        {
          id: 'runtime-stability',
          label: 'Runtime stability',
          buildSnapshot: (request) => {
            const deepDoctor =
              this.readOptionalBoolean(request.query, 'deepDoctor') ||
              this.readOptionalBoolean(request.query, 'refresh');
            return deepDoctor === true
              ? this.deps.runtimeStabilityControlPlaneService.buildSnapshot({ deepDoctor: true })
              : this.deps.runtimeStabilityControlPlaneService.buildSnapshot();
          },
          renderReport: (request) => {
            const deepDoctor =
              this.readOptionalBoolean(request.query, 'deepDoctor') ||
              this.readOptionalBoolean(request.query, 'refresh');
            return deepDoctor === true
              ? this.deps.runtimeStabilityControlPlaneService.renderReport({ deepDoctor: true })
              : this.deps.runtimeStabilityControlPlaneService.renderReport();
          },
        },
        {
          id: 'rollout-readiness',
          label: 'Rollout readiness',
          buildSnapshot: (request) =>
            this.deps.rolloutReadinessControlPlaneService.buildSnapshot({
              profile: this.readNullableString(request.query, 'profile'),
              scope: this.readNullableString(request.query, 'scope'),
              refresh: this.readOptionalBoolean(request.query, 'refresh'),
              includeSources:
                this.readOptionalBoolean(request.query, 'includeSources') ||
                this.readOptionalBoolean(request.query, 'full'),
            }),
          renderReport: (request) =>
            this.deps.rolloutReadinessControlPlaneService.renderReport({
              profile: this.readNullableString(request.query, 'profile'),
              scope: this.readNullableString(request.query, 'scope'),
              refresh: this.readOptionalBoolean(request.query, 'refresh'),
            }),
        },
        {
          id: 'natural-setup',
          label: 'Natural setup',
          buildSnapshot: (request) =>
            this.deps.naturalSetupControlPlaneService.buildSnapshot({
              intentText: this.readNullableString(request.query, 'intentText'),
              channelId: this.readNullableString(request.query, 'channelId'),
              mode: this.readNullableString(request.query, 'mode'),
              autoApply: this.readOptionalBoolean(request.query, 'apply'),
              autoDoctor: this.readOptionalBoolean(request.query, 'doctor'),
              autoTest: this.readOptionalBoolean(request.query, 'test'),
              localOnly: this.readOptionalBoolean(request.query, 'localOnly'),
            }),
          renderReport: (request) =>
            this.deps.naturalSetupControlPlaneService.renderReport({
              intentText: this.readNullableString(request.query, 'intentText'),
              channelId: this.readNullableString(request.query, 'channelId'),
              mode: this.readNullableString(request.query, 'mode'),
              autoApply: this.readOptionalBoolean(request.query, 'apply'),
              autoDoctor: this.readOptionalBoolean(request.query, 'doctor'),
              autoTest: this.readOptionalBoolean(request.query, 'test'),
              localOnly: this.readOptionalBoolean(request.query, 'localOnly'),
            }),
        },
      ],
    });
  }

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    switch (commandType) {
      case '/evals':
        await this.handleEvals(ctx, args);
        return true;
      case '/qa':
        await ctx.reply(
          await this.renderPlaneReport(ctx, 'qa', {
            profile: this.normalizeProfileArg(args),
          }),
        );
        return true;
      case '/governance':
        await ctx.reply(
          await this.renderPlaneReport(ctx, 'governance', {
            limit: this.extractLimitArg(args, 8),
          }),
        );
        return true;
      case '/replayloop':
        await ctx.reply(
          await this.renderPlaneReport(ctx, 'replay-learning', {
            userId: String(ctx.userId || '').trim() || null,
            platform: ctx.platform,
            chatId: String(ctx.chatId || '').trim() || null,
            limit: this.extractLimitArg(args, 8),
          }),
        );
        return true;
      case '/ecosystem': {
        const normalizedArgs = String(args || '').trim();
        await ctx.reply(
          await this.renderPlaneReport(ctx, 'ecosystem', {
            selectedId: normalizedArgs || null,
            query: normalizedArgs || null,
          }),
        );
        return true;
      }
      case '/fleet': {
        const normalizedArgs = String(args || '').trim();
        await ctx.reply(
          await this.renderPlaneReport(ctx, 'distributed-runtime', {
            selectedId: normalizedArgs || null,
            query: normalizedArgs || null,
          }),
        );
        return true;
      }
      case '/stability':
        await ctx.reply(
          await this.renderPlaneReport(ctx, 'runtime-stability', {
            refresh: this.hasBooleanFlag(args, [
              'refresh',
              '--refresh',
              'deepDoctor',
              '--deepDoctor',
              'deep',
              '--deep',
            ]),
          }),
        );
        return true;
      case '/rolloutqa':
        await ctx.reply(
          await this.renderPlaneReport(ctx, 'rollout-readiness', {
            profile: this.normalizeProfileArg(args),
            scope: this.normalizeRolloutScopeArg(args),
            refresh: this.hasBooleanFlag(args, ['refresh', '--refresh']),
          }),
        );
        return true;
      case '/setupagent': {
        const normalizedArgs = String(args || '').trim();
        await ctx.reply(
          await this.renderPlaneReport(ctx, 'natural-setup', {
            intentText: normalizedArgs || null,
            channelId: this.readFlag(args, ['channel', '--channel']),
            mode: this.readFlag(args, ['mode', '--mode']),
            apply: this.hasBooleanFlag(args, ['apply', '--apply', 'scaffold', '--scaffold']),
            doctor: this.hasBooleanFlag(args, ['doctor', '--doctor', 'validate', '--validate']),
            test: this.hasBooleanFlag(args, ['test', '--test', 'send-test', '--send-test']),
            localOnly: this.hasBooleanFlag(args, ['local-only', '--local-only', 'localOnly']),
          }),
        );
        return true;
      }
      default:
        return false;
    }
  }

  private async handleEvals(ctx: IMessageContext, args: string): Promise<void> {
    const snapshotResult = await this.controlPlaneApi.readSnapshot<EvalControlPlaneSnapshot>(
      this.buildSnapshotRequest(ctx, 'evals', {
        workspace: this.readFlag(args, ['workspace', '--workspace']),
        sourceSurface: this.readFlag(args, ['surface', '--surface', 'sourceSurface', '--source-surface']),
        executor: this.readFlag(args, ['executor', '--executor']),
        workflow: this.readFlag(args, ['workflow', '--workflow']),
      }),
    );
    if (!snapshotResult.ok || !snapshotResult.data) {
      await ctx.reply(
        this.renderControlPlaneReport('evals', 'Eval observability: Eval + Observability', snapshotResult.summary, {
          status: 'failed',
        }),
      );
      return;
    }
    const snapshot = snapshotResult.data;
    const topRegression = snapshot.regressions?.[0] || null;
    const topTrace = snapshot.telemetry?.traces?.[0] || null;
    const latestTrend = snapshot.history?.trend?.[snapshot.history.trend.length - 1] || null;
    const text = [
      'Eval observability: Eval + Observability',
      '',
      `Postura: ${snapshot.summary.posture}`,
      snapshot.narrative.operatorSummary,
      `Scorecards: ${snapshot.summary.scorecards} | datasets: ${snapshot.summary.datasets} | regressions: ${snapshot.summary.regressions}`,
      `Telemetry: ${snapshot.telemetry.status} | events=${snapshot.telemetry.totalEvents} | traces=${snapshot.telemetry.traceCount} | failures=${snapshot.telemetry.failureEvents}`,
      `History: ${snapshot.history.entries} window(s) | delta regressions=${snapshot.history.delta.regressions} | delta traces=${snapshot.history.delta.traceCount}`,
      topRegression ? `Largest regression: ${topRegression.label} (${topRegression.severity})`
        : 'Largest regression: none highlighted in this window.',
      topTrace ? `Trace foco: ${topTrace.source} | ${topTrace.status} | ${topTrace.eventCount} evento(s) | ${topTrace.lastEventType}`
        : 'Trace foco: without traces recentes nesta window.',
      latestTrend ? `Latest baseline: ${latestTrend.posture} em ${latestTrend.generatedAt}`
        : 'Latest baseline: history still short on this host.',
      snapshot.telemetry.recommendation ? `Recomendaction: ${snapshot.telemetry.recommendation}` : null,
      snapshot.history.recommendation ? `Tendencia: ${snapshot.history.recommendation}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    await ctx.reply(
      this.renderControlPlaneReport('evals', 'Eval observability: Eval + Observability', text, {
        query: this.readEvalsQuery(
          this.buildSnapshotRequest(ctx, 'evals', {
            workspace: this.readFlag(args, ['workspace', '--workspace']),
            sourceSurface: this.readFlag(args, ['surface', '--surface', 'sourceSurface', '--source-surface']),
            executor: this.readFlag(args, ['executor', '--executor']),
            workflow: this.readFlag(args, ['workflow', '--workflow']),
          }).query,
        ),
      }),
    );
  }

  private async renderPlaneReport(
    ctx: IMessageContext,
    planeId: string,
    query: Record<string, unknown> = {},
  ): Promise<string> {
    const request = this.buildSnapshotRequest(ctx, planeId, query);
    const report = await this.controlPlaneApi.renderReport(request);
    if (report) {
      return this.renderControlPlaneReport(planeId, this.getPlaneTitle(planeId), report, { query });
    }
    const snapshot = await this.controlPlaneApi.readSnapshot(request);
    if (!snapshot.ok) {
      return this.renderControlPlaneReport(planeId, this.getPlaneTitle(planeId), snapshot.summary, {
        query,
        status: 'failed',
      });
    }
    return this.renderControlPlaneReport(planeId, this.getPlaneTitle(planeId), JSON.stringify(snapshot.data, null, 2), {
      query,
    });
  }

  private renderControlPlaneReport(
    planeId: string,
    title: string,
    text: string,
    options: {
      query?: Record<string, unknown>;
      status?: SurfaceReceiptStatus;
    } = {},
  ): string {
    return renderPlainSurfaceResponse(
      buildReportSurfaceResponse({
        id: `control-plane-${planeId}`,
        title,
        text,
        status: options.status || 'done',
        policyProfile: 'shared-control-plane',
        metadata: {
          planeId,
          query: options.query || null,
        },
      }),
    ).text;
  }

  private getPlaneTitle(planeId: string): string {
    switch (planeId) {
      case 'evals':
        return 'Eval observability: Eval + Observability';
      case 'qa':
        return 'QA release: QA, budgets e release gates';
      case 'governance':
        return 'Governance governance';
      case 'replay-learning':
        return 'Replay learning';
      case 'ecosystem':
        return 'Ecosystem control plane';
      case 'distributed-runtime':
        return 'Distributed runtime';
      case 'runtime-stability':
        return 'Runtime stability';
      case 'rollout-readiness':
        return 'Rollout readiness';
      case 'natural-setup':
        return 'Natural setup';
      default:
        return 'Zavorth control plane';
    }
  }

  private buildSnapshotRequest(
    ctx: IMessageContext,
    planeId: string,
    query: Record<string, unknown> = {},
  ): SnapshotRequest {
    return {
      planeId,
      surface: ctx.platform,
      requestedBy: String(ctx.userId || '').trim() || 'anonymous',
      query,
    };
  }

  private normalizeProfileArg(args: string): string {
    const explicit = this.readFlag(args, ['profile', '--profile']);
    const normalizedArgs = String(explicit || args || '')
      .trim()
      .toLowerCase();
    return /\bbeta\b/.test(normalizedArgs) ? 'beta' : 'alpha';
  }

  private normalizeRolloutScopeArg(args: string): string {
    const explicit = this.readFlag(args, ['scope', '--scope']);
    const normalizedArgs = String(explicit || args || '')
      .trim()
      .toLowerCase();
    if (/\brollback-only\b/.test(normalizedArgs)) {
      return 'rollback-only';
    }
    if (/\bproduction\b|\bprod\b/.test(normalizedArgs)) {
      return 'production';
    }
    if (/\bbeta\b/.test(normalizedArgs)) {
      return 'beta';
    }
    return 'local';
  }

  private extractLimitArg(args: string, fallback: number): number {
    const limitMatch = String(args || '').match(/\b(?:limit|limite)\s*=?\s*(\d{1,2})\b/i);
    return limitMatch ? Number(limitMatch[1]) : fallback;
  }

  private readFlag(args: string, flagNames: string[]): string | null {
    const normalizedArgs = String(args || '').trim();
    for (const flag of flagNames) {
      const match = normalizedArgs.match(new RegExp(`(?:^|\\s)${flag}\\s*=...\\s*([^\\s]+)`, 'i'));
      if (match?.[1]) {
        return String(match[1]).trim() || null;
      }
    }
    return null;
  }

  private hasBooleanFlag(args: string, flagNames: string[]): boolean {
    const normalizedArgs = String(args || '')
      .trim()
      .toLowerCase();
    return flagNames.some((flag) => {
      const normalizedFlag = flag.replace(/^--/, '').toLowerCase();
      return new RegExp(`(?:^|\\s)--...${normalizedFlag}(?:\\s|$|=true\\b)`, 'i').test(normalizedArgs);
    });
  }

  private readEvalsQuery(query: SnapshotRequest['query']) {
    return {
      workspace: this.readNullableString(query, 'workspace'),
      sourceSurface: this.readNullableString(query, 'sourceSurface'),
      executor: this.readNullableString(query, 'executor'),
      workflow: this.readNullableString(query, 'workflow'),
    };
  }

  private readString(query: SnapshotRequest['query'], key: string): string {
    return String(query?.[key] || '').trim();
  }

  private readNullableString(query: SnapshotRequest['query'], key: string): string | null {
    const value = this.readString(query, key);
    return value.length > 0 ? value : null;
  }

  private readNumber(query: SnapshotRequest['query'], key: string): number | null {
    const raw = Number(query?.[key]);
    return Number.isFinite(raw) ? raw : null;
  }

  private readBoolean(query: SnapshotRequest['query'], key: string): boolean {
    return query?.[key] === true;
  }

  private readOptionalBoolean(query: SnapshotRequest['query'], key: string): boolean | undefined {
    return query?.[key] === true ? true : undefined;
  }
}
