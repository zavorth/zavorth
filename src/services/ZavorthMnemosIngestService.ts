import fs from 'node:fs';
import path from 'node:path';
import {
  ZAVORTH_MNEMOS_INGEST_VERSION,
  type ZavorthMnemosIngestPatch,
  type ZavorthMnemosIngestSnapshot,
  type ZavorthMnemosIngestSource,
  type ZavorthMnemosIngestTargetPage,
} from '../contracts/ZavorthMnemosIngestContract.js';

type ZavorthMnemosIngestRuntime = {
  now?: () => Date;
  projectRoot?: string;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

type ZavorthMnemosIngestInput = {
  sourcePaths?: string[];
  apply?: boolean;
  approvalId?: string | null;
  maxSourceBytes?: number;
};

const DEFAULT_SOURCE_PATHS = [
  'docs/mnemos-memory-os.md',
  'README.md',
];

const PAGE_KEYWORDS: Record<ZavorthMnemosIngestTargetPage, RegExp[]> = {
  architecture: [/architecture|runtime|gateway|agent os|policy/i],
  dependencies: [/dependency|dependencies|package|provider sdk|typescript|node/i],
  memory: [/mnemos|memory|compaction|handoff|wiki|context/i],
  operations: [/operator|readiness|approval|zavorthControl|telegram|remote|daily/i],
  providers: [/provider|model|gemini|openai|routing|live proof|media/i],
  skills: [/skill|curator|capability|tool|workflow/i],
};

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bhf_[A-Za-z0-9]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\b(?:api[_-]...key|token|secret|password)\s*[:=]\s*["']...[^"'\s]+/gi,
];

function redact(value: string): string {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED_SECRET]'), String(value || ''));
}

function compact(value: string): string {
  return redact(value).replace(/\s+/g, ' ').trim();
}

function stableId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeApprovalId(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export class ZavorthMnemosIngestService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  constructor(runtime: ZavorthMnemosIngestRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public buildSnapshot(input: ZavorthMnemosIngestInput = {}): ZavorthMnemosIngestSnapshot {
    const generatedAt = this.now().toISOString();
    const maxSourceBytes = Math.max(1024, Math.min(Number(input.maxSourceBytes || 128 * 1024), 512 * 1024));
    const sourcePaths = (input.sourcePaths && input.sourcePaths.length ? input.sourcePaths : DEFAULT_SOURCE_PATHS)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    const sources = sourcePaths.map((sourcePath) => this.readSource(sourcePath, maxSourceBytes));
    const patches = this.buildPatches(sources);
    const applyRequested = input.apply === true;
    const approvalId = normalizeApprovalId(input.approvalId);
    const approvalSatisfied = Boolean(approvalId);
    const blockers: string[] = [];
    if (applyRequested && !approvalSatisfied) {
      blockers.push('approval-id-required');
    }
    if (sources.length === 0) {
      blockers.push('no-readable-sources');
    }
    const canApply = applyRequested && approvalSatisfied && blockers.length === 0;
    const mutatedFiles = canApply ? this.applyPatches(patches) : [];

    return {
      version: ZAVORTH_MNEMOS_INGEST_VERSION,
      generatedAt,
      status: canApply ? 'applied' : blockers.length ? 'blocked' : 'preview-ready',
      mode: applyRequested ? 'apply' : 'preview',
      sources,
      patches,
      apply: {
        requested: applyRequested,
        applied: canApply,
        approvalRequired: applyRequested,
        approvalSatisfied,
        approvalId,
        mutatedFiles,
        blockers,
      },
      safety: {
        workspaceConfined: true,
        maxSourceBytes,
        providerCall: false,
        networkCall: false,
        secretsRedacted: true,
        patchPreviewOnlyByDefault: true,
      },
      receipt: {
        id: `mnemos-ingest-${stableId(`${generatedAt}:${sourcePaths.join('|')}:${patches.length}:${canApply}`)}`,
        providerCall: false,
        durableMutation: canApply,
        approvalId,
      },
    };
  }

  private readSource(sourcePath: string, maxSourceBytes: number): ZavorthMnemosIngestSource {
    const absolutePath = this.resolveWorkspacePath(sourcePath);
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      throw new Error(`Mnemos ingest source is not a file: ${sourcePath}`);
    }
    if (stat.size > maxSourceBytes) {
      throw new Error(`Mnemos ingest source exceeds maxSourceBytes: ${sourcePath}`);
    }
    const raw = String(this.readFileSyncImpl(absolutePath, 'utf8'));
    const title = this.extractTitle(raw) || path.basename(sourcePath);
    const excerpt = compact(raw).slice(0, 600);
    const signals = this.extractSignals(raw);
    const extension = path.extname(sourcePath).toLowerCase();
    const kind = extension === '.md' ? 'markdown' : extension === '.json' ? 'json' : 'text';

    return {
      path: path.relative(this.projectRoot, absolutePath).replace(/\\/g, '/'),
      bytes: stat.size,
      kind,
      title,
      excerpt,
      signals,
    };
  }

  private buildPatches(sources: ZavorthMnemosIngestSource[]): ZavorthMnemosIngestPatch[] {
    const patches: ZavorthMnemosIngestPatch[] = [];
    for (const source of sources) {
      const pages = this.resolveImpactedPages(source);
      for (const pageId of pages) {
        const pagePath = `.zavorth/wiki/${pageId}.md`;
        patches.push({
          pageId,
          pagePath,
          action: 'append-source-note',
          summary: `Add source note from ${source.path} to ${pageId}.`,
          preview: [
            '',
            '## Ingest Notes',
            '',
            `- Source: \`${source.path}\``,
            `- Title: ${source.title}`,
            `- Signals: ${source.signals.join(', ') || 'general'}`,
            `- Excerpt: ${source.excerpt}`,
          ].join('\n'),
        });
      }
    }
    return patches;
  }

  private applyPatches(patches: ZavorthMnemosIngestPatch[]): string[] {
    const mutated = new Set<string>();
    for (const patch of patches) {
      const target = this.resolveWorkspacePath(patch.pagePath);
      const current = String(this.readFileSyncImpl(target, 'utf8'));
      if (current.includes(patch.preview.trim())) {
        continue;
      }
      this.writeFileSyncImpl(target, `${current.replace(/\s+$/g, '')}\n${patch.preview}\n`, 'utf8');
      mutated.add(patch.pagePath);
    }
    return Array.from(mutated);
  }

  private resolveImpactedPages(source: ZavorthMnemosIngestSource): ZavorthMnemosIngestTargetPage[] {
    const haystack = `${source.title} ${source.excerpt} ${source.signals.join(' ')}`;
    const pages = (Object.keys(PAGE_KEYWORDS) as ZavorthMnemosIngestTargetPage[])
      .filter((pageId) => PAGE_KEYWORDS[pageId].some((pattern) => pattern.test(haystack)));
    return pages.length ? pages : ['memory'];
  }

  private extractTitle(raw: string): string | null {
    const frontmatterTitle = raw.match(/^title:\s*(.+)$/m)?.[1];
    const headingTitle = raw.match(/^#\s+(.+)$/m)?.[1];
    return compact(frontmatterTitle || headingTitle || '').slice(0, 120) || null;
  }

  private extractSignals(raw: string): string[] {
    const signals = new Set<string>();
    const text = raw.toLowerCase();
    for (const [pageId, patterns] of Object.entries(PAGE_KEYWORDS)) {
      if (patterns.some((pattern) => pattern.test(text))) {
        signals.add(pageId);
      }
    }
    return Array.from(signals).slice(0, 12);
  }

  private resolveWorkspacePath(inputPath: string): string {
    const normalized = String(inputPath || '').trim();
    if (!normalized) {
      throw new Error('Mnemos ingest path is required');
    }
    const absolute = path.resolve(this.projectRoot, normalized);
    const relative = path.relative(this.projectRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Mnemos ingest path escapes workspace: ${inputPath}`);
    }
    return absolute;
  }
}
