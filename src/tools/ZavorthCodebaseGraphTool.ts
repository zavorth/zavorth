import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { ZavorthCodebaseGraphService } from '../services/graph/ZavorthCodebaseGraphService.js';
import { logger } from '../logger.js';

export class ZavorthCodebaseGraphTool extends BaseTool {
  public readonly name = 'zavorth_codebase_graph';

  public readonly description =
    'AST Scope & Call Graph Engine. Analyzes symbol definitions, functions, interfaces, cross-file caller dependencies, and breaking contract impact analysis.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action to perform: 'index_file', 'impact_analysis', 'list_symbols'.",
      },
      filePath: {
        type: 'string',
        description: 'Target file path to index or analyze.',
      },
      sourceCode: {
        type: 'string',
        description: 'Source code content for action=index_file.',
      },
      symbolName: {
        type: 'string',
        description: 'Symbol name (function, class, interface) for action=impact_analysis.',
      },
    },
    required: ['action'],
  };

  private readonly graphService: ZavorthCodebaseGraphService;

  constructor(service?: ZavorthCodebaseGraphService) {
    super();
    this.graphService = service || new ZavorthCodebaseGraphService();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'list_symbols').trim().toLowerCase();

    try {
      switch (action) {
        case 'index_file': {
          const filePath = String(args.filePath || '').trim();
          const sourceCode = typeof args.sourceCode === 'string' ? args.sourceCode : '';
          if (!filePath) {
            return JSON.stringify({ error: 'filePath parameter is required for action=index_file.' });
          }

          const symbols = this.graphService.indexSourceFile(filePath, sourceCode);
          return JSON.stringify({
            success: true,
            filePath,
            indexedSymbolsCount: symbols.length,
            symbols,
          });
        }

        case 'impact_analysis': {
          const filePath = String(args.filePath || '').trim();
          const symbolName = String(args.symbolName || '').trim();
          if (!filePath || !symbolName) {
            return JSON.stringify({ error: 'filePath and symbolName are required for action=impact_analysis.' });
          }

          const impact = this.graphService.getImpactAnalysis(filePath, symbolName);
          if (!impact) {
            return JSON.stringify({
              success: false,
              message: `Symbol "${symbolName}" not found in file "${filePath}". Make sure the file is indexed first.`,
            });
          }

          return JSON.stringify({
            success: true,
            impact,
          });
        }

        case 'list_symbols': {
          const allSymbols = this.graphService.getAllSymbols();
          return JSON.stringify({
            success: true,
            totalSymbols: allSymbols.length,
            symbols: allSymbols,
          });
        }

        default:
          return JSON.stringify({
            error: `Unknown action "${action}". Valid actions: index_file, impact_analysis, list_symbols.`,
          });
      }
    } catch (err: unknown) {
      logger.warn('[ZavorthCodebaseGraphTool] execution failed', { error: err });
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }
}
