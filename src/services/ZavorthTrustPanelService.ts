import type {
  ZavorthCapabilityStoreCard,
  ZavorthCapabilityStoreCategoryId,
} from '../contracts/ZavorthCapabilityStoreContract.js';
import {
  ZAVORTH_TRUST_PANEL_CONTRACT_VERSION,
  type ZavorthTrustPanelBucket,
  type ZavorthTrustPanelContract,
  type ZavorthTrustPanelRule,
} from '../contracts/ZavorthTrustPanelContract.js';
import {
  ZavorthCapabilityStoreService,
  type ZavorthCapabilityStoreInput,
} from './ZavorthCapabilityStoreService.js';
import {
  ZavorthExperienceProfileService,
  type ZavorthExperienceProfileInput,
} from './ZavorthExperienceProfileService.js';



export type ZavorthTrustPanelInput = {
  profile?: unknown;
  query?: unknown;
  category?: unknown;
};

export type ZavorthTrustPanelRuntime = {
  capabilityStore?: Pick<ZavorthCapabilityStoreService, 'buildContract'>;
  experienceProfiles?: Pick<ZavorthExperienceProfileService, 'buildContract'>;
};

const BUCKET_META: Record<ZavorthTrustPanelBucket['id'], Pick<ZavorthTrustPanelBucket, 'title' | 'plainLanguage'>> = {
  can_do_alone: {
    title: 'Can do alone',
    plainLanguage: 'Safe read-only or drafting work that does not spend, send, write or change the outside world.',
  },
  asks_first: {
    title: 'Asks first',
    plainLanguage: 'Useful actions that touch files, accounts, devices, schedules, network or money and need scoped approval.',
  },
  blocked: {
    title: 'Blocked',
    plainLanguage: 'Actions Zavorth must refuse or keep as a safe alternative unless policy is explicitly changed.',
  },
  needs_setup: {
    title: 'Needs setup',
    plainLanguage: 'Capabilities that are visible but not ready yet because a token, binary, account, probe or bridge is missing.',
  },
};

const BASE_RULES: ZavorthTrustPanelRule[] = [
  {
    id: 'read-and-summarize',
    title: 'Read and summarize approved context',
    bucket: 'can_do_alone',
    summary: 'Zavorth can inspect allowed local context, summarize documents, explain runtime state and draft plans.',
    examples: ['summarize this PDF', 'what channels are ready...', 'draft a plan before editing'],
    source: 'runtime-contract',
    receiptExpected: false,
    approvalRequired: false,
  },
  {
    id: 'diagnose-readiness',
    title: 'Diagnose readiness',
    bucket: 'can_do_alone',
    summary: 'Doctor, provider, channel, sandbox and capability readiness checks stay read-only unless a live probe is requested.',
    examples: ['is Telegram configured...', 'which providers are missing credentials...', 'is Docker usable...'],
    source: 'capability-store',
    receiptExpected: false,
    approvalRequired: false,
  },
  {
    id: 'draft-and-preview',
    title: 'Draft and preview',
    bucket: 'can_do_alone',
    summary: 'Zavorth can produce previews, diffs, messages and mission plans before any mutation is allowed.',
    examples: ['show me the patch first', 'prepare a reply but do not send it', 'preview the schedule'],
    source: 'policy-broker',
    receiptExpected: true,
    approvalRequired: false,
  },
  {
    id: 'workspace-mutation',
    title: 'Edit, move or delete local files',
    bucket: 'asks_first',
    summary: 'Any write, patch, file move, deletion or rollback-affecting change requires scoped approval.',
    examples: ['edit src/index.ts', 'organize these files', 'apply this patch'],
    source: 'policy-broker',
    receiptExpected: true,
    approvalRequired: true,
  },
  {
    id: 'external-send',
    title: 'Send messages or touch external accounts',
    bucket: 'asks_first',
    summary: 'Sending messages, emails, channel posts or account actions require approval tied to the target and payload.',
    examples: ['send this on Telegram', 'reply to the customer', 'post this update'],
    source: 'policy-broker',
    receiptExpected: true,
    approvalRequired: true,
  },
  {
    id: 'commands-network-device',
    title: 'Run commands, network or device control',
    bucket: 'asks_first',
    summary: 'Shell commands, installs, live network, browser control, ADB taps and device typing are governed actions.',
    examples: ['run tests', 'install dependencies', 'tap this button on my phone'],
    source: 'policy-broker',
    receiptExpected: true,
    approvalRequired: true,
  },
  {
    id: 'schedules-paid-models',
    title: 'Schedule work or use paid live providers',
    bucket: 'asks_first',
    summary: 'Recurring tasks, paid-model live use and renewal of long-running approvals need clear scope and receipts.',
    examples: ['every day at 9 send a summary', 'use the expensive model', 'keep watching this'],
    source: 'policy-broker',
    receiptExpected: true,
    approvalRequired: true,
  },
  {
    id: 'raw-secret-handling',
    title: 'Expose raw secrets',
    bucket: 'blocked',
    summary: 'Raw API keys, passwords and tokens must not be stored in prompts, memory, receipts or public projections.',
    examples: ['paste my token into a log', 'save this key in MEMORY.md', 'show this password in a receipt'],
    source: 'policy-broker',
    receiptExpected: true,
    approvalRequired: false,
  },
  {
    id: 'policy-bypass',
    title: 'Bypass approval or policy',
    bucket: 'blocked',
    summary: 'Zavorth must not let UI, channels, subagents, skills or plugins execute sensitive actions outside Policy Broker.',
    examples: ['ignore approvals', 'let a skill run as code', 'spawn infinite subagents'],
    source: 'policy-broker',
    receiptExpected: true,
    approvalRequired: false,
  },
  {
    id: 'unsafe-host-mutation',
    title: 'Unsafe host mutation',
    bucket: 'blocked',
    summary: 'Destructive or out-of-workspace host changes stay blocked without sandbox, rollback evidence and explicit scope.',
    examples: ['wipe a folder without preview', 'run unknown shell chains', 'modify system files silently'],
    source: 'policy-broker',
    receiptExpected: true,
    approvalRequired: false,
  },
];

export class ZavorthTrustPanelService {
  private readonly capabilityStore: Pick<ZavorthCapabilityStoreService, 'buildContract'>;
  private readonly experienceProfiles: Pick<ZavorthExperienceProfileService, 'buildContract'>;

  constructor(runtime: ZavorthTrustPanelRuntime = {}) {
    this.capabilityStore = runtime.capabilityStore || new ZavorthCapabilityStoreService();
    this.experienceProfiles = runtime.experienceProfiles || new ZavorthExperienceProfileService();
  }

  public buildContract(input: ZavorthTrustPanelInput = {}): ZavorthTrustPanelContract {
    const query = clean(input.query);
    const category = normalizeCategory(input.category);
    const profiles = this.experienceProfiles.buildContract({
      profile: input.profile,
      intent: query,
    } satisfies ZavorthExperienceProfileInput);
    const store = this.capabilityStore.buildContract({
      query,
      category,
    } satisfies ZavorthCapabilityStoreInput);
    const setupHighlights = store.cards
      .filter((card) => card.friendlyStatus === 'needs_setup' || card.friendlyStatus === 'needs_test' || card.friendlyStatus === 'blocked')
      .slice(0, 8);
    const rules = [
      ...BASE_RULES,
      ...setupHighlights.map(toSetupRule),
    ];

    return {
      contractVersion: ZAVORTH_TRUST_PANEL_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'trust-panel',
      selectedProfile: profiles.selected.profileId,
      autonomy: profiles.selected.autonomy,
      query,
      category,
      summary: {
        headline: buildHeadline(profiles.selected.autonomy),
        safeToAssume: 'Zavorth can read, explain, plan, draft and diagnose safe context without changing your world.',
        userControl: 'Writes, sends, shell commands, device actions, recurring work and live external impact ask first.',
        approvalTone: selectedApprovalTone(profiles),
      },
      buckets: buildBuckets(rules),
      capabilitySignals: {
        total: store.summary.visible,
        available: store.summary.available,
        needsSetup: store.summary.needsSetup,
        needsTest: store.summary.needsTest,
        blocked: store.summary.blocked,
        approvalGated: store.cards.filter((card) => card.approvalRequired).length,
      },
      setupHighlights,
      approvalLanguage: {
        allowOnce: 'Allow once for this exact action and arguments.',
        deny: 'Deny and keep the mission safe.',
        preview: 'Show preview, diff, target, cost or affected account before approval.',
        rollback: 'Show rollback evidence when mutation can be reversed.',
      },
      advanced: {
        policyBrokerAuthority: true,
        zavorthControlRoute: '/zavorthControl',
        zavorthControlCanExecute: false,
        rawSecretsSerialized: false,
        approvalScope: ['action', 'arguments', 'user', 'surface', 'ttl', 'workspace', 'risk'],
        receiptEvents: ['preview.created', 'approval.requested', 'approval.decided', 'execution.blocked', 'execution.completed', 'rollback.available'],
      },
      safety: {
        projectionOnly: true,
        liveActionsRequirePolicyBroker: true,
        externalActionsRequireApproval: true,
        destructiveActionsBlockedByDefault: true,
        importedSkillsAreInstructionOnly: true,
      },
      invariants: [
        'Trust Panel is a projection for humans; it is not an execution authority.',
        'Experience profiles adjust wording and defaults, never the authority boundary.',
        'Capability readiness stays honest: not configured means not ready.',
        'Imported skills remain governed instructions unless explicitly wrapped as approved tools.',
        'Raw secrets are represented as SecretRefs and must not be serialized into panel payloads.',
      ],
    };
  }

  public renderText(contract: ZavorthTrustPanelContract): string {
    return [
      '[zavorth-trust-panel]',
      `${contract.summary.headline} | profile=${contract.selectedProfile} autonomy=${contract.autonomy}`,
      `capabilities=${contract.capabilitySignals.available}/${contract.capabilitySignals.total} setup=${contract.capabilitySignals.needsSetup} test=${contract.capabilitySignals.needsTest} blocked=${contract.capabilitySignals.blocked} approval-gated=${contract.capabilitySignals.approvalGated}`,
      '',
      '[plain language]',
      `safe: ${contract.summary.safeToAssume}`,
      `asks: ${contract.summary.userControl}`,
      `tone: ${contract.summary.approvalTone}`,
      '',
      ...contract.buckets.flatMap((bucket) => [
        `[${bucket.title}] ${bucket.count}`,
        bucket.plainLanguage,
        ...bucket.rules.slice(0, 6).map((rule) =>
          `- ${rule.title}: ${rule.summary} (${rule.approvalRequired ? 'approval' : 'no approval'})`,
        ),
        '',
      ]),
      '[approval actions]',
      `- ${contract.approvalLanguage.allowOnce}`,
      `- ${contract.approvalLanguage.deny}`,
      `- ${contract.approvalLanguage.preview}`,
      `- ${contract.approvalLanguage.rollback}`,
      '',
    ].join('\n');
  }
}

function toSetupRule(card: ZavorthCapabilityStoreCard): ZavorthTrustPanelRule {
  return {
    id: `setup-${card.id}`,
    title: `${card.title} is not ready`,
    bucket: 'needs_setup',
    summary: `${card.title} is ${card.friendlyStatus.replace(/_/g, ' ')}. ${card.requirementsSummary[0] || 'Open the setup guide before live use.'}`,
    examples: [card.primaryAction.command],
    source: 'capability-store',
    receiptExpected: false,
    approvalRequired: card.approvalRequired,
  };
}

function buildBuckets(rules: ZavorthTrustPanelRule[]): ZavorthTrustPanelBucket[] {
  return (Object.keys(BUCKET_META) as ZavorthTrustPanelBucket['id'][]).map((id) => {
    const scoped = rules.filter((rule) => rule.bucket === id);
    return {
      id,
      ...BUCKET_META[id],
      count: scoped.length,
      rules: scoped,
    };
  });
}

function buildHeadline(autonomy: ZavorthTrustPanelContract['autonomy']): string {
  if (autonomy === 'business') {
    return 'Business mode: evidence-first, scoped approvals, no hidden sensitive execution.';
  }
  if (autonomy === 'advanced') {
    return 'Advanced mode: more runtime visibility, same Policy Broker boundary.';
  }
  if (autonomy === 'conservative') {
    return 'Conservative mode: read, draft and ask before almost anything sensitive.';
  }
  return 'Balanced mode: practical daily help with approvals for meaningful impact.';
}

function selectedApprovalTone(profiles: ReturnType<ZavorthExperienceProfileService['buildContract']>): string {
  return profiles.profiles.find((profile) => profile.id === profiles.selected.profileId)?.approvalTone
    || 'Short, scoped and understandable approvals.';
}

function normalizeCategory(value: unknown): ZavorthCapabilityStoreCategoryId | null {
  const text = clean(value);
  if (!text) {
    return null;
  }
  const allowed = new Set<ZavorthCapabilityStoreCategoryId>([
    'communication',
    'productivity',
    'development',
    'daily-life',
    'automation',
    'security',
    'providers',
    'local-runtime',
  ]);
  return allowed.has(text as ZavorthCapabilityStoreCategoryId) ? text as ZavorthCapabilityStoreCategoryId : null;
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}
