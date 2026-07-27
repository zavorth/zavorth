import { UnifiedSearchTool } from './UnifiedSearchTool.js';

export class DeepSearchTool extends UnifiedSearchTool {
  public readonly name = 'deep_search';

  public readonly description =
    'Performs deeper provider-agnostic web research when the user asks for thorough investigation, comparison, verification, or multi-source analysis. Use web_search for quick lookup; use deep_search only when depth is worth the extra tokens.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Research question or topic to investigate deeply.',
      },
      mode: {
        type: 'string',
        description: "Depth mode: 'deep' for ranked evidence and extracted pages, or 'grounded' for synthesis with citations. Default: 'deep'.",
      },
      limit: {
        type: 'number',
        description: 'Maximum number of evidence results to collect (1-10). Default: 8.',
      },
      evidence_domain: {
        type: 'string',
        description: "Evidence profile: 'auto', 'general', 'medical', 'legal', 'scientific', 'finance', 'consumer', 'technical', 'public_policy', 'ai_news'. Default: 'auto'.",
      },
      extract_pages: {
        type: 'boolean',
        description: 'When true, extracts excerpts from top pages to improve evidence quality. Default: true.',
      },
    },
    required: ['query'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    return super.execute({
      ...args,
      mode: args.mode || args.search_mode || 'deep',
      limit: typeof args.limit === 'number' ? args.limit : 8,
      extract_pages: typeof args.extract_pages === 'boolean'
        ? args.extract_pages
        : typeof args.extractPages === 'boolean'
          ? args.extractPages
          : true,
    });
  }
}
