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

const CATEGORY_PATTERNS: Array<{
  category: NaturalCapabilityDiscoveryIntentCategory;
  pattern: RegExp;
  tools: string[];
  groups: string[];
  reason: string;
}> = [
  {
    category: 'workspace-inspection',
    pattern: /\b(analise|analisar|revisar|review|inspecione|listar|liste|compare|diff|resuma|arquivo|pasta|repo|repositorio|workspace|logs?)\b/i,
    tools: ['read_file', 'workspace.read'],
    groups: ['workspace'],
    reason: 'Pedido parece leitura, resumo ou inspecao de workspace.',
  },
  {
    category: 'workspace-mutation',
    pattern: /\b(corrija|corrigir|edite|editar|altere|alterar|crie|criar|salve|aplique|organize|mova|renomeie|patch)\b/i,
    tools: ['write_file'],
    groups: ['workspace'],
    reason: 'Pedido pode alterar arquivos e precisa de policy de escrita.',
  },
  {
    category: 'shell-execution',
    pattern: /\b(shell|powershell|pwsh|terminal|comando(?:\s+de\s+terminal)?|linha\s+de\s+comando)\b|\b(npm|pnpm|yarn|npx|node|python|pytest|jest|git|docker|cargo|go|bash|sh|cmd)\s+[\w:./-]+\b|\b(rode|rodar|execute|executar|executa|run|dispare|inicie)\b[\s\S]{0,80}\b(npm|pnpm|yarn|npx|node|python|pytest|jest|git|docker|cargo|go|bash|sh|cmd|powershell|pwsh|build|testes?|scripts?)\b/i,
    tools: ['shell.exec'],
    groups: ['local_control'],
    reason: 'Pedido pede execucao de comando ou testes.',
  },
  {
    category: 'web-research',
    pattern: /\b(pesquise|pesquisar|buscar|busque|internet|web|site|url|artigos?|noticia|recente)\b/i,
    tools: ['network_fetch', 'web.search'],
    groups: ['network'],
    reason: 'Pedido depende de busca externa ou rede.',
  },
  {
    category: 'memory-recall',
    pattern: /\b(lembre|lembrar|memoria|memory|mnemos|historico|preferencia|recorde)\b/i,
    tools: ['memory.read', 'session_search', 'zavorth_session_search'],
    groups: ['memory'],
    reason: 'Pedido pede recall de memoria ou historico.',
  },
  {
    category: 'selfmod-preview',
    pattern: /\b(selfmod|auto[-\s]?melhoria|auto[-\s]?evolucao|melhore o zavorth|modifique o zavorth|aperfeicoe o zavorth)\b/i,
    tools: ['selfmod.preview'],
    groups: ['selfmod'],
    reason: 'Pedido pede selfmod e deve comecar por preview.',
  },
  {
    category: 'computer-use',
    pattern: /\b(watch mode|watchmode|computer use|observe a tela|monitorar a tela|controle visual|navegue por mim|clique)\b/i,
    tools: ['watchmode.control'],
    groups: ['local_control'],
    reason: 'Pedido envolve controle visual/computer use.',
  },
  {
    category: 'swarm-escalation',
    pattern: /\b(swarm|subagentes?|multiagente|multi-agente|equipe de agentes|time de agentes|paralelo)\b/i,
    tools: ['swarm.run'],
    groups: ['general'],
    reason: 'Pedido sugere decomposicao com subagentes.',
  },
  {
    category: 'channel-or-node',
    pattern: /\b(canal|telegram|slack|discord|node|nodo|companion|device|dispositivo|invoke)\b/i,
    tools: ['node.invoke'],
    groups: ['local_control'],
    reason: 'Pedido menciona canal, node mesh ou invocacao remota.',
  },
  {
    category: 'policy-or-session',
    pattern: /\b(sessao|session|history|historico|policy|policies|reload|recarregue policy)\b/i,
    tools: ['sessions.history', 'session_search', 'zavorth_session_search'],
    groups: ['memory'],
    reason: 'Pedido toca sessao, historico ou policy.',
  },
];

const NEGATIVE_WORKSPACE_MUTATION_PATTERNS = /\bsem\s+(criar|gerar|usar|chamar|acionar)\s+(ferramenta|tool|mensagem|message)\b/i;

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

function hasUrl(text: string): boolean {
  return /https?:\/\/|www\./i.test(text);
}

function asksForWebOperation(text: string): boolean {
  if (/\b(pesquise|pesquisar|buscar|busque|procure|internet|web)\b/i.test(text)) {
    return true;
  }
  if (/\b(acesse|acessar|abra|abrir|navegue|fetch|baixe|download)\b/i.test(text)) {
    return true;
  }
  if (
    hasUrl(text)
    && /\b(leia|ler|resuma|resumir|analise|analisar|explique|explicar|extraia|extrair|verifique|verificar)\b/i.test(text)
  ) {
    return true;
  }
  if (/\b(link|url|site|pagina|page|website|artigo|noticia)\b/i.test(text)
    && /\b(leia|ler|resuma|resumir|analise|analisar|abra|abrir|acesse|acessar|verifique|verificar|pesquise|buscar|busque)\b/i.test(text)) {
    return true;
  }
  return false;
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
        ? `Natural Capability Discovery recomendou ${recommendations.length} capability(s) para: ${intentCategory}.`
        : 'Nenhuma capability forte foi inferida por linguagem natural.',
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

    for (const pattern of CATEGORY_PATTERNS) {
      if (!pattern.pattern.test(normalized)) {
        continue;
      }
      if (pattern.category === 'web-research' && !asksForWebOperation(text)) {
        continue;
      }
      if (pattern.category === 'workspace-mutation' && NEGATIVE_WORKSPACE_MUTATION_PATTERNS.test(normalized)) {
        continue;
      }
      const risk = maxRisk(pattern.tools.map(inferRisk));
      candidates.push({
        id: `intent:${pattern.category}`,
        label: humanize(pattern.category),
        source: 'natural-language',
        toolIds: pattern.tools,
        groups: pattern.groups,
        score: 7,
        risk,
        requiresApproval: risk !== 'safe',
        previewRequired: pattern.tools.some((toolId) => toolId.startsWith('selfmod.')),
        permission: permissionFromRisk(pattern.tools, risk),
        reason: pattern.reason,
      });
    }

    if (workload.shouldUseSwarm) {
      const scaleToolIds = workload.shouldUseScalePlane ? ['swarm.run', 'swarm.scale'] : ['swarm.run'];
      candidates.push({
        id: workload.shouldUseScalePlane ? 'intent:swarm-scale-workload' : 'intent:swarm-workload',
        label: workload.shouldUseScalePlane ? 'Swarm Scale Workload' : 'Swarm Workload',
        source: 'natural-language',
        toolIds: scaleToolIds,
        groups: ['general'],
        score: Math.max(8, Math.min(12, workload.score)),
        risk: 'attention',
        requiresApproval: true,
        previewRequired: false,
        permission: 'approval',
        reason: `Zavorth workload assessment: ${workload.reasons.join('; ')}.`,
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
      reason: catalogEntry?.description || `${toolId} foi inferida a partir do pedido em linguagem natural.`,
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
    normalizedText: string,
    naturalTools: string[],
  ): boolean {
    if (entry.toolIds.some((toolId) => naturalTools.includes(toolId))) {
      return true;
    }
    const capabilityId = String(entry.capabilityId || '') as StrongCapabilityId;
    const terms: Record<StrongCapabilityId, string[]> = {
      'mnemos.memory': ['memoria', 'memory', 'mnemos', 'lembr'],
      'echo.hands': ['echo', 'voz', 'audio', 'hands'],
      'nexus.surface': ['nexus'],
      'swarm.escalation': ['swarm', 'subagente', 'multiagente', 'paralelo'],
      'selfmod.supervised': ['selfmod', 'auto melhoria', 'evolua', 'melhore o zavorth'],
      'watchmode.computer-use': ['watch', 'computer use', 'tela', 'visual', 'clique'],
      'skills.snapshot': ['skill', 'skills'],
      'mcp.snapshot': ['mcp', 'plugin'],
      'channel-mesh.bridge': ['canal', 'telegram', 'slack', 'discord'],
      'node-mesh.gateway': ['node', 'nodo', 'companion', 'dispositivo'],
      'session.ownership': ['sessao', 'session', 'historico'],
      'timing.canonical': ['timeline', 'tempo', 'timing', 'quando'],
      'policy.hot-reload': ['policy', 'policies', 'reload', 'recarreg'],
    };
    return (terms[capabilityId] || []).some((term) => normalizedText.includes(term));
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
    text: string,
    recommendations: NaturalCapabilityDiscoveryRecommendation[],
  ): NaturalCapabilityDiscoveryIntentCategory {
    const normalized = normalizeSearchText(text);
    const matchedPattern = CATEGORY_PATTERNS.find((entry) => {
      if (!entry.pattern.test(normalized)) {
        return false;
      }
      return entry.category !== 'web-research' || asksForWebOperation(text);
    });
    if (matchedPattern) {
      return matchedPattern.category;
    }
    const first = recommendations[0];
    if (!first) {
      return 'unknown';
    }
    if (first.toolIds.some((toolId) => toolId.includes('write'))) {
      return 'workspace-mutation';
    }
    if (first.toolIds.some((toolId) => toolId.includes('read'))) {
      return 'workspace-inspection';
    }
    return 'unknown';
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
      detail: 'Discovery nao executou tools; apenas alimentou ToolExposurePolicy.',
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
        detail: 'Nenhuma capability forte foi inferida; manter resposta direta ou pedir esclarecimento.',
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
