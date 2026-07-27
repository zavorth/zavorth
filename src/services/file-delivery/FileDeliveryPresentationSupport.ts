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

    const intro = options?.intro || (options?.mentionFallback ? `I could not find an exact match. These are some options in ${rootLabel}:` : `I found several options in ${rootLabel}.`);
    const closingLine = options?.closingLine || (options?.selectionAction === 'list' ? 'Reply with the number of the folder you want to open.' : 'Reply with the number of the option you want to receive.');
    return { kind: 'choices', entries, prompt: [intro, '', ...entries.map((entry, index) => this.formatChoiceLine(entry, index)), '', closingLine].join('\n') };
  }

  public async createSendPlan(entry: FileDeliveryEntry, shouldSkipAbsolutePath: (absolutePath: string, isDirectoryHint?: boolean) => boolean): Promise<FileDeliveryPlan> {
    if (entry.isDirectory) {
      const previewText = await this.buildDirectoryPreviewText(entry, shouldSkipAbsolutePath);
      const archivePath = await this.archiveSupport.buildDirectoryArchive(entry, shouldSkipAbsolutePath);
      const archiveStats = await fs.promises.stat(archivePath);
      if (archiveStats.size > MAX_TELEGRAM_DOCUMENT_BYTES) {
        await fs.promises.rm(archivePath, { force: true });
        return { kind: 'message', text: `The folder ${entry.baseName} is too large to send (${this.formatBytes(archiveStats.size)}).` };
      }

      return { kind: 'send', entry, sendPath: archivePath, fileName: `${entry.baseName}.zip`, caption: `Compressed folder: ${entry.baseName}`, previewText, cleanupPath: archivePath };
    }

    const fileStats = await fs.promises.stat(entry.absolutePath);
    if (fileStats.size > MAX_TELEGRAM_DOCUMENT_BYTES) {
      return { kind: 'message', text: `The file ${entry.baseName} is too large for direct delivery (${this.formatBytes(fileStats.size)}).` };
    }

    return { kind: 'send', entry, sendPath: entry.absolutePath, fileName: entry.baseName, caption: `File sent: ${entry.baseName}`, previewText: this.buildFilePreviewText(entry) };
  }

  public buildFilePreviewText(entry: FileDeliveryEntry): string {
    return ['I found this file:', `Name: ${entry.baseName}`, `Type: ${this.describeFileKind(entry)}`, `Size: ${this.formatBytes(entry.sizeBytes)}`, `Modified: ${this.formatDateTime(entry.modifiedAtMs)}`, `local: ${entry.rootLabel}/${entry.relativePath}`].join('\n');
  }

  public async buildDirectoryPreviewText(entry: FileDeliveryEntry, shouldSkipAbsolutePath: (absolutePath: string, isDirectoryHint?: boolean) => boolean): Promise<string> {
    const visibleItems = (
      await fs.promises.readdir(entry.absolutePath, { withFileTypes: true })
    ).filter(
      (child) =>
        !child.name.startsWith('.')
        && !shouldSkipAbsolutePath(path.join(entry.absolutePath, child.name), child.isDirectory()),
    ).length;
    return ['I will compress this folder for sending:', `Name: ${entry.baseName}`, `Visible items: ${visibleItems}`, `Modified: ${this.formatDateTime(entry.modifiedAtMs)}`, `local: ${entry.rootLabel}/${entry.relativePath}`].join('\n');
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
      case '.jsx': return 'code';
      case '.json': return 'json';
      case '.md': return 'markdown';
      case '.png':
      case '.jpg':
      case '.gif': return 'imagem';
      case '.docx': return 'documento';
      case '.xlsx':
      case '.csv': return 'planilha';
      case '.zip': return 'zip';
      case '.txt': return 'text';
      default: return 'file';
    }
  }

  private formatChoiceLine(entry: FileDeliveryEntry, index: number): string {
    const kindLabel = entry.isDirectory ? 'folder' : this.describeFileKind(entry);
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
