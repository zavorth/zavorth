import { config } from '../config/index.js';
import {
  ZAVORTH_GOVERNED_SUBAGENT_CONTRACT_VERSION,
  type ZavorthGovernedSubagentBudget,
  type ZavorthGovernedSubagentPreparedRole,
  type ZavorthGovernedSubagentProfile,
  type ZavorthGovernedSubagentProfileId,
  type ZavorthGovernedSubagentSnapshot,
  type ZavorthGovernedSubagentStatus,
} from '../contracts/runtime/ZavorthGovernedSubagentContract.js';
import type { ZavorthNativeSkillPresetId } from '../contracts/native/ZavorthNativeIntelligencePackContract.js';
import {
  decideSecurityPolicy,
  type SecurityPolicyBrokerDecision,
  type SecurityPolicyBrokerRequest,
} from '../security/SecurityPolicyBroker.js';
import type { SecurityProfileId } from '../security/SecurityProfile.js';
import {
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
} from '../runtime/agent/subagents/index.js';
import { ZavorthNativeIntelligencePackService } from './ZavorthNativeIntelligencePackService.js';

type DecideSecurityPolicy = (
  request: SecurityPolicyBrokerRequest,
  runtime?: { now?: () => Date },
) => SecurityPolicyBrokerDecision;

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  nativePackService?: Pick<ZavorthNativeIntelligencePackService, 'buildSnapshot'>;
  decidePolicy?: DecideSecurityPolicy;
};

export type ZavorthGovernedSubagentInput = {
  projectRoot?: string | null;
  presetId?: ZavorthNativeSkillPresetId | string | null;
  task?: string | null;
  roleIds?: string[] | null;
  prepare?: boolean | null;
  maxRoles?: number | null;
  securityProfile?: SecurityProfileId | string | null;
};

const PRESET_ROLE_IDS: Record<ZavorthNativeSkillPresetId, ZavorthGovernedSubagentProfileId[]> = {
  basic: ['planner', 'operator', 'memory-curator'],
  developer: ['planner', 'coder', 'qa', 'auditor'],
  security: ['planner', 'auditor', 'researcher', 'qa'],
  research: ['planner', 'researcher', 'memory-curator'],
  ops: ['planner', 'operator', 'qa', 'memory-curator'],
  'power-user': ['planner', 'researcher', 'auditor', 'coder', 'qa', 'operator', 'memory-curator'],
};

const PROFILE_DEFINITIONS: ZavorthGovernedSubagentProfile[] = [
  profile({
    id: 'planner',
    label: 'Planner',
    objective: 'Decompose ambiguous requests into safe, testable execution plans.',
    nativeSkillIds: ['task-planning', 'agent-orchestrator'],
    permissionProfileId: 'local-readonly',
    riskLevel: 'low',
    scopeMode: 'read_only',
    allowedSurfaces: ['skill', 'workspace'],
    allowedToolIds: ['skill.invoke.native', 'workspace.read'],
    requiresUserApproval: false,
    requiresAdminPolicy: false,
    maxToolCalls: 4,
    maxWallClockMs: 120000,
    maxOutputBytes: 24000,
    maxPromptChars: 32000,
    maxFileReads: 40,
    maxFileWrites: 0,
    maxNetworkCalls: 0,
    accepts: ['user objective', 'runtime state', 'skill catalog summary'],
    produces: ['execution plan', 'acceptance criteria', 'approval checklist'],
    mustNotProduce: ['shell commands for execution', 'secret values', 'unapproved mutations'],
  }),
  profile({
    id: 'researcher',
    label: 'Researcher',
    objective: 'Gather evidence from documents or safe web surfaces with untrusted-content boundaries.',
    nativeSkillIds: ['document-analysis', 'web-research-governed', 'prompt-injection-defense'],
    permissionProfileId: 'network-read-approval',
    riskLevel: 'medium',
    scopeMode: 'tool_limited',
    allowedSurfaces: ['skill', 'workspace', 'web-fetch'],
    allowedToolIds: ['skill.invoke.native', 'workspace.read', 'safe-fetch.extract'],
    requiresUserApproval: true,
    requiresAdminPolicy: false,
    maxToolCalls: 8,
    maxWallClockMs: 180000,
    maxOutputBytes: 32000,
    maxPromptChars: 48000,
    maxFileReads: 80,
    maxFileWrites: 0,
    maxNetworkCalls: 8,
    accepts: ['research question', 'source allowlist', 'untrusted excerpts'],
    produces: ['cited findings', 'source map', 'risk notes'],
    mustNotProduce: ['instructions copied from untrusted content as commands', 'raw secrets', 'uncited claims'],
  }),
  profile({
    id: 'auditor',
    label: 'Auditor',
    objective: 'Review code, prompts, policies, channels, and runtime behavior for security or quality risk.',
    nativeSkillIds: ['security-audit', 'prompt-injection-defense', 'repo-map'],
    permissionProfileId: 'workspace-read',
    riskLevel: 'medium',
    scopeMode: 'read_only',
    allowedSurfaces: ['skill', 'workspace'],
    allowedToolIds: ['skill.invoke.native', 'workspace.read', 'policy.receipt.read'],
    requiresUserApproval: false,
    requiresAdminPolicy: false,
    maxToolCalls: 8,
    maxWallClockMs: 180000,
    maxOutputBytes: 30000,
    maxPromptChars: 48000,
    maxFileReads: 120,
    maxFileWrites: 0,
    maxNetworkCalls: 0,
    accepts: ['diff summary', 'repo map', 'runtime receipts'],
    produces: ['findings with severity', 'evidence references', 'test gaps'],
    mustNotProduce: ['silent fixes', 'speculative findings without evidence', 'secret values'],
  }),
  profile({
    id: 'coder',
    label: 'Coder',
    objective: 'Prepare scoped implementation changes only after planning and approval.',
    nativeSkillIds: ['code-review', 'repo-map', 'large-skill-absorption'],
    permissionProfileId: 'workspace-write-approval',
    riskLevel: 'medium',
    scopeMode: 'workspace_patch',
    allowedSurfaces: ['skill', 'workspace', 'local-write'],
    allowedToolIds: ['skill.invoke.native', 'workspace.read', 'workspace.patch'],
    requiresUserApproval: true,
    requiresAdminPolicy: false,
    maxToolCalls: 10,
    maxWallClockMs: 240000,
    maxOutputBytes: 36000,
    maxPromptChars: 64000,
    maxFileReads: 140,
    maxFileWrites: 12,
    maxNetworkCalls: 0,
    accepts: ['approved plan', 'owned file set', 'acceptance criteria'],
    produces: ['patch summary', 'changed file list', 'verification commands'],
    mustNotProduce: ['unapproved file mutations', 'destructive commands', 'credential material'],
  }),
  profile({
    id: 'qa',
    label: 'QA',
    objective: 'Verify behavior, tests, regressions, receipts, and release readiness.',
    nativeSkillIds: ['code-review', 'incident-triage', 'dashboard-ops'],
    permissionProfileId: 'workspace-read',
    riskLevel: 'medium',
    scopeMode: 'tool_limited',
    allowedSurfaces: ['skill', 'workspace'],
    allowedToolIds: ['skill.invoke.native', 'workspace.read', 'runtime.check'],
    requiresUserApproval: false,
    requiresAdminPolicy: false,
    maxToolCalls: 8,
    maxWallClockMs: 240000,
    maxOutputBytes: 30000,
    maxPromptChars: 48000,
    maxFileReads: 120,
    maxFileWrites: 0,
    maxNetworkCalls: 0,
    accepts: ['implementation summary', 'test commands', 'receipts'],
    produces: ['verification result', 'regression notes', 'release risk'],
    mustNotProduce: ['unapproved writes', 'ignored failing tests', 'unclear pass criteria'],
  }),
  profile({
    id: 'operator',
    label: 'Operator',
    objective: 'Inspect providers, channels, dashboard state, and operational recovery steps.',
    nativeSkillIds: ['provider-doctor', 'dashboard-ops', 'incident-triage', 'channel-response-design', 'user-onboarding'],
    permissionProfileId: 'connector-live-secretref',
    riskLevel: 'medium',
    scopeMode: 'tool_limited',
    allowedSurfaces: ['skill', 'provider', 'mcp', 'plugin'],
    allowedToolIds: ['skill.invoke.native', 'provider.doctor', 'channel.status', 'dashboard.project'],
    requiresUserApproval: true,
    requiresAdminPolicy: false,
    maxToolCalls: 8,
    maxWallClockMs: 180000,
    maxOutputBytes: 28000,
    maxPromptChars: 48000,
    maxFileReads: 40,
    maxFileWrites: 0,
    maxNetworkCalls: 4,
    accepts: ['runtime health', 'channel status', 'provider references'],
    produces: ['operator status', 'safe next action', 'plain-language setup guidance'],
    mustNotProduce: ['raw provider secrets', 'automatic external sends', 'unapproved channel messages'],
  }),
  profile({
    id: 'memory-curator',
    label: 'Memory Curator',
    objective: 'Summarize, retain, redact, or forget context under data lifecycle policy.',
    nativeSkillIds: ['memory-curator', 'document-analysis', 'prompt-injection-defense'],
    permissionProfileId: 'workspace-read',
    riskLevel: 'medium',
    scopeMode: 'read_only',
    allowedSurfaces: ['skill', 'workspace'],
    allowedToolIds: ['skill.invoke.native', 'workspace.read', 'memory.receipt.read'],
    requiresUserApproval: false,
    requiresAdminPolicy: false,
    maxToolCalls: 6,
    maxWallClockMs: 120000,
    maxOutputBytes: 24000,
    maxPromptChars: 40000,
    maxFileReads: 80,
    maxFileWrites: 0,
    maxNetworkCalls: 0,
    accepts: ['conversation summary', 'artifact receipts', 'retention policy'],
    produces: ['memory decision', 'redaction summary', 'forget/export recommendation'],
    mustNotProduce: ['raw secrets', 'unapproved persistent memory writes', 'unbounded transcript dumps'],
  }),
];

export class ZavorthGovernedSubagentService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly nativePackService: Pick<ZavorthNativeIntelligencePackService, 'buildSnapshot'>;
  private readonly decidePolicy: DecideSecurityPolicy;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.nativePackService = runtime.nativePackService || new ZavorthNativeIntelligencePackService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.decidePolicy = runtime.decidePolicy || decideSecurityPolicy;
  }

  public listProfiles(): ZavorthGovernedSubagentProfile[] {
    return PROFILE_DEFINITIONS.map((entry) => clone(entry));
  }

  public buildSnapshot(input: ZavorthGovernedSubagentInput = {}): ZavorthGovernedSubagentSnapshot {
    const projectRoot = String(input.projectRoot || this.projectRoot);
    const selectedPreset = normalizePresetId(input.presetId);
    const task = normalizeText(input.task) || null;
    const selectedProfileIds = this.selectProfileIds({
      selectedPreset,
      task,
      explicitRoleIds: input.roleIds || [],
      maxRoles: input.maxRoles,
    });
    const nativePack = this.nativePackService.buildSnapshot({
      projectRoot,
      presetId: selectedPreset,
      activate: input.prepare !== false,
    });
    const nativeReadyIds = new Set(
      nativePack.skills
        .filter((entry) => entry.activationReady)
        .map((entry) => entry.id),
    );
    const profiles = this.listProfiles();
    const preparedRoles = selectedProfileIds.map((id) => {
      const profileEntry = profiles.find((entry) => entry.id === id)!;
      return this.prepareRole({
        profile: profileEntry,
        nativeReadyIds,
        selectedPreset,
        projectRoot,
        securityProfile: input.securityProfile,
      });
    });
    const summary = {
      profiles: profiles.length,
      selectedRoles: selectedProfileIds.length,
      readyRoles: preparedRoles.filter((entry) => entry.runtimeStatus === 'ready').length,
      approvalRequiredRoles: preparedRoles.filter((entry) => entry.runtimeStatus === 'approval-required').length,
      blockedRoles: preparedRoles.filter((entry) => entry.runtimeStatus === 'blocked').length,
      nativePackStatus: nativePack.status,
      nativeSkillsReady: nativePack.summary.activationReady,
      policyReceipts: preparedRoles.filter((entry) => Boolean(entry.policyReceipt)).length,
      subagentReceipts: preparedRoles.filter((entry) => Boolean(entry.subagentReceipt)).length,
      executionPerformed: false as const,
      directToolUsePerformed: false as const,
      workspaceMutationPerformed: false as const,
    };
    const status = resolveStatus({
      nativePackStatus: nativePack.status,
      selectedRoleCount: selectedProfileIds.length,
      blockedRoles: summary.blockedRoles,
      approvalRequiredRoles: summary.approvalRequiredRoles,
    });

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_GOVERNED_SUBAGENT_CONTRACT_VERSION,
      status,
      source: 'ZavorthGovernedSubagentService',
      projectRoot,
      selectedPreset,
      task,
      profiles,
      selectedProfileIds,
      preparedRoles,
      summary,
      guarantees: {
        compilerOnly: true,
        noSubagentsLaunched: true,
        noToolsInvoked: true,
        noWorkspaceMutation: true,
        launchRequiresUserApproval: true,
        launchRequiresPolicyBroker: true,
        launchRequiresBudget: true,
        nativeSkillsBackEveryRole: true,
        untrustedContentDelimited: true,
        receiptsRequired: true,
      },
      commands: {
        preview: 'npm run zavorth:governed-subagents',
        previewJson: 'npm run zavorth:governed-subagents:json',
        prepareDeveloper: 'npm run zavorth:governed-subagents -- --preset developer --prepare',
        check: 'npm run zavorth:governed-subagents:check --silent',
        nextStage: 'Approval gate - Large Skill Absorption Pipeline',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthGovernedSubagentSnapshot): string {
    const lines = [
      'Zavorth Governed Subagents - Preview engine',
      '',
      `Status: ${snapshot.status}`,
      `Preset: ${snapshot.selectedPreset}`,
      `Task: ${snapshot.task || 'not provided'}`,
      `Roles: selected=${snapshot.summary.selectedRoles} ready=${snapshot.summary.readyRoles} approval=${snapshot.summary.approvalRequiredRoles} blocked=${snapshot.summary.blockedRoles}`,
      `Receipts: policy=${snapshot.summary.policyReceipts} subagent=${snapshot.summary.subagentReceipts}`,
      `Execution: ${snapshot.summary.executionPerformed} | tools: ${snapshot.summary.directToolUsePerformed} | workspace mutation: ${snapshot.summary.workspaceMutationPerformed}`,
      '',
      'Prepared roles:',
    ];

    for (const role of snapshot.preparedRoles) {
      lines.push(
        `- ${role.profile.id}: ${role.runtimeStatus} | scope=${role.profile.scopeMode} | skills=${role.nativeSkills.readySkillIds.length}/${role.nativeSkills.requiredSkillIds.length} | policy=${role.policyReceipt.action}`,
      );
      if (role.nativeSkills.missingSkillIds.length > 0) {
        lines.push(`  missingSkills=${role.nativeSkills.missingSkillIds.join(', ')}`);
      }
    }

    lines.push('', 'Guarantees:');
    lines.push('- compiler-only; no subagents launched');
    lines.push('- no tools invoked and no workspace mutation');
    lines.push('- launch requires user approval, Policy Broker, budget and receipts');
    lines.push('', `Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private selectProfileIds(input: {
    selectedPreset: ZavorthNativeSkillPresetId;
    task: string | null;
    explicitRoleIds: string[];
    maxRoles?: number | null;
  }): ZavorthGovernedSubagentProfileId[] {
    const explicit = unique(
      input.explicitRoleIds
        .map((entry) => normalizeProfileId(entry))
        .filter((entry): entry is ZavorthGovernedSubagentProfileId => Boolean(entry)),
    );
    const base = explicit.length > 0
      ? explicit
      : [...PRESET_ROLE_IDS[input.selectedPreset]];
    const taskRoles = this.rolesFromTask(input.task);
    const selected = unique(['planner', ...base, ...taskRoles]);
    const maxRoles = normalizeMaxRoles(input.maxRoles);
    return selected.slice(0, maxRoles);
  }

  private rolesFromTask(task: string | null): ZavorthGovernedSubagentProfileId[] {
    const text = String(task || '').toLowerCase();
    const roles: ZavorthGovernedSubagentProfileId[] = [];
    if (/\b(vulnerab|seguran|security|audit|brecha|prompt injection|ssrf)\b/.test(text)) {
      roles.push('auditor');
    }
    if (/\b(skill|absor|biblioteca|library|research|pesquis|document|web)\b/.test(text)) {
      roles.push('researcher');
    }
    if (/\b(codigo|code|implementar|patch|editar|fix|corrigir|build)\b/.test(text)) {
      roles.push('coder');
    }
    if (/\b(test|qa|valid|verific|regress|smoke)\b/.test(text)) {
      roles.push('qa');
    }
    if (/\b(provider|canal|channel|dashboard|runtime|operac|whatsapp|telegram|discord|signal|imessage)\b/.test(text)) {
      roles.push('operator');
    }
    if (/\b(memoria|memory|retenc|forget|lembrar|contexto)\b/.test(text)) {
      roles.push('memory-curator');
    }
    return roles;
  }

  private prepareRole(input: {
    profile: ZavorthGovernedSubagentProfile;
    nativeReadyIds: Set<string>;
    selectedPreset: ZavorthNativeSkillPresetId;
    projectRoot: string;
    securityProfile?: SecurityProfileId | string | null;
  }): ZavorthGovernedSubagentPreparedRole {
    const readySkillIds = input.profile.nativeSkillIds.filter((id) => input.nativeReadyIds.has(id));
    const missingSkillIds = input.profile.nativeSkillIds.filter((id) => !input.nativeReadyIds.has(id));
    const policyDecision = this.decidePolicy({
      surface: 'skill',
      operation: 'prepare-governed-subagent',
      target: input.profile.id,
      profile: input.securityProfile || undefined,
      workspace: input.projectRoot,
      sourceTrust: 'trusted-zavorth-native-skill',
      risk: input.profile.requiresUserApproval ? 'review' : 'safe',
      blocked: missingSkillIds.length > 0,
      adminPolicyRequired: input.profile.requiresAdminPolicy,
      userConfirmationRequired: input.profile.requiresUserApproval,
      reasons: [
        `Subagent role ${input.profile.id} is prepared from Zavorth native skills.`,
        'Preparation is compiler-only; launch is denied until explicit approval.',
        `Preset ${input.selectedPreset} selected this role.`,
      ],
      metadata: {
        nativeSkillIds: input.profile.nativeSkillIds,
        allowedSurfaces: input.profile.allowedSurfaces,
        budget: input.profile.budget,
      },
    }, {
      now: this.now,
    });
    const scope = createSubagentCapabilityScope({
      roleId: input.profile.id,
      mode: input.profile.scopeMode,
      allowedTools: input.profile.allowedToolIds,
      allowedPaths: [],
      deniedPaths: input.profile.deniedPaths,
      requiresApproval: true,
      policyTags: [
        'governed-subagent-checkpoint-2',
        `native-preset:${input.selectedPreset}`,
        `native-role:${input.profile.id}`,
      ],
      metadata: {
        source: 'ZavorthGovernedSubagentService',
        nativeSkillIds: input.profile.nativeSkillIds,
        compilerOnly: true,
      },
    });
    const budget = createSubagentBudget({
      maxToolCalls: input.profile.budget.maxToolCalls,
      maxWallClockMs: input.profile.budget.maxWallClockMs,
      maxOutputBytes: input.profile.budget.maxOutputBytes,
      metadata: {
        source: 'ZavorthGovernedSubagentService',
        maxPromptChars: input.profile.budget.maxPromptChars,
        maxFileReads: input.profile.budget.maxFileReads,
        maxFileWrites: input.profile.budget.maxFileWrites,
        maxNetworkCalls: input.profile.budget.maxNetworkCalls,
      },
    });
    const approvalBoundary = createSubagentApprovalBoundary({
      scope,
      budget,
      requiresApproval: true,
      risk: input.profile.requiresUserApproval ? 'attention' : 'safe',
      approvalReason: 'Governed subagent launch requires explicit approval, Policy Broker decision, budget and receipt review.',
      policyTags: [
        `policy-action:${policyDecision.action}`,
        policyDecision.allowed ? 'policy-preparation:allowed' : 'policy-preparation:not-allowed',
      ],
      metadata: {
        policyReceiptId: policyDecision.receipt.receiptId,
      },
    });
    const runtimeStatus = missingSkillIds.length > 0 || policyDecision.requiresAdminPolicy || policyDecision.action === 'deny'
      ? 'blocked'
      : policyDecision.requiresUserConfirmation
        ? 'approval-required'
        : 'ready';
    const subagentReceipt = createSubagentResultReceipt({
      roleId: input.profile.id,
      status: runtimeStatus === 'blocked' ? 'blocked' : 'planned',
      summary: `Governed subagent ${input.profile.id} prepared without launch.`,
      scope,
      budget,
      approvalBoundary,
      risks: [
        ...missingSkillIds.map((id) => `missing-native-skill:${id}`),
        policyDecision.requiresUserConfirmation ? 'policy-user-confirmation-required' : 'policy-preparation-allowed',
        'launch-not-performed',
      ],
      metadata: {
        source: 'ZavorthGovernedSubagentService',
        policyReceiptId: policyDecision.receipt.receiptId,
        nativeSkillsReady: readySkillIds,
        nativeSkillsMissing: missingSkillIds,
      },
    });

    return {
      profile: clone(input.profile),
      runtimeStatus,
      nativeSkills: {
        requiredSkillIds: [...input.profile.nativeSkillIds],
        readySkillIds,
        missingSkillIds,
      },
      policyReceipt: policyDecision.receipt,
      subagentReceipt,
      launchBoundary: {
        preparedOnly: true,
        noSubagentLaunched: true,
        noToolInvoked: true,
        noWorkspaceMutation: true,
        approvalRequiredBeforeLaunch: true,
      },
    };
  }
}

function profile(input: Omit<ZavorthGovernedSubagentProfile, 'budget' | 'deniedPaths' | 'isolation' | 'handoffContract'> & {
  maxToolCalls: number;
  maxWallClockMs: number;
  maxOutputBytes: number;
  maxPromptChars: number;
  maxFileReads: number;
  maxFileWrites: number;
  maxNetworkCalls: number;
  accepts: string[];
  produces: string[];
  mustNotProduce: string[];
  deniedPaths?: string[];
}): ZavorthGovernedSubagentProfile {
  const budget: ZavorthGovernedSubagentBudget = {
    maxToolCalls: input.maxToolCalls,
    maxWallClockMs: input.maxWallClockMs,
    maxOutputBytes: input.maxOutputBytes,
    maxPromptChars: input.maxPromptChars,
    maxFileReads: input.maxFileReads,
    maxFileWrites: input.maxFileWrites,
    maxNetworkCalls: input.maxNetworkCalls,
  };
  return {
    id: input.id,
    label: input.label,
    objective: input.objective,
    nativeSkillIds: [...input.nativeSkillIds],
    permissionProfileId: input.permissionProfileId,
    riskLevel: input.riskLevel,
    scopeMode: input.scopeMode,
    allowedSurfaces: [...input.allowedSurfaces],
    allowedToolIds: [...input.allowedToolIds],
    deniedPaths: unique([...(input.deniedPaths || []), '.git', 'node_modules', 'dist', 'coverage']),
    requiresUserApproval: input.requiresUserApproval,
    requiresAdminPolicy: input.requiresAdminPolicy,
    budget,
    handoffContract: {
      accepts: [...input.accepts],
      produces: [...input.produces],
      mustNotProduce: [...input.mustNotProduce],
    },
    isolation: {
      noSharedMutableMemoryByDefault: true,
      untrustedContentMustBeDelimited: true,
      toolOutputsMustBeReceipted: true,
      launchRequiresPolicyBroker: true,
    },
  };
}

function normalizePresetId(value: unknown): ZavorthNativeSkillPresetId {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'basic'
    || normalized === 'developer'
    || normalized === 'security'
    || normalized === 'research'
    || normalized === 'ops'
    || normalized === 'power-user'
  ) {
    return normalized;
  }
  return 'developer';
}

function normalizeProfileId(value: unknown): ZavorthGovernedSubagentProfileId | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (
    normalized === 'planner'
    || normalized === 'researcher'
    || normalized === 'auditor'
    || normalized === 'coder'
    || normalized === 'qa'
    || normalized === 'operator'
    || normalized === 'memory-curator'
  ) {
    return normalized;
  }
  if (normalized === 'memory') {
    return 'memory-curator';
  }
  return null;
}

function normalizeMaxRoles(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 6;
  }
  return Math.max(1, Math.min(7, Math.floor(parsed)));
}

function resolveStatus(input: {
  nativePackStatus: string;
  selectedRoleCount: number;
  blockedRoles: number;
  approvalRequiredRoles: number;
}): ZavorthGovernedSubagentStatus {
  if (input.nativePackStatus === 'blocked' || input.selectedRoleCount === 0 || input.blockedRoles > 0) {
    return 'blocked';
  }
  if (input.nativePackStatus === 'attention' || input.approvalRequiredRoles > 0) {
    return 'attention';
  }
  return 'passed';
}

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function unique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))) as T[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
