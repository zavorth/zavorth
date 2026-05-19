import type {
  ImportedCapabilityKind,
  ImportedCapabilityRiskLevel,
  ImportedCapabilityRiskReport,
  ImportedCapabilityTrustState,
} from './security/index.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const SKILL_MCP_QUARANTINE_CONTRACT_VERSION = '2026-05-03.skill-mcp-quarantine' as const;

export type SkillMcpQuarantineEntry = {
  id: string;
  kind: ImportedCapabilityKind;
  trustState: ImportedCapabilityTrustState;
  riskLevel: ImportedCapabilityRiskLevel;
  quarantined: boolean;
  requiresReview: boolean;
  canExposeToModel: boolean;
  canExposeTools: boolean;
  toolNames: string[];
  reasons: string[];
  origin: {
    source: string;
    ref: string | null;
  };
  actions: {
    inspectCommand: string;
    reviewCommand: string;
    promoteCommand: string;
    keepQuarantinedCommand: string;
  };
};

export type SkillMcpQuarantineSnapshot = {
  contractVersion: typeof SKILL_MCP_QUARANTINE_CONTRACT_VERSION;
  source: 'SkillMcpQuarantineService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  summary: {
    total: number;
    trusted: number;
    safe: number;
    quarantined: number;
    reviewRequired: number;
    blockedToolCount: number;
  };
  entries: SkillMcpQuarantineEntry[];
  receipts: Array<{
    id: string;
    kind: 'skill' | 'mcp' | 'policy';
    detail: string;
  }>;
  policy: {
    externalImportsNeverTrustedAutomatically: true;
    quarantinedToolsHidden: true;
    toolExposureGatedByImportedCapabilityTrust: boolean;
    noMarketplaceInstallPerformed: true;
    promotionsRequireExplicitOperatorAction: true;
    naturalLanguageDoesNotBypassQuarantine: true;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    reviewHint: string;
  };
  nextSafeAction: string;
};

export type SkillMcpQuarantineInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function normalizeKind(value: unknown): ImportedCapabilityKind {
  return normalizeText(value).toLowerCase() === 'mcp' ? 'mcp' : 'skill';
}

function normalizeTrustState(value: unknown): ImportedCapabilityTrustState {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'trusted' || raw === 'safe' || raw === 'quarantined') {
    return raw;
  }
  return 'safe';
}

function normalizeRiskLevel(value: unknown, trustState: ImportedCapabilityTrustState): ImportedCapabilityRiskLevel {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'low' || raw === 'medium' || raw === 'high') {
    return raw;
  }
  return trustState === 'quarantined' ? 'high' : trustState === 'trusted' ? 'low' : 'medium';
}

function collectRiskReports(run: UniversalAgentRun): ImportedCapabilityRiskReport[] {
  const metadata = run.metadata || {};
  const importedCapabilityTrust = recordOrNull(metadata.importedCapabilityTrust);
  const coldContext = recordOrNull(metadata.coldContext);
  const skillContext = recordOrNull(coldContext?.skillContext);
  const mcpContext = recordOrNull(coldContext?.mcpContext);
  const canonicalContext = recordOrNull(metadata.canonicalContext);
  const canonicalCold = recordOrNull(canonicalContext?.cold);
  const canonicalColdMetadata = recordOrNull(canonicalCold?.metadata);
  const canonicalSkillContext = recordOrNull(canonicalColdMetadata?.skillContext);
  const canonicalMcpContext = recordOrNull(canonicalColdMetadata?.mcpContext);
  const candidates = [
    ...normalizeRiskReports(importedCapabilityTrust?.riskReports),
    ...normalizeRiskReports(skillContext?.riskReports),
    ...normalizeRiskReports(mcpContext?.riskReports),
    ...normalizeRiskReports(canonicalSkillContext?.riskReports),
    ...normalizeRiskReports(canonicalMcpContext?.riskReports),
  ];
  const byKey = new Map<string, ImportedCapabilityRiskReport>();
  for (const report of candidates) {
    byKey.set(`${report.kind}:${report.id}`, report);
  }
  return Array.from(byKey.values());
}

function normalizeRiskReports(value: unknown): ImportedCapabilityRiskReport[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(recordOrNull)
    .filter((entry): entry is LooseRecord => Boolean(entry))
    .map((entry) => {
      const trustState = normalizeTrustState(entry.trustState);
      const quarantined = entry.quarantined === true || trustState === 'quarantined';
      const normalizedTrustState = quarantined ? 'quarantined' : trustState;
      return {
        kind: normalizeKind(entry.kind),
        id: normalizeText(entry.id, 'unknown'),
        toolNames: normalizeList(entry.toolNames),
        trustState: normalizedTrustState,
        riskLevel: normalizeRiskLevel(entry.riskLevel, normalizedTrustState),
        quarantined,
        requiresReview: entry.requiresReview === true || quarantined,
        canExposeToModel: entry.canExposeToModel === false ? false : !quarantined,
        canExposeTools: entry.canExposeTools === false ? false : !quarantined,
        reasons: normalizeList(entry.reasons).length > 0
          ? normalizeList(entry.reasons)
          : [quarantined ? 'capability-quarantined' : `capability-${normalizedTrustState}`],
      };
    });
}

function blockedToolNames(entries: SkillMcpQuarantineEntry[]): string[] {
  return Array.from(new Set(
    entries
      .filter((entry) => entry.quarantined || entry.canExposeTools === false)
      .flatMap((entry) => entry.toolNames),
  ));
}

function buildActions(run: UniversalAgentRun, entry: ImportedCapabilityRiskReport): SkillMcpQuarantineEntry['actions'] {
  const id = `${entry.kind}:${entry.id}`;
  return {
    inspectCommand: `zavorth quarantine inspect ${id}`,
    reviewCommand: `zavorth quarantine review ${id}`,
    promoteCommand: `zavorth quarantine promote ${id} --confirm`,
    keepQuarantinedCommand: `zavorth quarantine keep ${id}`,
  };
}

function originForReport(run: UniversalAgentRun, report: ImportedCapabilityRiskReport): SkillMcpQuarantineEntry['origin'] {
  const coldContext = recordOrNull(run.metadata.coldContext);
  const skillContext = recordOrNull(coldContext?.skillContext);
  const mcpContext = recordOrNull(coldContext?.mcpContext);
  if (report.kind === 'mcp') {
    return {
      source: normalizeText(mcpContext?.source, 'McpRuntimeService.readSnapshot'),
      ref: normalizeText(mcpContext?.manifestPath) || normalizeText(mcpContext?.sourceRef) || null,
    };
  }
  return {
    source: normalizeText(skillContext?.source, 'SkillScanner'),
    ref: normalizeText(skillContext?.directory) || normalizeText(skillContext?.sourceRef) || null,
  };
}

export class SkillMcpQuarantineService {
  private readonly now: () => Date;

  constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: SkillMcpQuarantineInput): SkillMcpQuarantineSnapshot {
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const reports = collectRiskReports(input.run);
    const entries = reports.map((report) => this.toEntry(input.run, report));
    const blockedTools = blockedToolNames(entries);
    const importedCapabilityTrust = recordOrNull(input.run.metadata.importedCapabilityTrust);
    const toolExposureGatedByImportedCapabilityTrust = importedCapabilityTrust?.toolExposureGatedByImportedCapabilityTrust === true
      || blockedTools.length > 0
      || input.run.toolExposure.blockedTools?.some((tool) => tool.reason === 'blocked-by-imported-capability-trust') === true;

    return {
      contractVersion: SKILL_MCP_QUARANTINE_CONTRACT_VERSION,
      source: 'SkillMcpQuarantineService',
      generatedAt,
      identifiers: {
        runId: input.run.id,
        traceId: input.run.traceId,
        requestId: input.run.requestId,
        sessionId: input.run.sessionId,
      },
      summary: {
        total: entries.length,
        trusted: entries.filter((entry) => entry.trustState === 'trusted').length,
        safe: entries.filter((entry) => entry.trustState === 'safe').length,
        quarantined: entries.filter((entry) => entry.trustState === 'quarantined').length,
        reviewRequired: entries.filter((entry) => entry.requiresReview).length,
        blockedToolCount: blockedTools.length,
      },
      entries,
      receipts: this.buildReceipts(entries),
      policy: {
        externalImportsNeverTrustedAutomatically: true,
        quarantinedToolsHidden: true,
        toolExposureGatedByImportedCapabilityTrust,
        noMarketplaceInstallPerformed: true,
        promotionsRequireExplicitOperatorAction: true,
        naturalLanguageDoesNotBypassQuarantine: true,
      },
      surface: {
        cliCommand: `zavorth quarantine run ${input.run.id} --json`,
        commandCenterPath: '/control?sector=skills',
        reviewHint: 'Revise origem, risco e manifest antes de promover qualquer capability importada.',
      },
      nextSafeAction: this.nextSafeAction(entries),
    };
  }

  private toEntry(run: UniversalAgentRun, report: ImportedCapabilityRiskReport): SkillMcpQuarantineEntry {
    return {
      id: report.id,
      kind: report.kind,
      trustState: report.trustState,
      riskLevel: report.riskLevel,
      quarantined: report.quarantined,
      requiresReview: report.requiresReview,
      canExposeToModel: report.canExposeToModel,
      canExposeTools: report.canExposeTools,
      toolNames: report.toolNames || [],
      reasons: report.reasons,
      origin: originForReport(run, report),
      actions: buildActions(run, report),
    };
  }

  private buildReceipts(entries: SkillMcpQuarantineEntry[]): SkillMcpQuarantineSnapshot['receipts'] {
    const receipts: SkillMcpQuarantineSnapshot['receipts'] = entries.slice(0, 12).map((entry) => ({
      id: `quarantine:${entry.kind}:${entry.id}`,
      kind: entry.kind,
      detail: `${entry.id} esta ${entry.trustState}; tools expostas=${String(entry.canExposeTools)}; review=${String(entry.requiresReview)}.`,
    }));
    receipts.push({
      id: 'quarantine:policy',
      kind: 'policy',
      detail: 'Imports externos nunca viram trusted automaticamente; promocao exige acao explicita do operador.',
    });
    return receipts;
  }

  private nextSafeAction(entries: SkillMcpQuarantineEntry[]): string {
    if (entries.some((entry) => entry.quarantined)) {
      return 'Manter tools importadas em quarentena ate review/promocao explicita.';
    }
    if (entries.length > 0) {
      return 'Monitorar origem e risco; nenhuma capability importada exige review imediato.';
    }
    return 'Nenhuma skill/MCP importada foi detectada neste run.';
  }
}
