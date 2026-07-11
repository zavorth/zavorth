import {
  REACH_CHANNEL_SPINE_CONTRACT_VERSION,
  type ReachChannelSpineCapabilityFlags,
  type ReachChannelSpineHandoffPreview,
  type ReachChannelSpineMember,
  type ReachChannelSpineMemberId,
  type ReachChannelSpineReadiness,
  type ReachChannelSpineReceipt,
  type ReachChannelSpineSnapshot,
} from '../contracts/channel/ReachChannelSpineContract.js';
import {
  AgentRunService,
  CrossChannelContinuityService,
  type CrossChannelContinuitySnapshot,
  type UniversalAgentChannel,
} from '../runtime/agent/index.js';
import { ChannelInstallScaffoldService } from './ChannelInstallScaffoldService.js';
import { ChannelLiveActivationService } from './ChannelLiveActivationService.js';
import type { PlatformKey } from '../contracts/PlatformContract.js';

export { REACH_CHANNEL_SPINE_CONTRACT_VERSION } from '../contracts/channel/ReachChannelSpineContract.js';

/** Operator surfaces always in the product ring. */
const STABLE_RING: ReachChannelSpineMemberId[] = ['web', 'cli', 'telegram', 'discord', 'slack'];

/**
 * Full factory fabric is first-class via ChannelCompletenessService.
 * The spine ring remains the daily operator set; completeness inventory covers all gateways.
 */

type MemberDescriptor = {
  id: ReachChannelSpineMemberId;
  label: string;
  preferredOrder: number;
  gatewayTarget: string;
  requiredEnvKeys: string[];
  allowlistEnvKeys: string[];
  capabilities: ReachChannelSpineCapabilityFlags;
  notes: string[];
  platformKey?: PlatformKey;
};

const MEMBER_DESCRIPTORS: MemberDescriptor[] = [
  {
    id: 'web',
    label: 'Zavorth Control / Web',
    preferredOrder: 0,
    gatewayTarget: 'apps/zavorth-control-vite-shell',
    requiredEnvKeys: [],
    allowlistEnvKeys: [],
    capabilities: {
      inbound: true,
      outbound: true,
      allowlist: false,
      doctor: true,
      installScaffold: false,
      outboxFallback: false,
      mockIo: true,
      continuity: true,
      liveReadiness: true,
    },
    notes: ['Local control surface — no external channel credentials required.'],
  },
  {
    id: 'cli',
    label: 'CLI',
    preferredOrder: 1,
    gatewayTarget: 'src/cli',
    requiredEnvKeys: [],
    allowlistEnvKeys: [],
    capabilities: {
      inbound: true,
      outbound: true,
      allowlist: false,
      doctor: true,
      installScaffold: false,
      outboxFallback: false,
      mockIo: true,
      continuity: true,
      liveReadiness: true,
    },
    notes: ['Operator terminal surface over the same gateway spine.'],
  },
  {
    id: 'telegram',
    label: 'Telegram',
    preferredOrder: 2,
    gatewayTarget: 'src/gateways/channels/telegram',
    requiredEnvKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS'],
    allowlistEnvKeys: ['TELEGRAM_ALLOWED_USER_IDS', 'TELEGRAM_ALLOWED_CHAT_IDS'],
    capabilities: {
      inbound: true,
      outbound: true,
      allowlist: true,
      doctor: true,
      installScaffold: true,
      outboxFallback: false,
      mockIo: true,
      continuity: true,
      liveReadiness: true,
    },
    notes: ['Reference native channel for selective spine depth.'],
    platformKey: 'telegram',
  },
  {
    id: 'discord',
    label: 'Discord',
    preferredOrder: 3,
    gatewayTarget: 'src/gateways/channels/discord/DiscordGateway.stub.ts',
    requiredEnvKeys: ['DISCORD_BOT_TOKEN'],
    allowlistEnvKeys: ['DISCORD_ALLOWED_GUILD_IDS', 'DISCORD_ALLOWED_CHANNEL_IDS'],
    capabilities: {
      inbound: true,
      outbound: true,
      allowlist: true,
      doctor: true,
      installScaffold: true,
      outboxFallback: true,
      mockIo: true,
      continuity: true,
      liveReadiness: true,
    },
    notes: [
      'Spine slice: inbound parse, mockable outbound, allowlist, doctor, outbox fallback.',
      'Native discord-gateway services remain available for live bot login when credentials are present.',
    ],
    platformKey: 'discord',
  },
  {
    id: 'slack',
    label: 'Slack',
    preferredOrder: 4,
    gatewayTarget: 'src/gateways/channels/slack/SlackGateway.stub.ts',
    requiredEnvKeys: ['SLACK_BOT_TOKEN'],
    allowlistEnvKeys: ['SLACK_ALLOWED_CHANNEL_IDS'],
    capabilities: {
      inbound: true,
      outbound: true,
      allowlist: true,
      doctor: true,
      installScaffold: true,
      outboxFallback: true,
      mockIo: true,
      continuity: true,
      liveReadiness: true,
    },
    notes: [
      'Preferred third chat surface after Telegram and Discord.',
      'Web API + signing secret + allowlist; stub outbox when native transport is off.',
    ],
    platformKey: 'slack',
  },
];

const SPINE_HANDOFF_PAIRS: Array<{
  from: ReachChannelSpineMemberId;
  to: ReachChannelSpineMemberId;
  reason: string;
}> = [
  {
    from: 'web',
    to: 'telegram',
    reason: 'Resume the same session from Zavorth Control on Telegram after explicit approval.',
  },
  {
    from: 'telegram',
    to: 'discord',
    reason: 'Handoff Telegram continuity onto Discord with preview and approval before switch.',
  },
  {
    from: 'discord',
    to: 'telegram',
    reason: 'Handoff Discord continuity onto Telegram with preview and approval before switch.',
  },
  {
    from: 'cli',
    to: 'telegram',
    reason: 'Carry CLI session continuity into Telegram without forking the gateway session.',
  },
];

type ReachChannelSpineRuntime = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
  channelInstallService?: Pick<ChannelInstallScaffoldService, 'buildPlanForChannel'>;
  channelLiveActivationService?: Pick<ChannelLiveActivationService, 'buildSnapshot'>;
  continuityService?: Pick<CrossChannelContinuityService, 'buildSnapshot'>;
  agentRunService?: Pick<AgentRunService, 'createRun'>;
};

function envTruthy(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized) && normalized !== '0' && normalized !== 'false' && normalized !== 'off';
}

function hasEnv(env: Record<string, string | undefined>, key: string): boolean {
  return Boolean(String(env[key] || '').trim());
}

function toUniversalChannel(id: ReachChannelSpineMemberId): UniversalAgentChannel {
  if (id === 'web' || id === 'cli' || id === 'telegram' || id === 'discord') {
    return id;
  }
  // Slack is a spine member; continuity maps it through metadata when not a first-class UniversalAgentChannel.
  return 'api';
}

export class ReachChannelSpineService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly install: Pick<ChannelInstallScaffoldService, 'buildPlanForChannel'>;
  private readonly liveActivation: Pick<ChannelLiveActivationService, 'buildSnapshot'>;
  private readonly continuity: Pick<CrossChannelContinuityService, 'buildSnapshot'>;
  private readonly runs: Pick<AgentRunService, 'createRun'>;

  constructor(runtime: ReachChannelSpineRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.install = runtime.channelInstallService || new ChannelInstallScaffoldService();
    this.liveActivation = runtime.channelLiveActivationService || new ChannelLiveActivationService({ now: this.now });
    this.continuity = runtime.continuityService || new CrossChannelContinuityService({ now: this.now });
    this.runs = runtime.agentRunService || new AgentRunService({ now: this.now });
  }

  public buildSnapshot(input: {
    userId?: string;
    sessionId?: string;
    includeContinuityPreview?: boolean;
  } = {}): ReachChannelSpineSnapshot {
    const generatedAt = this.now().toISOString();
    const members = MEMBER_DESCRIPTORS.map((descriptor) => this.buildMember(descriptor));
    const continuity = input.includeContinuityPreview === false
      ? {
        sessionKeyScheme: 'userId:sessionId' as const,
        approvalRequiredForChannelSwitch: true as const,
        handoffs: [] as ReachChannelSpineHandoffPreview[],
        bridgedPairs: [] as Array<{ from: string; to: string }>,
      }
      : this.buildContinuityProjection({
        userId: String(input.userId || 'spine-operator').trim() || 'spine-operator',
        sessionId: String(input.sessionId || 'reach-channel-spine').trim() || 'reach-channel-spine',
        members,
      });

    const configuredCount = members.filter((member) => member.configured).length;
    const liveReadyCount = members.filter((member) => member.liveReady).length;
    const needsSetupCount = members.filter((member) => member.readiness === 'needs-setup').length;
    const doctorCovered = members.filter((member) => member.capabilities.doctor).length;
    const installCovered = members.filter((member) => member.capabilities.installScaffold).length;
    const mockIoCovered = members.filter((member) => member.capabilities.mockIo).length;

    const status = this.resolveStatus(members, continuity.handoffs);
    const receipts = this.buildReceipts(members, continuity.handoffs);

    return {
      contractVersion: REACH_CHANNEL_SPINE_CONTRACT_VERSION,
      source: 'ReachChannelSpineService',
      generatedAt,
      status,
      stableRing: {
        ids: [...STABLE_RING],
        preferredThird: 'slack',
        description:
          'Selective reach spine stable ring: web/control + CLI, Telegram (reference), Discord, Slack (preferred third). Long-tail activation stays separate.',
      },
      longTailPolicy: {
        activationService: 'ChannelLongTailActivationService',
        separateFromSpine: true,
        telegramParityRequired: false,
        note: 'Matrix, QQ, Nostr and other long-tail packs activate through ChannelLongTailActivationService — no Telegram parity required.',
      },
      summary: {
        memberCount: members.length,
        configuredCount,
        liveReadyCount,
        needsSetupCount,
        doctorCovered,
        installCovered,
        mockIoCovered,
        continuityHandoffs: continuity.handoffs.length,
        longTailChannelsExcluded: true,
      },
      members,
      continuity,
      receipts,
      policy: {
        catalogIsNotLive: true,
        longTailActivationSeparate: true,
        noTelegramParityOnLongTail: true,
        approvalRequiredForChannelSwitch: true,
        noLiveNetworkRequiredForSpineSmoke: true,
        secretValuesSerialized: false,
      },
      commands: {
        inventory: 'ReachChannelSpineService.buildSnapshot()',
        doctor: 'npm run test:channels:smoke',
        install: 'npm run channels:install -- --channel <discord|slack|telegram>',
        continuity: 'zavorth continuity handoff <channel> --session <sessionId>',
        focusedTests: [
          'npx jest tests/gateways/ReachChannelSpineService.test.ts --runInBand',
          'npx jest tests/gateways/ReachChannelSpine.discord-slack.smoke.test.ts --runInBand',
        ],
      },
      nextSafeAction: this.resolveNextSafeAction(status, members, continuity.handoffs),
    };
  }

  public isStableRingMember(channelId: string): boolean {
    const normalized = String(channelId || '').trim().toLowerCase();
    return STABLE_RING.includes(normalized as ReachChannelSpineMemberId);
  }

  public listStableRing(): ReachChannelSpineMemberId[] {
    return [...STABLE_RING];
  }

  public buildHandoffPreview(input: {
    fromChannel: ReachChannelSpineMemberId;
    toChannel: ReachChannelSpineMemberId;
    userId?: string;
    sessionId?: string;
  }): CrossChannelContinuitySnapshot {
    const userId = String(input.userId || 'spine-operator').trim() || 'spine-operator';
    const sessionId = String(input.sessionId || 'reach-channel-spine').trim() || 'reach-channel-spine';
    const from = toUniversalChannel(input.fromChannel);
    const to = toUniversalChannel(input.toChannel);
    const run = this.runs.createRun({
      userId,
      channel: from,
      sessionId,
      text: `spine handoff preview ${input.fromChannel} -> ${input.toChannel}`,
      metadata: {
        reachChannelSpine: {
          stableRing: STABLE_RING,
          membership: 'stable-ring',
        },
        crossChannelContinuity: {
          continuityKey: `${userId}:${sessionId}`,
        },
        channelMeshBridge: {
          source: 'ReachChannelSpineService',
          originChannel: input.fromChannel,
          channels: [
            {
              id: `${input.fromChannel}:primary`,
              label: input.fromChannel,
              kind: input.fromChannel,
              status: 'available',
              canResume: true,
            },
            {
              id: `${input.toChannel}:primary`,
              label: input.toChannel,
              kind: input.toChannel === 'slack' ? 'api' : input.toChannel,
              status: 'available',
              canResume: true,
              canNotify: true,
            },
          ],
        },
        crossChannelHandoffs: [
          {
            id: `handoff:${input.fromChannel}:to:${input.toChannel}`,
            fromChannel: from,
            toChannel: to,
            reason: `Selective spine handoff ${input.fromChannel} -> ${input.toChannel}`,
            requiresApproval: true,
            previewRequired: true,
            status: 'needs-approval',
            command: `zavorth continuity handoff ${input.toChannel} --session ${sessionId}`,
          },
        ],
      },
    });

    return this.continuity.buildSnapshot({
      run,
      generatedAt: this.now().toISOString(),
    });
  }

  private buildMember(descriptor: MemberDescriptor): ReachChannelSpineMember {
    const missingEnvKeys = descriptor.requiredEnvKeys.filter((key) => !hasEnv(this.env, key));
    const allowlistConfigured = descriptor.allowlistEnvKeys.length === 0
      || descriptor.allowlistEnvKeys.some((key) => hasEnv(this.env, key));
    const configured = missingEnvKeys.length === 0 && (descriptor.requiredEnvKeys.length === 0 || allowlistConfigured || descriptor.id === 'web' || descriptor.id === 'cli');

    let installAvailable = descriptor.capabilities.installScaffold;
    if (descriptor.platformKey && descriptor.capabilities.installScaffold) {
      try {
        const plan = this.install.buildPlanForChannel(descriptor.platformKey);
        installAvailable = Array.isArray(plan.modes) && plan.modes.length > 0;
      } catch {
        installAvailable = false;
      }
    }

    const liveEntry = this.findLiveActivationEntry(descriptor.id);
    const readiness = this.resolveMemberReadiness({
      id: descriptor.id,
      configured,
      missingEnvKeys,
      liveEntryStatus: liveEntry?.status || null,
    });

    return {
      id: descriptor.id,
      label: descriptor.label,
      membership: 'stable-ring',
      preferredOrder: descriptor.preferredOrder,
      readiness,
      configured: configured || descriptor.id === 'web' || descriptor.id === 'cli',
      liveReady: readiness === 'live-ready' || descriptor.id === 'web' || descriptor.id === 'cli',
      gatewayTarget: descriptor.gatewayTarget,
      doctorCommand: descriptor.platformKey
        ? `npm run test:channels:smoke`
        : 'zavorth gateway status',
      installCommand: descriptor.platformKey
        ? `npm run channels:install -- --channel ${descriptor.platformKey}`
        : 'n/a',
      liveActivationCommand: descriptor.platformKey
        ? `npm run channel-live-activation -- --profile configured --channel ${descriptor.id === 'slack' ? 'slack' : descriptor.id}`
        : 'n/a',
      smokeCommand: descriptor.platformKey
        ? 'npx jest tests/gateways/ReachChannelSpine.discord-slack.smoke.test.ts --runInBand'
        : 'npx jest tests/services/ReachChannelSpineService.test.ts --runInBand',
      requiredEnvKeys: [...descriptor.requiredEnvKeys],
      allowlistEnvKeys: [...descriptor.allowlistEnvKeys],
      missingEnvKeys,
      capabilities: {
        ...descriptor.capabilities,
        installScaffold: installAvailable,
      },
      notes: [...descriptor.notes],
    };
  }

  private findLiveActivationEntry(id: ReachChannelSpineMemberId): { status: string } | null {
    if (id === 'web' || id === 'cli') {
      return { status: 'live-ready' };
    }
    try {
      const snapshot = this.liveActivation.buildSnapshot();
      const channelId = id === 'slack' ? 'slack' : id;
      return snapshot.entries.find((entry) => entry.channelId === channelId) || null;
    } catch {
      return null;
    }
  }

  private resolveMemberReadiness(input: {
    id: ReachChannelSpineMemberId;
    configured: boolean;
    missingEnvKeys: string[];
    liveEntryStatus: string | null;
  }): ReachChannelSpineReadiness {
    if (input.id === 'web' || input.id === 'cli') {
      return 'live-ready';
    }
    if (input.liveEntryStatus === 'live-ready') {
      return 'live-ready';
    }
    if (input.liveEntryStatus === 'partial-live') {
      return input.configured ? 'partial-live' : 'needs-setup';
    }
    if (input.configured) {
      return 'configured-only';
    }
    if (input.missingEnvKeys.length > 0) {
      return 'needs-setup';
    }
    return 'catalogued';
  }

  private buildContinuityProjection(input: {
    userId: string;
    sessionId: string;
    members: ReachChannelSpineMember[];
  }): ReachChannelSpineSnapshot['continuity'] {
    const handoffs: ReachChannelSpineHandoffPreview[] = SPINE_HANDOFF_PAIRS.map((pair) => {
      const preview = this.buildHandoffPreview({
        fromChannel: pair.from,
        toChannel: pair.to,
        userId: input.userId,
        sessionId: input.sessionId,
      });
      const handoff = preview.handoffs.find(
        (entry) => entry.fromChannel === toUniversalChannel(pair.from)
          || entry.toChannel === toUniversalChannel(pair.to),
      ) || preview.handoffs[0];

      return {
        id: handoff?.id || `handoff:${pair.from}:to:${pair.to}`,
        fromChannel: pair.from,
        toChannel: pair.to,
        continuityKey: preview.session.continuityKey || `${input.userId}:${input.sessionId}`,
        status: 'needs-approval' as const,
        requiresApproval: true as const,
        previewRequired: true as const,
        command: handoff?.command || `zavorth continuity handoff ${pair.to} --session ${input.sessionId}`,
        reason: pair.reason,
      };
    });

    return {
      sessionKeyScheme: 'userId:sessionId',
      approvalRequiredForChannelSwitch: true,
      handoffs,
      bridgedPairs: SPINE_HANDOFF_PAIRS.map((pair) => ({ from: pair.from, to: pair.to })),
    };
  }

  private buildReceipts(
    members: ReachChannelSpineMember[],
    handoffs: ReachChannelSpineHandoffPreview[],
  ): ReachChannelSpineReceipt[] {
    return [
      {
        id: 'reach-channel-spine.membership',
        kind: 'membership',
        status: members.length === STABLE_RING.length ? 'ready' : 'partial',
        detail: `Stable ring members: ${members.map((member) => member.id).join(', ')}.`,
        secretValuesSerialized: false,
      },
      {
        id: 'reach-channel-spine.doctor',
        kind: 'doctor',
        status: members.every((member) => member.capabilities.doctor) ? 'ready' : 'partial',
        detail: 'Doctor coverage via channel provider doctor / gateway status for spine members.',
        secretValuesSerialized: false,
      },
      {
        id: 'reach-channel-spine.install',
        kind: 'install',
        status: members.filter((member) => member.capabilities.installScaffold).length >= 3 ? 'ready' : 'partial',
        detail: 'ChannelInstallScaffold covers telegram, discord and slack spine install paths.',
        secretValuesSerialized: false,
      },
      {
        id: 'reach-channel-spine.mock-io',
        kind: 'mock-io',
        status: members.filter((member) => member.id === 'discord' || member.id === 'slack')
          .every((member) => member.capabilities.mockIo)
          ? 'ready'
          : 'partial',
        detail: 'Discord and Slack expose mock inbound/outbound without live network.',
        secretValuesSerialized: false,
      },
      {
        id: 'reach-channel-spine.continuity',
        kind: 'continuity',
        status: handoffs.length > 0 && handoffs.every((handoff) => handoff.requiresApproval)
          ? 'ready'
          : 'missing',
        detail: `${handoffs.length} spine handoff preview(s) require approval before channel switch.`,
        secretValuesSerialized: false,
      },
      {
        id: 'reach-channel-spine.long-tail-boundary',
        kind: 'long-tail-boundary',
        status: 'ready',
        detail: 'Long-tail activation remains on ChannelLongTailActivationService; spine does not claim Telegram parity for matrix/qq/nostr.',
        secretValuesSerialized: false,
      },
    ];
  }

  private resolveStatus(
    members: ReachChannelSpineMember[],
    handoffs: ReachChannelSpineHandoffPreview[],
  ): ReachChannelSpineSnapshot['status'] {
    if (members.length === 0) {
      return 'blocked';
    }
    const chatMembers = members.filter((member) => member.id === 'telegram' || member.id === 'discord' || member.id === 'slack');
    const allChatBlocked = chatMembers.every((member) => member.readiness === 'blocked');
    if (allChatBlocked) {
      return 'blocked';
    }
    if (handoffs.some((handoff) => !handoff.requiresApproval)) {
      return 'attention';
    }
    const needsSetup = chatMembers.filter((member) => member.readiness === 'needs-setup').length;
    if (needsSetup > 0) {
      return 'partial';
    }
    return 'ready';
  }

  private resolveNextSafeAction(
    status: ReachChannelSpineSnapshot['status'],
    members: ReachChannelSpineMember[],
    handoffs: ReachChannelSpineHandoffPreview[],
  ): string {
    if (status === 'blocked') {
      return 'Restore at least one chat spine member (telegram/discord/slack) before routing.';
    }
    const needsSetup = members.find((member) => member.readiness === 'needs-setup' && member.capabilities.installScaffold);
    if (needsSetup) {
      return `Run install scaffold for ${needsSetup.id}: ${needsSetup.installCommand}`;
    }
    if (handoffs.length > 0) {
      return 'Review continuity handoff preview and approve before switching channels.';
    }
    return 'Stable ring is documented; run doctor smoke without live network when credentials change.';
  }
}

export function isReachChannelSpineMember(channelId: string): boolean {
  return new ReachChannelSpineService().isStableRingMember(channelId);
}

// Keep envTruthy available for future env-policy extensions without unused export noise.
void envTruthy;
