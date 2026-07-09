import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_INNOVATION_RADAR_CONTRACT_VERSION,
  type ZavorthInnovationRadarCandidate,
  type ZavorthInnovationRadarCategory,
  type ZavorthInnovationRadarSignal,
  type ZavorthInnovationRadarSignalInput,
  type ZavorthInnovationRadarSnapshot,
  type ZavorthInnovationRadarSourceReceipt,
} from '../contracts/native/ZavorthInnovationRadarContract.js';
import { ZavorthCapabilityPackCatalogService } from './ZavorthCapabilityPackCatalogService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';
import { logger } from '../logger.js';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type Runtime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  fetchImpl?: FetchLike;
  reportFile?: string;
  catalog?: Pick<ZavorthCapabilityPackCatalogService, 'listPacks'>;
};

export type ZavorthInnovationRadarRunInput = {
  signals?: ZavorthInnovationRadarSignalInput[];
  inputFiles?: string[];
  feedUrls?: string[];
  allowedHosts?: string[];
  persist?: boolean;
};

type KnownCapability = { id: string; tokens: string[] };

const MAX_FEED_BYTES = 512 * 1024;
const FEED_TIMEOUT_MS = 8_000;
const VALID_CATEGORIES = new Set<ZavorthInnovationRadarCategory>([
  'agent-runtime', 'channels', 'providers', 'memory', 'tooling', 'sandbox',
  'multimodal', 'workflow', 'ux', 'security', 'unknown',
]);

export class ZavorthInnovationRadarService {
  private readonly projectRoot: string;
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;
  private readonly fetchImpl: FetchLike;
  private readonly reportFile: string;
  private readonly catalog: Pick<ZavorthCapabilityPackCatalogService, 'listPacks'>;

  constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.env = runtime.env || process.env;
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || fetch;
    const paths = new ZavorthHomePathService({ projectRoot: this.projectRoot, env: this.env }).resolvePaths();
    this.reportFile = path.resolve(runtime.reportFile || path.join(paths.runtimeDir, 'innovation-radar-last.json'));
    this.catalog = runtime.catalog || new ZavorthCapabilityPackCatalogService();
  }

  public async run(input: ZavorthInnovationRadarRunInput = {}): Promise<ZavorthInnovationRadarSnapshot> {
    const signals: ZavorthInnovationRadarSignal[] = [];
    const sources: ZavorthInnovationRadarSourceReceipt[] = [];
    const localSignals = this.normalizeSignals(input.signals || [], 'local-input');
    signals.push(...localSignals);
    if (localSignals.length > 0) {
      sources.push(this.receipt('local-input', 'local-input', 'read', localSignals.length, 'Explicit local signals normalized.'));
    }

    for (const file of unique(input.inputFiles || [])) {
      const result = this.readJsonFile(file);
      sources.push(result.receipt);
      signals.push(...result.signals);
    }

    const feedUrls = unique([...splitList(this.env.ZAVORTH_INNOVATION_RADAR_FEEDS), ...(input.feedUrls || [])]);
    const allowedHosts = new Set(
      unique([...splitList(this.env.ZAVORTH_INNOVATION_RADAR_ALLOWED_HOSTS), ...(input.allowedHosts || [])])
        .map((entry) => entry.toLowerCase()),
    );
    for (const feedUrl of feedUrls) {
      const result = await this.readJsonFeed(feedUrl, allowedHosts);
      sources.push(result.receipt);
      signals.push(...result.signals);
    }

    const candidates = this.buildCandidates(signals);
    const sourceSummary = {
      sources: sources.length,
      sourcesRead: sources.filter((source) => source.status === 'read').length,
      sourcesBlocked: sources.filter((source) => source.status === 'blocked').length,
      sourcesFailed: sources.filter((source) => source.status === 'failed').length,
    };
    const reportFile = input.persist === false ? null : this.reportFile;
    const snapshot: ZavorthInnovationRadarSnapshot = {
      contractVersion: ZAVORTH_INNOVATION_RADAR_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      surface: 'innovation-radar',
      status: sourceSummary.sourcesBlocked > 0 || sourceSummary.sourcesFailed > 0 || candidates.some((candidate) => candidate.status !== 'known')
        ? 'attention'
        : 'ready',
      reportFile,
      summary: {
        ...sourceSummary,
        signals: signals.length,
        candidates: candidates.length,
        newCandidates: candidates.filter((candidate) => candidate.status === 'new').length,
        watchCandidates: candidates.filter((candidate) => candidate.status === 'watch').length,
        knownCandidates: candidates.filter((candidate) => candidate.status === 'known').length,
      },
      sources,
      candidates,
      safety: {
        observationOnly: true,
        noCapabilityRegistered: true,
        noCapabilityInstalled: true,
        noToolExposed: true,
        noLiveActivation: true,
        httpsFeedsOnly: true,
        feedHostsAllowlisted: true,
        secretsRedacted: true,
      },
      commands: {
        inspect: 'npm run zavorth:innovation-radar --silent',
        inspectJson: 'npm run zavorth:innovation-radar:json --silent',
        check: 'npm run zavorth:innovation-radar:check --silent',
        nextStage: 'Register selected innovation signals as capability candidates.',
      },
    };
    if (reportFile) {
      fs.mkdirSync(path.dirname(reportFile), { recursive: true });
      fs.writeFileSync(reportFile, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    }
    return snapshot;
  }

  public renderText(snapshot: ZavorthInnovationRadarSnapshot): string {
    const lines = [
      'Zavorth Innovation Radar',
      '',
      `status=${snapshot.status}`,
      `sources=${snapshot.summary.sources} read=${snapshot.summary.sourcesRead} blocked=${snapshot.summary.sourcesBlocked} failed=${snapshot.summary.sourcesFailed}`,
      `signals=${snapshot.summary.signals} candidates=${snapshot.summary.candidates} new=${snapshot.summary.newCandidates} watch=${snapshot.summary.watchCandidates} known=${snapshot.summary.knownCandidates}`,
      '',
      'Candidates:',
    ];
    if (snapshot.candidates.length === 0) lines.push('- none observed');
    for (const candidate of snapshot.candidates) {
      lines.push(`- ${candidate.id} [${candidate.status}] ${candidate.title} / novelty=${candidate.noveltyScore.toFixed(2)} / confidence=${candidate.confidence.toFixed(2)}`);
      lines.push(`  next: ${candidate.nextSafeAction}`);
    }
    lines.push('', 'Safety: observation only; no capability was registered, installed, exposed or activated.');
    return lines.join('\n');
  }

  private readJsonFile(inputFile: string): { receipt: ZavorthInnovationRadarSourceReceipt; signals: ZavorthInnovationRadarSignal[] } {
    const locator = path.resolve(this.projectRoot, inputFile);
    try {
      const stats = fs.statSync(locator);
      if (!stats.isFile() || stats.size > MAX_FEED_BYTES) {
        return { receipt: this.receipt('json-file', locator, 'blocked', 0, 'Input is not a bounded JSON file.'), signals: [] };
      }
      const signals = this.normalizeSignals(extractSignals(JSON.parse(fs.readFileSync(locator, 'utf8')) as unknown), `file:${path.basename(locator)}`);
      return { receipt: this.receipt('json-file', locator, 'read', signals.length, 'Local JSON signals normalized.'), signals };
    } catch (error: any) {
    logger.warn('[Zavorth Innovation Radar] JSON parse failed', error);
    return { receipt: this.receipt('json-file', locator, 'failed', 0, safeError(error)), signals: [] };
  }
  }

  private async readJsonFeed(feedUrl: string, allowedHosts: Set<string>): Promise<{ receipt: ZavorthInnovationRadarSourceReceipt; signals: ZavorthInnovationRadarSignal[] }> {
    const validation = validateFeedUrl(feedUrl, allowedHosts);
    if (!validation.ok || !validation.url) {
      return { receipt: this.receipt('json-feed', redact(feedUrl), 'blocked', 0, validation.reason), signals: [] };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(validation.url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) {
        return { receipt: this.receipt('json-feed', validation.url, 'failed', 0, `Feed returned HTTP ${response.status}.`), signals: [] };
      }
      const length = Number(response.headers.get('content-length') || '0');
      if (length > MAX_FEED_BYTES) {
        return { receipt: this.receipt('json-feed', validation.url, 'blocked', 0, 'Feed payload exceeds the size limit.'), signals: [] };
      }
      const body = await response.text();
      if (Buffer.byteLength(body, 'utf8') > MAX_FEED_BYTES) {
        return { receipt: this.receipt('json-feed', validation.url, 'blocked', 0, 'Feed payload exceeds the size limit.'), signals: [] };
      }
      const signals = this.normalizeSignals(extractSignals(JSON.parse(body) as unknown), `feed:${new URL(validation.url).hostname}`);
      return { receipt: this.receipt('json-feed', validation.url, 'read', signals.length, 'Allowlisted HTTPS feed signals normalized.'), signals };
    } catch (error: any) {
    logger.warn('[Zavorth Innovation Radar] JSON parse failed', error);
    return { receipt: this.receipt('json-feed', validation.url, 'failed', 0, safeError(error)), signals: [] };
  } finally {
      clearTimeout(timer);
    }
  }

  private normalizeSignals(input: ZavorthInnovationRadarSignalInput[], fallbackSourceId: string): ZavorthInnovationRadarSignal[] {
    return input.map((signal, index) => {
      const title = redact(signal?.title);
      if (!title) return null;
      const sourceId = safeId(signal.sourceId || fallbackSourceId) || safeId(fallbackSourceId);
      const summary = redact(signal.summary || '');
      const tags = unique((signal.tags || []).map((tag) => safeId(tag)).filter(Boolean));
      return {
        id: safeId(signal.id || `${sourceId}-${index + 1}-${title}`),
        sourceId,
        sourceLabel: redact(signal.sourceLabel || sourceId),
        title,
        summary,
        url: safeEvidenceUrl(signal.url),
        publishedAt: normalizeDate(signal.publishedAt),
        category: normalizeCategory(signal.category, `${title} ${summary} ${tags.join(' ')}`),
        tags,
      } satisfies ZavorthInnovationRadarSignal;
    }).filter((signal): signal is ZavorthInnovationRadarSignal => Boolean(signal));
  }

  private buildCandidates(signals: ZavorthInnovationRadarSignal[]): ZavorthInnovationRadarCandidate[] {
    const grouped = new Map<string, ZavorthInnovationRadarSignal[]>();
    for (const signal of signals) {
      const key = `${signal.category}:${safeId(signal.title)}`;
      grouped.set(key, [...(grouped.get(key) || []), signal]);
    }
    const known = this.knownCapabilities();
    return [...grouped.entries()].map(([key, group]) => this.buildCandidate(key, group, known))
      .sort((left, right) => right.noveltyScore - left.noveltyScore || left.id.localeCompare(right.id));
  }

  private buildCandidate(key: string, group: ZavorthInnovationRadarSignal[], known: KnownCapability[]): ZavorthInnovationRadarCandidate {
    const representative = group[0];
    const candidateTokens = tokens(`${representative.title} ${representative.summary} ${representative.tags.join(' ')}`);
    const matches = known
      .filter((entry) => overlap(candidateTokens, entry.tokens) >= 2 || entry.tokens.some((token) => safeId(representative.title).includes(token)))
      .map((entry) => entry.id);
    const sourceIds = unique(group.map((signal) => signal.sourceId));
    const noveltyScore = clamp(matches.length > 0 ? 0.2 : 0.68 + Math.min(0.18, (sourceIds.length - 1) * 0.09));
    const confidence = clamp(0.52 + Math.min(0.24, (sourceIds.length - 1) * 0.12) + (representative.summary ? 0.08 : 0));
    const status: ZavorthInnovationRadarCandidate['status'] = matches.length > 0 ? 'known' : confidence >= 0.58 ? 'new' : 'watch';
    return {
      id: `innovation:${safeId(key)}`,
      status,
      title: representative.title,
      summary: representative.summary,
      category: representative.category,
      tags: unique(group.flatMap((signal) => signal.tags)),
      noveltyScore,
      confidence,
      sourceSignalIds: group.map((signal) => signal.id),
      sourceIds,
      matchedExistingCapabilityIds: matches,
      reasons: matches.length > 0
        ? [`Matched existing Zavorth capability: ${matches.join(', ')}.`]
        : [
          'No close match was found in the current Zavorth capability pack catalog.',
          sourceIds.length > 1 ? 'Observed from multiple source IDs.' : 'Observed from one source ID; corroborate before promotion.',
        ],
      nextSafeAction: status === 'new'
        ? 'Review and register this signal as a capability candidate before prototype work.'
        : status === 'watch'
          ? 'Collect another source signal before registering a capability candidate.'
          : 'Compare the signal with the existing capability and update its evidence if useful.',
    };
  }

  private knownCapabilities(): KnownCapability[] {
    return this.catalog.listPacks({ includeManifests: true }).flatMap((pack) =>
      pack.manifest.items.map((item) => ({
        id: `${item.kind}:${item.id}`,
        tokens: tokens(`${item.id} ${item.label} ${item.summary} ${(item.tags || []).join(' ')}`),
      })),
    );
  }

  private receipt(
    kind: ZavorthInnovationRadarSourceReceipt['kind'],
    locator: string,
    status: ZavorthInnovationRadarSourceReceipt['status'],
    signalCount: number,
    summary: string,
  ): ZavorthInnovationRadarSourceReceipt {
    return {
      id: `radar-source:${safeId(`${kind}-${locator}`)}`,
      kind,
      locator: redact(locator),
      status,
      signalCount,
      summary: redact(summary),
    };
  }
}

function extractSignals(payload: unknown): ZavorthInnovationRadarSignalInput[] {
  if (Array.isArray(payload)) return payload as ZavorthInnovationRadarSignalInput[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { signals?: unknown }).signals)) {
    return (payload as { signals: ZavorthInnovationRadarSignalInput[] }).signals;
  }
  return [];
}

function validateFeedUrl(feedUrl: string, allowedHosts: Set<string>): { ok: boolean; url: string | null; reason: string } {
  try {
    const url = new URL(feedUrl);
    if (url.protocol !== 'https:') return { ok: false, url: null, reason: 'Innovation Radar accepts HTTPS feeds only.' };
    if (url.username || url.password || url.search) return { ok: false, url: null, reason: 'Feed URLs cannot carry credentials or query parameters.' };
    if (!allowedHosts.has(url.hostname.toLowerCase())) return { ok: false, url: null, reason: 'Feed host is not allowlisted.' };
    return { ok: true, url: url.toString(), reason: 'Allowlisted HTTPS feed.' };
  } catch (error: any) {
    logger.warn('[Zavorth Innovation Radar] network request failed', error);
    return { ok: false, url: null, reason: 'Feed URL is invalid.' };
  }
}

function normalizeCategory(value: ZavorthInnovationRadarCategory | null | undefined, text: string): ZavorthInnovationRadarCategory {
  if (value && VALID_CATEGORIES.has(value)) return value;
  const normalized = text.toLowerCase();
  if (/\b(channel|telegram|discord|slack|whatsapp|chat)\b/.test(normalized)) return 'channels';
  if (/\b(provider|model|llm|embedding|inference)\b/.test(normalized)) return 'providers';
  if (/\b(memory|recall|knowledge|rag|context)\b/.test(normalized)) return 'memory';
  if (/\b(sandbox|container|docker|wasm|microvm|isolation)\b/.test(normalized)) return 'sandbox';
  if (/\b(image|video|audio|voice|multimodal|vision)\b/.test(normalized)) return 'multimodal';
  if (/\b(security|policy|approval|receipt|redaction|secret)\b/.test(normalized)) return 'security';
  if (/\b(workflow|automation|task|scheduler|background)\b/.test(normalized)) return 'workflow';
  if (/\b(ui|ux|zavorthControl|tui|mobile|companion)\b/.test(normalized)) return 'ux';
  if (/\b(agent|swarm|subagent|orchestration|tool.call)\b/.test(normalized)) return 'agent-runtime';
  if (/\b(tool|mcp|plugin|skill|connector)\b/.test(normalized)) return 'tooling';
  return 'unknown';
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function safeEvidenceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    const keys: string[] = [];
    url.searchParams.forEach((_value, key) => keys.push(key));
    for (const key of keys) url.searchParams.set(key, '***');
    url.hash = '';
    return url.toString();
  } catch (error: any) { logger.warn('[Zavorth Innovation Radar] search failed', error); return null; }
}

function redact(value: unknown): string {
  return String(value || '')
    .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, '[REDACTED]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{6,}\b/g, '[REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{6,}\b/g, '[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{8,}\b/g, '[REDACTED]')
    .replace(/\b(token|secret|password|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .trim();
}

function safeError(error: unknown): string {
  return redact(error instanceof Error ? error.message : String(error || 'Unknown radar source error.'));
}

function safeId(value: unknown): string {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160);
}

function splitList(value: string | undefined): string[] {
  return String(value || '').split(/[,\n;]/).map((entry) => entry.trim()).filter(Boolean);
}

function tokens(value: string): string[] {
  return unique(safeId(value).split(/[-._]+/).filter((token) => token.length >= 3));
}

function overlap(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token)).length;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
