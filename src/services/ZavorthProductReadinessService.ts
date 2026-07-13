import {
  resolveLearningRuntimePolicy,
  type LearningRuntimePolicySnapshot,
} from './ZavorthLearningRuntimePolicy.js';
import {
  listChannelProductTiers,
  type ChannelProductTierDefinition,
} from './ZavorthChannelProductTier.js';
import { ScaleToZeroManager } from '../gateways/ScaleToZeroManager.js';

export type ProductReadinessStatus = 'ready' | 'attention' | 'blocked';

export type ProductReadinessCell = {
  id: string;
  label: string;
  status: ProductReadinessStatus;
  claim: string;
  evidence: string[];
  nextStep: string | null;
};

export type ProductReadinessSnapshot = {
  contractVersion: 'zavorth-product-readiness/1';
  generatedAt: string;
  status: ProductReadinessStatus;
  learning: LearningRuntimePolicySnapshot;
  channels: Array<ChannelProductTierDefinition & { mayClaimProductionWithoutLiveProof: boolean }>;
  cells: ProductReadinessCell[];
  scaleToZero: {
    role: 'gateway-adapter-idle';
    notCloudHostHibernation: true;
    enabled: boolean;
    defaultIdleTimeoutMs: number;
    summary: string;
  };
  summary: string;
};

export type ProductReadinessInput = {
  projectRoot?: string | null;
  now?: () => Date;
  env?: Record<string, string | undefined>;
  scaleToZero?: ScaleToZeroManager | null;
};

export class ZavorthProductReadinessService {
  public buildSnapshot(input: ProductReadinessInput = {}): ProductReadinessSnapshot {
    const now = (input.now || (() => new Date()))().toISOString();
    const learning = resolveLearningRuntimePolicy({
      projectRoot: input.projectRoot,
      env: input.env,
    });
    const channels = listChannelProductTiers().map((entry) => ({
      ...entry,
      mayClaimProductionWithoutLiveProof: entry.productionClaim === 'always',
    }));
    const scaleConfig = input.scaleToZero?.getConfig() || new ScaleToZeroManager().getConfig();
    const cells: ProductReadinessCell[] = [
      {
        id: 'learning-mode',
        label: 'Learning mode',
        status: 'ready',
        claim: learning.mode,
        evidence: [
          `source=${learning.source}`,
          `securityProfile=${learning.securityProfileId}`,
          `autoGreen=${learning.autoWriteGreenPreferences}`,
          `autoYellowDrafts=${learning.autoMaterializeYellowSkillDrafts}`,
          `autoInstallSkills=${learning.autoInstallSkills}`,
        ],
        nextStep: learning.mode === 'governed'
          ? 'Set ZAVORTH_LEARNING_MODE=autonomous or apply personal security preset for post-turn writes.'
          : null,
      },
      {
        id: 'channel-tiers',
        label: 'Channel product tiers',
        status: channels.some((c) => c.tier === 'T2') ? 'attention' : 'ready',
        claim: 'T0-T3 catalog; factory presence is not live send',
        evidence: [
          `T0=${channels.filter((c) => c.tier === 'T0').length}`,
          `T1=${channels.filter((c) => c.tier === 'T1').length}`,
          `T2=${channels.filter((c) => c.tier === 'T2').length}`,
          `T3=${channels.filter((c) => c.tier === 'T3').length}`,
          'experimental-and-catalog-only-must-not-claim-production',
        ],
        nextStep: 'Run channel live certification before default-routing T1 channels.',
      },
      {
        id: 'scale-to-zero',
        label: 'Gateway scale-to-zero',
        status: scaleConfig.enabled ? 'ready' : 'attention',
        claim: 'gateway-adapter-idle',
        evidence: [
          `enabled=${scaleConfig.enabled}`,
          `idleTimeoutMs=${scaleConfig.defaultIdleTimeoutMs}`,
          'not-cloud-host-hibernation',
        ],
        nextStep: scaleConfig.enabled
          ? null
          : 'Enable scale-to-zero for in-process gateway idle, or configure platform autostop for host hibernation.',
      },
      {
        id: 'cloud-host-idle',
        label: 'Cloud host idle',
        status: 'attention',
        claim: 'separate-from-code-sandbox',
        evidence: [
          'code-sandbox=ZavorthSandboxCloudTool/Daytona/Modal',
          'host-idle=deploy platform autostop + webhook wake',
          'scaleToZeroManager=adapter layer only',
        ],
        nextStep: 'Use deploy/fly.toml or docker-compose.prod.yml with durable volume; prove idle wake before claiming $0 idle.',
      },
    ];

    const status: ProductReadinessStatus = cells.some((c) => c.status === 'blocked')
      ? 'blocked'
      : cells.some((c) => c.status === 'attention')
        ? 'attention'
        : 'ready';

    return {
      contractVersion: 'zavorth-product-readiness/1',
      generatedAt: now,
      status,
      learning,
      channels,
      cells,
      scaleToZero: {
        role: 'gateway-adapter-idle',
        notCloudHostHibernation: true,
        enabled: Boolean(scaleConfig.enabled),
        defaultIdleTimeoutMs: scaleConfig.defaultIdleTimeoutMs,
        summary: scaleConfig.enabled
          ? 'In-process channel gateways may shut down after idle and warm on activity.'
          : 'Scale-to-zero disabled; gateways stay warm until process exit.',
      },
      summary: `Product readiness ${status}: learning=${learning.mode}, channels=${channels.length}, scaleToZero=${scaleConfig.enabled ? 'on' : 'off'}.`,
    };
  }
}
