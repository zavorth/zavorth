import type {
  ZavorthOwnerGatedLiveActivationCommand,
  ZavorthOwnerGatedLiveActivationEntry,
  ZavorthOwnerGatedLiveActivationFamily,
  ZavorthOwnerGatedLiveActivationGroupId,
  ZavorthOwnerGatedLiveActivationMode,
  ZavorthOwnerGatedLiveActivationPhase,
  ZavorthOwnerGatedLiveActivationPriority,
  ZavorthOwnerGatedLiveActivationReceipt,
  ZavorthOwnerGatedLiveActivationRouteStatus,
  ZavorthOwnerGatedLiveActivationSnapshot,
  ZavorthOwnerGatedLiveActivationStatus,
  ZavorthOwnerGatedLiveIoStatus,
} from '../contracts/ZavorthOwnerGatedLiveActivationContract.js';
import { ZAVORTH_OWNER_GATED_LIVE_ACTIVATION_CONTRACT_VERSION } from '../contracts/ZavorthOwnerGatedLiveActivationContract.js';

type Runtime = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
};

type BuildInput = {
  activate?: boolean;
  ownerApprovalId?: string | null;
};

type Descriptor = {
  groupId: ZavorthOwnerGatedLiveActivationGroupId;
  label: string;
  family: ZavorthOwnerGatedLiveActivationFamily;
  sourcePhase: ZavorthOwnerGatedLiveActivationPhase;
  priority: ZavorthOwnerGatedLiveActivationPriority;
  mode: ZavorthOwnerGatedLiveActivationMode;
  profile: ZavorthOwnerGatedLiveActivationEntry['profile'];
  requiredSecretRefs: string[];
  requiredConfigRefs: string[];
  runtimeTarget: string;
  policyTarget: string;
  notes: string[];
  commands: ZavorthOwnerGatedLiveActivationCommand[];
};

const DESCRIPTORS: Descriptor[] = [
  agentBridge('agent.bridge.claude-code-cli', 'Claude Code CLI bridge', 'npm run semantic-agent-runtime-certification -- --release-gate --require-pass'),
  agentBridge('agent.bridge.acpx', 'ACPX bridge', 'npm run semantic-agent-runtime-certification:check --silent'),
  agentBridge('agent.bridge.codex-acp', 'Codex ACP bridge', 'npm run semantic-agent-runtime-certification:check --silent'),
  providerRoute('provider.claude.vertex', 'Claude Vertex provider route', [], ['ANTHROPIC_VERTEX_PROJECT_ID', 'ANTHROPIC_VERTEX_REGION']),
  providerRoute('provider.claude.bedrock', 'Claude Bedrock provider route', [], ['AWS_REGION']),
  channelRoute('channel.whatsapp.baileys', 'WhatsApp Baileys channel route', ['WHATSAPP_BAILEYS_SESSION_REF'], ['WHATSAPP_BAILEYS_ALLOWED_RECIPIENTS']),
  channelRoute('channel.matrix.crypto', 'Matrix crypto channel route', ['MATRIX_ACCESS_TOKEN'], ['MATRIX_HOMESERVER_URL', 'MATRIX_ROOM_IDS']),
  runtimeEnhancement('runtime.terminal.pty', 'Governed terminal PTY runtime', ['NODE_PTY_ENABLED']),
  runtimeEnhancement('runtime.shell.tree-sitter', 'Tree-sitter shell parser enhancement', ['TREE_SITTER_SHELL_ENABLED']),
  nativeTarget('native.wrapper.android', 'Android native wrapper route', ['ANDROID_WRAPPER_SCOPE_APPROVED']),
  nativeTarget('native.wrapper.ios', 'iOS native wrapper route', ['IOS_WRAPPER_SCOPE_APPROVED']),
  nativeTarget('native.wrapper.macos', 'macOS native wrapper route', ['MACOS_WRAPPER_SCOPE_APPROVED']),
  nativeTarget('native.local-tts.mlx', 'Local MLX TTS runtime route', ['MLX_TTS_RUNTIME_PATH']),
  skill('skill.release-note-drafter', 'Release note drafter skill', [], ['ZAVORTH_SKILL_TOOL_EXECUTION_APPROVAL']),
  skill('skill.qa-scenario-author', 'QA scenario author skill', [], ['ZAVORTH_SKILL_TOOL_EXECUTION_APPROVAL']),
  skill('skill.web-research-reviewer', 'Web research reviewer skill', [], ['ZAVORTH_SKILL_NETWORK_READ_APPROVAL']),
  skill('skill.connector-calendar-brief', 'Calendar brief connector skill', ['calendar.oauth'], ['ZAVORTH_SKILL_TOOL_EXECUTION_APPROVAL']),
  skill('skill.connector-email-draft', 'Email draft connector skill', ['mail.oauth'], ['ZAVORTH_SKILL_TOOL_EXECUTION_APPROVAL']),
  skill('skill.connector-issue-triage', 'Issue triage connector skill', ['issues.token'], ['ZAVORTH_SKILL_TOOL_EXECUTION_APPROVAL']),
  skill('skill.catalog.chrome-devtools', 'Chrome DevTools catalog skill', [], ['ZAVORTH_SKILL_TOOL_EXECUTION_APPROVAL']),
  skill('skill.catalog.codenavi', 'Code navigation catalog skill', [], ['ZAVORTH_SKILL_TOOL_EXECUTION_APPROVAL']),
  skillBridge('bridge.mcp.skill-connectors', 'MCP bridge for skill connectors'),
  skillBridge('bridge.acp.skill-connectors', 'ACP bridge for skill connectors'),
];

export class ZavorthOwnerGatedLiveActivationService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
  }

  public buildSnapshot(input: BuildInput = {}): ZavorthOwnerGatedLiveActivationSnapshot {
    const activationRequested = input.activate === true;
    const ownerApprovalId = clean(input.ownerApprovalId);
    const entries = DESCRIPTORS.map((descriptor) =>
      this.buildEntry(descriptor, activationRequested, ownerApprovalId));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const approvalRequired = entries.filter((entry) => entry.status === 'approval-required').length;
    const status: ZavorthOwnerGatedLiveActivationStatus =
      activationRequested && ownerApprovalId && blocked === 0 ? 'passed' : 'blocked';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_OWNER_GATED_LIVE_ACTIVATION_CONTRACT_VERSION,
      status,
      statement: 'Owner-gated live capabilities are activated as controlled Zavorth routes with receipts, approvals, SecretRefs and no default live I/O.',
      activationRequested,
      ownerApprovalId,
      entries,
      receipts,
      summary: {
        groups: 23,
        activated: entries.filter((entry) => entry.status === 'activated').length,
        approvalRequired,
        blocked,
        families: new Set(entries.map((entry) => entry.family)).size,
        agentRuntimeBridges: countFamily(entries, 'agent-runtime-bridge'),
        providerRoutes: countFamily(entries, 'provider-route'),
        channelRoutes: countFamily(entries, 'channel-route'),
        runtimeEnhancements: countFamily(entries, 'runtime-enhancement'),
        nativeDeviceTargets: countFamily(entries, 'native-device'),
        skills: countFamily(entries, 'skill'),
        skillBridges: countFamily(entries, 'skill-bridge'),
        configuredLiveIoReady: entries.filter((entry) => entry.liveIoStatus === 'ready').length,
        secretRefRequired: entries.filter((entry) => entry.liveIoStatus === 'secretref-required').length,
        configRequired: entries.filter((entry) => entry.liveIoStatus === 'config-required').length,
        localOnlyOrNoLiveIoRequired: entries.filter((entry) => entry.liveIoStatus === 'not-required').length,
        requiredSecretRefs: sumLength(entries, 'requiredSecretRefs'),
        configuredSecretRefs: sumLength(entries, 'configuredSecretRefs'),
        missingSecretRefs: sumLength(entries, 'missingSecretRefs'),
        requiredConfigRefs: sumLength(entries, 'requiredConfigRefs'),
        configuredConfigRefs: sumLength(entries, 'configuredConfigRefs'),
        missingConfigRefs: sumLength(entries, 'missingConfigRefs'),
        receipts: receipts.length,
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        enabledByDefault: false,
      },
      policy: {
        activateAllOwnerGatedRoutesWhenApproved: true,
        activationDoesNotPerformLiveIo: true,
        liveIoRequiresSecretRefsAndExplicitStagingCommand: true,
        writesShellAndNativeAccessRequirePolicyReceipts: true,
        providerRoutesUseRealProviderMeshNotApiImpersonation: true,
        localModelsUseProviderMeshCompatibleRoutes: true,
        noBypassPermissions: true,
        noDefaultEnablement: true,
        noSecretsSerialized: true,
        receiptsRequiredForEveryActivatedGroup: true,
      },
      commands: {
        inspect: 'npm run owner-gated-live-activation --silent',
        inspectJson: 'npm run owner-gated-live-activation:json --silent',
        activate: 'npm run owner-gated-live-activation -- --activate --owner-approval-id <id>',
        check: 'npm run owner-gated-live-activation:check --silent',
        qa: 'npm run qa:owner-gated-live-activation --silent',
        nextStep: 'Owner-gated live activation routes are resolved',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthOwnerGatedLiveActivationSnapshot): string {
    const lines = [
      'Zavorth Owner-Gated Live Activation',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Activation requested: ${snapshot.activationRequested}`,
      `Owner approval id: ${snapshot.ownerApprovalId || 'missing'}`,
      `Groups: ${snapshot.summary.groups}`,
      `Activated/approval-required/blocked: ${snapshot.summary.activated}/${snapshot.summary.approvalRequired}/${snapshot.summary.blocked}`,
      `Families agent/provider/channel/runtime/native/skill/bridge: ${snapshot.summary.agentRuntimeBridges}/${snapshot.summary.providerRoutes}/${snapshot.summary.channelRoutes}/${snapshot.summary.runtimeEnhancements}/${snapshot.summary.nativeDeviceTargets}/${snapshot.summary.skills}/${snapshot.summary.skillBridges}`,
      `Live I/O ready/SecretRef/config/not-required: ${snapshot.summary.configuredLiveIoReady}/${snapshot.summary.secretRefRequired}/${snapshot.summary.configRequired}/${snapshot.summary.localOnlyOrNoLiveIoRequired}`,
      `Missing SecretRefs/config refs: ${snapshot.summary.missingSecretRefs}/${snapshot.summary.missingConfigRefs}`,
      `Live external I/O performed: ${snapshot.summary.liveExternalIoPerformed}`,
      `Secret values serialized: ${snapshot.summary.secretValuesSerialized}`,
      'Activated groups:',
      ...snapshot.entries.map((entry) =>
        `- ${entry.status} ${entry.groupId}: liveIo=${entry.liveIoStatus}, missingSecretRefs=${entry.missingSecretRefs.length}, missingConfigRefs=${entry.missingConfigRefs.length}`,
      ),
      `Next: ${snapshot.commands.nextStep}`,
    ];
    return lines.join('\n');
  }

  private buildEntry(
    descriptor: Descriptor,
    activationRequested: boolean,
    ownerApprovalId: string | null,
  ): ZavorthOwnerGatedLiveActivationEntry {
    const status: ZavorthOwnerGatedLiveActivationRouteStatus =
      activationRequested && ownerApprovalId ? 'activated' : 'approval-required';
    const configuredSecretRefs = descriptor.requiredSecretRefs.filter((ref) => this.hasRef(ref));
    const missingSecretRefs = descriptor.requiredSecretRefs.filter((ref) => !configuredSecretRefs.includes(ref));
    const configuredConfigRefs = descriptor.requiredConfigRefs.filter((ref) => this.hasRef(ref));
    const missingConfigRefs = descriptor.requiredConfigRefs.filter((ref) => !configuredConfigRefs.includes(ref));
    const liveIoStatus = this.liveIoStatus(descriptor, missingSecretRefs, missingConfigRefs);
    const receipt = this.receipt({
      descriptor,
      status,
      liveIoStatus,
      ownerApprovalId,
      activationRequested,
    });
    return {
      groupId: descriptor.groupId,
      label: descriptor.label,
      family: descriptor.family,
      sourcePhase: descriptor.sourcePhase,
      priority: descriptor.priority,
      status,
      mode: descriptor.mode,
      liveIoStatus,
      profile: descriptor.profile,
      requiredApproval: true,
      ownerApprovalId,
      requiredSecretRefs: descriptor.requiredSecretRefs,
      configuredSecretRefs,
      missingSecretRefs,
      requiredConfigRefs: descriptor.requiredConfigRefs,
      configuredConfigRefs,
      missingConfigRefs,
      runtimeTarget: descriptor.runtimeTarget,
      policyTarget: descriptor.policyTarget,
      commands: descriptor.commands,
      receipt,
      notes: descriptor.notes,
    };
  }

  private liveIoStatus(
    descriptor: Descriptor,
    missingSecretRefs: string[],
    missingConfigRefs: string[],
  ): ZavorthOwnerGatedLiveIoStatus {
    if (descriptor.requiredSecretRefs.length === 0 && descriptor.requiredConfigRefs.length === 0) {
      return 'not-required';
    }
    if (missingSecretRefs.length > 0) {
      return 'secretref-required';
    }
    if (missingConfigRefs.length > 0) {
      return 'config-required';
    }
    return 'ready';
  }

  private hasRef(ref: string): boolean {
    const candidates = secretRefCandidates(ref);
    return candidates.some((candidate) => Boolean(clean(this.env[candidate])));
  }

  private receipt(input: {
    descriptor: Descriptor;
    status: ZavorthOwnerGatedLiveActivationRouteStatus;
    liveIoStatus: ZavorthOwnerGatedLiveIoStatus;
    ownerApprovalId: string | null;
    activationRequested: boolean;
  }): ZavorthOwnerGatedLiveActivationReceipt {
    return {
      id: `zavorth.owner-gated-live.${safeId(input.descriptor.groupId)}.receipt`,
      groupId: input.descriptor.groupId,
      status: input.status,
      mode: input.descriptor.mode,
      liveIoStatus: input.liveIoStatus,
      ownerApprovalId: input.ownerApprovalId,
      activationRequested: input.activationRequested,
      artifactFirst: true,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      enabledByDefault: false,
      reason: input.status === 'activated'
        ? 'Owner-gated route is activated in controlled Zavorth mode; staging live I/O still requires configured refs and explicit command.'
        : 'Owner approval id is required before controlled activation.',
    };
  }
}

function agentBridge(
  groupId: ZavorthOwnerGatedLiveActivationGroupId,
  label: string,
  checkCommand: string,
): Descriptor {
  return descriptor({
    groupId,
    label,
    family: 'agent-runtime-bridge',
    sourcePhase: 'S2',
    priority: 'P1',
    mode: 'controlled-route',
    profile: 'controlled-live',
    requiredSecretRefs: [],
    requiredConfigRefs: [],
    runtimeTarget: 'SourceAgentRuntimeBridgeService + ClaudeAgentSdkRuntimeAdapter policy surface',
    policyTarget: 'SourceAgentRuntimeToolPolicyService canUseTool denial/approval policy',
    commands: [
      command('policy-check', checkCommand, false, true),
      command('dry-run', 'npm run semantic-agent-runtime-certification:json --silent', false, true),
    ],
    notes: ['Bridge is active as a governed route, not as bypassed CLI/tool execution.'],
  });
}

function providerRoute(
  groupId: ZavorthOwnerGatedLiveActivationGroupId,
  label: string,
  requiredSecretRefs: string[],
  requiredConfigRefs: string[],
): Descriptor {
  const provider = groupId.endsWith('vertex') ? 'anthropic-vertex' : 'amazon-bedrock';
  return descriptor({
    groupId,
    label,
    family: 'provider-route',
    sourcePhase: 'S3',
    priority: 'P1',
    mode: 'configured-live-io',
    profile: 'staging-live',
    requiredSecretRefs,
    requiredConfigRefs,
    runtimeTarget: `Provider Mesh ${provider} route`,
    policyTarget: 'SourceProviderCredentialRouteService redacted credential route',
    commands: [
      command('configured', `npm run provider-long-tail-activation -- --profile configured --provider ${provider}`, false, true),
      command('staging-live', `npm run provider-long-tail-activation -- --profile staging-live --provider ${provider} --confirm-live-io`, true, true),
    ],
    notes: ['Provider route uses the real provider family. No Anthropic API impersonation or provider bypass is allowed.'],
  });
}

function channelRoute(
  groupId: ZavorthOwnerGatedLiveActivationGroupId,
  label: string,
  requiredSecretRefs: string[],
  requiredConfigRefs: string[],
): Descriptor {
  const channel = groupId.includes('whatsapp') ? 'whatsapp' : 'matrix';
  return descriptor({
    groupId,
    label,
    family: 'channel-route',
    sourcePhase: 'S4',
    priority: groupId.includes('whatsapp') ? 'P0' : 'P1',
    mode: 'configured-live-io',
    profile: 'staging-live',
    requiredSecretRefs,
    requiredConfigRefs,
    runtimeTarget: channel === 'whatsapp' ? 'WhatsAppChannelPack owner-gated route' : 'Matrix channel crypto route',
    policyTarget: 'SourceChannelSecretPolicyService allowlist and SecretRef policy',
    commands: [
      command('configured', `npm run channel-long-tail-activation -- --profile configured --channel ${channel}`, false, true),
      command('staging-live', `npm run channel-long-tail-activation -- --profile staging-live --channel ${channel} --confirm-live-io`, true, true),
    ],
    notes: ['Channel route is active only behind allowlist, SecretRef and staging live-send confirmation.'],
  });
}

function runtimeEnhancement(
  groupId: ZavorthOwnerGatedLiveActivationGroupId,
  label: string,
  requiredConfigRefs: string[],
): Descriptor {
  return descriptor({
    groupId,
    label,
    family: 'runtime-enhancement',
    sourcePhase: 'S5',
    priority: 'P1',
    mode: 'local-runtime',
    profile: 'local-runtime',
    requiredSecretRefs: [],
    requiredConfigRefs,
    runtimeTarget: groupId.includes('pty') ? 'GovernedTerminalRuntime PTY capability' : 'ShellSafetyClassifier parser enhancement',
    policyTarget: 'terminal and parser safety policy receipts',
    commands: [
      command('doctor', 'npm run semantic-memory-document-terminal-certification:check --silent', false, true),
    ],
    notes: ['Local runtime enhancement remains policy-governed and never enables unsafe shell bypass.'],
  });
}

function nativeTarget(
  groupId: ZavorthOwnerGatedLiveActivationGroupId,
  label: string,
  requiredConfigRefs: string[],
): Descriptor {
  return descriptor({
    groupId,
    label,
    family: 'native-device',
    sourcePhase: 'S6',
    priority: groupId.includes('local-tts') ? 'P2' : 'P1',
    mode: 'local-runtime',
    profile: 'local-runtime',
    requiredSecretRefs: [],
    requiredConfigRefs,
    runtimeTarget: groupId.includes('local-tts') ? 'ZavorthMlxTtsRuntimeAdapter' : 'Owner-scope native wrapper ledger',
    policyTarget: 'Zavorth native companion device permission policy',
    commands: [
      command('doctor', 'npm run semantic-native-companion-device-capability-certification:check --silent', false, true),
    ],
    notes: ['Native capability route is active as an owner-scoped ledger path, not as a shipped native app by default.'],
  });
}

function skill(
  groupId: ZavorthOwnerGatedLiveActivationGroupId,
  label: string,
  requiredSecretRefs: string[],
  requiredConfigRefs: string[],
): Descriptor {
  return descriptor({
    groupId,
    label,
    family: 'skill',
    sourcePhase: 'S8',
    priority: groupId.includes('connector') ? 'P0' : 'P1',
    mode: requiredSecretRefs.length > 0 ? 'configured-live-io' : 'controlled-route',
    profile: requiredSecretRefs.length > 0 ? 'staging-live' : 'controlled-live',
    requiredSecretRefs,
    requiredConfigRefs,
    runtimeTarget: 'ZavorthSkillEcosystemPackService manifest and lifecycle receipts',
    policyTarget: 'ZavorthSkillPermissionProfileService approval and SecretRef policy',
    commands: [
      command('doctor', 'npm run semantic-skill-ecosystem-certification:check --silent', false, true),
      command('dry-run', 'npm run semantic-skill-ecosystem-certification:json --silent', false, true),
    ],
    notes: ['Skill is active as optional, inspectable and receipt-first; destructive tool execution remains approval-gated.'],
  });
}

function skillBridge(
  groupId: ZavorthOwnerGatedLiveActivationGroupId,
  label: string,
): Descriptor {
  return descriptor({
    groupId,
    label,
    family: 'skill-bridge',
    sourcePhase: 'S8',
    priority: 'P1',
    mode: 'controlled-route',
    profile: 'controlled-live',
    requiredSecretRefs: [],
    requiredConfigRefs: [],
    runtimeTarget: 'Optional skill bridge route',
    policyTarget: 'MCP/ACP optional bridge policy',
    commands: [
      command('policy-check', 'npm run semantic-skill-ecosystem-certification:check --silent', false, true),
    ],
    notes: ['Bridge is active as a connector route, not core runtime bloat.'],
  });
}

function descriptor(input: Descriptor): Descriptor {
  return input;
}

function command(
  kind: ZavorthOwnerGatedLiveActivationCommand['kind'],
  commandText: string,
  requiresLiveIoConfirmation: boolean,
  requiresOwnerApproval: boolean,
): ZavorthOwnerGatedLiveActivationCommand {
  return {
    kind,
    command: commandText,
    requiresLiveIoConfirmation,
    requiresOwnerApproval,
  };
}

function countFamily(
  entries: ZavorthOwnerGatedLiveActivationEntry[],
  family: ZavorthOwnerGatedLiveActivationFamily,
): number {
  return entries.filter((entry) => entry.family === family).length;
}

type ArrayField =
  | 'requiredSecretRefs'
  | 'configuredSecretRefs'
  | 'missingSecretRefs'
  | 'requiredConfigRefs'
  | 'configuredConfigRefs'
  | 'missingConfigRefs';

function sumLength(entries: ZavorthOwnerGatedLiveActivationEntry[], field: ArrayField): number {
  return entries.reduce((sum, entry) => sum + entry[field].length, 0);
}

function secretRefCandidates(ref: string): string[] {
  const normalized = ref.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const explicit: Record<string, string[]> = {
    'CALENDAR_OAUTH': ['CALENDAR_OAUTH', 'GOOGLE_CALENDAR_OAUTH', 'ZAVORTH_SECRET_CALENDAR_OAUTH'],
    'MAIL_OAUTH': ['MAIL_OAUTH', 'GMAIL_OAUTH', 'OUTLOOK_MAIL_OAUTH', 'ZAVORTH_SECRET_MAIL_OAUTH'],
    'ISSUES_TOKEN': ['ISSUES_TOKEN', 'GITHUB_TOKEN', 'LINEAR_TOKEN', 'ZAVORTH_SECRET_ISSUES_TOKEN'],
    'ANTHROPIC_VERTEX_PROJECT_ID': ['ANTHROPIC_VERTEX_PROJECT_ID', 'GOOGLE_CLOUD_PROJECT'],
    'AWS_REGION': ['AWS_REGION', 'AWS_DEFAULT_REGION'],
    'WHATSAPP_BAILEYS_SESSION_REF': ['WHATSAPP_BAILEYS_SESSION_REF', 'WHATSAPP_BAILEYS_SESSION_DIR'],
  };
  return [...(explicit[normalized] || []), normalized, `ZAVORTH_${normalized}`];
}

function clean(value: unknown): string | null {
  const text = String(value || '').trim();
  return text.length > 0 ? text : null;
}

function safeId(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'unknown';
}
