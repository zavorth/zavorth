import * as fs from 'fs';
import * as path from 'path';

export type PreviewFilePayload = {
  path: string;
  content: string;
  truncated: boolean;
};

export type PreviewAssetPayload = {
  path: string;
  filename: string;
  content: Buffer;
  contentType: string;
  size: number;
};

export class WebConsolePreviewFileService {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  public readPreviewFile(targetPath: string): PreviewFilePayload {
    const { normalized, resolved } = this.resolveWorkspaceFile(targetPath);

    const extension = path.extname(resolved).toLowerCase();
    if (!this.isTextPreviewExtension(extension)) {
      throw new Error('Preview unavailable for this file type.');
    }

    const content = fs.readFileSync(resolved, 'utf8');
    const maxChars = 6000;
    return {
      path: normalized,
      content: content.slice(0, maxChars),
      truncated: content.length > maxChars,
    };
  }

  public readPreviewAsset(targetPath: string): PreviewAssetPayload {
    const { normalized, resolved } = this.resolveWorkspaceFile(targetPath);
    const extension = path.extname(resolved).toLowerCase();
    const contentType = this.resolveAssetContentType(extension);
    if (!contentType) {
      throw new Error('Visual preview unavailable for this file type.');
    }

    const stat = fs.statSync(resolved);
    const maxBytes = 15 * 1024 * 1024;
    if (stat.size > maxBytes) {
      throw new Error('File is too large for zavorthControl preview.');
    }

    return {
      path: normalized,
      filename: path.basename(resolved),
      content: fs.readFileSync(resolved),
      contentType,
      size: stat.size,
    };
  }

  private resolveWorkspaceFile(targetPath: string): { normalized: string; resolved: string } {
    const normalized = String(targetPath || '').trim();
    const root = path.resolve(this.workspaceRoot);
    const resolved = path.isAbsolute(normalized)
      ? path.resolve(normalized)
      : path.resolve(root, normalized.replace(/^[/\\]+/, ''));

    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error('That file is outside the Zavorth workspace.');
    }

    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      throw new Error('File not found for preview.');
    }

    return { normalized, resolved };
  }

  private isTextPreviewExtension(extension: string): boolean {
    return [
      '.txt',
      '.md',
      '.json',
      '.csv',
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.py',
      '.html',
      '.css',
      '.yml',
      '.yaml',
      '.toml',
      '.ini',
      '.log',
      '.sql',
      '.xml',
      '.sh',
      '.ps1',
    ].includes(String(extension || '').toLowerCase());
  }

  private resolveAssetContentType(extension: string): string | null {
    switch (String(extension || '').toLowerCase()) {
      case '.pdf':
        return 'application/pdf';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.svg':
        return 'image/svg+xml';
      default:
        return null;
    }
  }
}
