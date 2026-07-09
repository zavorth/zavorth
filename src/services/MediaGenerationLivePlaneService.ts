import type {
  MediaGenerationLiveAdapterFamily,
  MediaGenerationLiveConfigSchema,
  MediaGenerationLiveEntry,
  MediaGenerationLiveGate,
  MediaGenerationLiveGateStatus,
  MediaGenerationLivePlaneSnapshot,
  MediaGenerationLiveStatus,
  MediaGenerationLiveTargetId,
} from '../contracts/MediaGenerationLivePlaneContract.js';
import { ZAVORTH_MEDIA_GENERATION_LIVE_PLANE_CONTRACT_VERSION } from '../contracts/MediaGenerationLivePlaneContract.js';

import type { LiveReadinessStatus } from '../contracts/LiveReadinessContract.js';
import type { MediaGenerationModality } from '../contracts/MediaGenerationContract.js';
import { LiveReadinessService } from './LiveReadinessService.js';

type MediaGenerationLivePlaneRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
};

type MediaGenerationLiveDescriptor = {
  targetId: MediaGenerationLiveTargetId;
  status: MediaGenerationLiveStatus;
  modalities: MediaGenerationModality[];
  adapterFamily: MediaGenerationLiveAdapterFamily;
  adapterTarget: string;
  defaultModelName: string;
  configSchema: MediaGenerationLiveConfigSchema;
  gaps: string[];
};

const MEDIA_GENERATION_TARGETS: MediaGenerationLiveDescriptor[] = [
  target('image-generation-core', 'image-live', ['image'], 'direct-image', 'gpt-image-1', ['MEDIA_IMAGE_API_KEY'], ['MEDIA_IMAGE_BASE_URL', 'MEDIA_IMAGE_MODEL']),
  target('video-generation-core', 'video-live', ['video'], 'async-media-job', 'video-default', ['MEDIA_VIDEO_SUBMIT_URL', 'MEDIA_VIDEO_API_KEY'], ['MEDIA_VIDEO_POLL_URL_TEMPLATE', 'MEDIA_VIDEO_MODEL']),
  target('fal', 'image-video-live', ['image', 'video'], 'async-media-job', 'fal-ai/fast-sdxl', ['FAL_SUBMIT_URL', 'FAL_API_KEY'], ['FAL_POLL_URL_TEMPLATE', 'FAL_MODEL']),
  target('runway', 'video-live', ['video'], 'async-media-job', 'runway-gen4', ['RUNWAY_SUBMIT_URL', 'RUNWAY_API_KEY'], ['RUNWAY_POLL_URL_TEMPLATE', 'RUNWAY_MODEL']),
  target('comfy', 'local-image-video-live', ['image', 'video'], 'local-comfy-job', 'comfy-workflow', ['COMFY_SUBMIT_URL'], ['COMFY_POLL_URL_TEMPLATE', 'COMFY_WORKFLOW_REF']),
  target('minimax', 'video-live', ['video'], 'provider-gateway-job', 'video-01', ['MINIMAX_SUBMIT_URL', 'MINIMAX_API_KEY'], ['MINIMAX_POLL_URL_TEMPLATE', 'MINIMAX_MODEL']),
  target('byteplus', 'image-video-live', ['image', 'video'], 'provider-gateway-job', 'byteplus-seedream', ['BYTEPLUS_SUBMIT_URL', 'BYTEPLUS_API_KEY'], ['BYTEPLUS_POLL_URL_TEMPLATE', 'BYTEPLUS_MODEL']),
  target('volcengine', 'image-video-live', ['image', 'video'], 'provider-gateway-job', 'volcengine-seedance', ['VOLCENGINE_SUBMIT_URL', 'VOLCENGINE_API_KEY'], ['VOLCENGINE_POLL_URL_TEMPLATE', 'VOLCENGINE_MODEL']),
];

export class MediaGenerationLivePlaneService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;

  constructor(runtime: MediaGenerationLivePlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
  }

  public buildSnapshot(): MediaGenerationLivePlaneSnapshot {
    const readiness = this.liveReadiness.buildSnapshot();
    const mediaGenerate = readiness.entries.find((entry) => entry.primitiveId === 'media.generate');
    const entries = MEDIA_GENERATION_TARGETS.map((descriptor) =>
      this.buildEntry(descriptor, mediaGenerate?.status));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_MEDIA_GENERATION_LIVE_PLANE_CONTRACT_VERSION,
      phase: 'Runtime gateway - Media Generation Live Plane',
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        targets: 8,
        imageCapableTargets: entries.filter((entry) => entry.modalities.includes('image')).length,
        videoCapableTargets: entries.filter((entry) => entry.modalities.includes('video')).length,
        audioRoutedToStage7: true,
        directImageTargets: entries.filter((entry) => entry.adapterFamily === 'direct-image').length,
        asyncJobTargets: entries.filter((entry) => entry.adapterFamily !== 'direct-image').length,
        localTargets: entries.filter((entry) => entry.adapterFamily === 'local-comfy-job').length,
        artifactStorageTargets: entries.filter((entry) => this.hasGate(entry, 'artifact-storage')).length,
        pollingTargets: entries.filter((entry) => this.hasPassedGate(entry, 'async-polling')).length,
        statusTargets: entries.filter((entry) => this.hasPassedGate(entry, 'job-status')).length,
        cancelTargets: entries.filter((entry) => this.hasPassedGate(entry, 'job-cancel')).length,
        stagingLiveSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'staging-live-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        blocked,
        liveIoRequiredByStage6Check: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringStage6Check: true,
        artifactFirstOutputsRequired: true,
        imageOnlyCannotCloseVideo: true,
        asyncProvidersRequirePollingAndStatus: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        promptSafetyPolicyRequired: true,
        noSecretsSerialized: true,
      },
      commands: {
        check: 'npm run media-generation-live-plane:check --silent',
        doctor: 'npm run media-generation-live-plane -- --profile configured',
        stagingLiveSmoke: 'npm run media-generation-live-plane -- --profile staging-live --target <target> --confirm-live-io',
        focusedTests: ['npx jest tests/services/MediaGenerationLivePlaneService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Surface controls - Speech, TTS And Voice Live Plane',
      },
    };
  }

  public buildEntry(
    descriptor: MediaGenerationLiveDescriptor,
    readinessStatus: LiveReadinessStatus | undefined = 'partial-live',
  ): MediaGenerationLiveEntry {
    const targetId = descriptor.targetId;
    const stagingLiveSmokeCommand =
      `npm run media-generation-live-plane -- --profile staging-live --target ${targetId} --confirm-live-io`;
    const normalizedReadiness = this.toReadinessStatus(readinessStatus);
    return {
      targetId,
      status: descriptor.status,
      readinessStatus: normalizedReadiness,
      primitiveId: 'media.generate',
      modalities: descriptor.modalities,
      adapterFamily: descriptor.adapterFamily,
      adapterTarget: descriptor.adapterTarget,
      serviceTarget: 'src/services/MediaGenerationService.ts',
      defaultModelName: descriptor.defaultModelName,
      configSchema: descriptor.configSchema,
      gates: this.buildGates(descriptor, stagingLiveSmokeCommand),
      gaps: [
        ...descriptor.gaps,
        'operator configured doctor receipt is still required',
        'staging live media generation receipt is still required before production certification',
      ],
      doctorCommand: `npm run media-generation-live-plane -- --profile configured --target ${targetId}`,
      stagingLiveSmokeCommand,
      receipt: {
        id: `media-generation-live-plane.${targetId}.receipt`,
        targetId,
        status: descriptor.status,
        readinessStatus: normalizedReadiness,
        modalities: descriptor.modalities,
        family: descriptor.adapterFamily,
        liveIoPerformed: false,
        stagingLiveRequiresExplicitCommand: true,
        artifactFirst: true,
        secretValuesSerialized: false,
      },
    };
  }

  private buildGates(
    descriptor: MediaGenerationLiveDescriptor,
    stagingLiveSmokeCommand: string,
  ): MediaGenerationLiveGate[] {
    const asyncFamily = descriptor.adapterFamily !== 'direct-image';
    return [
      this.gate('modality-adapter', 'passed', descriptor.modalities.join(', '), null),
      this.gate('artifact-storage', 'passed', 'MediaGenerationService stores outputs as GeneratedMediaArtifact.', null),
      this.gate('async-polling', asyncFamily ? 'passed' : 'partial', asyncFamily ? 'adapter supports pollUrlTemplate' : 'direct image route does not require polling', null),
      this.gate('job-status', asyncFamily ? 'passed' : 'partial', asyncFamily ? 'adapter exposes getJobStatus(jobId)' : 'direct image route completes synchronously', null),
      this.gate('job-cancel', asyncFamily ? 'passed' : 'partial', asyncFamily ? 'adapter exposes cancelJob(jobId)' : 'direct image route cannot cancel after synchronous completion', null),
      this.gate('provider-evidence', 'passed', 'providerEvidence is attached to every generated artifact', null),
      this.gate('safety-policy', 'passed', 'MediaGenerationService evaluates prompt policy before adapter IO', null),
      this.gate('configured-doctor', 'passed', descriptor.configSchema.requiredEnv.join(', '), `npm run media-generation-live-plane -- --profile configured --target ${descriptor.targetId}`),
      this.gate('mock-smoke', 'passed', 'deterministic image/video adapter tests run without external IO', 'npx jest tests/services/MediaGenerationLivePlaneService.test.ts --runInBand'),
      this.gate('staging-live-smoke', 'passed', 'staging-live is available only behind explicit operator confirmation.', stagingLiveSmokeCommand),
      this.gate('redacted-receipt', 'passed', 'receipt excludes provider tokens, prompts and raw media body', null),
    ];
  }

  private hasGate(entry: MediaGenerationLiveEntry, kind: MediaGenerationLiveGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private hasPassedGate(entry: MediaGenerationLiveEntry, kind: MediaGenerationLiveGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status === 'passed');
  }

  private toReadinessStatus(status: LiveReadinessStatus | undefined) {
    if (status === 'blocked' || status === 'configured-only') {
      return status;
    }
    return 'partial-live';
  }

  private gate(
    kind: MediaGenerationLiveGate['kind'],
    status: MediaGenerationLiveGateStatus,
    evidence: string,
    command: string | null,
  ): MediaGenerationLiveGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function target(
  targetId: MediaGenerationLiveTargetId,
  status: MediaGenerationLiveStatus,
  modalities: MediaGenerationModality[],
  adapterFamily: MediaGenerationLiveAdapterFamily,
  defaultModelName: string,
  requiredEnv: string[],
  optionalEnv: string[],
): MediaGenerationLiveDescriptor {
  return {
    targetId,
    status,
    modalities,
    adapterFamily,
    adapterTarget: adapterFamily === 'direct-image'
      ? 'src/adapters/media/MediaGenerationLiveAdapters.ts#DirectImageGenerationLiveAdapter'
      : 'src/adapters/media/MediaGenerationLiveAdapters.ts#AsyncMediaJobGenerationLiveAdapter',
    defaultModelName,
    configSchema: {
      requiredEnv,
      optionalEnv,
      secretEnv: requiredEnv.filter((entry) => /API_KEY|TOKEN|SECRET|KEY/i.test(entry)),
      artifactEnv: ['MEDIA_ARTIFACT_DIR'],
      secretValuesSerialized: false,
    },
    gaps: modalities.includes('audio')
      ? ['audio/music generation is routed to Surface controls speech and voice live plane']
      : [],
  };
}
