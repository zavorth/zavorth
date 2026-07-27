import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { config } from '../config/index.js';
import type { ZavorthOperationalMnemosUnifiedMemory } from '../contracts/ZavorthOperationalRefinementContract.js';
import { logger } from '../logger.js';

type MnemosUnifiedSourceId = ZavorthOperationalMnemosUnifiedMemory['sources'][number]['id'];

type MnemosUnifiedDocument = {
  id: string;
  source: MnemosUnifiedSourceId;
  title: string;
  path: string;
  body: string;
  hash: string;
};

type MnemosUnifiedRuntime = {
  projectRoot?: string;
  now?: () => Date;
};

export type ZavorthMnemosUnifiedMemoryInput = {
  apply?: boolean;
  limitPerSource?: number;
};

export type ZavorthMnemosUnifiedMemorySnapshot = ZavorthOperationalMnemosUnifiedMemory & {
  generatedAt: string;
  documents: MnemosUnifiedDocument[];
};

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bhf_[A-Za-z0-9]{12,}\b/g,
  /\bAIza[0-9A-Za-z_-]{16,}\b/g,
  /\b(?:api[_-]...key|token|secret|password|authorization)\s*[:=]\s*["']...[^"'\s,;]+/gi,
  /\b[A-Za-z0-9._%+-]+:[^@\s]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
];

const SOURCE_PATHS: Record<MnemosUnifiedSourceId, string[]> = {
  wiki: ['.zavorth/wiki'],
  sessions: ['.zavorth/sessions.json', '.zavorth/runtime/sessions.json', 'data/runtime/sessions.json'],
  receipts: ['.zavorth/receipts', 'data/receipts'],
  transactions: ['.zavorth/mutation-plans', '.zavorth/mutation-plane', '.zavorth/action-receipts.jsonl', '.zavorth/approvals'],
  chat: ['.zavorth/messages.json', '.zavorth/chat.jsonl', 'data/runtime/chat.jsonl'],
};

const TEXT_EXTENSIONS = new Set(['.json', '.jsonl', '.md', '.txt', '.log']);

export class ZavorthMnemosUnifiedMemoryService {
  private readonly projectRoot: string;
  private readonly now: () => Date;

  constructor(runtime: MnemosUnifiedRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ZavorthMnemosUnifiedMemoryInput = {}): ZavorthMnemosUnifiedMemorySnapshot {
    const generatedAt = this.now().toISOString();
    const limitPerSource = Math.max(1, Math.min(250, Number(input.limitPerSource || 50)));
    const documents = (Object.keys(SOURCE_PATHS) as MnemosUnifiedSourceId[])
      .flatMap((source) => this.collectSource(source, limitPerSource));
    const sources = (Object.keys(SOURCE_PATHS) as MnemosUnifiedSourceId[]).map((source) => {
      const count = documents.filter((doc) => doc.source === source).length;
      return {
        id: source,
        status: count > 0 ? 'ready' as const : 'partial' as const,
        documents: count,
        summary: count > 0
          ? `${count} redacted document(s) available for unified recall.`
          : 'No local artifact was found yet; this source will populate after normal use.',
      };
    });
    const outputPath = this.outputPath();
    const applyPerformed = input.apply === true;

    if (applyPerformed) {
      this.writeUnifiedStore({ generatedAt, documents, outputPath });
    }

    return {
      generatedAt,
      status: documents.length > 0 ? 'ready' : 'partial',
      sources,
      outputPath,
      documentsIndexed: documents.length,
      documents,
      applyPerformed,
      safety: {
        providerCall: false,
        networkCall: false,
        secretsRedacted: true,
        rawSecretsSerialized: false,
      },
    };
  }

  public renderText(snapshot: ZavorthMnemosUnifiedMemorySnapshot): string {
    return [
      '[zavorth-mnemos-unified-memory]',
      `status=${snapshot.status} documents=${snapshot.documentsIndexed} apply=${snapshot.applyPerformed ? 'yes' : 'no'}`,
      `output=${snapshot.outputPath}`,
      ...snapshot.sources.map((source) => `- ${source.id}: ${source.status} (${source.documents}) ${source.summary}`),
      '',
    ].join('\n');
  }

  private collectSource(source: MnemosUnifiedSourceId, limit: number): MnemosUnifiedDocument[] {
    const files = SOURCE_PATHS[source]
      .flatMap((entry) => this.collectFiles(entry))
      .slice(0, limit);
    return files.flatMap((filePath) => {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const body = redact(raw).slice(0, 12_000);
        const relative = normalizePath(path.relative(this.projectRoot, filePath));
        return [{
          id: `${source}:${hash(`${relative}:${body}`).slice(0, 16)}`,
          source,
          title: path.basename(filePath),
          path: relative,
          body,
          hash: hash(body),
        }];
      } catch (error: unknown) {logger.warn('[Zavorth Mnemos Unified Memory] operation failed', error); return []; }
    });
  }

  private collectFiles(inputPath: string): string[] {
    const absolute = this.resolveInsideRoot(inputPath);
    if (!absolute || !fs.existsSync(absolute)) return [];
    const stat = fs.statSync(absolute);
    if (stat.isFile()) {
      return TEXT_EXTENSIONS.has(path.extname(absolute).toLowerCase()) ? [absolute] : [];
    }
    if (!stat.isDirectory()) return [];
    const output: string[] = [];
    const visit = (dir: string): void => {
      if (output.length >= 250) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const child = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          visit(child);
        } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          output.push(child);
        }
      }
    };
    visit(absolute);
    return output;
  }

  private writeUnifiedStore(input: {
    generatedAt: string;
    documents: MnemosUnifiedDocument[];
    outputPath: string;
  }): void {
    fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
    const lines = input.documents.map((document) => JSON.stringify({
      ...document,
      indexedAt: input.generatedAt,
    }));
    fs.writeFileSync(input.outputPath, `${lines.join('\n')}${lines.length ? '\n' : ''}`, 'utf8');
    fs.writeFileSync(
      path.join(path.dirname(input.outputPath), 'unified-memory-snapshot.json'),
      `${JSON.stringify({
        generatedAt: input.generatedAt,
        documents: input.documents.length,
        sources: [...new Set(input.documents.map((doc) => doc.source))],
        outputPath: input.outputPath,
        rawSecretsSerialized: false,
      }, null, 2)}\n`,
      'utf8',
    );
  }

  private outputPath(): string {
    return path.join(this.projectRoot, '.zavorth', 'memory', 'unified-memory.jsonl');
  }

  private resolveInsideRoot(inputPath: string): string | null {
    const absolute = path.resolve(this.projectRoot, inputPath);
    const relative = path.relative(this.projectRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return absolute;
  }
}

function redact(value: string): string {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED_SECRET]'), String(value || ''));
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}
