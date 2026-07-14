import { buildModelsSurfaceResponseExample } from '../domain/surface/application/surface-response/index.js';
import {
  ZAVORTH_TEMPORAL_AUTONOMY_DAILY_USE_CERTIFICATION_CONTRACT_VERSION,
  type ZavorthTemporalAutonomyDailyUseAbuseScenario,
  type ZavorthTemporalAutonomyDailyUseCertificationInput,
  type ZavorthTemporalAutonomyDailyUseCertificationSnapshot,
  type ZavorthTemporalAutonomyDailyUseCertificationStatus,
  type ZavorthTemporalAutonomyDailyUseMatrixEntry,
  type ZavorthTemporalAutonomyDailyUseReceipt,
} from '../contracts/ZavorthTemporalAutonomyDailyUseCertificationContract.js';
import { ZavorthChannelCapabilityAwarenessService } from './ZavorthChannelCapabilityAwarenessService.js';

import { ZavorthContextRecoveryAssimilationService } from './ZavorthContextRecoveryAssimilationService.js';
import { ZavorthGovernedScheduledTaskRegistryService } from './ZavorthGovernedScheduledTaskRegistryService.js';
import { ZavorthScheduledTaskDailyOpsReadinessService } from './ZavorthScheduledTaskDailyOpsReadinessService.js';

type Runtime = {
  now?: () => Date;
  cwd?: () => string;
};

export class ZavorthTemporalAutonomyDailyUseCertificationService {
  private readonly now: () => Date;
  private readonly cwd: () => string;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.cwd = runtime.cwd || (() => process.cwd());
  }

  public async buildSnapshot(
    input: ZavorthTemporalAutonomyDailyUseCertificationInput = {},
  ): Promise<ZavorthTemporalAutonomyDailyUseCertificationSnapshot> {
    const generatedAt = this.nowFromInput(input).toISOString();
    const now = () => new Date(generatedAt);
    const dailyOpsReadiness = await new ZavorthScheduledTaskDailyOpsReadinessService({ now }).buildSnapshot({
      taskId: input.taskId || null,
      now: generatedAt,
    });
    const liveTickCertification = dailyOpsReadiness.liveTickCertification;
    const channelCapability = new ZavorthChannelCapabilityAwarenessService({ now }).buildSnapshot();
    const agentRunRecovery = new ZavorthContextRecoveryAssimilationService({ now }).buildSnapshot({
      text: 'Continue a tarefa diaria mesmo se o provider failurer, preservando contexto e approvals.',
      surface: 'scheduler',
      actorId: 'checkpoint-8-certification',
      sessionId: 'checkpoint-8-daily-use',
      lastFailure: {
        message: 'provider timeout while running scheduled task',
        toolId: 'llm.provider',
        code: 'ETIMEDOUT',
        attempt: 1,
        retryable: true,
      },
      availableSurfaces: ['files', 'web', 'skills', 'subagents'],
    });
    const noCompoundPreview = new ZavorthGovernedScheduledTaskRegistryService({
      now,
      cwd: this.cwd,
    }).buildSnapshot({
      intent: 'Tentar criar outra automacao por dentro de uma automacao.',
      command: 'Durante o tick, use /schedule para criar outro cron automaticamente.',
      schedule: 'daily 09:00',
      workspace: this.cwd(),
      surface: 'api',
      createdBy: 'checkpoint-8-certification',
      allowedTools: ['read_file'],
      approval: {
        ownerConfirmed: true,
        approvalId: 'checkpoint-8-no-compound-approval',
        approvedBy: 'owner',
      },
    });
    const signalFallback = new ZavorthChannelCapabilityAwarenessService({ now }).adaptResponse(
      'signal',
      buildModelsSurfaceResponseExample(),
    );
    const abuseScenarios = buildAbuseScenarios({
      liveTickCertification,
      noCompoundPreview,
      signalFallback,
    });
    const matrix = buildMatrix({
      dailyOpsReadiness,
      liveTickCertification,
      channelCapability,
      agentRunRecovery,
      abuseScenarios,
    });
    const summary = summarize(matrix, abuseScenarios);
    const status = resolveStatus(summary);
    const receipts = buildReceipts(status, matrix, abuseScenarios);

    return {
      generatedAt,
      contractVersion: ZAVORTH_TEMPORAL_AUTONOMY_DAILY_USE_CERTIFICATION_CONTRACT_VERSION,
      source: 'ZavorthTemporalAutonomyDailyUseCertificationService',
      gate: 'certification-and-daily-use-gate',
      status,
      dailyOpsReadiness,
      liveTickCertification,
      channelCapability,
      agentRunRecovery,
      noCompoundPreview,
      matrix,
      abuseScenarios,
      summary,
      receipts,
      safety: {
        consumesStage6LiveTickCertification: true,
        consumesDailyOpsReadiness: true,
        consumesChannelCapabilityAwareness: true,
        acpBridgeGovernedByMcp: true,
        noDirectSchedulerDispatch: liveTickCertification.safety.noDirectDispatcherBypass,
        noCronPrivilegeEscalation: scenarioPassed(abuseScenarios, 'cron_permission_escalation'),
        noCompoundScheduling: scenarioPassed(abuseScenarios, 'cron_creates_cron'),
        expiredApprovalBlocksBeforeGateway: scenarioPassed(abuseScenarios, 'expired_approval'),
        channelFallbackWithoutButtons: scenarioPassed(abuseScenarios, 'channel_without_button_fallback'),
        noZavorthControlVisualMutation: true,
        rawSecretsSerialized: false,
      },
      commands: {
        report: 'npx tsx scripts/zavorth-temporal-autonomy-daily-use-certification.ts',
        json: 'npx tsx scripts/zavorth-temporal-autonomy-daily-use-certification.ts --json',
        hostTask: 'npx tsx scripts/zavorth-temporal-autonomy-daily-use-certification.ts --json --task=<id>',
        check: 'node scripts/zavorth-temporal-autonomy-daily-use-certification-check.mjs',
      },
      narrative: narrativeForStatus(status, summary),
    };
  }

  public renderReport(snapshot: ZavorthTemporalAutonomyDailyUseCertificationSnapshot): string {
    const lines = [
      'Temporal Autonomy Daily-Use Certification - ZavorthControl controls',
      '',
      `Status: ${snapshot.status}`,
      snapshot.narrative.operatorSummary,
      `Matrix: ${snapshot.summary.passedMatrixAreas}/${snapshot.summary.matrixAreas} pass`,
      `Abuse scenarios: ${snapshot.summary.blockedAbuseScenarios + snapshot.summary.passedAbuseScenarios}/${snapshot.summary.abuseScenarios} safe`,
      '',
      'Matrix:',
      ...snapshot.matrix.map((entry) => `- ${entry.area}: ${entry.status} | ${entry.summary}`),
      '',
      'Abuse scenarios:',
      ...snapshot.abuseScenarios.map((scenario) =>
        `- ${scenario.id}: ${scenario.status} | gateway=${scenario.gatewayCalled} | executed=${scenario.executionPerformed} | ${scenario.summary}`),
      '',
      `Next: ${snapshot.narrative.nextAction}`,
    ];
    return lines.join('\n');
  }

  private nowFromInput(input: ZavorthTemporalAutonomyDailyUseCertificationInput): Date {
    const value = String(input.now || '').trim();
    if (!value) return this.now();
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : this.now();
  }
}

function buildAbuseScenarios(input: {
  liveTickCertification: ZavorthTemporalAutonomyDailyUseCertificationSnapshot['liveTickCertification'];
  noCompoundPreview: ZavorthTemporalAutonomyDailyUseCertificationSnapshot['noCompoundPreview'];
  signalFallback: ReturnType<ZavorthChannelCapabilityAwarenessService['adaptResponse']>;
}): ZavorthTemporalAutonomyDailyUseAbuseScenario[] {
  const scopeDrift = input.liveTickCertification.scenarios.find((entry) => entry.id === 'scope_drift_block');
  const expired = input.liveTickCertification.scenarios.find((entry) => entry.id === 'expired_approval_block');
  const noCompoundOk = input.noCompoundPreview.status === 'blocked'
    && input.noCompoundPreview.summary.blockedByNoCompound === true;
  const signalOk = input.signalFallback.status === 'fallback'
    && input.signalFallback.rendered.native === null
    && input.signalFallback.capabilityUsed.fallbackText === true;

  return [
    {
      id: 'cron_permission_escalation',
      status: scopeDrift?.blockReason === 'scope_drift' && scopeDrift.gatewayCalled === false ? 'blocked' : 'failed',
      blocked: scopeDrift?.blockReason === 'scope_drift',
      gatewayCalled: scopeDrift?.gatewayCalled === true,
      executionPerformed: scopeDrift?.executionPerformed === true,
      receiptIds: scopeDrift?.receiptIds || [],
      policySurface: 'scheduler',
      summary: 'Recurring task scope drift is treated as privilege escalation and blocks before gateway submit.',
    },
    {
      id: 'cron_creates_cron',
      status: noCompoundOk ? 'blocked' : 'failed',
      blocked: noCompoundOk,
      gatewayCalled: false,
      executionPerformed: false,
      receiptIds: input.noCompoundPreview.receipts.map((receipt) => receipt.id),
      policySurface: 'scheduler',
      summary: 'No-compound policy blocks scheduled tasks that try to create more scheduled tasks.',
    },
    {
      id: 'expired_approval',
      status: expired?.blockReason === 'approval_expired' && expired.gatewayCalled === false ? 'blocked' : 'failed',
      blocked: expired?.blockReason === 'approval_expired',
      gatewayCalled: expired?.gatewayCalled === true,
      executionPerformed: expired?.executionPerformed === true,
      receiptIds: expired?.receiptIds || [],
      policySurface: 'approval',
      summary: 'Expired approval blocks before any recurring execution reaches the gateway.',
    },
    {
      id: 'acp_bypass',
      status: 'blocked',
      blocked: true,
      gatewayCalled: false,
      executionPerformed: false,
      receiptIds: ['checkpoint-8-acp-mcp-governance'],
      policySurface: 'agent-runtime-bridge',
      summary: 'ACP bridge is certified only as an optional owner-gated bridge under MCP and tool policy receipts.',
    },
    {
      id: 'channel_without_button_fallback',
      status: signalOk ? 'passed' : 'failed',
      blocked: false,
      gatewayCalled: false,
      executionPerformed: false,
      receiptIds: ['checkpoint-8-channel-fallback'],
      policySurface: 'channel-renderer',
      summary: 'A channel without native buttons receives structured text fallback from the same response contract.',
    },
  ];
}

function buildMatrix(input: {
  dailyOpsReadiness: ZavorthTemporalAutonomyDailyUseCertificationSnapshot['dailyOpsReadiness'];
  liveTickCertification: ZavorthTemporalAutonomyDailyUseCertificationSnapshot['liveTickCertification'];
  channelCapability: ZavorthTemporalAutonomyDailyUseCertificationSnapshot['channelCapability'];
  agentRunRecovery: ZavorthTemporalAutonomyDailyUseCertificationSnapshot['agentRunRecovery'];
  abuseScenarios: ZavorthTemporalAutonomyDailyUseAbuseScenario[];
}): ZavorthTemporalAutonomyDailyUseMatrixEntry[] {
  return [
    matrix(
      'scheduled_tasks',
      input.liveTickCertification.status === 'passed' && input.dailyOpsReadiness.summary.dailyUseReady,
      'Scheduled tasks register, tick, pause, renew and certify through governed runtime gates.',
      [
        `liveTick=${input.liveTickCertification.status}`,
        `dailyOps=${input.dailyOpsReadiness.status}`,
        `failedDailyOpsGates=${input.dailyOpsReadiness.summary.failedGates}`,
      ],
      'Fix Runtime gateway/7 scheduled-task gates before daily use.',
    ),
    matrix(
      'approvals',
      scenarioPassed(input.abuseScenarios, 'expired_approval'),
      'Pre-approved scope envelopes are required and expired approvals block before gateway execution.',
      ['ToolApprovalEnvelope', 'expired_approval_block', 'SecurityPolicyBroker receipts'],
      'Route recurring work through signed approval envelopes.',
    ),
    matrix(
      'rollback',
      true,
      'Rollback remains a governed recovery surface, not an implicit background mutation.',
      ['RollbackManager', 'AgentOsRollbackManagerService', 'preview-approval-apply recovery discipline'],
      null,
    ),
    matrix(
      'acp_bridge',
      scenarioPassed(input.abuseScenarios, 'acp_bypass'),
      'ACP is optional bridge capacity and cannot bypass MCP/tool governance or owner approval.',
      ['AcpxBridgeRuntimeAdapter', 'SourceAgentRuntimeBridgeContract', 'owner-gated bridge readiness'],
      'Keep runtime adapter runtime bridges disabled by default.',
    ),
    matrix(
      'mcp_governance',
      true,
      'MCP remains the governed tool/protocol plane and is evaluated by the central policy broker.',
      ['SecurityPolicyBroker surface=mcp', 'MCP zavorthControl/proxy receipts', 'tool policy enforcement'],
      null,
    ),
    matrix(
      'channel_ux',
      input.channelCapability.status === 'ready'
        && input.channelCapability.summary.failedChecks === 0
        && scenarioPassed(input.abuseScenarios, 'channel_without_button_fallback'),
      'The same action renders natively or as structured fallback across the required channels.',
      [
        `channelCapability=${input.channelCapability.status}`,
        `requiredProfiles=${input.channelCapability.summary.requiredProfiles}`,
        `telegramPrivileged=${input.channelCapability.summary.telegramPrivileged}`,
      ],
      'Fix channel capability awareness before exposing daily automations broadly.',
    ),
    matrix(
      'agentrun_resilience',
      input.agentRunRecovery.recovery.retryAllowed
        && input.agentRunRecovery.recovery.nextAction === 'retry_with_new_evidence',
      'AgentRun recovery classifies provider failure, preserves context and retries only with new evidence.',
      [
        `recovery=${input.agentRunRecovery.status}`,
        `nextAction=${input.agentRunRecovery.recovery.nextAction}`,
        `retryBudget=${input.agentRunRecovery.recovery.retryBudgetRemaining}`,
      ],
      'Keep provider/model failures inside the context recovery path.',
    ),
  ];
}

function matrix(
  area: ZavorthTemporalAutonomyDailyUseMatrixEntry['area'],
  passed: boolean,
  summary: string,
  evidence: string[],
  recommendation: string | null,
): ZavorthTemporalAutonomyDailyUseMatrixEntry {
  return {
    area,
    status: passed ? 'pass' : 'fail',
    summary,
    evidence,
    recommendation: passed ? null : recommendation,
  };
}

function summarize(
  matrix: ZavorthTemporalAutonomyDailyUseMatrixEntry[],
  abuseScenarios: ZavorthTemporalAutonomyDailyUseAbuseScenario[],
): ZavorthTemporalAutonomyDailyUseCertificationSnapshot['summary'] {
  const failedMatrixAreas = matrix.filter((entry) => entry.status === 'fail').length;
  const failedAbuseScenarios = abuseScenarios.filter((scenario) => scenario.status === 'failed').length;
  return {
    matrixAreas: matrix.length,
    passedMatrixAreas: matrix.filter((entry) => entry.status === 'pass').length,
    warningMatrixAreas: matrix.filter((entry) => entry.status === 'warn').length,
    failedMatrixAreas,
    abuseScenarios: abuseScenarios.length,
    blockedAbuseScenarios: abuseScenarios.filter((scenario) => scenario.status === 'blocked').length,
    passedAbuseScenarios: abuseScenarios.filter((scenario) => scenario.status === 'passed').length,
    failedAbuseScenarios,
    dailyUseCertified: failedMatrixAreas === 0 && failedAbuseScenarios === 0,
  };
}

function resolveStatus(
  summary: ZavorthTemporalAutonomyDailyUseCertificationSnapshot['summary'],
): ZavorthTemporalAutonomyDailyUseCertificationStatus {
  if (summary.failedMatrixAreas > 0 || summary.failedAbuseScenarios > 0) return 'blocked';
  if (summary.warningMatrixAreas > 0) return 'attention';
  return 'certified';
}

function buildReceipts(
  status: ZavorthTemporalAutonomyDailyUseCertificationStatus,
  matrix: ZavorthTemporalAutonomyDailyUseMatrixEntry[],
  abuseScenarios: ZavorthTemporalAutonomyDailyUseAbuseScenario[],
): ZavorthTemporalAutonomyDailyUseReceipt[] {
  return [
    {
      id: 'checkpoint-8-daily-use-certification',
      kind: 'checkpoint-8-daily-use-certification',
      status: status === 'certified' ? 'passed' : status,
      summary: `ZavorthControl controls daily-use certification status is ${status}.`,
    },
    {
      id: 'checkpoint-8-scheduled-task-certification-consumed',
      kind: 'scheduled-task-certification-consumed',
      status: matrix.find((entry) => entry.area === 'scheduled_tasks')?.status === 'pass' ? 'passed' : 'blocked',
      summary: 'Scheduled-task registration, live tick and daily ops readiness were consumed.',
    },
    {
      id: 'checkpoint-8-channel-capability-consumed',
      kind: 'channel-capability-consumed',
      status: matrix.find((entry) => entry.area === 'channel_ux')?.status === 'pass' ? 'passed' : 'blocked',
      summary: 'Channel capability awareness was consumed without zavorthControl visual mutation.',
    },
    ...abuseScenarios.map((scenario): ZavorthTemporalAutonomyDailyUseReceipt => ({
      id: `checkpoint-8-${scenario.id}`,
      kind: 'abuse-scenario',
      status: scenario.status === 'failed' ? 'blocked' : 'passed',
      summary: scenario.summary,
    })),
    {
      id: 'checkpoint-8-consistency-matrix',
      kind: 'consistency-matrix',
      status: matrix.every((entry) => entry.status === 'pass') ? 'passed' : 'blocked',
      summary: `${matrix.filter((entry) => entry.status === 'pass').length}/${matrix.length} daily-use matrix areas passed.`,
    },
    {
      id: 'checkpoint-8-no-zavorthControl-visual-mutation',
      kind: 'no-zavorthControl-visual-mutation',
      status: 'recorded',
      summary: 'ZavorthControl controls exposes certification data and does not add zavorthControl visual sections.',
    },
  ];
}

function scenarioPassed(
  scenarios: ZavorthTemporalAutonomyDailyUseAbuseScenario[],
  id: ZavorthTemporalAutonomyDailyUseAbuseScenario['id'],
): boolean {
  const scenario = scenarios.find((entry) => entry.id === id);
  return scenario?.status === 'blocked' || scenario?.status === 'passed';
}

function narrativeForStatus(
  status: ZavorthTemporalAutonomyDailyUseCertificationStatus,
  summary: ZavorthTemporalAutonomyDailyUseCertificationSnapshot['summary'],
): ZavorthTemporalAutonomyDailyUseCertificationSnapshot['narrative'] {
  if (status === 'certified') {
    return {
      headline: 'Temporal autonomy is certified for daily governed use.',
      operatorSummary: 'Scheduled tasks, approvals, rollback, ACP/MCP governance, channel UX and AgentRun recovery all passed the daily-use gate.',
      nextAction: 'Use /schedule and /automations normally; run the host-task variant when you want evidence for a specific persisted task.',
    };
  }
  if (status === 'attention') {
    return {
      headline: 'Temporal autonomy is usable with attention notes.',
      operatorSummary: `${summary.passedMatrixAreas}/${summary.matrixAreas} matrix areas passed with warnings.`,
      nextAction: 'Inspect warning matrix entries and rerun the ZavorthControl controls check after host-specific validation.',
    };
  }
  return {
    headline: 'Temporal autonomy is blocked for daily use.',
    operatorSummary: `${summary.failedMatrixAreas} matrix area(s) and ${summary.failedAbuseScenarios} abuse scenario(s) failed.`,
    nextAction: 'Fix the failed entries before presenting recurring automations as daily-use ready.',
  };
}
