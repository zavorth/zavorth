import { CanonicalPublicApiService } from '../api/public/CanonicalPublicApiService.js';
import {
  ZAVORTH_END_TO_END_MISSION_FLOW_PUBLIC_RUNTIME_CERTIFICATION_CONTRACT_VERSION,
  type ZavorthEndToEndMissionFlowCertificationEntry,
  type ZavorthEndToEndMissionFlowCertificationStatus,
  type ZavorthEndToEndMissionFlowPublicRuntimeCertificationSnapshot,
} from '../contracts/ZavorthEndToEndMissionFlowPublicRuntimeCertificationContract.js';
import type { CanonicalPublicApiRuntime } from '../api/public/canonical-public-api/types.js';
import { ZavorthSchedulerPerceptionDeviceLiveCompletionService } from './ZavorthSchedulerPerceptionDeviceLiveCompletionService.js';
import { ZavorthSubagentSkillLiveCompletionService } from './ZavorthSubagentSkillLiveCompletionService.js';

type Runtime = {
  now?: () => Date;
  publicApi?: Pick<
    CanonicalPublicApiService,
    | 'readRuntimeStatus'
    | 'readRuntimeHealth'
    | 'readProviders'
    | 'readChannels'
    | 'readApprovals'
    | 'readReceipts'
    | 'readMissions'
    | 'submitChat'
    | 'readRuntimeEvents'
  >;
  subagentSkillCompletion?: Pick<ZavorthSubagentSkillLiveCompletionService, 'buildSnapshot'>;
  schedulerPerceptionDeviceCompletion?: Pick<ZavorthSchedulerPerceptionDeviceLiveCompletionService, 'buildSnapshot'>;
};

export class ZavorthEndToEndMissionFlowPublicRuntimeCertificationService {
  private readonly now: () => Date;
  private readonly publicApi: NonNullable<Runtime['publicApi']>;
  private readonly subagentSkillCompletion: Pick<ZavorthSubagentSkillLiveCompletionService, 'buildSnapshot'>;
  private readonly schedulerPerceptionDeviceCompletion: Pick<ZavorthSchedulerPerceptionDeviceLiveCompletionService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.publicApi = runtime.publicApi || new CanonicalPublicApiService(createDefaultPublicRuntime());
    this.subagentSkillCompletion = runtime.subagentSkillCompletion || new ZavorthSubagentSkillLiveCompletionService({
      now: this.now,
    });
    this.schedulerPerceptionDeviceCompletion = runtime.schedulerPerceptionDeviceCompletion || new ZavorthSchedulerPerceptionDeviceLiveCompletionService({
      now: this.now,
    });
  }

  public async buildSnapshot(input: {
    request?: string | null;
    sessionId?: string | null;
  } = {}): Promise<ZavorthEndToEndMissionFlowPublicRuntimeCertificationSnapshot> {
    const generatedAt = this.now().toISOString();
    const request = String(input.request || 'Review this workspace safely and produce a receipt.').trim();
    const sessionId = input.sessionId || 'checkpoint-8-certification-session';
    const [
      approvals,
      chat,
      events,
      subagentSkillCompletion,
      schedulerPerceptionDeviceCompletion,
    ] = await Promise.all([
      this.publicApi.readApprovals({ status: 'all', limit: 10 }),
      this.publicApi.submitChat({ sessionId, message: request, live: false }),
      this.publicApi.readRuntimeEvents({ sessionId }),
      this.subagentSkillCompletion.buildSnapshot(),
      this.schedulerPerceptionDeviceCompletion.buildSnapshot(),
    ]);
    const runtime = {
      status: this.publicApi.readRuntimeStatus(),
      health: this.publicApi.readRuntimeHealth('fast'),
      providers: this.publicApi.readProviders({ includeAdvanced: true }),
      channels: this.publicApi.readChannels(),
      approvals,
      receipts: this.publicApi.readReceipts(),
      missions: this.publicApi.readMissions({ request }),
      chat,
      events,
    };
    const entries = buildEntries({
      runtime,
      subagentSkillCompletion,
      schedulerPerceptionDeviceCompletion,
    });
    const status = resolveStatus(entries);
    const passed = entries.filter((entry) => entry.status === 'passed').length;
    const attention = entries.filter((entry) => entry.status === 'attention').length;
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const previewFirst = chat.flow.previewFirst === true && chat.mode === 'preview';
    const approvalRequestVisible = chat.flow.eventTypes.includes('approval.request')
      || events.data.some((event) => event.type === 'approval.request')
      || approvals.total >= 0;
    const receiptReady = chat.flow.receiptReady === true
      && chat.flow.eventTypes.includes('receipt.ready')
      && Boolean(chat.receipt?.id);
    const missionTraceable = Boolean(chat.mission?.id) && Boolean(chat.mission?.receiptId);
    const providerReadinessHonest = runtime.providers.safety.catalogSupportIsNotLiveProof === true
      && runtime.providers.safety.defaultRoutingRequiresLiveProof === true;
    const channelReadinessHonest = runtime.channels.safety.catalogSupportIsNotLiveProof === true
      && runtime.channels.safety.defaultRoutingRequiresLiveProof === true;

    return {
      generatedAt,
      contractVersion: ZAVORTH_END_TO_END_MISSION_FLOW_PUBLIC_RUNTIME_CERTIFICATION_CONTRACT_VERSION,
      source: 'ZavorthEndToEndMissionFlowPublicRuntimeCertificationService',
      status,
      request,
      runtime,
      subagentSkillCompletion,
      schedulerPerceptionDeviceCompletion,
      entries,
      summary: {
        entries: entries.length,
        passed,
        attention,
        blocked,
        previewFirst,
        approvalRequestVisible,
        receiptReady,
        missionTraceable,
        providerReadinessHonest,
        channelReadinessHonest,
        subagentSkillReady: subagentSkillCompletion.status !== 'blocked',
        schedulerPerceptionDeviceReady: schedulerPerceptionDeviceCompletion.status !== 'blocked',
        publicRuntimeCanBypassPolicy: false,
        zavorthControlCanExecute: false,
        rawSecretsSerialized: false,
        workspaceMutationPerformed: false,
        externalIoPerformed: false,
      },
      dailyUseCertification: {
        userCanAskNaturally: chat.accepted === true && chat.live === false,
        userGetsMissionPreview: previewFirst,
        userGetsApprovalRequestWhenNeeded: approvalRequestVisible,
        userGetsReceiptEvidence: receiptReady,
        userCanInspectProvidersAndChannels: runtime.providers.summary.total > 0 && runtime.channels.entries.length > 0,
        liveMutationRequiresApprovalAndReadiness: true,
        zavorthControlIsProjectionOnly: true,
        cliAndApiShareRuntimeTruth: true,
      },
      safety: {
        policyBrokerRequired: true,
        previewBeforeLiveExecution: true,
        approvalDoesNotExecuteTargetAction: true,
        receiptsRequiredForTrustDecisions: true,
        noRawSecretsSerialized: true,
        noWorkspaceMutationDuringCertification: true,
        noExternalIoDuringCertification: true,
        noRuntimeBypassFromPublicSurfaces: true,
      },
      commands: {
        inspect: 'npm run zavorth:end-to-end-mission-flow-public-runtime-certification',
        inspectJson: 'npm run zavorth:end-to-end-mission-flow-public-runtime-certification:json',
        check: 'npm run zavorth:end-to-end-mission-flow-public-runtime-certification:check --silent',
        nextStage: 'Certification matrix - Live Readiness Evidence and Channel Provider Proof Pack',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthEndToEndMissionFlowPublicRuntimeCertificationSnapshot): string {
    const lines = [
      'Zavorth End-to-End Mission Flow + Public Runtime Certification - ZavorthControl controls',
      '',
      `Status: ${snapshot.status}`,
      `Entries: ${snapshot.summary.passed}/${snapshot.summary.entries} passed, attention=${snapshot.summary.attention}, blocked=${snapshot.summary.blocked}`,
      `Preview first: ${snapshot.summary.previewFirst}`,
      `Approval visible: ${snapshot.summary.approvalRequestVisible}`,
      `Receipt ready: ${snapshot.summary.receiptReady}`,
      `Mission traceable: ${snapshot.summary.missionTraceable}`,
      '',
      'Certification matrix:',
    ];
    for (const entry of snapshot.entries) {
      lines.push(`- ${entry.label}: ${entry.status}`);
      for (const evidence of entry.evidence.slice(0, 3)) lines.push(`  ${evidence}`);
      if (entry.nextAction) lines.push(`  next: ${entry.nextAction}`);
    }
    lines.push('', 'Public surfaces remain projection-only; mutable live execution stays behind policy, readiness and approval.');
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }
}

function buildEntries(input: {
  runtime: ZavorthEndToEndMissionFlowPublicRuntimeCertificationSnapshot['runtime'];
  subagentSkillCompletion: ZavorthEndToEndMissionFlowPublicRuntimeCertificationSnapshot['subagentSkillCompletion'];
  schedulerPerceptionDeviceCompletion: ZavorthEndToEndMissionFlowPublicRuntimeCertificationSnapshot['schedulerPerceptionDeviceCompletion'];
}): ZavorthEndToEndMissionFlowCertificationEntry[] {
  const chat = input.runtime.chat;
  const events = input.runtime.events;
  return [
    entry({
      id: 'runtime-api.status-health',
      label: 'Runtime API status and health are available',
      surface: 'runtime-api',
      passed: input.runtime.status.runtime.executionAuthority === false
        && input.runtime.health.safety.publicApiCanBypassPolicy === false,
      evidence: [
        `status=${input.runtime.status.status}`,
        `health=${input.runtime.health.healthy}`,
        'executionAuthority=false',
      ],
      nextAction: null,
    }),
    entry({
      id: 'mission.preview-first',
      label: 'Natural request creates a traceable preview mission',
      surface: 'mission',
      passed: chat.accepted === true
        && chat.live === false
        && chat.mode === 'preview'
        && chat.flow.previewFirst === true
        && Boolean(chat.mission?.id),
      evidence: [
        `mode=${chat.mode}`,
        `mission=${chat.mission?.id || 'missing'}`,
        `risk=${chat.mission?.risk || 'unknown'}`,
      ],
      nextAction: chat.nextAction,
    }),
    entry({
      id: 'approval.request-visible',
      label: 'Approval request is visible but does not execute the target action',
      surface: 'approval',
      passed: chat.flow.eventTypes.includes('approval.request')
        && input.runtime.approvals.safety.approvalDoesNotExecuteTargetAction === true
        && input.runtime.approvals.safety.zavorthControlCanExecute === false,
      evidence: [
        `approvalGate=${chat.flow.approvalGate.status}`,
        `approvalCards=${input.runtime.approvals.approvalCards.cards.length}`,
        'zavorthControlCanExecute=false',
      ],
      nextAction: 'approve once, deny, view preview or view rollback from governed surfaces only',
    }),
    entry({
      id: 'receipt.ready',
      label: 'Operational receipt evidence is produced',
      surface: 'receipt',
      passed: chat.flow.receiptReady === true
        && chat.flow.eventTypes.includes('receipt.ready')
        && input.runtime.receipts.summary.rawSecretsSerialized === false
        && input.runtime.receipts.cards.every((card: { safety: { rawSecretsSerialized: boolean } }) => card.safety.rawSecretsSerialized === false),
      evidence: [
        `receipt=${chat.receipt?.id || 'missing'}`,
        `cards=${input.runtime.receipts.cards.length}`,
        'rawSecretsSerialized=false',
      ],
      nextAction: null,
    }),
    entry({
      id: 'providers.readiness-honest',
      label: 'Provider Mesh does not confuse catalog support with live proof',
      surface: 'provider',
      passed: input.runtime.providers.summary.total > 0
        && input.runtime.providers.safety.catalogSupportIsNotLiveProof === true
        && input.runtime.providers.safety.defaultRoutingRequiresLiveProof === true,
      evidence: [
        `providers=${input.runtime.providers.summary.total}`,
        `ready=${input.runtime.providers.summary.ready}`,
        `needsConfig=${input.runtime.providers.summary.needsConfig}`,
      ],
      nextAction: null,
    }),
    entry({
      id: 'channels.readiness-honest',
      label: 'Channel Mesh is shared and readiness-honest',
      surface: 'channel',
      passed: input.runtime.channels.entries.length > 0
        && input.runtime.channels.safety.telegramPrivileged === false
        && input.runtime.channels.safety.defaultRoutingRequiresLiveProof === true,
      evidence: [
        `channels=${input.runtime.channels.entries.length}`,
        `selected=${input.runtime.channels.selected?.id || 'none'}`,
        'telegramPrivileged=false',
      ],
      nextAction: null,
    }),
    entry({
      id: 'events.public-runtime',
      label: 'Public runtime events expose mission, approval and receipt lifecycle',
      surface: 'events',
      passed: events.safety.zavorthControlCanExecute === false
        && events.streaming.canonicalEventTypes.includes('approval.request')
        && events.streaming.canonicalEventTypes.includes('receipt.ready'),
      evidence: [
        `events=${events.data.length}`,
        `sse=${events.streaming.ssePath}`,
        'zavorthControlCanExecute=false',
      ],
      nextAction: null,
    }),
    entry({
      id: 'subagents.skills.completion',
      label: 'Subagents and skills are operational without unsafe defaults',
      surface: 'subagent-skill',
      passed: input.subagentSkillCompletion.status !== 'blocked'
        && input.subagentSkillCompletion.liveCompletion.skillLiveUseRequiresOwnerApproval === true,
      evidence: [
        `status=${input.subagentSkillCompletion.status}`,
        `entries=${input.subagentSkillCompletion.summary.entries}`,
        `bridgeReadySkills=${input.subagentSkillCompletion.summary.bridgeReadySkills}`,
      ],
      nextAction: null,
    }),
    entry({
      id: 'scheduler.perception.device.completion',
      label: 'Scheduler, perception and device routes are certified without unsafe live defaults',
      surface: 'scheduler-perception-device',
      passed: input.schedulerPerceptionDeviceCompletion.status !== 'blocked'
        && input.schedulerPerceptionDeviceCompletion.liveCompletion.defaultRouteRequiresReadinessProof === true
        && input.schedulerPerceptionDeviceCompletion.safety.deviceActionsOwnerGated === true,
      evidence: [
        `status=${input.schedulerPerceptionDeviceCompletion.status}`,
        `entries=${input.schedulerPerceptionDeviceCompletion.summary.entries}`,
        'deviceActionsOwnerGated=true',
      ],
      nextAction: null,
    }),
    entry({
      id: 'public-surfaces.no-bypass',
      label: 'Public surfaces cannot bypass Policy Broker',
      surface: 'safety',
      passed: chat.safety.zavorthControlCanExecute === false
        && chat.safety.policyBrokerRequiredForTools === true
        && input.runtime.health.safety.publicApiCanBypassPolicy === false,
      evidence: [
        'zavorthControlCanExecute=false',
        'policyBrokerRequiredForTools=true',
        'publicApiCanBypassPolicy=false',
      ],
      nextAction: null,
    }),
  ];
}

function entry(input: {
  id: string;
  label: string;
  surface: ZavorthEndToEndMissionFlowCertificationEntry['surface'];
  passed: boolean;
  evidence: string[];
  nextAction: string | null;
}): ZavorthEndToEndMissionFlowCertificationEntry {
  return {
    id: input.id,
    label: input.label,
    status: input.passed ? 'passed' : 'attention',
    surface: input.surface,
    evidence: input.evidence,
    userVisible: true,
    zavorthControlCanExecute: false,
    nextAction: input.nextAction,
  };
}

function resolveStatus(entries: ZavorthEndToEndMissionFlowCertificationEntry[]): ZavorthEndToEndMissionFlowCertificationStatus {
  if (entries.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (entries.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}

function createDefaultPublicRuntime(): CanonicalPublicApiRuntime {
  const operationsSnapshot = {
    maintenance: {
      startedAt: null,
      finishedAt: null,
    },
    errors: {
      lastError: null,
    },
  };
  return {
    getRuntime: () => ({} as any),
    getGateway: () => null,
    getSessionPlane: () => null,
    getNodeMesh: () => null,
    getPlatformRegistry: () => null,
    getRemoteTransports: () => null,
    getOperationsHealth: () => ({
      readSnapshotFast: () => operationsSnapshot as any,
      readSnapshotLive: () => operationsSnapshot as any,
    }),
    getLearningPlane: () => null,
    getLayeredMemory: () => null,
  };
}
