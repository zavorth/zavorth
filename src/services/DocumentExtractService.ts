import { DOCUMENT_EXTRACT_CONTRACT_VERSION } from '../contracts/DocumentExtractContract.js';

import type {
  DocumentExtractRequest,
  DocumentExtractResult,
  DocumentExtractTable,
} from '../contracts/DocumentExtractContract.js';

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { config } from '../config/index.js';
import { LocalDocumentTextExtractionAdapter } from '../adapters/files/FileDocumentDiffLiveAdapters.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type DocumentExtractServiceOptions = {
  artifactDir?: string;
  workspaceRoots?: string[];
  now?: () => Date;
  adapter?: LocalDocumentTextExtractionAdapter;
};

export type DocumentExtractLiveRequest = DocumentExtractRequest & {
  allowedRoots?: string[];
  outputDir?: string | null;
};

export class DocumentExtractService {
  private readonly artifactDir: string;
  private readonly workspaceRoots: string[];
  private readonly now: () => Date;
  private readonly adapter: LocalDocumentTextExtractionAdapter;

  constructor(options: DocumentExtractServiceOptions = {}) {
    this.artifactDir = options.artifactDir || path.join(config.dataDir, 'artifacts', 'document-extract');
    this.workspaceRoots = options.workspaceRoots || [process.cwd(), config.dataDir];
    this.now = options.now || (() => new Date());
    this.adapter = options.adapter || new LocalDocumentTextExtractionAdapter();
  }

  public extract(request: DocumentExtractRequest): DocumentExtractResult {
    const processedAt = this.now().toISOString();
    const sourceId = this.normalizeId(request.source.artifactId || request.source.storageRef);
    const mode = request.mode || 'full';

    return {
      ok: true,
      contractVersion: DOCUMENT_EXTRACT_CONTRACT_VERSION,
      text: mode === 'tables' ? '' : `Dry document extraction plan for ${request.source.storageRef}.`,
      tables: mode === 'text' || mode === 'metadata'
        ? []
        : [
          {
            tableId: `table.${sourceId}.1`,
            rows: [['column', 'value']],
            caption: 'Dry-run table extraction placeholder.',
          },
        ],
      metadata: {
        mode,
        contentType: request.source.contentType || 'application/octet-stream',
        dryRun: true,
      },
      outputArtifactId: `document.extracted.${sourceId}`,
      policyDecision: {
        allowed: true,
        reason: 'Document extraction is artifact-first and redaction-aware.',
        piiDetected: false,
        redactionApplied: false,
      },
      receiptId: `document.extract.${sourceId}.receipt`,
      processedAt,
      error: null,
    };
  }

  public async extractLive(request: DocumentExtractLiveRequest): Promise<DocumentExtractResult> {
    const processedAt = this.now().toISOString();
    const sourceId = this.normalizeId(request.source.artifactId || path.basename(request.source.storageRef) || request.source.storageRef);
    const mode = request.mode || 'full';
    const roots = this.allowedRoots(request.allowedRoots);
    const sourcePath = this.resolveSourcePath(request.source.storageRef, roots);
    const outputDir = path.resolve(request.outputDir || this.artifactDir);
    const policyDecision = {
      allowed: Boolean(
        sourcePath
        && this.isWithinRoots(sourcePath, roots)
        && this.isWithinRoots(outputDir, roots)
        && fs.existsSync(sourcePath),
      ),
      reason: sourcePath && this.isWithinRoots(outputDir, roots)
        ? 'document.extract approved for local artifact/workspace read.'
        : 'document.extract live execution requires a local artifact/workspace file.',
      piiDetected: false,
      redactionApplied: false,
    };

    if (!policyDecision.allowed || !sourcePath) {
      return {
        ok: false,
        contractVersion: DOCUMENT_EXTRACT_CONTRACT_VERSION,
        text: '',
        tables: [],
        metadata: {
          mode,
          dryRun: false,
        },
        outputArtifactId: null,
        policyDecision,
        receiptId: `document.extract.${sourceId}.receipt`,
        processedAt,
        error: policyDecision.reason,
      };
    }

    try {
      const bytes = await fs.promises.readFile(sourcePath);
      const contentType = this.resolveContentType(request.source.contentType, sourcePath);
      const extracted = await this.extractByFormat({
        bytes,
        contentType,
        fileName: sourcePath,
      });
      const tables = mode === 'text' || mode === 'metadata'
        ? []
        : extracted.tables;
      const text = mode === 'tables' || mode === 'metadata'
        ? ''
        : extracted.text;
      const metadata = {
        ...extracted.metadata,
        mode,
        contentType,
        storageRef: this.redactPath(sourcePath),
        bytes: bytes.length,
        dryRun: false,
        tables: tables.length,
        secretValuesSerialized: false,
      };
      const outputArtifactId = await this.storeExtractionArtifact({
        outputDir,
        sourceId,
        text: extracted.text,
        tables: extracted.tables,
        metadata,
      });

      return {
        ok: true,
        contractVersion: DOCUMENT_EXTRACT_CONTRACT_VERSION,
        text,
        tables,
        metadata,
        outputArtifactId,
        policyDecision,
        receiptId: `${outputArtifactId}.receipt`,
        processedAt,
        error: null,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Document Extract] operation failed', error);
    return {
        ok: false,
        contractVersion: DOCUMENT_EXTRACT_CONTRACT_VERSION,
        text: '',
        tables: [],
        metadata: {
          mode,
          dryRun: false,
        },
        outputArtifactId: null,
        policyDecision,
        receiptId: `document.extract.${sourceId}.receipt`,
        processedAt,
        error: error instanceof Error ? err.message : String(error),
      };
  }
  }

  private async extractByFormat(input: {
    bytes: Buffer;
    contentType: string;
    fileName: string;
  }): Promise<{
    text: string;
    tables: DocumentExtractTable[];
    metadata: Record<string, unknown>;
  }> {
    const contentType = input.contentType.toLowerCase();
    const fileName = input.fileName.toLowerCase();
    if (contentType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
      return this.extractDocx(input.bytes);
    }

    const base = this.adapter.extractText(input);
    const tables = contentType.includes('html') || fileName.endsWith('.html') || fileName.endsWith('.htm')
      ? this.extractHtmlTables(input.bytes.toString('utf8'))
      : this.extractTextTables(base.text);
    return {
      text: base.text,
      tables,
      metadata: base.metadata,
    };
  }

  private async extractDocx(bytes: Buffer): Promise<{
    text: string;
    tables: DocumentExtractTable[];
    metadata: Record<string, unknown>;
  }> {
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await (zip.file('word/document.xml')?.async('string') || Promise.resolve(''));
    const paragraphs = [...documentXml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)]
      .map((match) => this.cleanText(match[0].replace(/<[^>]+>/g, ' ')))
      .filter(Boolean);
    const tables = [...documentXml.matchAll(/<w:tbl[\s\S]*?<\/w:tbl>/g)].map((tableMatch, index) => {
      const rows = [...tableMatch[0].matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)].map((rowMatch) =>
        [...rowMatch[0].matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)]
          .map((cellMatch) => this.cleanText(cellMatch[0].replace(/<[^>]+>/g, ' ')))
          .filter((cell) => cell.length > 0));
      return {
        tableId: `table.docx.${index + 1}`,
        rows: rows.filter((row) => row.length > 0),
        caption: null,
      };
    }).filter((table) => table.rows.length > 0);

    return {
      text: this.cleanText(paragraphs.join('\n')),
      tables,
      metadata: {
        extractor: 'document-text-extractor',
        format: 'docx',
        parser: 'docx-xml-baseline',
      },
    };
  }

  private extractHtmlTables(html: string): DocumentExtractTable[] {
    return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((tableMatch, tableIndex) => {
      const rows = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((rowMatch) =>
        [...rowMatch[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
          .map((cellMatch) => this.cleanText(cellMatch[1].replace(/<[^>]+>/g, ' ')))
          .filter(Boolean));
      const caption = tableMatch[0].match(/<caption[^>]*>([\s\S]*?)<\/caption>/i)?.[1] || null;
      return {
        tableId: `table.html.${tableIndex + 1}`,
        rows: rows.filter((row) => row.length > 0),
        caption: caption ? this.cleanText(caption) : null,
      };
    }).filter((table) => table.rows.length > 0);
  }

  private extractTextTables(text: string): DocumentExtractTable[] {
    const pipeRows = text.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('|') && line.endsWith('|'))
      .map((line) => line.split('|').slice(1, -1).map((cell) => this.cleanText(cell)));
    return pipeRows.length > 0
      ? [{
        tableId: 'table.text.1',
        rows: pipeRows,
        caption: null,
      }]
      : [];
  }

  private async storeExtractionArtifact(input: {
    outputDir: string;
    sourceId: string;
    text: string;
    tables: DocumentExtractTable[];
    metadata: Record<string, unknown>;
  }): Promise<string> {
    const outputDir = path.resolve(input.outputDir);
    await fs.promises.mkdir(outputDir, { recursive: true });
    const artifactId = `document.extracted.${input.sourceId}.${randomUUID()}`;
    await fs.promises.writeFile(
      path.join(outputDir, `${artifactId}.json`),
      JSON.stringify({
        artifactId,
        text: input.text,
        tables: input.tables,
        metadata: input.metadata,
        generatedAt: this.now().toISOString(),
        secretValuesSerialized: false,
      }, null, 2),
      'utf8',
    );
    return artifactId;
  }

  private resolveSourcePath(storageRef: string, roots: string[]): string | null {
    const normalized = String(storageRef || '').trim();
    if (!normalized || /^https?:\/\//i.test(normalized) || /^artifact:\/\//i.test(normalized)) {
      return null;
    }
    const root = roots[0] || process.cwd();
    return path.resolve(path.isAbsolute(normalized) ? normalized : path.join(root, normalized));
  }

  private resolveContentType(contentType: string | null, fileName: string): string {
    const normalized = String(contentType || '').trim().toLowerCase();
    if (normalized) return normalized;
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === '.html' || ext === '.htm') return 'text/html';
    if (ext === '.json') return 'application/json';
    if (ext === '.md') return 'text/markdown';
    return 'text/plain';
  }

  private allowedRoots(extraRoots: string[] | undefined): string[] {
    return [...this.workspaceRoots, this.artifactDir, ...(extraRoots || [])]
      .map((root) => path.resolve(root));
  }

  private isWithinRoots(candidate: string, roots: string[]): boolean {
    const resolved = path.resolve(candidate);
    return roots.some((root) => {
      const normalizedRoot = path.resolve(root);
      const relative = path.relative(normalizedRoot, resolved);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
  }

  private redactPath(value: string): string {
    return path.basename(value);
  }

  private cleanText(value: string): string {
    return value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeId(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'document';
  }
}
