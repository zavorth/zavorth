/**
 * Zavorth LSP Diagnostics Tool.
 * Fast <50ms in-memory language server typechecking and diagnostics for source code files.
 */

import { BaseTool } from './BaseTool.js';
import { EmbeddedLspManager } from '../services/lsp/EmbeddedLspManager.js';
import { logger } from '../logger.js';

export class ZavorthLspDiagnosticsTool extends BaseTool {
  readonly name = 'zavorth_lsp_diagnostics';
  readonly description = 'Runs instant (<50ms) in-memory compiler diagnostics and type checks for TypeScript, JavaScript, and supported languages.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        description: "Action to perform: 'check', 'status'.",
      },
      filePath: {
        type: 'string',
        description: 'Relative or absolute path to the file to check (for action=check).',
      },
      content: {
        type: 'string',
        description: 'Optional in-memory file content to check before saving to disk.',
      },
    },
    required: ['action'] as string[],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'check').toLowerCase();
    const lsp = EmbeddedLspManager.getInstance();

    try {
      if (action === 'status') {
        const statuses = lsp.getStatus();
        return JSON.stringify({ success: true, statuses });
      }

      if (action === 'check') {
        const filePath = String(args.filePath || '').trim();
        if (!filePath) {
          return JSON.stringify({ error: 'filePath parameter is required for action=check.' });
        }

        const content = typeof args.content === 'string' ? args.content : undefined;
        const diagnostics = await lsp.checkFile(filePath, content);

        return JSON.stringify({
          success: true,
          filePath,
          errorCount: diagnostics.filter((d) => d.severity === 'error').length,
          warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
          diagnostics,
        });
      }

      return JSON.stringify({ error: `Invalid action "${action}". Valid: check, status.` });
    } catch (err: unknown) {
      logger.warn('[ZavorthLspDiagnosticsTool] execution failed', err);
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }
}
