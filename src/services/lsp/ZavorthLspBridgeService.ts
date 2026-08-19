export type SupportedLspLanguage = 'typescript' | 'javascript' | 'python' | 'rust' | 'golang';

export type LspDiagnosticSeverity = 'ERROR' | 'WARNING' | 'INFORMATION' | 'HINT';

export interface LspPosition {
  readonly line: number;
  readonly character: number;
}

export interface LspRange {
  readonly start: LspPosition;
  readonly end: LspPosition;
}

export interface LspDiagnostic {
  readonly filePath: string;
  readonly range: LspRange;
  readonly severity: LspDiagnosticSeverity;
  readonly message: string;
  readonly code?: string | number;
  readonly source?: string;
}

export interface LspDefinitionResult {
  readonly targetFilePath: string;
  readonly targetRange: LspRange;
}

export interface LspHoverResult {
  readonly contentsMarkdown: string;
  readonly range?: LspRange;
}

export interface LspServerDescriptor {
  readonly language: SupportedLspLanguage;
  readonly executable: string;
  readonly defaultArgs: readonly string[];
  readonly fileExtensions: readonly string[];
}

export class ZavorthLspBridgeService {
  private readonly serverCatalog: readonly LspServerDescriptor[] = [
    {
      language: 'typescript',
      executable: 'typescript-language-server',
      defaultArgs: ['--stdio'],
      fileExtensions: ['.ts', '.tsx', '.mts', '.cts'],
    },
    {
      language: 'javascript',
      executable: 'typescript-language-server',
      defaultArgs: ['--stdio'],
      fileExtensions: ['.js', '.jsx', '.mjs', '.cjs'],
    },
    {
      language: 'python',
      executable: 'pyright-langserver',
      defaultArgs: ['--stdio'],
      fileExtensions: ['.py', '.pyi'],
    },
    {
      language: 'rust',
      executable: 'rust-analyzer',
      defaultArgs: [],
      fileExtensions: ['.rs'],
    },
    {
      language: 'golang',
      executable: 'gopls',
      defaultArgs: [],
      fileExtensions: ['.go'],
    },
  ];

  public detectLanguageForFile(filePath: string): SupportedLspLanguage | null {
    const normalized = filePath.toLowerCase();
    for (const server of this.serverCatalog) {
      if (server.fileExtensions.some((ext) => normalized.endsWith(ext))) {
        return server.language;
      }
    }
    return null;
  }

  public getServerDescriptor(language: SupportedLspLanguage): LspServerDescriptor | null {
    return this.serverCatalog.find((s) => s.language === language) ?? null;
  }

  public formatJsonRpcMessage(payload: Record<string, unknown>): string {
    const content = JSON.stringify(payload);
    const byteLength = Buffer.byteLength(content, 'utf8');
    return `Content-Length: ${byteLength}\r\n\r\n${content}`;
  }

  public parseJsonRpcFrames(buffer: string): { frames: Array<Record<string, unknown>>; remaining: string } {
    const frames: Array<Record<string, unknown>> = [];
    let currentBuffer = buffer;

    while (currentBuffer.length > 0) {
      const headerEndIdx = currentBuffer.indexOf('\r\n\r\n');
      if (headerEndIdx < 0) {
        break;
      }

      const header = currentBuffer.substring(0, headerEndIdx);
      const lengthPrefix = 'Content-Length: ';
      const lengthLine = header.split('\r\n').find((l) => l.startsWith(lengthPrefix));

      if (!lengthLine) {
        break;
      }

      const lengthStr = lengthLine.substring(lengthPrefix.length).trim();
      const contentLength = parseInt(lengthStr, 10);

      if (isNaN(contentLength) || contentLength <= 0) {
        break;
      }

      const payloadStart = headerEndIdx + 4;
      const totalFrameSize = payloadStart + contentLength;

      if (currentBuffer.length < totalFrameSize) {
        break;
      }

      const payloadStr = currentBuffer.substring(payloadStart, totalFrameSize);
      try {
        const parsed = JSON.parse(payloadStr);
        frames.push(parsed);
      } catch {
        // Safe degrade on malformed JSON payload frame
      }

      currentBuffer = currentBuffer.substring(totalFrameSize);
    }

    return { frames, remaining: currentBuffer };
  }

  public normalizeDiagnostics(
    filePath: string,
    rawDiagnostics: readonly Record<string, unknown>[]
  ): readonly LspDiagnostic[] {
    return rawDiagnostics.map((raw) => {
      const rawRange = (raw.range as Record<string, Record<string, number>>) || {};
      const start = rawRange.start || { line: 0, character: 0 };
      const end = rawRange.end || { line: 0, character: 0 };

      const rawSeverity = raw.severity as number | undefined;
      let severity: LspDiagnosticSeverity = 'INFORMATION';
      if (rawSeverity === 1) severity = 'ERROR';
      else if (rawSeverity === 2) severity = 'WARNING';
      else if (rawSeverity === 4) severity = 'HINT';

      return {
        filePath,
        range: {
          start: { line: start.line ?? 0, character: start.character ?? 0 },
          end: { line: end.line ?? 0, character: end.character ?? 0 },
        },
        severity,
        message: String(raw.message || 'Unknown diagnostic'),
        code: raw.code !== undefined ? String(raw.code) : undefined,
        source: raw.source ? String(raw.source) : undefined,
      };
    });
  }

  public formatDiagnosticsSummary(diagnostics: readonly LspDiagnostic[]): string {
    if (!diagnostics || diagnostics.length === 0) {
      return '\x1b[32m✔ LSP: 0 errors, clean file.\x1b[0m';
    }

    const errors = diagnostics.filter((d) => d.severity === 'ERROR');
    const warnings = diagnostics.filter((d) => d.severity === 'WARNING');

    const lines: string[] = [
      `\x1b[1mLSP Diagnostics\x1b[0m: \x1b[31m${errors.length} errors\x1b[0m, \x1b[33m${warnings.length} warnings\x1b[0m`,
    ];

    for (const d of diagnostics.slice(0, 10)) {
      const loc = `${d.range.start.line + 1}:${d.range.start.character + 1}`;
      const badge =
        d.severity === 'ERROR'
          ? '\x1b[31m[ERROR]\x1b[0m'
          : d.severity === 'WARNING'
          ? '\x1b[33m[WARN]\x1b[0m'
          : '\x1b[90m[INFO]\x1b[0m';
      lines.push(`  ${badge} ${loc} - ${d.message} (${d.source || 'lsp'})`);
    }

    if (diagnostics.length > 10) {
      lines.push(`  \x1b[90m... and ${diagnostics.length - 10} more diagnostics.\x1b[0m`);
    }

    return lines.join('\n');
  }
}
