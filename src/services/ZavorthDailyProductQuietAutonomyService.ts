import {
  type ProfileImprovementLane,
  type ProfileImprovementPolicy,
  type ProfileRuntimeBundle,
} from '../contracts/ProfileManifestContract.js';
import {
  ZAVORTH_DAILY_PRODUCT_QUIET_AUTONOMY_VERSION,
  type ZavorthDailyProductQuietAutonomySnapshot,
  type ZavorthDailyProductStatus,
  type ZavorthDailyProductTab,
  type ZavorthQuietAutonomyLane,
  type ZavorthQuietAutonomyProfilePolicy,
} from '../contracts/ZavorthDailyProductQuietAutonomyContract.js';
import { ProfileManifestService } from './ProfileManifestService.js';


export type ZavorthDailyProductQuietAutonomyInput = {
  profileId?: string | null;
};

export type ZavorthDailyProductQuietAutonomyRuntime = {
  now?: () => Date;
  profileManifestService?: Pick<ProfileManifestService, 'compileProfileById'>;
  profileIds?: string[];
};

const DEFAULT_PROFILE_IDS = ['personal', 'developer', 'operator', 'creator', 'team'];

const NEVER_SILENT: ProfileImprovementLane[] = [
  'apply',
  'policy',
  'provider',
  'channel',
  'secret',
  'external_send',
  'host_mutation',
];

const REVERSIBLE_SILENT = new Set<ProfileImprovementLane>([
  'telemetry',
  'ranking',
  'metadata',
  'candidate',
  'draft_skill',
  'staging_diff',
  'sandbox_validation',
  'low_risk_archive',
]);

const LANE_LABELS: Record<ProfileImprovementLane, string> = {
  telemetry: 'Usage telemetry',
  ranking: 'Route and skill ranking',
  metadata: 'Metadata cleanup',
  candidate: 'Learning candidates',
  draft_skill: 'Draft skill creation',
  staging_diff: 'Staged improvement diffs',
  sandbox_validation: 'Sandbox validation',
  low_risk_archive: 'Low-risk archive',
  apply: 'Apply a durable change',
  policy: 'Policy change',
  provider: 'Provider change',
  channel: 'Channel change',
  secret: 'Secret or credential access',
  external_send: 'External send',
  host_mutation: 'Host or workspace mutation',
};

export class ZavorthDailyProductQuietAutonomyService {
  private readonly now: () => Date;
  private readonly profiles: Pick<ProfileManifestService, 'compileProfileById'>;
  private readonly profileIds: string[];

  public constructor(runtime: ZavorthDailyProductQuietAutonomyRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.profiles = runtime.profileManifestService || new ProfileManifestService();
    this.profileIds = runtime.profileIds || DEFAULT_PROFILE_IDS;
  }

  public buildSnapshot(
    input: ZavorthDailyProductQuietAutonomyInput = {},
  ): ZavorthDailyProductQuietAutonomySnapshot {
    const profilePolicies = this.profileIds
      .map((id) => this.profiles.compileProfileById(id))
      .filter((profile): profile is ProfileRuntimeBundle => Boolean(profile))
      .map((profile) => this.buildProfilePolicy(profile));
    const activeProfileId = normalize(input.profileId, 'personal');
    const activePolicy = profilePolicies.find((policy) => policy.profileId === activeProfileId)
      || profilePolicies.find((policy) => policy.profileId === 'personal')
      || profilePolicies[0]
      || this.fallbackPolicy(activeProfileId);
    const status = this.resolveStatus(profilePolicies, activePolicy);
    return {
      contractVersion: ZAVORTH_DAILY_PRODUCT_QUIET_AUTONOMY_VERSION,
      generatedAt: this.now().toISOString(),
      surface: 'daily-product-quiet-autonomy',
      status,
      activeProfileId: activePolicy.profileId,
      dailyProduct: {
        headline: 'Use chat first; show only active work, real decisions, connected routes and useful history.',
        primarySurface: 'chat',
        visibleTabs: this.dailyTabs(),
        collapsedTechnicalSurfaces: [
          'raw event stream',
          'trace timeline',
          'capability internals',
          'provider manifests',
          'channel policy text',
          'debug receipts',
        ],
        emptyStateRules: [
          'Empty pages show one useful action, not explanatory doctrine.',
          'Approvals stays empty until there is a real decision.',
          'Channels shows connected, needs setup and last activity, not policy lectures.',
          'Work shows current run, next useful action and health only.',
        ],
        zavorthControlRule: 'ZavorthControl is an app surface: chat, current work, connected routes and decisions; technical detail moves into settings, history or collapsed diagnostics.',
        tuiRule: 'TUI starts compact: Today, Chat, Approvals, Tasks, Memory, Providers, Channels and Logs; deep details stay one command away.',
        cliRule: 'CLI answers status in one screen and offers commands for detail instead of dumping every subsystem.',
      },
      quietAutonomy: {
        activePolicy,
        profilePolicies,
        neverSilent: [...NEVER_SILENT],
        backgroundReceipts: {
          enabled: true,
          receiptKind: 'quiet-autonomy',
          rollbackRequired: true,
          rawSecretsSerialized: false,
        },
        llmGuidance: this.buildLlmGuidance(activePolicy),
      },
      commands: {
        status: 'zavorth daily',
        json: 'npm run zavorth:daily-product:json --silent',
        quietStatus: 'zavorth daily --profile personal --json',
        curator: 'zavorth skills curator status',
        qa: 'npm run qa:zavorth-daily-product-quiet-autonomy --silent',
      },
      safety: {
        readOnlySnapshot: true,
        riskyMutationStillApprovalGated: true,
        outboundStillPolicyGated: true,
        noRawSecretsSerialized: true,
        quietActionsMustBeReversible: true,
      },
    };
  }

  public renderText(snapshot = this.buildSnapshot()): string {
    const active = snapshot.quietAutonomy.activePolicy;
    return [
      'Zavorth Daily Product + Quiet Autonomy',
      '',
      `status=${snapshot.status}`,
      `activeProfile=${snapshot.activeProfileId}`,
      `surface=${snapshot.dailyProduct.primarySurface}`,
      `tabs=${snapshot.dailyProduct.visibleTabs.map((tab) => tab.label).join(', ')}`,
      `quiet=${active.mode} maxSilentRisk=${active.maxSilentRisk} interrupt=${active.interruptMode}`,
      `silent=${active.silentLanes.map((lane) => lane.lane).join(', ') || 'none'}`,
      `digest=${active.digestLanes.map((lane) => lane.lane).join(', ') || 'none'}`,
      `approval=${active.approvalLanes.map((lane) => lane.lane).join(', ') || 'none'}`,
      '',
      snapshot.dailyProduct.headline,
      active.dailySummary,
      '',
      `QA: ${snapshot.commands.qa}`,
      '',
    ].join('\n');
  }

  private buildProfilePolicy(profile: ProfileRuntimeBundle): ZavorthQuietAutonomyProfilePolicy {
    const policy = profile.improvementPolicy;
    const silent = policy.silent.filter((lane) => this.canRunSilently(lane, policy));
    const digest = unique([
      ...policy.notify,
      ...policy.silent.filter((lane) => !silent.includes(lane) && !NEVER_SILENT.includes(lane)),
    ]);
    const approval = unique([...NEVER_SILENT, ...policy.requireApproval]);
    return {
      profileId: profile.id,
      label: profile.label,
      mode: policy.mode,
      maxSilentRisk: policy.maxSilentRisk,
      interruptMode: policy.interruptMode,
      silentLanes: silent.map((lane) => this.lane(lane, 'silent')),
      digestLanes: digest.map((lane) => this.lane(lane, 'digest')),
      approvalLanes: approval.map((lane) => this.lane(lane, 'approval')),
      dailySummary: this.profileSummary(profile, silent, digest, approval),
    };
  }

  private lane(lane: ProfileImprovementLane, mode: ZavorthQuietAutonomyLane['mode']): ZavorthQuietAutonomyLane {
    const reversible = REVERSIBLE_SILENT.has(lane);
    return {
      lane,
      label: LANE_LABELS[lane],
      mode,
      reversible,
      receipt: true,
      userVisibleSummary: mode === 'silent'
        ? `${LANE_LABELS[lane]} can run quietly with a receipt and rollback path.`
        : mode === 'digest'
          ? `${LANE_LABELS[lane]} is summarized instead of interrupting immediately.`
          : `${LANE_LABELS[lane]} needs explicit approval before apply.`,
    };
  }

  private canRunSilently(lane: ProfileImprovementLane, policy: ProfileImprovementPolicy): boolean {
    if (NEVER_SILENT.includes(lane)) return false;
    if (!REVERSIBLE_SILENT.has(lane)) return false;
    if (policy.mode === 'manual') return false;
    return policy.maxSilentRisk === 'low'
      ? lane !== 'low_risk_archive'
      : true;
  }

  private dailyTabs(): ZavorthDailyProductTab[] {
    return [
      tab('chat', 'Chat', 'Ask Zavorth and see streaming work.', 'always', 'Send a request'),
      tab('work', 'Work', 'Current run, task, health and next useful action.', 'always', 'Open active work'),
      tab('channels', 'Channels', 'Connected routes, missing setup and last activity.', 'needs-setup', 'Connect or test'),
      tab('approvals', 'Approvals', 'Only real decisions waiting for the operator.', 'has-data', 'Review decision'),
      tab('history', 'History', 'Receipts, artifacts, replay and rollback when available.', 'has-data', 'Review result'),
      tab('tools', 'Tools', 'Search available capabilities without exposing internals first.', 'always', 'Find a tool'),
      tab('memory', 'Memory', 'Recall, facts and forget/correct/promote.', 'always', 'Search memory'),
      tab('models', 'Models', 'Active route, readiness and measured usage.', 'needs-setup', 'Test route'),
      tab('settings', 'Settings', 'Provider, channel, home, voice and safety configuration.', 'always', 'Configure'),
    ];
  }

  private profileSummary(
    profile: ProfileRuntimeBundle,
    silent: ProfileImprovementLane[],
    digest: ProfileImprovementLane[],
    approval: ProfileImprovementLane[],
  ): string {
    return `${profile.label}: ${silent.length} quiet lane(s), ${digest.length} digest lane(s), ${approval.length} approval boundary lane(s).`;
  }

  private buildLlmGuidance(policy: ZavorthQuietAutonomyProfilePolicy): string {
    return [
      `Daily Product rule: use chat/work as the default surface and hide technical detail until it is needed.`,
      `Quiet Autonomy rule for ${policy.profileId}: do not interrupt for ${policy.silentLanes.map((lane) => lane.lane).join(', ') || 'no lanes'}; write receipts and keep rollback available.`,
      `Digest rule: summarize ${policy.digestLanes.map((lane) => lane.lane).join(', ') || 'no lanes'} instead of asking immediately.`,
      `Approval rule: never silently cross ${policy.approvalLanes.map((lane) => lane.lane).join(', ')}.`,
    ].join('\n');
  }

  private resolveStatus(
    profilePolicies: ZavorthQuietAutonomyProfilePolicy[],
    activePolicy: ZavorthQuietAutonomyProfilePolicy,
  ): ZavorthDailyProductStatus {
    if (profilePolicies.length === 0) return 'blocked';
    if (activePolicy.approvalLanes.length < NEVER_SILENT.length) return 'blocked';
    return activePolicy.silentLanes.length > 0 ? 'ready' : 'attention';
  }

  private fallbackPolicy(profileId: string): ZavorthQuietAutonomyProfilePolicy {
    return {
      profileId,
      label: profileId,
      mode: 'quiet-staging',
      maxSilentRisk: 'low',
      interruptMode: 'daily-digest',
      silentLanes: ['telemetry', 'ranking', 'metadata', 'candidate', 'staging_diff', 'sandbox_validation']
        .map((lane) => this.lane(lane as ProfileImprovementLane, 'silent')),
      digestLanes: ['draft_skill', 'low_risk_archive']
        .map((lane) => this.lane(lane as ProfileImprovementLane, 'digest')),
      approvalLanes: NEVER_SILENT.map((lane) => this.lane(lane, 'approval')),
      dailySummary: `${profileId}: fallback quiet-staging policy.`,
    };
  }
}

function tab(
  id: ZavorthDailyProductTab['id'],
  label: string,
  purpose: string,
  showWhen: ZavorthDailyProductTab['showWhen'],
  primaryAction: string,
): ZavorthDailyProductTab {
  return { id, label, purpose, showWhen, primaryAction };
}

function normalize(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
