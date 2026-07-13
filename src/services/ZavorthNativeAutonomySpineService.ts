import {
  ZAVORTH_NATIVE_AUTONOMY_SPINE_VERSION,
  type ZavorthChannelLiveCertificationInput,
  type ZavorthExecutionBackendProviderInput,
  type ZavorthNativeAutonomySpineInput,
  type ZavorthNativeAutonomySpineSnapshot,
  type ZavorthSkillForgeInput,
} from '../contracts/native/ZavorthNativeAutonomySpineContract.js';
import { MnemosDreamCycleService } from './MnemosDreamCycleService.js';

import { ZavorthChannelLiveCertificationService } from './ZavorthChannelLiveCertificationService.js';
import { ZavorthDynamicMissionHarnessService } from './ZavorthDynamicMissionHarnessService.js';
import { ZavorthExecutionBackendProviderService } from './ZavorthExecutionBackendProviderService.js';
import { ZavorthExperienceLearningDaemonService } from './ZavorthExperienceLearningDaemonService.js';
import { ZavorthSkillForgeRuntimeService } from './ZavorthSkillForgeRuntimeService.js';
import { ZavorthAutonomousLearningWriteService } from './ZavorthAutonomousLearningWriteService.js';
import { resolveLearningRuntimePolicy } from './ZavorthLearningRuntimePolicy.js';

type NativeAutonomySpineDeps = {
  now?: () => Date;
  projectRoot?: string | null;
  userId?: string | null;
  learning?: ZavorthExperienceLearningDaemonService;
  skillForge?: ZavorthSkillForgeRuntimeService;
  channelCertification?: ZavorthChannelLiveCertificationService;
  backendProvider?: ZavorthExecutionBackendProviderService;
  dynamicMission?: ZavorthDynamicMissionHarnessService;
  dreamCycle?: MnemosDreamCycleService;
  learningWrite?: ZavorthAutonomousLearningWriteService;
};

export class ZavorthNativeAutonomySpineService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly userId: string | null;
  private readonly learning: ZavorthExperienceLearningDaemonService;
  private readonly skillForge: ZavorthSkillForgeRuntimeService;
  private readonly channelCertification: ZavorthChannelLiveCertificationService;
  private readonly backendProvider: ZavorthExecutionBackendProviderService;
  private readonly dynamicMission: ZavorthDynamicMissionHarnessService;
  private readonly dreamCycle: MnemosDreamCycleService;
  private readonly learningWriteOverride: ZavorthAutonomousLearningWriteService | null;

  public constructor(deps: NativeAutonomySpineDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.projectRoot = String(deps.projectRoot || process.cwd());
    this.userId = deps.userId == null ? null : String(deps.userId);
    this.learning = deps.learning || new ZavorthExperienceLearningDaemonService({ now: this.now });
    this.skillForge = deps.skillForge || new ZavorthSkillForgeRuntimeService({ now: this.now });
    this.channelCertification = deps.channelCertification || new ZavorthChannelLiveCertificationService({ now: this.now });
    this.backendProvider = deps.backendProvider || new ZavorthExecutionBackendProviderService({ now: this.now });
    this.dynamicMission = deps.dynamicMission || new ZavorthDynamicMissionHarnessService({ now: this.now });
    this.dreamCycle = deps.dreamCycle || new MnemosDreamCycleService({ now: this.now });
    this.learningWriteOverride = deps.learningWrite || null;
  }

  public async buildSnapshot(input: ZavorthNativeAutonomySpineInput): Promise<ZavorthNativeAutonomySpineSnapshot> {
    const learning = await this.learning.reviewTurn(input.turn);
    const skillForge = this.skillForge.reviewSkillOpportunity(this.skillInputFromTurn(input.turn));
    const scopedUserId = input.turn.userId != null ? input.turn.userId : this.userId;
    const learningWrite = this.learningWriteOverride || new ZavorthAutonomousLearningWriteService({
      now: this.now,
      projectRoot: this.projectRoot,
      userId: scopedUserId,
      policy: resolveLearningRuntimePolicy({
        projectRoot: this.projectRoot,
        userId: scopedUserId,
      }),
    });
    const writeResult = learningWrite.applyFromSpine({
      learning,
      skillForge,
      sourceSurface: input.turn.sourceSurface || 'runtime',
    });
    const dynamicMission = input.mission ? this.dynamicMission.buildPreview(input.mission) : null;
    const dreamCycle = input.dreamCycle ? this.dreamCycle.buildCycle(input.dreamCycle) : null;
    const channel = input.channel ? this.channelCertification.certify(input.channel) : null;
    const backend = input.backend ? this.backendProvider.certify(input.backend) : null;
    const organicLearningReady = learning.status === 'ready';
    const skillForgeReady = skillForge.status === 'ready' || skillForge.status === 'needs-approval';
    const dynamicMissionReady = dynamicMission === null || dynamicMission.status === 'preview';
    const dreamCycleReady = dreamCycle === null || dreamCycle.status === 'ready';
    const liveChannelReady = channel?.readiness.liveReady === true;
    const backendProviderReady = backend?.readiness.liveReady === true;
    const learningWriteApplied = writeResult.appliedPreferences > 0 || writeResult.draftedSkills > 0;
    const blocked = learning.status === 'blocked'
      || dynamicMission?.status === 'blocked'
      || dreamCycle?.status === 'blocked';
    const attention = !organicLearningReady
      || !skillForgeReady
      || !dynamicMissionReady
      || !dreamCycleReady
      || (channel !== null && !liveChannelReady)
      || (backend !== null && !backendProviderReady);

    return {
      version: ZAVORTH_NATIVE_AUTONOMY_SPINE_VERSION,
      generatedAt: this.now().toISOString(),
      status: blocked ? 'blocked' : attention ? 'attention' : 'ready',
      stages: [
        {
          id: 'pre-turn-recall',
          status: 'ready',
          summary: learning.preTurnRecall.ranBeforeTurn
            ? `${learning.preTurnRecall.results.length} receipt-backed recall result(s).`
            : 'No recall query for this snapshot.',
        },
        {
          id: 'post-turn-learning',
          status: learning.status === 'ready' ? 'ready' : 'attention',
          summary: writeResult.mode === 'autonomous'
            ? `${learning.candidates.length} candidate(s); wrote ${writeResult.appliedPreferences} preference(s) and ${writeResult.draftedSkills} skill draft(s).`
            : `${learning.candidates.length} learning candidate(s) reviewed after the turn.`,
        },
        {
          id: 'skill-forge',
          status: skillForge.status === 'attention' ? 'attention' : 'ready',
          summary: writeResult.draftedSkills > 0
            ? `${skillForge.drafts.length} skill draft(s); ${writeResult.draftedSkills} materialized under learning/skill-drafts (install still blocked).`
            : `${skillForge.drafts.length} skill draft(s), no skill-library install.`,
        },
        {
          id: 'dynamic-mission-harness',
          status: dynamicMission?.status === 'blocked' ? 'blocked' : dynamicMissionReady ? 'ready' : 'attention',
          summary: dynamicMission
            ? `${dynamicMission.workflow.tasks.length} preview task(s), execution=${dynamicMission.workflow.execution}.`
            : 'No dynamic mission requested.',
        },
        {
          id: 'mnemos-dream-cycle',
          status: dreamCycle?.status === 'blocked' ? 'blocked' : dreamCycleReady ? 'ready' : 'attention',
          summary: dreamCycle
            ? `${dreamCycle.candidateStore.memories.length} candidate memory item(s), source immutable.`
            : 'No dream cycle requested.',
        },
        {
          id: 'channel-certification',
          status: channel?.readiness.liveReady ? 'ready' : channel ? 'attention' : 'ready',
          summary: channel ? `${channel.channelId} liveReady=${channel.readiness.liveReady}.` : 'No channel selected.',
        },
        {
          id: 'backend-provider',
          status: backend?.readiness.liveReady ? 'ready' : backend ? 'attention' : 'ready',
          summary: backend ? `${backend.backendId} liveReady=${backend.readiness.liveReady}.` : 'No backend selected.',
        },
        {
          id: 'review-center',
          status: 'ready',
          summary: 'Learn, skill, channel and backend actions remain reviewable and reversible.',
        },
      ],
      learning,
      skillForge,
      learningWrite: {
        mode: writeResult.mode,
        appliedPreferences: writeResult.appliedPreferences,
        draftedSkills: writeResult.draftedSkills,
        blocked: writeResult.blocked,
        receiptIds: writeResult.receipts.map((receipt) => receipt.id),
        preferenceStorePath: writeResult.preferenceStorePath,
        skillDraftRoot: writeResult.skillDraftRoot,
      },
      dynamicMission,
      dreamCycle,
      channel,
      backend,
      summary: {
        organicLearningReady,
        skillForgeReady,
        dynamicMissionReady,
        dreamCycleReady,
        liveChannelReady,
        backendProviderReady,
        learningWriteApplied,
      },
      reviewCenter: {
        actions: [
          'learn approve',
          'learn reject',
          'learn forget',
          'skill draft review',
          'mission preview approve',
          'mission preview reject',
          'dream review apply',
          'dream review reject',
          'channel proof review',
          'backend proof review',
        ],
        receipts: [
          ...learning.candidates.map((candidate) => candidate.receiptId),
          ...writeResult.receipts.map((receipt) => receipt.id),
          ...(dynamicMission?.approval.approvalId ? [dynamicMission.approval.approvalId] : []),
          ...(dreamCycle ? [dreamCycle.review.receiptId] : []),
          ...(channel?.readiness.proofRefs || []),
          ...(backend?.readiness.proofRefs || []),
        ],
        quietLanes: true,
      },
      safety: {
        rawSecretsSerialized: false,
        noLiveMutationWithoutProof: true,
        noDirectSkillFileWrites: true,
        noArbitraryMissionExecution: true,
        dreamCycleCandidateStoreOnly: true,
        channelDefaultRequiresProof: true,
        reviewAndForgetAvailable: true,
      },
    };
  }

  private skillInputFromTurn(turn: ZavorthNativeAutonomySpineInput['turn']): ZavorthSkillForgeInput {
    return {
      turnId: turn.turnId,
      outcome: turn.outcome,
      userMessage: turn.userMessage,
      assistantResponse: turn.assistantResponse,
      toolCallCount: turn.toolCallCount,
      observedFiles: turn.toolReceipts
        .filter((receipt) => /file|patch|write|diff/i.test(`${receipt.kind} ${receipt.summary}`))
        .map((receipt) => receipt.id),
      requestedCapabilities: turn.toolReceipts.map((receipt) => receipt.kind),
    };
  }
}

export type {
  ZavorthChannelLiveCertificationInput,
  ZavorthExecutionBackendProviderInput,
};
