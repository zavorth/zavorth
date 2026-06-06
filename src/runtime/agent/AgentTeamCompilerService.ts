import { queryUniversalAgentRuns } from './RunObservatory.js';
import {
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
  type SubagentResultReceipt,
} from './subagents/index.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const AGENT_TEAM_COMPILER_CONTRACT_VERSION = '2026-05-03.track-40' as const;

export type AgentTeamCompilerStatus = 'not-needed' | 'compiled' | 'waiting-approval' | 'blocked';

export type AgentTeamCompilerTopology = 'linear' | 'parallel' | 'review-gated';

export type AgentTeamCompilerLaunchStatus = 'blocked' | 'prepared';

export type AgentTeamCompilerRoleKind =
  | 'planner'
  | 'researcher'
  | 'implementer'
  | 'verifier'
  | 'provider-specialist'
  | 'safety-reviewer'
  | 'memory-curator'
  | 'operator-liaison';

export type AgentTeamCompilerRole = {
  id: string;
  roleId: string;
  kind: AgentTeamCompilerRoleKind;
  label: string;
  objective: string;
  why: string;
  dependsOn: string[];
  handoffTo: string[];
  capabilityIds: string[];
  toolIds: string[];
  provider: {
    providerLabel: string;
    modelLabel: string;
    candidateId: string | null;
    source: 'provider-arena' | 'model-profile' | 'fallback';
    advisoryOnly: true;
  };
  scope: {
    mode: 'blocked' | 'read_only' | 'tool_limited' | 'workspace_patch';
    allowedTools: string[];
    deniedPaths: string[];
    requiresApproval: boolean;
    policyTags: string[];
  };
  budget: {
    maxToolCalls: number;
    maxWallClockMs: number;
    maxOutputBytes: number;
  };
  approval: {
    required: boolean;
    reason: string;
    inheritedApprovalId: string | null;
  };
  risk: 'safe' | 'attention' | 'danger' | 'unknown';
  subagentReceipt: SubagentResultReceipt;
  actions: {
    previewCommand: string;
    approveCommand: string;
    launchCommand: string;
    inspectCommand: string;
  };
};

export type AgentTeamCompilerReceipt = {
  id: string;
  kind:
    | 'run-observatory'
    | 'provider-arena'
    | 'capability-negotiation'
    | 'swarm-escalation'
    | 'subagent-contract'
    | 'budget'
    | 'approval'
    | 'policy'
    | 'surface';
  source: string;
  detail: string;
  status: 'ready' | 'needs-approval' | 'missing';
};

export type AgentTeamCompilerSnapshot = {
  contractVersion: typeof AGENT_TEAM_COMPILER_CONTRACT_VERSION;
  source: 'AgentTeamCompilerService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: AgentTeamCompilerStatus;
  objective: string;
  topology: {
    mode: AgentTeamCompilerTopology;
    edges: Array<{
      from: string;
      to: string;
      reason: string;
    }>;
  };
  summary: {
    roleCount: number;
    approvalRequiredCount: number;
    providerAssignedCount: number;
    blockedRoleCount: number;
    requestedSwarm: boolean;
    providerArenaLinked: boolean;
    capabilityNegotiationLinked: boolean;
    subagentReceiptsPrepared: boolean;
    compilerOnly: true;
  };
  approval: {
    required: boolean;
    approvalId: string;
    reason: string;
    expiresAt: string | null;
  };
  launch: {
    mode: 'approval-gated-team-run';
    previewCommand: string;
    launchCommand: string;
    inspectCommand: string;
    synthesizeCommand: string;
    synthesisRequired: true;
    directToolExecution: false;
    executionAuthority: 'subagent-runtime-required';
    maxReviewRounds: number;
  };
  roles: AgentTeamCompilerRole[];
  receipts: AgentTeamCompilerReceipt[];
  policy: {
    noSubagentsLaunched: true;
    approvalRequiredBeforeLaunch: true;
    budgetsDefaultToZero: true;
    providerSelectionIsAdvisory: true;
    respectsCapabilityNegotiation: true;
    naturalLanguageDoesNotBypassPolicy: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    dashboardPath: string;
    previewHint: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type AgentTeamCompilerInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

export type AgentTeamCompilerLaunchTurn = {
  id: string;
  phase: 'claim' | 'peer-review' | 'synthesis-input';
  roleId: string;
  targetRoleId: string | null;
  status: 'prepared' | 'blocked';
  prompt: string;
  evidenceRefs: string[];
};

export type AgentTeamCompilerLaunchRole = {
  roleId: string;
  kind: AgentTeamCompilerRoleKind;
  status: 'prepared' | 'blocked';
  scopeMode: AgentTeamCompilerRole['scope']['mode'];
  allowedTools: string[];
  budget: AgentTeamCompilerRole['budget'];
  reviewRequired: boolean;
  evidenceRefs: string[];
};

export type AgentTeamCompilerLaunchResult = {
  contractVersion: typeof AGENT_TEAM_COMPILER_CONTRACT_VERSION;
  source: 'AgentTeamCompilerService';
  generatedAt: string;
  status: AgentTeamCompilerLaunchStatus;
  teamRunId: string;
  compilerRunId: string;
  approval: {
    required: true;
    expectedApprovalId: string;
    providedApprovalId: string | null;
    matched: boolean;
  };
  roles: AgentTeamCompilerLaunchRole[];
  turns: AgentTeamCompilerLaunchTurn[];
  synthesis: {
    status: 'blocked' | 'ready-for-final-synthesis';
    command: string;
    requiredEvidenceRefs: string[];
    reviewerRoleIds: string[];
    summary: string;
  };
  receipts: AgentTeamCompilerReceipt[];
  blockedReasons: string[];
  policy: {
    noDirectToolExecution: true;
    launchRequiresMatchingApproval: true;
    mutationRequiresSubagentGateway: true;
    peerReviewRequiredBeforeSynthesis: true;
    receiptsRequiredBeforeCompletion: true;
    secretsSerialized: false;
  };
  nextSafeAction: string;
};

type LooseRecord = Record<string, unknown>;

type RoleSeed = {
  roleId: string;
  label?: string;
  objective?: string;
  kind?: AgentTeamCompilerRoleKind;
  toolIds?: string[];
  capabilityIds?: string[];
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = 'agent'): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function safeSegment(value: unknown, fallback = 'agent'): string {
  return normalizeKey(value, fallback)
    .replace(/[:]+/g, '-')
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function addMinutesIso(value: string, minutes: number): string | null {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return null;
  }
  return new Date(time + minutes * 60_000).toISOString();
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function listRecords(value: unknown): LooseRecord[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
      const record = recordOrNull(entry);
      return record ? [record] : [];
    })
    : [];
}

function listStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function redactText(value: unknown, fallback = '', maxLength = 260): string {
  const text = normalizeText(value, fallback)
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function roleKindFromId(roleId: string): AgentTeamCompilerRoleKind {
  const normalized = normalizeKey(roleId);
  if (/research|explor|investig|analis/.test(normalized)) {
    return 'researcher';
  }
  if (/implement|worker|patch|dev|builder|coder/.test(normalized)) {
    return 'implementer';
  }
  if (/verify|test|qa|review|valid/.test(normalized)) {
    return 'verifier';
  }
  if (/provider|model|arena|route/.test(normalized)) {
    return 'provider-specialist';
  }
  if (/safety|risk|policy|approval/.test(normalized)) {
    return 'safety-reviewer';
  }
  if (/memory|artifact|receipt|recall/.test(normalized)) {
    return 'memory-curator';
  }
  if (/operator|handoff|ops/.test(normalized)) {
    return 'operator-liaison';
  }
  return 'planner';
}

function labelForKind(kind: AgentTeamCompilerRoleKind, roleId: string): string {
  const labels: Record<AgentTeamCompilerRoleKind, string> = {
    planner: 'Planner',
    researcher: 'Researcher',
    implementer: 'Implementer',
    verifier: 'Verifier',
    'provider-specialist': 'Provider specialist',
    'safety-reviewer': 'Safety reviewer',
    'memory-curator': 'Memory curator',
    'operator-liaison': 'Operator liaison',
  };
  return labels[kind] || roleId;
}

function objectiveForKind(kind: AgentTeamCompilerRoleKind, run: UniversalAgentRun): string {
  const objective = redactText(run.input, 'pedido da run');
  switch (kind) {
    case 'researcher':
      return `Levantar contexto e riscos para: ${objective}`;
    case 'implementer':
      return `Preparar patch ou execucao governada para: ${objective}`;
    case 'verifier':
      return `Validar criterios, testes e regressao para: ${objective}`;
    case 'provider-specialist':
      return 'Comparar provider/modelo usando Provider Arena antes de executar subagentes.';
    case 'safety-reviewer':
      return 'Revisar policy, approval, budget e quarantine antes de liberar lancamento.';
    case 'memory-curator':
      return 'Reutilizar receipts e artifacts relevantes sem gravar memoria automaticamente.';
    case 'operator-liaison':
      return 'Preparar handoff claro para decisao do operador.';
    case 'planner':
    default:
      return `Decompor o objetivo em plano executavel e governado: ${objective}`;
  }
}

function toolsForKind(kind: AgentTeamCompilerRoleKind): string[] {
  switch (kind) {
    case 'researcher':
      return ['workspace.read', 'memory.read'];
    case 'implementer':
      return ['workspace.read', 'workspace.write'];
    case 'verifier':
      return ['workspace.read', 'runtime.check'];
    case 'provider-specialist':
      return ['provider.arena'];
    case 'safety-reviewer':
      return ['safety.review', 'approval.review'];
    case 'memory-curator':
      return ['memory.read', 'artifact-memory.search'];
    case 'operator-liaison':
      return ['handoff.prepare'];
    case 'planner':
    default:
      return ['workspace.read'];
  }
}

function capabilitiesForKind(kind: AgentTeamCompilerRoleKind): string[] {
  switch (kind) {
    case 'provider-specialist':
      return ['provider.arena'];
    case 'safety-reviewer':
      return ['safety.narrative', 'tool.exposure.policy'];
    case 'memory-curator':
      return ['artifact.memory', 'memory.with.receipts'];
    case 'implementer':
      return ['workspace.patch', 'tool.rehearsal'];
    case 'verifier':
      return ['runtime.validation', 'run.observatory'];
    case 'researcher':
      return ['run.observatory', 'natural.capability.discovery'];
    case 'operator-liaison':
      return ['personal.ops.autopilot'];
    case 'planner':
    default:
      return ['capability.negotiation'];
  }
}

export class AgentTeamCompilerService {
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: AgentTeamCompilerInput): AgentTeamCompilerSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const observatory = queryUniversalAgentRuns({
      runs: [run],
      query: {
        runId: run.id,
        limit: 1,
      },
      generatedAt,
    });
    const requestedSwarm = this.isTeamIntent(run);
    const roles = requestedSwarm
      ? this.compileRoles(run).slice(0, 8)
      : [];
    const receipts = this.buildReceipts(run, roles, observatory.receipts.length, requestedSwarm);
    const status = this.resolveStatus(run, roles, requestedSwarm);
    const edges = this.buildEdges(roles);
    const approvalId = `agent-team-approval:${run.id}`;
    const cliCommand = `zavorth agent-team "${redactText(run.input, 'pedido', 80)}"`;

    return {
      contractVersion: AGENT_TEAM_COMPILER_CONTRACT_VERSION,
      source: 'AgentTeamCompilerService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      objective: redactText(this.resolveObjective(run), run.input),
      topology: {
        mode: roles.length > 3 ? 'parallel' : roles.length > 0 ? 'review-gated' : 'linear',
        edges,
      },
      summary: {
        roleCount: roles.length,
        approvalRequiredCount: roles.filter((role) => role.approval.required).length,
        providerAssignedCount: roles.filter((role) => role.provider.providerLabel).length,
        blockedRoleCount: roles.filter((role) => role.scope.mode === 'blocked').length,
        requestedSwarm,
        providerArenaLinked: Boolean(recordOrNull(run.metadata.providerArena)),
        capabilityNegotiationLinked: Boolean(recordOrNull(run.metadata.capabilityNegotiation)),
        subagentReceiptsPrepared: roles.every((role) => Boolean(role.subagentReceipt)),
        compilerOnly: true,
      },
      approval: {
        required: requestedSwarm && roles.length > 0,
        approvalId,
        reason: requestedSwarm
          ? 'Lancar Agent Team exige approval explicito, budget e escopo revisados.'
          : 'Sem launch de Agent Team necessario para esta run.',
        expiresAt: addMinutesIso(generatedAt, 30),
      },
      launch: {
        mode: 'approval-gated-team-run',
        previewCommand: `${cliCommand} --json`,
        launchCommand: `zavorth agent-team launch "${redactText(run.input, 'pedido', 80)}" --approval-id ${approvalId}`,
        inspectCommand: `zavorth agent-team inspect ${run.id}`,
        synthesizeCommand: `zavorth agent-team synthesize ${run.id}`,
        synthesisRequired: true,
        directToolExecution: false,
        executionAuthority: 'subagent-runtime-required',
        maxReviewRounds: 2,
      },
      roles,
      receipts,
      policy: {
        noSubagentsLaunched: true,
        approvalRequiredBeforeLaunch: true,
        budgetsDefaultToZero: true,
        providerSelectionIsAdvisory: true,
        respectsCapabilityNegotiation: true,
        naturalLanguageDoesNotBypassPolicy: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand,
        dashboardPath: '/dashboard?sector=agents',
        previewHint: 'Use o plano compilado para revisar roles, scopes, provider e receipts antes de aprovar.',
        approvalHint: 'Lancar subagentes exige approval explicito do Swarm/AgentRunService.',
      },
      nextSafeAction: this.resolveNextSafeAction(status, roles),
    };
  }

  public launchApprovedTeam(
    snapshot: AgentTeamCompilerSnapshot,
    input: {
      approvalId?: string | null;
      generatedAt?: string | null;
    } = {},
  ): AgentTeamCompilerLaunchResult {
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const expectedApprovalId = normalizeText(snapshot.approval?.approvalId);
    const providedApprovalId = normalizeText(input.approvalId) || null;
    const approvalMatched = Boolean(expectedApprovalId && providedApprovalId === expectedApprovalId);
    const initialBlockedReasons = this.resolveLaunchBlockedReasons(snapshot, approvalMatched);
    const candidateTurns = initialBlockedReasons.length === 0
      ? this.prepareLaunchTurns(snapshot, `agent-team-run-${safeSegment(snapshot.identifiers.runId, 'run')}`)
      : [];
    const blockedReasons = unique([
      ...initialBlockedReasons,
      ...(
        initialBlockedReasons.length === 0
          ? this.resolvePeerReviewBlockedReasons(snapshot, candidateTurns)
          : []
      ),
    ]);
    const status: AgentTeamCompilerLaunchStatus = blockedReasons.length > 0 ? 'blocked' : 'prepared';
    const teamRunId = `agent-team-run-${safeSegment(snapshot.identifiers.runId, 'run')}`;
    const roles = status === 'prepared'
      ? snapshot.roles.map((role) => this.prepareLaunchRole(role))
      : snapshot.roles.map((role) => ({
        roleId: role.roleId,
        kind: role.kind,
        status: 'blocked' as const,
        scopeMode: role.scope.mode,
        allowedTools: [...role.scope.allowedTools],
        budget: { ...role.budget },
        reviewRequired: true,
        evidenceRefs: [],
      }));
    const turns = status === 'prepared'
      ? candidateTurns
      : [];
    const requiredEvidenceRefs = turns.map((turn) => turn.id);
    const reviewerRoleIds = unique(snapshot.roles
      .filter((role) => role.kind === 'verifier' || role.kind === 'safety-reviewer')
      .map((role) => role.roleId));
    return {
      contractVersion: AGENT_TEAM_COMPILER_CONTRACT_VERSION,
      source: 'AgentTeamCompilerService',
      generatedAt,
      status,
      teamRunId,
      compilerRunId: snapshot.identifiers.runId,
      approval: {
        required: true,
        expectedApprovalId,
        providedApprovalId,
        matched: approvalMatched,
      },
      roles,
      turns,
      synthesis: {
        status: status === 'prepared' ? 'ready-for-final-synthesis' : 'blocked',
        command: `zavorth agent-team synthesize ${teamRunId}`,
        requiredEvidenceRefs,
        reviewerRoleIds,
        summary: status === 'prepared'
          ? 'Team run preparado com claims, peer review e entrada obrigatoria de sintese final.'
          : 'Team run bloqueado antes de preparar claims/reviews.',
      },
      receipts: [
        ...snapshot.receipts,
        {
          id: `agent-team-receipt:${snapshot.identifiers.runId}:launch-protocol`,
          kind: 'approval',
          source: 'AgentTeamCompilerService.launchApprovedTeam',
          detail: status === 'prepared'
            ? 'Approval conferido; team run preparado sem executar ferramentas diretamente.'
            : 'Launch bloqueado por approval, roles ou estado do compiler.',
          status: status === 'prepared' ? 'ready' : 'needs-approval',
        },
      ],
      blockedReasons,
      policy: {
        noDirectToolExecution: true,
        launchRequiresMatchingApproval: true,
        mutationRequiresSubagentGateway: true,
        peerReviewRequiredBeforeSynthesis: true,
        receiptsRequiredBeforeCompletion: true,
        secretsSerialized: false,
      },
      nextSafeAction: status === 'prepared'
        ? 'Executar cada role pelo runtime de subagentes aprovado e sintetizar apenas depois dos reviews.'
        : 'Revisar approval, roles e receipts antes de tentar launch novamente.',
    };
  }

  private isTeamIntent(run: UniversalAgentRun): boolean {
    const text = `${run.input} ${run.summary}`.toLowerCase();
    if (/\b(swarm|subagentes?|multiagente|multi-agente|equipe de agentes|time de agentes|agentes em paralelo|agent team|team compiler)\b/i.test(text)) {
      return true;
    }
    const metadata = run.metadata || {};
    const compiler = recordOrNull(metadata.agentTeamCompiler);
    const explicitCompilerIntent = Boolean(
      compiler
      && normalizeText(compiler.source) !== 'AgentTeamCompilerService'
      && (
        compiler.requested === true
        || normalizeText(compiler.objective)
        || listRecords(compiler.roles).length > 0
        || listStrings(compiler.roleIds).length > 0
      ),
    );
    const escalation = recordOrNull(metadata.executionEscalation);
    const proposal = recordOrNull(metadata.swarmEscalationProposal);
    const discovery = recordOrNull(metadata.naturalCapabilityDiscovery);
    const toolExposureIds = (run.toolExposure.tools || []).map((tool) => tool.id);
    return Boolean(
      explicitCompilerIntent
      || proposal
      || normalizeText(escalation?.target) === 'swarm'
      || toolExposureIds.includes('swarm.run')
      || listRecords(discovery?.recommendations).some((entry) => normalizeText(entry.category) === 'swarm-escalation'),
    );
  }

  private resolveObjective(run: UniversalAgentRun): string {
    const compiler = recordOrNull(run.metadata.agentTeamCompiler);
    const escalation = recordOrNull(run.metadata.executionEscalation);
    return normalizeText(compiler?.objective)
      || normalizeText(escalation?.taskGoal)
      || normalizeText(run.input, 'Objetivo da run');
  }

  private compileRoles(run: UniversalAgentRun): AgentTeamCompilerRole[] {
    const seeds = this.resolveRoleSeeds(run);
    return seeds.map((seed, index) => this.buildRole(run, seed, index, seeds.length));
  }

  private resolveRoleSeeds(run: UniversalAgentRun): RoleSeed[] {
    const metadata = run.metadata || {};
    const compiler = recordOrNull(metadata.agentTeamCompiler);
    const escalation = recordOrNull(metadata.executionEscalation);
    const explicitRecords = [
      ...listRecords(compiler?.roles),
      ...listRecords(metadata.teamRoles),
      ...listRecords(metadata.agentTeamRoles),
    ];
    const explicitStrings = unique([
      ...listStrings(compiler?.roleIds),
      ...listStrings(metadata.suggestedSubagents),
      ...listStrings(metadata.subagents),
      ...listStrings(escalation?.suggestedSubagents),
      ...listRecords(escalation?.subagentReceipts).map((entry) => normalizeText(entry.roleId)),
    ]);
    const seeds = [
      ...explicitRecords.map((entry) => {
        const roleId = normalizeKey(entry.roleId ?? entry.id ?? entry.kind ?? entry.label, 'agent');
        const kind = roleKindFromId(normalizeText(entry.kind, roleId));
        return {
          roleId,
          kind,
          label: normalizeText(entry.label),
          objective: normalizeText(entry.objective ?? entry.summary),
          toolIds: listStrings(entry.toolIds ?? entry.tools),
          capabilityIds: listStrings(entry.capabilityIds ?? entry.capabilities),
        };
      }),
      ...explicitStrings.map((roleId) => ({
        roleId: normalizeKey(roleId, 'agent'),
      })),
    ];
    const normalized = seeds.filter((seed) => seed.roleId);
    if (normalized.length > 0) {
      return this.dedupeSeeds(normalized);
    }
    return [
      { roleId: 'planner', kind: 'planner' },
      { roleId: 'implementer', kind: 'implementer' },
      { roleId: 'verifier', kind: 'verifier' },
      { roleId: 'safety-reviewer', kind: 'safety-reviewer' },
    ];
  }

  private dedupeSeeds(seeds: RoleSeed[]): RoleSeed[] {
    const seen = new Set<string>();
    return seeds.filter((seed) => {
      if (seen.has(seed.roleId)) {
        return false;
      }
      seen.add(seed.roleId);
      return true;
    });
  }

  private buildRole(
    run: UniversalAgentRun,
    seed: RoleSeed,
    index: number,
    roleCount: number,
  ): AgentTeamCompilerRole {
    const kind = seed.kind || roleKindFromId(seed.roleId);
    const roleId = normalizeKey(seed.roleId, `agent-${index + 1}`);
    const toolIds = unique([...(seed.toolIds || []), ...toolsForKind(kind)]);
    const capabilityIds = unique([...(seed.capabilityIds || []), ...capabilitiesForKind(kind)]);
    const scope = createSubagentCapabilityScope({
      roleId,
      mode: 'blocked',
      allowedTools: toolIds,
      requiresApproval: true,
      metadata: {
        proposedBy: 'AgentTeamCompilerService',
        compilerOnly: true,
        runId: run.id,
      },
    });
    const budget = createSubagentBudget({
      maxToolCalls: 0,
      maxWallClockMs: 0,
      maxOutputBytes: 0,
      metadata: {
        proposedBy: 'AgentTeamCompilerService',
        compilerOnly: true,
        runId: run.id,
      },
    });
    const approvalBoundary = createSubagentApprovalBoundary({
      scope,
      budget,
      risk: kind === 'implementer' ? 'attention' : 'unknown',
      approvalReason: 'Agent Team Compiler apenas compila o time; lancamento de subagente exige approval explicito.',
      metadata: {
        proposedBy: 'AgentTeamCompilerService',
        compilerOnly: true,
        runId: run.id,
      },
    });
    const subagentReceipt = createSubagentResultReceipt({
      roleId,
      status: 'planned',
      summary: `Role ${roleId} compilado para team plan e bloqueado ate approval.`,
      scope,
      budget,
      approvalBoundary,
      risks: kind === 'implementer' ? ['workspace-mutation-requires-approval'] : ['compiler-only'],
      metadata: {
        proposedBy: 'AgentTeamCompilerService',
        compilerOnly: true,
        runId: run.id,
      },
    });
    const provider = this.resolveProvider(run);
    const nextRole = index + 1 < roleCount ? `agent-team:${normalizeKey(index + 2)}:${normalizeKey('next')}` : null;
    return {
      id: `agent-team:${run.id}:${roleId}`,
      roleId,
      kind,
      label: normalizeText(seed.label, labelForKind(kind, roleId)),
      objective: redactText(seed.objective, objectiveForKind(kind, run)),
      why: this.resolveRoleReason(kind),
      dependsOn: index === 0 ? [] : [`agent-team:${run.id}:${index === 1 ? 'planner' : 'previous'}`],
      handoffTo: nextRole ? [nextRole] : [],
      capabilityIds,
      toolIds,
      provider,
      scope: {
        mode: scope.mode,
        allowedTools: [...scope.allowedTools],
        deniedPaths: [...scope.deniedPaths],
        requiresApproval: scope.requiresApproval,
        policyTags: [...scope.policyTags],
      },
      budget: {
        maxToolCalls: budget.maxToolCalls,
        maxWallClockMs: budget.maxWallClockMs,
        maxOutputBytes: budget.maxOutputBytes,
      },
      approval: {
        required: approvalBoundary.requiresApproval,
        reason: approvalBoundary.approvalReason,
        inheritedApprovalId: approvalBoundary.inheritedApprovalId,
      },
      risk: approvalBoundary.risk,
      subagentReceipt,
      actions: {
        previewCommand: `zavorth agent-team preview ${roleId}`,
        approveCommand: `zavorth agent-team approve ${roleId}`,
        launchCommand: `zavorth agent-team launch ${roleId}`,
        inspectCommand: `zavorth agent-team inspect ${roleId}`,
      },
    };
  }

  private resolveLaunchBlockedReasons(
    snapshot: AgentTeamCompilerSnapshot,
    approvalMatched: boolean,
  ): string[] {
    const reasons: string[] = [];
    if (snapshot.status === 'not-needed') {
      reasons.push('agent-team-not-needed');
    }
    if (snapshot.status === 'blocked') {
      reasons.push('compiler-blocked');
    }
    if (snapshot.roles.length === 0) {
      reasons.push('no-roles');
    }
    if (!approvalMatched) {
      reasons.push('approval-id-mismatch');
    }
    if (!snapshot.policy.approvalRequiredBeforeLaunch || !snapshot.policy.budgetsDefaultToZero) {
      reasons.push('policy-invariant-missing');
    }
    return unique(reasons);
  }

  private prepareLaunchRole(role: AgentTeamCompilerRole): AgentTeamCompilerLaunchRole {
    return {
      roleId: role.roleId,
      kind: role.kind,
      status: 'prepared',
      scopeMode: role.scope.mode,
      allowedTools: [...role.scope.allowedTools],
      budget: { ...role.budget },
      reviewRequired: true,
      evidenceRefs: [
        role.subagentReceipt.id,
        `agent-team-role:${role.roleId}:claim`,
        `agent-team-role:${role.roleId}:review`,
      ],
    };
  }

  private prepareLaunchTurns(
    snapshot: AgentTeamCompilerSnapshot,
    teamRunId: string,
  ): AgentTeamCompilerLaunchTurn[] {
    const reviewerCandidates = [
      ...snapshot.roles.filter((role) => role.kind === 'verifier' || role.kind === 'safety-reviewer'),
      ...snapshot.roles,
    ];
    const turns: AgentTeamCompilerLaunchTurn[] = [];
    for (const role of snapshot.roles) {
      const claimId = `${teamRunId}-${safeSegment(role.roleId)}-claim`;
      turns.push({
        id: claimId,
        phase: 'claim',
        roleId: role.roleId,
        targetRoleId: null,
        status: 'prepared',
        prompt: redactText(`Declare plano, evidencia esperada e limites para ${role.objective}`, '', 360),
        evidenceRefs: [role.subagentReceipt.id],
      });
      const reviewer = reviewerCandidates.find((candidate) => candidate.roleId !== role.roleId);
      if (reviewer) {
        turns.push({
          id: `${teamRunId}-${safeSegment(reviewer.roleId)}-reviews-${safeSegment(role.roleId)}`,
          phase: 'peer-review',
          roleId: reviewer.roleId,
          targetRoleId: role.roleId,
          status: 'prepared',
          prompt: redactText(`Revise a contribuicao de ${role.roleId} contra escopo, budget, riscos e criterios de conclusao.`, '', 360),
          evidenceRefs: [claimId, reviewer.subagentReceipt.id],
        });
      }
    }
    const synthesisRole = reviewerCandidates[0] || snapshot.roles[snapshot.roles.length - 1];
    if (synthesisRole) {
      turns.push({
        id: `${teamRunId}-final-synthesis-input`,
        phase: 'synthesis-input',
        roleId: synthesisRole.roleId,
        targetRoleId: null,
        status: 'prepared',
        prompt: 'Sintetize somente evidencias revisadas, liste bloqueios e nao declare conclusao sem receipts.',
        evidenceRefs: turns.map((turn) => turn.id),
      });
    }
    return turns;
  }

  private resolvePeerReviewBlockedReasons(
    snapshot: AgentTeamCompilerSnapshot,
    turns: AgentTeamCompilerLaunchTurn[],
  ): string[] {
    const reviewTurns = turns.filter((turn) => turn.phase === 'peer-review');
    const missing = snapshot.roles.filter((role) => !reviewTurns.some((turn) => turn.targetRoleId === role.roleId));
    return missing.length > 0
      ? ['peer-review-missing', ...missing.map((role) => `peer-review-missing:${role.roleId}`)]
      : [];
  }

  private resolveRoleReason(kind: AgentTeamCompilerRoleKind): string {
    switch (kind) {
      case 'implementer':
        return 'Implementacao fica separada para manter escopo, budget e approval claros.';
      case 'verifier':
        return 'Verificacao independente reduz regressao antes de handoff.';
      case 'provider-specialist':
        return 'Provider Arena deve informar custo, saude e fallback antes do lancamento.';
      case 'safety-reviewer':
        return 'Acoes de equipe precisam passar por policy, approval e quarantine.';
      case 'memory-curator':
        return 'Receipts e artifacts existentes evitam repetir trabalho e preservam citacao.';
      case 'researcher':
        return 'Exploracao read-only deve preceder edicoes ou execucoes mutaveis.';
      case 'operator-liaison':
        return 'O operador precisa de um resumo aprovavel antes de abrir subagentes.';
      case 'planner':
      default:
        return 'Decomposicao inicial evita acoplar planejamento, execucao e verificacao.';
    }
  }

  private resolveProvider(run: UniversalAgentRun): AgentTeamCompilerRole['provider'] {
    const arena = recordOrNull(run.metadata.providerArena);
    const selected = recordOrNull(arena?.selected);
    const summary = recordOrNull(arena?.summary);
    const candidateId = normalizeText(selected?.candidateId ?? summary?.recommendedCandidateId) || null;
    const providerLabel = normalizeText(selected?.providerLabel ?? summary?.recommendedProviderLabel);
    const modelLabel = normalizeText(selected?.modelLabel ?? summary?.recommendedModelLabel);
    if (providerLabel || modelLabel || candidateId) {
      return {
        providerLabel: providerLabel || normalizeText(run.modelProfile.providerLabel, 'unknown'),
        modelLabel: modelLabel || normalizeText(run.modelProfile.modelLabel, 'unknown'),
        candidateId,
        source: 'provider-arena',
        advisoryOnly: true,
      };
    }
    return {
      providerLabel: normalizeText(run.modelProfile.providerLabel, 'unknown'),
      modelLabel: normalizeText(run.modelProfile.modelLabel, 'unknown'),
      candidateId: null,
      source: run.modelProfile.providerLabel || run.modelProfile.modelLabel ? 'model-profile' : 'fallback',
      advisoryOnly: true,
    };
  }

  private buildEdges(roles: AgentTeamCompilerRole[]): AgentTeamCompilerSnapshot['topology']['edges'] {
    if (roles.length <= 1) {
      return [];
    }
    return roles.slice(0, -1).map((role, index) => ({
      from: role.roleId,
      to: roles[index + 1]?.roleId || 'handoff',
      reason: index === 0
        ? 'planner define escopo antes de execucao'
        : 'handoff sequencial com review gate',
    }));
  }

  private buildReceipts(
    run: UniversalAgentRun,
    roles: AgentTeamCompilerRole[],
    observatoryReceiptCount: number,
    requestedSwarm: boolean,
  ): AgentTeamCompilerReceipt[] {
    const providerArenaLinked = Boolean(recordOrNull(run.metadata.providerArena));
    const capabilityNegotiationLinked = Boolean(recordOrNull(run.metadata.capabilityNegotiation));
    return [
      {
        id: `agent-team-receipt:${run.id}:observatory`,
        kind: 'run-observatory',
        source: 'RunObservatory',
        detail: observatoryReceiptCount > 0
          ? `${observatoryReceiptCount} receipt(s) de run observados.`
          : 'Run Observatory ainda sem receipt adicional para este plano.',
        status: observatoryReceiptCount > 0 ? 'ready' : 'missing',
      },
      {
        id: `agent-team-receipt:${run.id}:provider-arena`,
        kind: 'provider-arena',
        source: 'ProviderArenaService',
        detail: providerArenaLinked
          ? 'Provider Arena informado; escolha de provider/modelo permanece advisory.'
          : 'Sem Provider Arena; modelProfile atual usado como fallback advisory.',
        status: providerArenaLinked ? 'ready' : 'missing',
      },
      {
        id: `agent-team-receipt:${run.id}:capability-negotiation`,
        kind: 'capability-negotiation',
        source: 'CapabilityNegotiationService',
        detail: capabilityNegotiationLinked
          ? 'Escopo de capabilities disponivel para revisar roles.'
          : 'Capability negotiation ausente; roles continuam bloqueados.',
        status: capabilityNegotiationLinked ? 'ready' : 'missing',
      },
      {
        id: `agent-team-receipt:${run.id}:swarm`,
        kind: 'swarm-escalation',
        source: 'AgentRunService',
        detail: requestedSwarm
          ? 'Pedido sugere equipe/subagentes; compiler preparou plano sem launch.'
          : 'Sem intencao de equipe detectada.',
        status: requestedSwarm ? 'needs-approval' : 'missing',
      },
      {
        id: `agent-team-receipt:${run.id}:subagent-contracts`,
        kind: 'subagent-contract',
        source: 'subagents/contracts',
        detail: `${roles.length} receipt(s) de subagente preparados com budget zero.`,
        status: roles.length > 0 ? 'needs-approval' : 'missing',
      },
      {
        id: `agent-team-receipt:${run.id}:policy`,
        kind: 'policy',
        source: 'AgentTeamCompilerService',
        detail: 'Compiler nao executa subagentes; launch depende de approval, budget e escopo.',
        status: 'ready',
      },
      {
        id: `agent-team-receipt:${run.id}:surface`,
        kind: 'surface',
        source: 'CLI/Dashboard',
        detail: 'Plano exposto por CLI read-only e Dashboard.',
        status: 'ready',
      },
    ];
  }

  private resolveStatus(
    run: UniversalAgentRun,
    roles: AgentTeamCompilerRole[],
    requestedSwarm: boolean,
  ): AgentTeamCompilerStatus {
    if (!requestedSwarm) {
      return 'not-needed';
    }
    if (roles.length === 0) {
      return 'blocked';
    }
    if (run.status === 'waiting_approval' || roles.some((role) => role.approval.required)) {
      return 'waiting-approval';
    }
    return 'compiled';
  }

  private resolveNextSafeAction(
    status: AgentTeamCompilerStatus,
    roles: AgentTeamCompilerRole[],
  ): string {
    if (status === 'not-needed') {
      return 'Nenhuma equipe de agentes precisa ser compilada para esta run.';
    }
    if (status === 'blocked') {
      return 'Revisar objetivo e roles antes de propor qualquer swarm.';
    }
    if (status === 'waiting-approval') {
      return 'Revisar roles, providers, scopes e receipts; aprovar Swarm apenas se o operador confirmar.';
    }
    return roles.length > 0
      ? 'Plano compilado pronto para preview governado.'
      : 'Sem roles compilados.';
  }
}
