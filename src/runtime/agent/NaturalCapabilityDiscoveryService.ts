import {
  CapabilityLoopGovernanceService,
  type StrongCapabilityId,
} from './CapabilityLoopGovernanceService.js';
import type { ToolExposurePolicyHintProfile } from './ToolExposurePolicy.js';
import { inferUniversalAgentRequestedTools } from './UniversalAgentRequestHeuristics.js';
import { assessSwarmWorkload } from './SwarmWorkloadAssessmentService.js';
import type {
  UniversalAgentChannel,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';
import { resolveToolGroupCatalogEntry, ToolGroupCatalog } from './tools/ToolGroupCatalog.js';

export const NATURAL_CAPABILITY_DISCOVERY_CONTRACT_VERSION = '2026-05-03.capability-discovery' as const;

export type NaturalCapabilityDiscoveryIntentCategory =
  | 'workspace-inspection'
  | 'workspace-mutation'
  | 'shell-execution'
  | 'web-research'
  | 'memory-recall'
  | 'selfmod-preview'
  | 'computer-use'
  | 'swarm-escalation'
  | 'multi-model-consensus'
  | 'channel-or-node'
  | 'policy-or-session'
  | 'unknown';

export type NaturalCapabilityDiscoveryRecommendation = {
  id: string;
  label: string;
  source: 'natural-language' | 'requested-tool' | 'tool-catalog' | 'strong-capability' | 'metadata';
  capabilityId?: string;
  toolIds: string[];
  groups: string[];
  score: number;
  confidence: number;
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
  permission: 'none' | 'preview' | 'approval' | 'operator';
  reason: string;
  nextSafeAction: string;
};

export type NaturalCapabilityDiscoverySnapshot = {
  contractVersion: typeof NATURAL_CAPABILITY_DISCOVERY_CONTRACT_VERSION;
  source: 'NaturalCapabilityDiscoveryService';
  generatedAt: string;
  query: {
    text: string;
    surface: UniversalAgentChannel | 'unknown';
    requestedTools: string[];
  };
  intentCategory: NaturalCapabilityDiscoveryIntentCategory;
  confidence: number;
  recommendedToolNames: string[];
  groups: string[];
  recommendations: NaturalCapabilityDiscoveryRecommendation[];
  toolHintProfile: ToolExposurePolicyHintProfile;
  safety: {
    noExecutionPerformed: true;
    naturalLanguageDoesNotBypassPolicy: true;
    highestRisk: UniversalToolRiskLevel;
    requiresApproval: boolean;
    previewRequired: boolean;
    approvalRequiredToolIds: string[];
    previewRequiredToolIds: string[];
  };
  quarantine: {
    importedCapabilityTrustPresent: boolean;
    quarantinedCount: number;
    blockedToolIds: string[];
    warning: string | null;
  };
  receipts: Array<{
    id: string;
    kind: 'match' | 'policy' | 'quarantine' | 'fallback';
    detail: string;
  }>;
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
  };
  nextSafeAction: string;
};

export type NaturalCapabilityDiscoveryInput = {
  text: string;
  surface?: UniversalAgentChannel | 'unknown' | null;
  requestedTools?: string[] | null;
  metadata?: Record<string, unknown> | null;
  generatedAt?: string | null;
};

type StrongCapabilityCatalogEntry = ReturnType<CapabilityLoopGovernanceService['listCatalog']>[number];

type Candidate = {
  id: string;
  label: string;
  source: NaturalCapabilityDiscoveryRecommendation['source'];
  capabilityId?: string;
  toolIds: string[];
  groups: string[];
  score: number;
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
  permission: NaturalCapabilityDiscoveryRecommendation['permission'];
  reason: string;
};

/** Reserved; free-text phrase→category maps are not used. */
const CATEGORY_PATTERNS: Array<{
  category: NaturalCapabilityDiscoveryIntentCategory;
  pattern: RegExp;
  tools: string[];
  groups: string[];
  reason: string;
}> = [];

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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

function maxRisk(values: UniversalToolRiskLevel[]): UniversalToolRiskLevel {
  const score = Math.max(0, ...values.map(riskScore));
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

function humanize(value: string): string {
  return value
    .replace(/[._:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase()) || 'Capability';
}

function inferRisk(toolId: string): UniversalToolRiskLevel {
  const entry = resolveToolGroupCatalogEntry(toolId);
  if (entry) {
    return entry.risk;
  }
  const normalized = toolId.toLowerCase();
  if (normalized.includes('write') || normalized.includes('shell') || normalized.includes('exec') || normalized.includes('deploy') || normalized.includes('invoke')) {
    return 'danger';
  }
  if (normalized.includes('network') || normalized.includes('search') || normalized.includes('send') || normalized.includes('pdf')) {
    return 'attention';
  }
  if (normalized.includes('read') || normalized.includes('list') || normalized.includes('history')) {
    return 'safe';
  }
  return 'unknown';
}

function permissionFromRisk(toolIds: string[], risk: UniversalToolRiskLevel): NaturalCapabilityDiscoveryRecommendation['permission'] {
  if (toolIds.some((toolId) => toolId === 'watchmode.control' || toolId === 'echo_hands' || toolId === 'node.invoke')) {
    return 'operator';
  }
  if (toolIds.some((toolId) => toolId.startsWith('selfmod.'))) {
    return 'preview';
  }
  if (risk === 'danger' || risk === 'attention' || risk === 'unknown') {
    return 'approval';
  }
  return 'none';
}

function confidenceFromScore(score: number): number {
  return Math.max(0.25, Math.min(0.98, score / 10));
}

export class NaturalCapabilityDiscoveryService {
  private readonly capabilityLoop: CapabilityLoopGovernanceService;
  private readonly toolGroupCatalog: ToolGroupCatalog;
  private readonly now: () => Date;

  constructor(runtime: {
    capabilityLoop?: CapabilityLoopGovernanceService | null;
    toolGroupCatalog?: ToolGroupCatalog | null;
    now?: () => Date;
  } = {}) {
    this.capabilityLoop = runtime.capabilityLoop || new CapabilityLoopGovernanceService();
    this.toolGroupCatalog = runtime.toolGroupCatalog || new ToolGroupCatalog();
    this.now = runtime.now || (() => new Date());
  }

  public discover(input: NaturalCapabilityDiscoveryInput): NaturalCapabilityDiscoverySnapshot {
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const text = normalizeText(input.text);
    const requestedTools = normalizeList(input.requestedTools);
    const metadata = input.metadata || {};
    const naturalTools = inferUniversalAgentRequestedTools({
      text,
      capabilityIds: requestedTools,
      fallbackTool: null,
    });
    const candidates = this.buildCandidates(text, naturalTools, requestedTools);
    const recommendations = this.dedupeCandidates(candidates)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, 12)
      .map((candidate): NaturalCapabilityDiscoveryRecommendation => ({
        ...candidate,
        confidence: confidenceFromScore(candidate.score),
        nextSafeAction: this.nextSafeActionFor(candidate),
      }));
    const recommendedToolNames = Array.from(new Set(recommendations.flatMap((entry) => entry.toolIds))).slice(0, 18);
    const groups = Array.from(new Set(recommendations.flatMap((entry) => entry.groups))).slice(0, 8);
    const highestRisk = maxRisk(recommendations.map((entry) => entry.risk));
    const confidence = recommendations.length === 0
      ? 0
      : Math.max(...recommendations.map((entry) => entry.confidence));
    const intentCategory = this.resolveIntentCategory(text, recommendations);
    const quarantine = this.resolveQuarantine(metadata);
    const toolHintProfile: ToolExposurePolicyHintProfile = {
      intentCategory,
      groups,
      recommendedToolNames,
      toolExposureGatedByCognitiveFirewall: false,
      isHardGate: false,
      reason: recommendations.length > 0
        ? `Capability discovery recommended ${recommendations.length} item(s) from tools/catalog (category: ${intentCategory}).`
        : 'No capability inferred from technical tools, requestedTools, or catalog.',
    };

    return {
      contractVersion: NATURAL_CAPABILITY_DISCOVERY_CONTRACT_VERSION,
      source: 'NaturalCapabilityDiscoveryService',
      generatedAt,
      query: {
        text,
        surface: input.surface || 'unknown',
        requestedTools,
      },
      intentCategory,
      confidence,
      recommendedToolNames,
      groups,
      recommendations,
      toolHintProfile,
      safety: {
        noExecutionPerformed: true,
        naturalLanguageDoesNotBypassPolicy: true,
        highestRisk,
        requiresApproval: recommendations.some((entry) => entry.requiresApproval),
        previewRequired: recommendations.some((entry) => entry.previewRequired),
        approvalRequiredToolIds: recommendedToolNames.filter((toolId) => {
          const risk = inferRisk(toolId);
          return risk === 'danger' || risk === 'attention' || risk === 'unknown';
        }),
        previewRequiredToolIds: recommendedToolNames.filter((toolId) => toolId.startsWith('selfmod.')),
      },
      quarantine,
      receipts: this.buildReceipts(recommendations, quarantine),
      surface: {
        cliCommand: `zavorth discover "${text || '<pedido>'}" --json`,
        zavorthControlPath: '/zavorthControl?sector=skills',
      },
      nextSafeAction: this.nextSafeAction(recommendations, quarantine),
    };
  }

  private buildCandidates(
    text: string,
    naturalTools: string[],
    requestedTools: string[],
  ): Candidate[] {
    const candidates: Candidate[] = [];
    const normalized = normalizeSearchText(text);
    const workload = assessSwarmWorkload({
      text,
      requestedTools,
    });

    if (workload.shouldUseSwarm) {
      const scaleToolIds = workload.shouldUseScalePlane ? ['swarm.run', 'swarm.scale'] : ['swarm.run'];
      candidates.push({
        id: workload.shouldUseScalePlane ? 'intent:swarm-scale-workload' : 'intent:swarm-workload',
        label: workload.shouldUseScalePlane ? 'Swarm Scale Workload' : 'Swarm Workload',
        source: 'metadata',
        toolIds: scaleToolIds,
        groups: ['general'],
        score: Math.max(8, Math.min(12, workload.score)),
        risk: 'attention',
        requiresApproval: true,
        previewRequired: false,
        permission: 'approval',
        reason: `Workload assessment: ${workload.reasons.join('; ')}.`,
      });
    }

    for (const toolId of naturalTools) {
      candidates.push(this.candidateFromTool(toolId, requestedTools.includes(toolId) ? 'requested-tool' : 'tool-catalog', 6));
    }

    for (const entry of this.capabilityLoop.listCatalog()) {
      const matched = this.strongCapabilityMatches(entry, normalized, naturalTools);
      if (!matched) {
        continue;
      }
      const risk = maxRisk(entry.toolIds.map(inferRisk));
      candidates.push({
        id: `strong:${entry.capabilityId}`,
        label: entry.label,
        source: 'strong-capability',
        capabilityId: entry.capabilityId,
        toolIds: entry.toolIds,
        groups: [entry.policyMode],
        score: entry.alwaysReady ? 4 : 8,
        risk,
        requiresApproval: entry.permission === 'approval' || entry.permission === 'operator' || risk === 'danger',
        previewRequired: entry.permission === 'preview' || entry.toolIds.some((toolId) => toolId.startsWith('selfmod.')),
        permission: entry.permission,
        reason: entry.description,
      });
    }

    for (const entry of this.toolGroupCatalog.list()) {
      if (!naturalTools.includes(entry.id) && !requestedTools.includes(entry.id)) {
        continue;
      }
      candidates.push({
        id: `tool-group:${entry.id}`,
        label: humanize(entry.id),
        source: 'tool-catalog',
        capabilityId: entry.id,
        toolIds: [entry.id],
        groups: [entry.group],
        score: 7,
        risk: entry.risk,
        requiresApproval: entry.requiresApproval,
        previewRequired: entry.policyTags.includes('preview-required') || entry.policyTags.includes('preview-first'),
        permission: permissionFromRisk([entry.id], entry.risk),
        reason: entry.description,
      });
    }

    return candidates;
  }

  private candidateFromTool(
    toolId: string,
    source: NaturalCapabilityDiscoveryRecommendation['source'],
    score: number,
  ): Candidate {
    const catalogEntry = resolveToolGroupCatalogEntry(toolId);
    const risk = catalogEntry?.risk || inferRisk(toolId);
    return {
      id: `tool:${toolId}`,
      label: humanize(toolId),
      source,
      capabilityId: toolId,
      toolIds: [toolId],
      groups: catalogEntry ? [catalogEntry.group] : [this.groupFromTool(toolId)],
      score,
      risk,
      requiresApproval: Boolean(catalogEntry?.requiresApproval) || risk === 'danger',
      previewRequired: toolId.startsWith('selfmod.') || Boolean(catalogEntry?.policyTags.includes('preview-first')),
      permission: permissionFromRisk([toolId], risk),
      reason: catalogEntry?.description || `${toolId} inferred from requestedTools or technical signals.`,
    };
  }

  private dedupeCandidates(candidates: Candidate[]): Candidate[] {
    const byId = new Map<string, Candidate>();
    for (const candidate of candidates) {
      const key = candidate.capabilityId || candidate.toolIds.join('|') || candidate.id;
      const existing = byId.get(key);
      if (!existing || candidate.score > existing.score) {
        byId.set(key, candidate);
      }
    }
    return Array.from(byId.values());
  }

  private strongCapabilityMatches(
    entry: StrongCapabilityCatalogEntry,
    _normalizedText: string,
    naturalTools: string[],
  ): boolean {
    return entry.toolIds.some((toolId) => naturalTools.includes(toolId));
  }

  private groupFromTool(toolId: string): string {
    const normalized = toolId.toLowerCase();
    if (normalized.includes('memory')) {
      return 'memory';
    }
    if (normalized.includes('network') || normalized.includes('web')) {
      return 'network';
    }
    if (normalized.includes('write') || normalized.includes('read') || normalized.includes('workspace')) {
      return 'workspace';
    }
    if (normalized.includes('selfmod')) {
      return 'selfmod';
    }
    return 'general';
  }

  private resolveIntentCategory(
    _text: string,
    recommendations: NaturalCapabilityDiscoveryRecommendation[],
  ): NaturalCapabilityDiscoveryIntentCategory {
    const toolIds = recommendations.flatMap((entry) => entry.toolIds).map((id) => id.toLowerCase());
    if (toolIds.some((id) => id.includes('selfmod'))) return 'selfmod-preview';
    if (toolIds.some((id) => id.includes('swarm'))) return 'swarm-escalation';
    if (toolIds.some((id) => id.includes('consensus'))) return 'multi-model-consensus';
    if (toolIds.some((id) => id.includes('shell') || id.includes('exec') || id === 'remote_shell')) return 'shell-execution';
    if (toolIds.some((id) => id.includes('write') || id.includes('edit') || id.includes('patch'))) return 'workspace-mutation';
    if (toolIds.some((id) => id.includes('web') || id.includes('network') || id.includes('search'))) return 'web-research';
    if (toolIds.some((id) => id.includes('memory') || id.includes('session'))) return 'memory-recall';
    if (toolIds.some((id) => id.includes('watch') || id.includes('desktop') || id.includes('computer'))) return 'computer-use';
    if (toolIds.some((id) => id.includes('read') || id.includes('list'))) return 'workspace-inspection';
    if (toolIds.some((id) => id.includes('node') || id.includes('channel'))) return 'channel-or-node';
    return recommendations.length > 0 ? 'unknown' : 'unknown';
  }

  private resolveQuarantine(metadata: Record<string, unknown>): NaturalCapabilityDiscoverySnapshot['quarantine'] {
    const importedTrust = recordOrNull(metadata.importedCapabilityTrust);
    const total = recordOrNull(importedTrust?.total);
    const blockedToolIds = normalizeList(importedTrust?.blockedTools);
    const quarantinedCount = Number(total?.quarantined || 0);
    return {
      importedCapabilityTrustPresent: Boolean(importedTrust),
      quarantinedCount: Number.isFinite(quarantinedCount) && quarantinedCount > 0 ? quarantinedCount : 0,
      blockedToolIds,
      warning: quarantinedCount > 0 || blockedToolIds.length > 0
        ? 'Skills/MCP em quarentena continuam bloqueando exposicao de tools.'
        : null,
    };
  }

  private buildReceipts(
    recommendations: NaturalCapabilityDiscoveryRecommendation[],
    quarantine: NaturalCapabilityDiscoverySnapshot['quarantine'],
  ): NaturalCapabilityDiscoverySnapshot['receipts'] {
    const receipts: NaturalCapabilityDiscoverySnapshot['receipts'] = recommendations.slice(0, 8).map((entry) => ({
      id: `capability-discovery:${entry.id}`,
      kind: 'match' as const,
      detail: `${entry.label}: ${entry.reason}`,
    }));
    receipts.push({
      id: 'capability-discovery:policy',
      kind: 'policy',
      detail: 'Discovery not executou tools; only alimentou ToolExposurePolicy.',
    });
    if (quarantine.warning) {
      receipts.push({
        id: 'capability-discovery:quarantine',
        kind: 'quarantine',
        detail: quarantine.warning,
      });
    }
    if (recommendations.length === 0) {
      receipts.push({
        id: 'capability-discovery:fallback',
        kind: 'fallback',
        detail: 'No capability forte foi inferida; manter resposta direta ou pedir esclarecimento.',
      });
    }
    return receipts;
  }

  private nextSafeActionFor(candidate: Candidate): string {
    if (candidate.previewRequired) {
      return 'Gerar preview antes de qualquer apply.';
    }
    if (candidate.permission === 'operator') {
      return 'Pedir permissao de operador e escopo antes de controlar ambiente.';
    }
    if (candidate.requiresApproval) {
      return 'Pedir approval antes de executar tools sensiveis.';
    }
    return 'Pode expor como leitura governada.';
  }

  private nextSafeAction(
    recommendations: NaturalCapabilityDiscoveryRecommendation[],
    quarantine: NaturalCapabilityDiscoverySnapshot['quarantine'],
  ): string {
    if (quarantine.warning) {
      return 'Revisar quarentena de skills/MCP antes de expor ferramentas importadas.';
    }
    if (recommendations.some((entry) => entry.previewRequired)) {
      return 'Comecar por preview e manter apply atras de approval.';
    }
    if (recommendations.some((entry) => entry.requiresApproval)) {
      return 'Expor tools em modo confirm/restricted e solicitar approval quando necessario.';
    }
    if (recommendations.length === 0) {
      return 'Responder diretamente ou pedir clarificacao se o alvo estiver ambiguo.';
    }
    return 'Expor tools de leitura governada e registrar receipts no run.';
  }
}
