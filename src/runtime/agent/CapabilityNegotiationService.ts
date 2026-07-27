import type {
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';

export const CAPABILITY_NEGOTIATION_CONTRACT_VERSION = '2026-05-03.capability-negotiation' as const;

export type CapabilityNegotiationStatus =
  | 'not-needed'
  | 'proposal'
  | 'waiting-approval'
  | 'approved'
  | 'blocked';

export type CapabilityNegotiationDecisionSource =
  | 'natural-capability-discovery'
  | 'universal-preview'
  | 'tool-exposure'
  | 'operator-approved-scope'
  | 'policy';

export type CapabilityNegotiationPermission =
  | 'none'
  | 'preview'
  | 'approval'
  | 'operator';

export type CapabilityNegotiationCapability = {
  id: string;
  label: string;
  source: CapabilityNegotiationDecisionSource;
  toolIds: string[];
  groups: string[];
  risk: UniversalToolRiskLevel;
  permission: CapabilityNegotiationPermission;
  requiresApproval: boolean;
  previewRequired: boolean;
  available: boolean;
  blocked: boolean;
  reason: string;
  nextSafeAction: string;
};

export type CapabilityNegotiationScope = {
  id: string;
  summary: string;
  allowedToolIds: string[];
  blockedToolIds: string[];
  pathHints: string[];
  surfaces: string[];
  approvalRequired: boolean;
  previewRequired: boolean;
  constraints: string[];
  approved: boolean;
};

export type CapabilityNegotiationSnapshot = {
  contractVersion: typeof CAPABILITY_NEGOTIATION_CONTRACT_VERSION;
  source: 'CapabilityNegotiationService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: CapabilityNegotiationStatus;
  decisionSource: CapabilityNegotiationDecisionSource;
  summary: {
    capabilityCount: number;
    allowedToolCount: number;
    blockedToolCount: number;
    approvalRequired: boolean;
    previewRequired: boolean;
    highestRisk: UniversalToolRiskLevel;
    sensitiveTask: boolean;
    approvedScope: boolean;
    pathScoped: boolean;
  };
  capabilities: CapabilityNegotiationCapability[];
  scope: CapabilityNegotiationScope;
  proposal: {
    title: string;
    summary: string;
    userQuestion: string;
    approvalId: string | null;
    requestedCapabilityIds: string[];
  } | null;
  receipts: Array<{
    id: string;
    kind: 'discovery' | 'preview' | 'tool-exposure' | 'scope' | 'approval' | 'policy';
    detail: string;
    status: 'pending' | 'done' | 'blocked';
  }>;
  policy: {
    noExecutionPerformed: true;
    naturalLanguageDoesNotBypassPolicy: true;
    approvedScopeLimitsTools: true;
    approvedScopeLimitsPaths: true;
    approvalsStillRequired: boolean;
    previewStillRequired: boolean;
    quarantineStillRequired: boolean;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type CapabilityNegotiationInput = {
  run: UniversalAgentRun;
  request?: Pick<UniversalAgentRequest, 'text' | 'requestedTools' | 'metadata' | 'workspace' | 'channel'> | null;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = ''): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function listOrEmpty(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function normalizeRisk(value: unknown): UniversalToolRiskLevel {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'safe' || raw === 'attention' || raw === 'danger' || raw === 'unknown') {
    return raw;
  }
  return 'unknown';
}

function riskScore(risk: UniversalToolRiskLevel): number {
  if (risk === 'danger') {
    return 3;
  }
  if (risk === 'attention') {
    return 2;
  }
  if (risk === 'unknown') {
    return 1;
  }
  return 0;
}

function maxRisk(risks: UniversalToolRiskLevel[]): UniversalToolRiskLevel {
  const score = Math.max(0, ...risks.map(riskScore));
  if (score >= 3) {
    return 'danger';
  }
  if (score === 2) {
    return 'attention';
  }
  if (score === 1) {
    return 'unknown';
  }
  return 'safe';
}

function normalizePermission(value: unknown, fallback: CapabilityNegotiationPermission): CapabilityNegotiationPermission {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'none' || raw === 'preview' || raw === 'approval' || raw === 'operator') {
    return raw;
  }
  return fallback;
}

function permissionForCapability(input: {
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
}): CapabilityNegotiationPermission {
  if (input.requiresApproval || input.risk === 'danger') {
    return 'approval';
  }
  if (input.previewRequired) {
    return 'preview';
  }
  return 'none';
}

function humanize(value: string): string {
  return value
    .replace(/[._:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase()) || 'Capability';
}

function mergeCapability(
  target: Map<string, CapabilityNegotiationCapability>,
  capability: CapabilityNegotiationCapability,
): void {
  const key = normalizeKey(capability.toolIds[0] || capability.id, capability.id);
  const existing = target.get(key);
  if (!existing) {
    target.set(key, capability);
    return;
  }

  const risk = maxRisk([existing.risk, capability.risk]);
  const requiresApproval = existing.requiresApproval || capability.requiresApproval || risk === 'danger';
  const previewRequired = existing.previewRequired || capability.previewRequired;
  target.set(key, {
    ...existing,
    label: existing.label || capability.label,
    source: existing.source === 'tool-exposure' ? capability.source : existing.source,
    toolIds: Array.from(new Set([...existing.toolIds, ...capability.toolIds])),
    groups: Array.from(new Set([...existing.groups, ...capability.groups])),
    risk,
    permission: permissionForCapability({ risk, requiresApproval, previewRequired }),
    requiresApproval,
    previewRequired,
    available: existing.available && capability.available,
    blocked: existing.blocked || capability.blocked,
    reason: Array.from(new Set([existing.reason, capability.reason].filter(Boolean))).join(' | '),
    nextSafeAction: capability.nextSafeAction || existing.nextSafeAction,
  });
}

function isApprovedFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1' || value === 'approved';
}

function pathListFromRecord(record: LooseRecord | null): string[] {
  if (!record) {
    return [];
  }
  return [
    normalizeText(record.workspaceRoot),
    normalizeText(record.workspacePath),
    normalizeText(record.targetPath),
    normalizeText(record.filePath),
    ...listOrEmpty(record.targetPaths),
    ...listOrEmpty(record.paths),
    ...listOrEmpty(record.files),
  ].filter(Boolean);
}

export class CapabilityNegotiationService {
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: CapabilityNegotiationInput): CapabilityNegotiationSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const metadata = run.metadata || {};
    const requestMetadata = input.request?.metadata || {};
    const discovery = recordOrNull(metadata.naturalCapabilityDiscovery);
    const preview = recordOrNull(metadata.universalPreviewMode);
    const previous = recordOrNull(metadata.capabilityNegotiation);
    const toolExposure = run.toolExposure;
    const blockedToolIds = this.collectBlockedToolIds(run, discovery, preview);
    const capabilities = this.buildCapabilities(run, discovery, preview, blockedToolIds);
    const highestRisk = maxRisk(capabilities.map((capability) => capability.risk));
    const approvalRequired = capabilities.some((capability) => capability.requiresApproval) || highestRisk === 'danger';
    const previewRequired = capabilities.some((capability) => capability.previewRequired);
    const sensitiveTask = this.isSensitiveTask({
      capabilities,
      blockedToolIds,
      approvalRequired,
      previewRequired,
      highestRisk,
      metadata,
      requestMetadata,
    });
    const previousApprovalId = normalizeText(previous?.approvalId)
      || normalizeText(recordOrNull(previous?.proposal)?.approvalId);
    const approvedScope = this.hasApprovedScope({
      run,
      previous,
      previousApprovalId,
      metadata,
      requestMetadata,
    });
    const previousWaiting = normalizeText(previous?.status) === 'waiting-approval' && !approvedScope;
    const blocked = blockedToolIds.length > 0
      && (toolExposure.toolExposureGatedByImportedCapabilityTrust === true
        || recordOrNull(discovery?.quarantine)?.importedCapabilityTrustPresent === true)
      && !approvedScope;
    const status = this.resolveStatus({
      blocked,
      approvedScope,
      previousWaiting,
      sensitiveTask,
    });
    const decisionSource = this.resolveDecisionSource({
      approvedScope,
      discovery,
      preview,
      capabilities,
    });
    const pathHints = Array.from(new Set([
      normalizeText(input.request?.workspace),
      normalizeText(run.workspace),
      ...pathListFromRecord(metadata),
      ...pathListFromRecord(requestMetadata),
      ...pathListFromRecord(recordOrNull(metadata.trustSlider)),
    ].filter(Boolean)));
    const allowedToolIds = capabilities
      .flatMap((capability) => capability.toolIds)
      .filter((toolId) => !blockedToolIds.includes(toolId));
    const scope: CapabilityNegotiationScope = {
      id: normalizeKey(previous?.scopeId || recordOrNull(previous?.scope)?.id || `capability-scope:${run.id}`),
      summary: this.buildScopeSummary({
        allowedToolCount: allowedToolIds.length,
        blockedToolCount: blockedToolIds.length,
        approvalRequired,
        previewRequired,
      }),
      allowedToolIds: Array.from(new Set(allowedToolIds)),
      blockedToolIds,
      pathHints,
      surfaces: Array.from(new Set([
        normalizeText(input.request?.channel),
        normalizeText(run.channel),
        ...run.replyPorts.map((port) => normalizeText(port.kind)),
      ].filter(Boolean))),
      approvalRequired,
      previewRequired,
      constraints: this.buildConstraints({ approvalRequired, previewRequired, blockedToolIds, pathHints }),
      approved: approvedScope,
    };
    const proposal = sensitiveTask || status === 'waiting-approval' || status === 'blocked'
      ? {
        title: 'Negociar escopo de capabilities',
        summary: this.buildProposalSummary(capabilities, scope),
        userQuestion: blocked ? 'This scope contains a blocked tool; review permission/quarantine before continuing...'
          : 'Posso seguir com esse escopo governado...',
        approvalId: previousApprovalId || null,
        requestedCapabilityIds: capabilities.map((capability) => capability.id),
      }
      : null;

    return {
      contractVersion: CAPABILITY_NEGOTIATION_CONTRACT_VERSION,
      source: 'CapabilityNegotiationService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      decisionSource,
      summary: {
        capabilityCount: capabilities.length,
        allowedToolCount: scope.allowedToolIds.length,
        blockedToolCount: blockedToolIds.length,
        approvalRequired,
        previewRequired,
        highestRisk,
        sensitiveTask,
        approvedScope,
        pathScoped: pathHints.length > 0,
      },
      capabilities,
      scope,
      proposal,
      receipts: this.buildReceipts({ discovery, preview, toolExposure, status, approvalId: previousApprovalId, scope }),
      policy: {
        noExecutionPerformed: true,
        naturalLanguageDoesNotBypassPolicy: true,
        approvedScopeLimitsTools: true,
        approvedScopeLimitsPaths: true,
        approvalsStillRequired: approvalRequired && !approvedScope,
        previewStillRequired: previewRequired && !approvedScope,
        quarantineStillRequired: blockedToolIds.length > 0,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: 'zavorth negotiate --json',
        zavorthControlPath: '/zavorthControl...sector=skills',
        approvalHint: 'Approve only if tools, paths, and surfaces are correct.',
      },
      nextSafeAction: this.buildNextSafeAction(status, approvalRequired, previewRequired, blockedToolIds.length),
    };
  }

  private collectBlockedToolIds(
    run: UniversalAgentRun,
    discovery: LooseRecord | null,
    preview: LooseRecord | null,
  ): string[] {
    const discoveryQuarantine = recordOrNull(discovery?.quarantine);
    const previewToolExposure = recordOrNull(preview?.toolExposure);
    return Array.from(new Set([
      ...listOrEmpty(run.toolExposure.blockedTools?.map((tool) => tool.id)),
      ...listOrEmpty(discoveryQuarantine?.blockedToolIds),
      ...listOrEmpty(previewToolExposure?.blockedToolIds),
    ].filter(Boolean)));
  }

  private buildCapabilities(
    run: UniversalAgentRun,
    discovery: LooseRecord | null,
    preview: LooseRecord | null,
    blockedToolIds: string[],
  ): CapabilityNegotiationCapability[] {
    const capabilities = new Map<string, CapabilityNegotiationCapability>();
    const blockedSet = new Set(blockedToolIds.map((toolId) => toolId.toLowerCase()));

    for (const [index, entry] of listRecords(discovery?.recommendations).entries()) {
      const toolIds = listOrEmpty(entry.toolIds);
      const risk = normalizeRisk(entry.risk);
      const requiresApproval = entry.requiresApproval === true || risk === 'danger';
      const previewRequired = entry.previewRequired === true;
      const blocked = toolIds.some((toolId) => blockedSet.has(toolId.toLowerCase()));
      mergeCapability(capabilities, {
        id: normalizeKey(entry.id || `capability-negotiation:discovery:${index + 1}`),
        label: normalizeText(entry.label, toolIds[0] ? humanize(toolIds[0]) : 'Capability recomendada'),
        source: 'natural-capability-discovery',
        toolIds,
        groups: listOrEmpty(entry.groups),
        risk,
        permission: normalizePermission(entry.permission, permissionForCapability({ risk, requiresApproval, previewRequired })),
        requiresApproval,
        previewRequired,
        available: !blocked,
        blocked,
        reason: normalizeText(entry.reason, 'Inferred by Natural Capability Discovery.'),
        nextSafeAction: normalizeText(entry.nextSafeAction, 'Apply ToolExposurePolicy before running.'),
      });
    }

    for (const [index, entry] of listRecords(preview?.planSteps).entries()) {
      const toolId = normalizeText(entry.toolId);
      if (!toolId) {
        continue;
      }
      const risk = normalizeRisk(entry.risk);
      const requiresApproval = entry.requiresApproval === true || risk === 'danger';
      const previewRequired = entry.previewRequired === true;
      const blocked = blockedSet.has(toolId.toLowerCase());
      mergeCapability(capabilities, {
        id: normalizeKey(`capability-negotiation:preview:${toolId || index + 1}`),
        label: normalizeText(entry.label, humanize(toolId)),
        source: 'universal-preview',
        toolIds: [toolId],
        groups: [normalizeText(entry.kind, 'unknown')],
        risk,
        permission: permissionForCapability({ risk, requiresApproval, previewRequired }),
        requiresApproval,
        previewRequired,
        available: !blocked,
        blocked,
        reason: normalizeText(entry.impact || entry.action, 'Step came from Universal Preview Mode.'),
        nextSafeAction: normalizeText(entry.action, 'Confirmar escopo before run.'),
      });
    }

    for (const tool of run.toolExposure.tools) {
      const blocked = blockedSet.has(tool.id.toLowerCase());
      mergeCapability(capabilities, {
        id: normalizeKey(`capability-negotiation:tool:${tool.id}`),
        label: normalizeText(tool.label, humanize(tool.id)),
        source: 'tool-exposure',
        toolIds: [tool.id],
        groups: tool.group ? [tool.group] : [],
        risk: tool.risk,
        permission: permissionForCapability({
          risk: tool.risk,
          requiresApproval: tool.requiresApproval,
          previewRequired: Boolean(tool.policyTags?.some((tag) => tag === 'preview-required' || tag === 'preview-first')),
        }),
        requiresApproval: tool.requiresApproval,
        previewRequired: Boolean(tool.policyTags?.some((tag) => tag === 'preview-required' || tag === 'preview-first')),
        available: !blocked,
        blocked,
        reason: normalizeText(tool.description, 'Tool exposed by ToolExposurePolicy.'),
        nextSafeAction: tool.requiresApproval ? 'Request approval before running.' : 'run within the active policy.',
      });
    }

    for (const [index, toolId] of blockedToolIds.entries()) {
      if (capabilities.has(normalizeKey(toolId))) {
        continue;
      }
      mergeCapability(capabilities, {
        id: normalizeKey(`capability-negotiation:blocked:${toolId || index + 1}`),
        label: humanize(toolId),
        source: 'policy',
        toolIds: [toolId],
        groups: [],
        risk: 'danger',
        permission: 'operator',
        requiresApproval: true,
        previewRequired: false,
        available: false,
        blocked: true,
        reason: 'Tool blocked por policy/quarentena.',
        nextSafeAction: 'review quarentena ou remover a tool do escopo.',
      });
    }

    if (capabilities.size === 0) {
      mergeCapability(capabilities, {
        id: 'capability-negotiation:direct-reply',
        label: 'Direct response',
        source: 'policy',
        toolIds: [],
        groups: [],
        risk: 'safe',
        permission: 'none',
        requiresApproval: false,
        previewRequired: false,
        available: true,
        blocked: false,
        reason: 'No sensitive capability was inferred.',
        nextSafeAction: 'Respond directly.',
      });
    }

    return Array.from(capabilities.values());
  }

  private isSensitiveTask(input: {
    capabilities: CapabilityNegotiationCapability[];
    blockedToolIds: string[];
    approvalRequired: boolean;
    previewRequired: boolean;
    highestRisk: UniversalToolRiskLevel;
    metadata: LooseRecord;
    requestMetadata: LooseRecord;
  }): boolean {
    if (isApprovedFlag(input.metadata.capabilityNegotiationRequired)
      || isApprovedFlag(input.requestMetadata.capabilityNegotiationRequired)
      || isApprovedFlag(recordOrNull(input.metadata.capabilityNegotiation)?.required)
      || isApprovedFlag(recordOrNull(input.requestMetadata.capabilityNegotiation)?.required)) {
      return true;
    }
    const toolIds = input.capabilities.flatMap((capability) => capability.toolIds);
    if (input.blockedToolIds.length > 0 || input.approvalRequired) {
      return true;
    }
    if (this.isProfileBaselineToolExposure({
      capabilities: input.capabilities,
      metadata: input.metadata,
      toolIds,
    })) {
      return false;
    }
    if (input.previewRequired) {
      return true;
    }
    if (input.highestRisk === 'danger' || input.highestRisk === 'attention') {
      return true;
    }
    const riskyNames = toolIds.some((toolId) => /write|shell|exec|deploy|commit|delete|selfmod|watchmode|swarm/i.test(toolId));
    return riskyNames || toolIds.length > 2;
  }

  private isProfileBaselineToolExposure(input: {
    capabilities: CapabilityNegotiationCapability[];
    metadata: LooseRecord;
    toolIds: string[];
  }): boolean {
    if (input.toolIds.length === 0) {
      return false;
    }
    if (input.capabilities.some((capability) => !['tool-exposure', 'universal-preview'].includes(capability.source))) {
      return false;
    }
    const profileBundle = recordOrNull(input.metadata.profileBundle)
      || recordOrNull(input.metadata.profileRuntimeBundle);
    const capabilityPolicy = recordOrNull(profileBundle?.capabilityPolicy);
    const baselineTools = new Set(listOrEmpty(capabilityPolicy?.allow).map((toolId) => toolId.toLowerCase()));
    if (baselineTools.size === 0) {
      return false;
    }
    return input.toolIds.every((toolId) => baselineTools.has(toolId.toLowerCase()));
  }

  private hasApprovedScope(input: {
    run: UniversalAgentRun;
    previous: LooseRecord | null;
    previousApprovalId: string;
    metadata: LooseRecord;
    requestMetadata: LooseRecord;
  }): boolean {
    const requestNegotiation = recordOrNull(input.requestMetadata.capabilityNegotiation);
    if (
      isApprovedFlag(input.metadata.capabilityNegotiationApproved)
      || isApprovedFlag(input.requestMetadata.capabilityNegotiationApproved)
      || isApprovedFlag(requestNegotiation?.approved)
      || isApprovedFlag(input.previous?.approved)
      || normalizeText(input.previous?.status) === 'approved'
    ) {
      return true;
    }
    if (!input.previousApprovalId) {
      return false;
    }
    return input.run.approvals.some((approval) => (
      approval.id === input.previousApprovalId
      && approval.status === 'approved'
    ));
  }

  private resolveStatus(input: {
    blocked: boolean;
    approvedScope: boolean;
    previousWaiting: boolean;
    sensitiveTask: boolean;
  }): CapabilityNegotiationStatus {
    if (input.blocked) {
      return 'blocked';
    }
    if (input.approvedScope) {
      return 'approved';
    }
    if (input.previousWaiting) {
      return 'waiting-approval';
    }
    return input.sensitiveTask ? 'proposal' : 'not-needed';
  }

  private resolveDecisionSource(input: {
    approvedScope: boolean;
    discovery: LooseRecord | null;
    preview: LooseRecord | null;
    capabilities: CapabilityNegotiationCapability[];
  }): CapabilityNegotiationDecisionSource {
    if (input.approvedScope) {
      return 'operator-approved-scope';
    }
    if (input.capabilities.some((capability) => capability.source === 'natural-capability-discovery')
      || listRecords(input.discovery?.recommendations).length > 0) {
      return 'natural-capability-discovery';
    }
    if (input.capabilities.some((capability) => capability.source === 'universal-preview')
      || listRecords(input.preview?.planSteps).length > 0) {
      return 'universal-preview';
    }
    if (input.capabilities.some((capability) => capability.source === 'tool-exposure')) {
      return 'tool-exposure';
    }
    return 'policy';
  }

  private buildScopeSummary(input: {
    allowedToolCount: number;
    blockedToolCount: number;
    approvalRequired: boolean;
    previewRequired: boolean;
  }): string {
    const parts = [
      `${input.allowedToolCount} allowed tool(s)`,
      input.blockedToolCount > 0 ? `${input.blockedToolCount} blocked(s)` : '',
      input.approvalRequired ? 'approval required' : '',
      input.previewRequired ? 'preview required' : '',
    ].filter(Boolean);
    return parts.join('; ') || 'Scope has no sensitive tools.';
  }

  private buildConstraints(input: {
    approvalRequired: boolean;
    previewRequired: boolean;
    blockedToolIds: string[];
    pathHints: string[];
  }): string[] {
    return [
      'run only the tools approved in scope.',
      input.pathHints.length > 0
        ? 'Respect the declared paths and WorkspaceFsPolicy.'
        : 'Ask for path/scope before touching the filesystem outside the context.',
      input.previewRequired ? 'Generate preview before any mutation.' : '',
      input.approvalRequired ? 'Keep approval required for danger/attention risk.' : '',
      input.blockedToolIds.length > 0 ? 'Do not expose tools blocked by quarantine/policy.' : '',
    ].filter(Boolean);
  }

  private buildProposalSummary(
    capabilities: CapabilityNegotiationCapability[],
    scope: CapabilityNegotiationScope,
  ): string {
    const labels = capabilities
      .filter((capability) => capability.toolIds.length > 0 || capability.requiresApproval || capability.previewRequired)
      .slice(0, 5)
      .map((capability) => capability.label);
    return [
      'To do this correctly, I need to negotiate the scope before execution.',
      labels.length > 0 ? `Capabilities: ${labels.join(', ')}.` : '',
      `Scope: ${scope.summary}.`,
    ].filter(Boolean).join(' ');
  }

  private buildReceipts(input: {
    discovery: LooseRecord | null;
    preview: LooseRecord | null;
    toolExposure: UniversalAgentRun['toolExposure'];
    status: CapabilityNegotiationStatus;
    approvalId: string;
    scope: CapabilityNegotiationScope;
  }): CapabilityNegotiationSnapshot['receipts'] {
    const receipts: CapabilityNegotiationSnapshot['receipts'] = [];
    if (input.discovery) {
      receipts.push({
        id: 'capability-negotiation:receipt:discovery',
        kind: 'discovery',
        detail: 'Natural Capability Discovery used as the intent source.',
        status: 'done',
      });
    }
    if (input.preview) {
      receipts.push({
        id: 'capability-negotiation:receipt:preview',
        kind: 'preview',
        detail: 'Universal Preview Mode used as the plan and risk source.',
        status: 'done',
      });
    }
    receipts.push({
      id: 'capability-negotiation:receipt:tool-exposure',
      kind: 'tool-exposure',
      detail: `${input.toolExposure.tools.length} tool(s) exposed by policy ${input.toolExposure.mode}.`,
      status: 'done',
    });
    receipts.push({
      id: 'capability-negotiation:receipt:scope',
      kind: 'scope',
      detail: input.scope.summary,
      status: input.status === 'blocked' ? 'blocked' : 'done',
    });
    if (input.approvalId) {
      receipts.push({
        id: 'capability-negotiation:receipt:approval',
        kind: 'approval',
        detail: `Approval associado: ${input.approvalId}.`,
        status: input.status === 'approved' ? 'done' : 'pending',
      });
    }
    receipts.push({
      id: 'capability-negotiation:receipt:policy',
      kind: 'policy',
      detail: 'Natural language does not change tools, paths, or approvals without policy.',
      status: 'done',
    });
    return receipts;
  }

  private buildNextSafeAction(
    status: CapabilityNegotiationStatus,
    approvalRequired: boolean,
    previewRequired: boolean,
    blockedToolCount: number,
  ): string {
    if (status === 'blocked' || blockedToolCount > 0) {
      return 'review tools blocked before run.';
    }
    if (status === 'waiting-approval') {
      return 'Aguardar approval do operador for o escopo proposto.';
    }
    if (status === 'approved') {
      return 'run only within the approved scope.';
    }
    if (status === 'proposal') {
      return approvalRequired ? 'Pedir approval do escopo before run.'
        : previewRequired ? 'Confirmar preview governado before da mutation.'
          : 'Confirmar escopo before seguir.';
    }
    return 'Answer directly; negotiation is not required.';
  }
}

function listRecords(value: unknown): LooseRecord[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
      const record = recordOrNull(entry);
      return record ? [record] : [];
    })
    : [];
}
