import {
  queryUniversalAgentRuns,
  type UniversalAgentRunObservatoryReceipt,
} from './RunObservatory.js';
import type {
  UniversalAgentRun,
  UniversalArtifactSummary,
} from './UniversalAgentRuntimeTypes.js';

export const ARTIFACT_MEMORY_CONTRACT_VERSION = '2026-05-03.wave-38' as const;

export type ArtifactMemoryStatus = 'ready' | 'needs-index' | 'empty' | 'blocked';

export type ArtifactMemoryCategory =
  | 'plan'
  | 'diff'
  | 'report'
  | 'spec'
  | 'decision'
  | 'execution'
  | 'prompt'
  | 'release'
  | 'run-summary'
  | 'file'
  | 'log'
  | 'handoff'
  | 'unknown';

export type ArtifactMemoryEntry = {
  id: string;
  artifactId: string;
  memoryId: string;
  title: string;
  kind: UniversalArtifactSummary['kind'] | 'run-summary';
  category: ArtifactMemoryCategory;
  status: UniversalArtifactSummary['status'] | 'ready';
  createdAt: string;
  runId: string;
  traceId: string;
  sessionId: string;
  projectRef: string | null;
  taskRef: string | null;
  summary: string;
  searchableText: string;
  tags: string[];
  importance: 'low' | 'medium' | 'high';
  reusable: boolean;
  receipt: {
    observatoryReceiptId: string | null;
    memoryReceiptId: string | null;
    source: 'artifact-ledger' | 'run-summary' | 'metadata';
  };
  actions: {
    openCommand: string;
    rememberCommand: string;
    reuseCommand: string;
    citeCommand: string;
    forgetCommand: string;
  };
};

export type ArtifactMemoryReceipt = {
  id: string;
  kind:
    | 'artifact-ledger'
    | 'run-observatory'
    | 'memory-with-receipts'
    | 'search-index'
    | 'policy'
    | 'surface';
  source: string;
  artifactId?: string;
  detail: string;
  status: 'ready' | 'needs-index' | 'missing';
  observatoryReceiptId?: string;
};

export type ArtifactMemorySnapshot = {
  contractVersion: typeof ARTIFACT_MEMORY_CONTRACT_VERSION;
  source: 'ArtifactMemoryService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: ArtifactMemoryStatus;
  summary: {
    artifactCount: number;
    memoryEntryCount: number;
    reusableCount: number;
    readyArtifactCount: number;
    runSummaryIndexed: boolean;
    receiptCount: number;
    linkedMemoryReceiptCount: number;
    runObservatoryLinked: boolean;
    searchReady: boolean;
    indexedCategories: ArtifactMemoryCategory[];
  };
  entries: ArtifactMemoryEntry[];
  search: {
    queryHints: string[];
    facets: Array<{
      id: string;
      label: string;
      count: number;
    }>;
    commands: {
      searchCommand: string;
      latestCommand: string;
      byRunCommand: string;
    };
  };
  receipts: ArtifactMemoryReceipt[];
  policy: {
    noArtifactContentInvented: true;
    noFilesystemReadPerformed: true;
    noArtifactMutation: true;
    memoryWriteNotPerformed: true;
    promotionRequiresExplicitAction: true;
    reusedArtifactMustCiteOrigin: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    searchHint: string;
    reuseHint: string;
  };
  nextSafeAction: string;
};

export type ArtifactMemoryInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = 'artifact'): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
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

function normalizeArtifactKind(value: unknown): UniversalArtifactSummary['kind'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'file' || raw === 'report' || raw === 'diff' || raw === 'log' || raw === 'plan' || raw === 'handoff') {
    return raw;
  }
  return 'file';
}

function uniqueCategories(entries: ArtifactMemoryEntry[]): ArtifactMemoryCategory[] {
  const categories = new Set<ArtifactMemoryCategory>();
  for (const entry of entries) {
    categories.add(entry.category);
  }
  return Array.from(categories);
}

type ArtifactMemoryKind = UniversalArtifactSummary['kind'] | 'run-summary';

type ArtifactMemoryStatusLike = UniversalArtifactSummary['status'] | 'ready';

function categoryFromArtifact(artifact: { kind: ArtifactMemoryKind; title: string }): ArtifactMemoryCategory {
  const title = normalizeText(artifact.title).toLowerCase();
  if (artifact.kind === 'plan' || /plano|plan|roadmap/.test(title)) {
    return 'plan';
  }
  if (artifact.kind === 'diff' || /diff|patch|mudan/.test(title)) {
    return 'diff';
  }
  if (artifact.kind === 'report' || /report|relat[oó]rio|auditoria|qa/.test(title)) {
    return 'report';
  }
  if (/spec|rfc|contrato|design/.test(title)) {
    return 'spec';
  }
  if (/decis[aã]o|decision|adr/.test(title)) {
    return 'decision';
  }
  if (/execu|run|teste|workflow/.test(title)) {
    return 'execution';
  }
  if (/prompt/.test(title)) {
    return 'prompt';
  }
  if (/release|vers[aã]o|rollback/.test(title)) {
    return 'release';
  }
  if (artifact.kind === 'log') {
    return 'log';
  }
  if (artifact.kind === 'handoff') {
    return 'handoff';
  }
  if (artifact.kind === 'file') {
    return 'file';
  }
  return 'unknown';
}

function importanceForCategory(category: ArtifactMemoryCategory, status: ArtifactMemoryStatusLike): ArtifactMemoryEntry['importance'] {
  if (status === 'failed') {
    return 'low';
  }
  if (category === 'decision' || category === 'spec' || category === 'release' || category === 'run-summary') {
    return 'high';
  }
  if (category === 'plan' || category === 'diff' || category === 'report' || category === 'handoff') {
    return 'medium';
  }
  return 'low';
}

function tagsForEntry(input: {
  artifact: {
    kind: ArtifactMemoryKind;
    status: ArtifactMemoryStatusLike;
    sessionId?: string;
    title: string;
  };
  category: ArtifactMemoryCategory;
  run: UniversalAgentRun;
}): string[] {
  return Array.from(new Set([
    `kind:${input.artifact.kind}`,
    `category:${input.category}`,
    `status:${input.artifact.status}`,
    `session:${input.artifact.sessionId || input.run.sessionId}`,
    input.run.workspace ? `workspace:${normalizeKey(input.run.workspace)}` : '',
    ...normalizeText(input.artifact.title)
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .slice(0, 5)
      .map((word) => `topic:${normalizeKey(word)}`),
  ].filter(Boolean)));
}

export class ArtifactMemoryService {
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: ArtifactMemoryInput): ArtifactMemorySnapshot {
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
    const observatoryArtifactReceipts = observatory.receipts.filter((receipt) => receipt.kind === 'artifact');
    const memoryWithReceipts = recordOrNull(run.metadata.memoryWithReceipts);
    const memoryReceipts = listRecords(memoryWithReceipts?.receipts);
    const entries = [
      ...run.artifacts.map((artifact) => this.entryFromArtifact({
        run,
        artifact,
        observatoryReceipt: observatoryArtifactReceipts.find((receipt) =>
          normalizeText(receipt.metadata?.artifactId) === artifact.id),
        memoryReceipt: memoryReceipts.find((receipt) =>
          normalizeText(receipt.origin && recordOrNull(receipt.origin)?.artifactId) === artifact.id),
      })),
      ...this.runSummaryEntry(run, observatory.receipts, memoryReceipts),
      ...this.metadataEntries(run, observatoryArtifactReceipts, memoryReceipts),
    ];
    const receipts = this.buildReceipts({
      run,
      entries,
      observatoryArtifactReceipts,
      memoryReceipts,
    });
    const linkedMemoryReceiptCount = entries.filter((entry) => Boolean(entry.receipt.memoryReceiptId)).length;
    const runObservatoryLinked = entries.length === 0
      || entries.every((entry) => entry.kind === 'run-summary' || Boolean(entry.receipt.observatoryReceiptId));
    const searchReady = entries.length > 0 && entries.every((entry) => Boolean(entry.searchableText));
    const status = this.resolveStatus(run, entries, searchReady);

    return {
      contractVersion: ARTIFACT_MEMORY_CONTRACT_VERSION,
      source: 'ArtifactMemoryService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      summary: {
        artifactCount: run.artifacts.length,
        memoryEntryCount: entries.length,
        reusableCount: entries.filter((entry) => entry.reusable).length,
        readyArtifactCount: run.artifacts.filter((artifact) => artifact.status === 'ready').length,
        runSummaryIndexed: entries.some((entry) => entry.kind === 'run-summary'),
        receiptCount: receipts.length,
        linkedMemoryReceiptCount,
        runObservatoryLinked,
        searchReady,
        indexedCategories: uniqueCategories(entries),
      },
      entries,
      search: this.buildSearch(entries, run),
      receipts,
      policy: {
        noArtifactContentInvented: true,
        noFilesystemReadPerformed: true,
        noArtifactMutation: true,
        memoryWriteNotPerformed: true,
        promotionRequiresExplicitAction: true,
        reusedArtifactMustCiteOrigin: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth artifact-memory run ${run.id} --json`,
        commandCenterPath: '/control?sector=dreams',
        searchHint: 'Procure por tarefa, projeto, categoria, data ou runId antes de reutilizar um artifact.',
        reuseHint: 'Ao reutilizar artifact em resposta, cite artifactId, runId e receipt de origem.',
      },
      nextSafeAction: this.nextSafeAction(status, entries, linkedMemoryReceiptCount),
    };
  }

  private entryFromArtifact(input: {
    run: UniversalAgentRun;
    artifact: UniversalArtifactSummary;
    observatoryReceipt?: UniversalAgentRunObservatoryReceipt;
    memoryReceipt?: LooseRecord;
  }): ArtifactMemoryEntry {
    const { run, artifact } = input;
    const category = categoryFromArtifact(artifact);
    const memoryId = `artifact-memory:${artifact.id}`;
    const summary = this.summaryForArtifact(run, artifact, category);
    return {
      id: `artifact-memory:entry:${normalizeKey(artifact.id)}`,
      artifactId: artifact.id,
      memoryId,
      title: artifact.title,
      kind: artifact.kind,
      category,
      status: artifact.status,
      createdAt: artifact.createdAt,
      runId: run.id,
      traceId: run.traceId,
      sessionId: artifact.sessionId || run.sessionId,
      projectRef: normalizeText(run.workspace) || null,
      taskRef: this.resolveTaskRef(run),
      summary,
      searchableText: this.searchableText({
        title: artifact.title,
        summary,
        run,
        kind: artifact.kind,
        category,
      }),
      tags: tagsForEntry({ artifact, category, run }),
      importance: importanceForCategory(category, artifact.status),
      reusable: artifact.status === 'ready' || artifact.status === 'draft',
      receipt: {
        observatoryReceiptId: input.observatoryReceipt?.id || null,
        memoryReceiptId: normalizeText(input.memoryReceipt?.id) || null,
        source: 'artifact-ledger',
      },
      actions: this.actions(artifact.id, memoryId),
    };
  }

  private runSummaryEntry(
    run: UniversalAgentRun,
    observatoryReceipts: UniversalAgentRunObservatoryReceipt[],
    memoryReceipts: LooseRecord[],
  ): ArtifactMemoryEntry[] {
    const summary = redactText(run.summary);
    if (!summary || summary === 'Execucao recebida pelo runtime universal.') {
      return [];
    }
    const artifactId = `run-summary:${run.id}`;
    const memoryId = `artifact-memory:${artifactId}`;
    const artifact = {
      kind: 'run-summary' as const,
      title: run.title || 'Resumo do run',
      status: 'ready' as const,
      sessionId: run.sessionId,
    };
    const memoryReceipt = memoryReceipts.find((receipt) =>
      normalizeText(recordOrNull(receipt.origin)?.artifactId) === artifactId);
    const statusReceipt = observatoryReceipts.find((receipt) => receipt.kind === 'status' || receipt.kind === 'reply');
    return [{
      id: `artifact-memory:entry:${normalizeKey(artifactId)}`,
      artifactId,
      memoryId,
      title: `Resumo: ${run.title}`,
      kind: 'run-summary',
      category: 'run-summary',
      status: 'ready',
      createdAt: run.updatedAt,
      runId: run.id,
      traceId: run.traceId,
      sessionId: run.sessionId,
      projectRef: normalizeText(run.workspace) || null,
      taskRef: this.resolveTaskRef(run),
      summary,
      searchableText: this.searchableText({
        title: run.title,
        summary,
        run,
        kind: artifact.kind,
        category: 'run-summary',
      }),
      tags: tagsForEntry({ artifact, category: 'run-summary', run }),
      importance: 'high',
      reusable: true,
      receipt: {
        observatoryReceiptId: statusReceipt?.id || null,
        memoryReceiptId: normalizeText(memoryReceipt?.id) || null,
        source: 'run-summary',
      },
      actions: this.actions(artifactId, memoryId),
    }];
  }

  private metadataEntries(
    run: UniversalAgentRun,
    observatoryArtifactReceipts: UniversalAgentRunObservatoryReceipt[],
    memoryReceipts: LooseRecord[],
  ): ArtifactMemoryEntry[] {
    const previousArtifactMemory = recordOrNull(run.metadata.artifactMemory);
    const previousArtifactMemoryEntries = normalizeText(previousArtifactMemory?.contractVersion) === ARTIFACT_MEMORY_CONTRACT_VERSION
      || normalizeText(previousArtifactMemory?.source) === 'ArtifactMemoryService'
      ? []
      : listRecords(previousArtifactMemory?.entries);
    const rawEntries = [
      ...listRecords(run.metadata.artifactMemoryCandidates),
      ...previousArtifactMemoryEntries,
      ...listRecords(recordOrNull(run.metadata.artifactIndex)?.entries),
    ];
    const knownArtifactIds = new Set([
      ...run.artifacts.map((artifact) => artifact.id),
      `run-summary:${run.id}`,
    ]);
    const dedupedEntries: LooseRecord[] = [];
    const seenMetadataIds = new Set<string>();
    rawEntries.forEach((entry, index) => {
      const artifactId = normalizeText(entry.artifactId, `metadata-artifact-${index + 1}`);
      if (knownArtifactIds.has(artifactId) || seenMetadataIds.has(artifactId)) {
        return;
      }
      seenMetadataIds.add(artifactId);
      dedupedEntries.push(entry);
    });
    return dedupedEntries.slice(0, 12).map((entry, index) => {
      const artifactId = normalizeText(entry.artifactId, `metadata-artifact-${index + 1}`);
      const kind = normalizeArtifactKind(entry.kind);
      const status: UniversalArtifactSummary['status'] = normalizeText(entry.status) === 'failed'
        ? 'failed'
        : normalizeText(entry.status) === 'draft'
          ? 'draft'
          : 'ready';
      const artifact = {
        id: artifactId,
        title: normalizeText(entry.title, `Artifact ${index + 1}`),
        kind,
        status,
        createdAt: normalizeText(entry.createdAt, run.updatedAt),
        sessionId: normalizeText(entry.sessionId, run.sessionId),
      };
      const category = this.normalizeCategory(entry.category, categoryFromArtifact(artifact));
      const memoryId = `artifact-memory:${artifactId}`;
      const summary = redactText(entry.summary, artifact.title);
      const observatoryReceipt = observatoryArtifactReceipts.find((receipt) =>
        normalizeText(receipt.metadata?.artifactId) === artifactId);
      const memoryReceipt = memoryReceipts.find((receipt) =>
        normalizeText(recordOrNull(receipt.origin)?.artifactId) === artifactId);
      return {
        id: `artifact-memory:entry:${normalizeKey(artifactId)}`,
        artifactId,
        memoryId,
        title: artifact.title,
        kind: artifact.kind,
        category,
        status: artifact.status,
        createdAt: artifact.createdAt,
        runId: run.id,
        traceId: run.traceId,
        sessionId: artifact.sessionId,
        projectRef: normalizeText(entry.projectRef, normalizeText(run.workspace)) || null,
        taskRef: normalizeText(entry.taskRef, this.resolveTaskRef(run) || '') || null,
        summary,
        searchableText: this.searchableText({
          title: artifact.title,
          summary,
          run,
          kind: artifact.kind,
          category,
        }),
        tags: Array.from(new Set([
          ...tagsForEntry({ artifact, category, run }),
          ...listStrings(entry.tags),
        ])),
        importance: importanceForCategory(category, artifact.status),
        reusable: artifact.status !== 'failed',
        receipt: {
          observatoryReceiptId: observatoryReceipt?.id || null,
          memoryReceiptId: normalizeText(memoryReceipt?.id) || null,
          source: 'metadata',
        },
        actions: this.actions(artifactId, memoryId),
      };
    });
  }

  private resolveTaskRef(run: UniversalAgentRun): string | null {
    const metadata = run.metadata || {};
    return normalizeText(metadata.taskId)
      || normalizeText(metadata.task_id)
      || normalizeText(recordOrNull(metadata.task)?.id)
      || normalizeText(recordOrNull(metadata.task)?.taskId)
      || null;
  }

  private summaryForArtifact(
    run: UniversalAgentRun,
    artifact: UniversalArtifactSummary,
    category: ArtifactMemoryCategory,
  ): string {
    const metadata = run.metadata || {};
    const artifactSummaries = recordOrNull(metadata.artifactSummaries);
    const directSummary = recordOrNull(artifactSummaries?.[artifact.id]);
    return redactText(
      directSummary?.summary
        || directSummary?.description
        || `${artifact.title} (${category}) criado em ${artifact.createdAt} para ${run.title}.`,
      artifact.title,
    );
  }

  private searchableText(input: {
    title: string;
    summary: string;
    run: UniversalAgentRun;
    kind: string;
    category: ArtifactMemoryCategory;
  }): string {
    return redactText([
      input.title,
      input.summary,
      input.kind,
      input.category,
      input.run.title,
      input.run.summary,
      input.run.workspace || '',
      input.run.sessionId,
    ].join(' '), '', 500).toLowerCase();
  }

  private actions(artifactId: string, memoryId: string): ArtifactMemoryEntry['actions'] {
    return {
      openCommand: `zavorth artifacts open ${artifactId}`,
      rememberCommand: `zavorth artifact-memory remember ${artifactId}`,
      reuseCommand: `zavorth artifact-memory reuse ${artifactId}`,
      citeCommand: `zavorth artifact-memory cite ${artifactId}`,
      forgetCommand: `zavorth artifact-memory forget ${memoryId}`,
    };
  }

  private normalizeCategory(value: unknown, fallback: ArtifactMemoryCategory): ArtifactMemoryCategory {
    const raw = normalizeText(value).toLowerCase();
    if (
      raw === 'plan'
      || raw === 'diff'
      || raw === 'report'
      || raw === 'spec'
      || raw === 'decision'
      || raw === 'execution'
      || raw === 'prompt'
      || raw === 'release'
      || raw === 'run-summary'
      || raw === 'file'
      || raw === 'log'
      || raw === 'handoff'
      || raw === 'unknown'
    ) {
      return raw;
    }
    return fallback;
  }

  private buildSearch(entries: ArtifactMemoryEntry[], run: UniversalAgentRun): ArtifactMemorySnapshot['search'] {
    const facets = uniqueCategories(entries).map((category) => ({
      id: `category:${category}`,
      label: category,
      count: entries.filter((entry) => entry.category === category).length,
    }));
    return {
      queryHints: [
        run.title,
        run.workspace || '',
        ...uniqueCategories(entries),
        ...entries.slice(0, 4).map((entry) => entry.title),
      ].map((entry) => normalizeText(entry)).filter(Boolean),
      facets,
      commands: {
        searchCommand: 'zavorth artifact-memory search "<termo>" --json',
        latestCommand: 'zavorth artifact-memory latest --json',
        byRunCommand: `zavorth artifact-memory run ${run.id} --json`,
      },
    };
  }

  private buildReceipts(input: {
    run: UniversalAgentRun;
    entries: ArtifactMemoryEntry[];
    observatoryArtifactReceipts: UniversalAgentRunObservatoryReceipt[];
    memoryReceipts: LooseRecord[];
  }): ArtifactMemoryReceipt[] {
    const receipts: ArtifactMemoryReceipt[] = [];
    if (input.run.artifacts.length === 0) {
      receipts.push({
        id: 'artifact-memory:receipt:artifact-ledger:empty',
        kind: 'artifact-ledger',
        source: 'artifact-ledger',
        detail: 'Nenhum artifact estruturado foi encontrado neste run.',
        status: input.entries.length > 0 ? 'needs-index' : 'missing',
      });
    }
    for (const entry of input.entries.slice(0, 16)) {
      receipts.push({
        id: `artifact-memory:receipt:entry:${normalizeKey(entry.artifactId)}`,
        kind: entry.kind === 'run-summary' ? 'search-index' : 'artifact-ledger',
        source: entry.receipt.source,
        artifactId: entry.artifactId,
        detail: `${entry.title} indexado como ${entry.category}.`,
        status: entry.reusable ? 'ready' : 'needs-index',
        ...(entry.receipt.observatoryReceiptId ? { observatoryReceiptId: entry.receipt.observatoryReceiptId } : {}),
      });
    }
    receipts.push({
      id: 'artifact-memory:receipt:run-observatory',
      kind: 'run-observatory',
      source: 'RunObservatory',
      detail: `${input.observatoryArtifactReceipts.length} artifact receipt(s) encontrados no Run Observatory.`,
      status: input.observatoryArtifactReceipts.length >= input.run.artifacts.length ? 'ready' : 'needs-index',
    });
    receipts.push({
      id: 'artifact-memory:receipt:memory-with-receipts',
      kind: 'memory-with-receipts',
      source: 'MemoryWithReceiptsService',
      detail: `${input.memoryReceipts.length} memory receipt(s) disponiveis para correlacionar origem.`,
      status: input.memoryReceipts.length > 0 ? 'ready' : 'needs-index',
    });
    receipts.push({
      id: 'artifact-memory:receipt:policy',
      kind: 'policy',
      source: 'ArtifactMemoryService',
      detail: 'Artifact Memory indexa e prepara reuso, mas nao le arquivo, nao muta artifact e nao escreve memoria.',
      status: 'ready',
    });
    receipts.push({
      id: 'artifact-memory:receipt:surface',
      kind: 'surface',
      source: '/control',
      detail: 'Artifact Memory projetado em /control?sector=dreams e CLI.',
      status: 'ready',
    });
    return receipts;
  }

  private resolveStatus(
    run: UniversalAgentRun,
    entries: ArtifactMemoryEntry[],
    searchReady: boolean,
  ): ArtifactMemoryStatus {
    if (run.status === 'failed' && entries.length === 0) {
      return 'blocked';
    }
    if (entries.length === 0) {
      return 'empty';
    }
    if (!searchReady || entries.some((entry) => !entry.receipt.observatoryReceiptId && entry.kind !== 'run-summary')) {
      return 'needs-index';
    }
    return 'ready';
  }

  private nextSafeAction(
    status: ArtifactMemoryStatus,
    entries: ArtifactMemoryEntry[],
    linkedMemoryReceiptCount: number,
  ): string {
    if (status === 'blocked') {
      return 'Resolver falha do run antes de promover artifacts para memoria.';
    }
    if (status === 'empty') {
      return 'Continuar sem inventar artifact; criar plano, report, diff ou resumo antes de reutilizar.';
    }
    if (status === 'needs-index') {
      return 'Indexar artifacts com receipt e promover memoria apenas por comando explicito.';
    }
    if (linkedMemoryReceiptCount < entries.length) {
      return 'Reutilizar artifacts citando artifactId/runId; promover receipts faltantes quando necessario.';
    }
    return 'Artifacts podem ser pesquisados e reutilizados, sempre citando origem.';
  }
}
