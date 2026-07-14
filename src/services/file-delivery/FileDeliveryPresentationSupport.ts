import fs from 'fs';
import path from 'path';
import type { FileDeliveryArchiveSupport } from './FileDeliveryArchiveSupport.js';
import type {
  FileDeliveryEntry,
  FileDeliveryPlan,
  PendingSelection,
  SelectionAction,
} from './FileDeliveryTypes.js';
import { MAX_TELEGRAM_DOCUMENT_BYTES } from './FileDeliveryTypes.js';

export class FileDeliveryPresentationSupport {
  constructor(
    private readonly pendingSelections: Map<string, PendingSelection>,
    private readonly archiveSupport: FileDeliveryArchiveSupport,
  ) {}

  public createChoicesPlan(
    userId: string,
    rawRequest: string,
    rootLabel: string,
    entries: FileDeliveryEntry[],
    options?: { mentionFallback?: boolean; selectionAction?: SelectionAction; intro?: string; closingLine?: string },
  ): FileDeliveryPlan {
    this.pendingSelections.set(userId, {
      createdAtMs: Date.now(),
      entries,
      originalRequest: rawRequest,
      selectionAction: options?.selectionAction || 'send',
    });

    const intro = options?.intro || (options?.mentionFallback ? `Nao encontrei uma correspondencia exata. Estas sao algumas opcoes em ${rootLabel}:` : `Encontrei varias opcoes em ${rootLabel}.`);
    const closingLine = options?.closingLine || (options?.selectionAction === 'list' ? 'Responda com o numero da pasta que voce quer abrir.' : 'Responda com o numero da opcao que voce quer receber.');
    return { kind: 'choices', entries, prompt: [intro, '', ...entries.map((entry, index) => this.formatChoiceLine(entry, index)), '', closingLine].join('\n') };
  }

  public async createSendPlan(entry: FileDeliveryEntry, shouldSkipAbsolutePath: (absolutePath: string, isDirectoryHint?: boolean) => boolean): Promise<FileDeliveryPlan> {
    if (entry.isDirectory) {
      const previewText = await this.buildDirectoryPreviewText(entry, shouldSkipAbsolutePath);
      const archivePath = await this.archiveSupport.buildDirectoryArchive(entry, shouldSkipAbsolutePath);
      const archiveStats = await fs.promises.stat(archivePath);
      if (archiveStats.size > MAX_TELEGRAM_DOCUMENT_BYTES) {
        await fs.promises.rm(archivePath, { force: true });
        return { kind: 'message', text: `A pasta ${entry.baseName} ficou grande demais para envio (${this.formatBytes(archiveStats.size)}).` };
      }

      return { kind: 'send', entry, sendPath: archivePath, fileName: `${entry.baseName}.zip`, caption: `Pasta compactada: ${entry.baseName}`, previewText, cleanupPath: archivePath };
    }

    const fileStats = await fs.promises.stat(entry.absolutePath);
    if (fileStats.size > MAX_TELEGRAM_DOCUMENT_BYTES) {
      return { kind: 'message', text: `O arquivo ${entry.baseName} e grande demais para envio direto (${this.formatBytes(fileStats.size)}).` };
    }

    return { kind: 'send', entry, sendPath: entry.absolutePath, fileName: entry.baseName, caption: `Arquivo enviado: ${entry.baseName}`, previewText: this.buildFilePreviewText(entry) };
  }

  public buildFilePreviewText(entry: FileDeliveryEntry): string {
    return ['I found este arquivo:', `Nome: ${entry.baseName}`, `Tipo: ${this.describeFileKind(entry)}`, `Tamanho: ${this.formatBytes(entry.sizeBytes)}`, `Modificado: ${this.formatDateTime(entry.modifiedAtMs)}`, `Local: ${entry.rootLabel}/${entry.relativePath}`].join('\n');
  }

  public async buildDirectoryPreviewText(entry: FileDeliveryEntry, shouldSkipAbsolutePath: (absolutePath: string, isDirectoryHint?: boolean) => boolean): Promise<string> {
    const visibleItems = (
      await fs.promises.readdir(entry.absolutePath, { withFileTypes: true })
    ).filter(
      (child) =>
        !child.name.startsWith('.')
        && !shouldSkipAbsolutePath(path.join(entry.absolutePath, child.name), child.isDirectory()),
    ).length;
    return ['Vou compactar esta pasta para enviar:', `Nome: ${entry.baseName}`, `Itens visiveis: ${visibleItems}`, `Modificado: ${this.formatDateTime(entry.modifiedAtMs)}`, `Local: ${entry.rootLabel}/${entry.relativePath}`].join('\n');
  }

  public describeFileKind(entry: FileDeliveryEntry): string {
    switch (entry.extension) {
      case '.pdf': return 'pdf';
      case '.html':
      case '.htm': return 'html';
      case '.css': return 'css';
      case '.js':
      case '.ts':
      case '.tsx':
      case '.jsx': return 'codigo';
      case '.json': return 'json';
      case '.md': return 'markdown';
      case '.png':
      case '.jpg':
      case '.gif': return 'imagem';
      case '.docx': return 'documento';
      case '.xlsx':
      case '.csv': return 'planilha';
      case '.zip': return 'zip';
      case '.txt': return 'texto';
      default: return 'arquivo';
    }
  }

  private formatChoiceLine(entry: FileDeliveryEntry, index: number): string {
    const kindLabel = entry.isDirectory ? 'pasta' : this.describeFileKind(entry);
    const metadata = [!entry.isDirectory ? this.formatBytes(entry.sizeBytes) : null, `modificado ${this.formatDateTime(entry.modifiedAtMs)}`, entry.relativePath].filter(Boolean);
    return `${index + 1}. [${kindLabel}] ${entry.baseName} - ${metadata.join(' - ')}`;
  }

  private formatBytes(sizeBytes: number): string {
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private formatDateTime(timestampMs: number): string {
    return new Date(timestampMs).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
  }
}
