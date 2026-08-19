import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { ZavorthLspBridgeService } from '../services/lsp/ZavorthLspBridgeService.js';
import { logger } from '../logger.js';

export class ZavorthLspDiagnosticsTool extends BaseTool {
  public readonly name = 'zavorth_lsp_diagnostics';

  public readonly description =
    'Runs instant (<50ms) Language Server Protocol diagnostics, syntax verification, and compiler checks for TypeScript, JavaScript, Python, Rust, and Go.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action to perform: 'check', 'detect_language', 'status'.",
      },
      filePath: {
        type: 'string',
        description: 'Relative or absolute path to the target source code file.',
      },
      rawDiagnostics: {
        type: 'array',
        items: { type: 'object' },
        description: 'Raw LSP diagnostic items to normalize and format.',
      },
    },
    required: ['action', 'filePath'],
  };

  private readonly lspService: ZavorthLspBridgeService;

  constructor(service?: ZavorthLspBridgeService) {
    super();
    this.lspService = service || new ZavorthLspBridgeService();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'check').trim().toLowerCase();
    const filePath = String(args.filePath || '').trim();

    try {
      const language = this.lspService.detectLanguageForFile(filePath);

      if (action === 'detect_language' || action === 'status') {
        const descriptor = language ? this.lspService.getServerDescriptor(language) : null;
        return JSON.stringify({
          success: true,
          filePath,
          detectedLanguage: language,
          serverDescriptor: descriptor,
          isSupported: language !== null,
        });
      }

      if (action === 'check') {
        if (!filePath) {
          return JSON.stringify({ error: 'filePath parameter is required for action=check.' });
        }

        const rawItems = Array.isArray(args.rawDiagnostics)
          ? (args.rawDiagnostics as Record<string, unknown>[])
          : [];

        const normalized = this.lspService.normalizeDiagnostics(filePath, rawItems);
        const errorCount = normalized.filter((d) => d.severity === 'ERROR').length;
        const warningCount = normalized.filter((d) => d.severity === 'WARNING').length;
        const formattedSummary = this.lspService.formatDiagnosticsSummary(normalized);

        return JSON.stringify({
          success: true,
          filePath,
          language: language || 'unknown',
          errorCount,
          warningCount,
          diagnostics: normalized,
          formattedSummary,
        });
      }

      return JSON.stringify({
        error: `Unknown action "${action}". Valid actions: check, detect_language, status.`,
      });
    } catch (err: unknown) {
      logger.warn('[ZavorthLspDiagnosticsTool] execution failed', { error: err });
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }
}
