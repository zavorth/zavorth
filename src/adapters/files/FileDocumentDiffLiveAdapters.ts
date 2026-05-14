import { createTwoFilesPatch } from 'diff';
import fs from 'node:fs';

export type FileTransferAdapterOperation = 'copy' | 'move';

export type FileTransferAdapterResult = {
  operation: FileTransferAdapterOperation;
  bytesTransferred: number;
};

export class LocalFileTransferAdapter {
  public readonly adapterId = 'local-filesystem-transfer';

  public async transfer(input: {
    sourcePath: string;
    destinationPath: string;
    overwrite: boolean;
    operation: FileTransferAdapterOperation;
  }): Promise<FileTransferAdapterResult> {
    const stats = await fs.promises.stat(input.sourcePath);
    if (!input.overwrite && fs.existsSync(input.destinationPath)) {
      throw new Error(`Destination already exists: ${input.destinationPath}`);
    }
    if (input.operation === 'move') {
      await fs.promises.rename(input.sourcePath, input.destinationPath);
    } else {
      await fs.promises.copyFile(input.sourcePath, input.destinationPath);
    }
    return {
      operation: input.operation,
      bytesTransferred: stats.size,
    };
  }
}

export type DocumentExtractionAdapterOutput = {
  text: string;
  metadata: Record<string, unknown>;
};

export class LocalDocumentTextExtractionAdapter {
  public readonly adapterId = 'document-text-extractor';

  public extractText(input: {
    contentType: string;
    fileName: string;
    bytes: Buffer;
  }): DocumentExtractionAdapterOutput {
    const contentType = input.contentType.toLowerCase();
    const fileName = input.fileName.toLowerCase();
    if (contentType.includes('pdf') || fileName.endsWith('.pdf')) {
      return this.extractPdf(input.bytes);
    }
    if (contentType.includes('html') || fileName.endsWith('.html') || fileName.endsWith('.htm')) {
      return this.extractHtml(input.bytes.toString('utf8'));
    }
    return {
      text: this.cleanText(input.bytes.toString('utf8')),
      metadata: {
        extractor: this.adapterId,
        format: 'text',
      },
    };
  }

  private extractHtml(html: string): DocumentExtractionAdapterOutput {
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null;
    const text = this.cleanText(html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '));
    return {
      text,
      metadata: {
        extractor: this.adapterId,
        format: 'html',
        title: title ? this.cleanText(title) : null,
      },
    };
  }

  private extractPdf(bytes: Buffer): DocumentExtractionAdapterOutput {
    const raw = bytes.toString('latin1');
    const title = raw.match(/\/Title\s*\(([^)]*)\)/)?.[1] || null;
    const strings = [...raw.matchAll(/\(([^()]{2,})\)/g)]
      .map((match) => this.cleanText(match[1]))
      .filter((value) => /[A-Za-z0-9]/.test(value));
    const pageMatches = raw.match(/\/Type\s*\/Page\b/g) || [];
    return {
      text: this.cleanText(strings.join('\n') || raw.replace(/[^\x20-\x7E\r\n\t]+/g, ' ')),
      metadata: {
        extractor: this.adapterId,
        format: 'pdf',
        title: title ? this.cleanText(title) : null,
        pagesDetected: pageMatches.length,
        parser: 'baseline-literal-text',
      },
    };
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
}

export class LocalArtifactDiffAdapter {
  public readonly adapterId = 'artifact-diff-engine';

  public createPatch(input: {
    leftLabel: string;
    rightLabel: string;
    leftText: string;
    rightText: string;
  }): string {
    return createTwoFilesPatch(input.leftLabel, input.rightLabel, input.leftText, input.rightText, '', '', {
      context: 3,
    });
  }
}
