import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { logger } from '../../logger.js';

export class SearchSearXNGTool extends BaseTool {
  public readonly name = 'zavorth_searxng';

  public readonly description =
    'SearXNG — self-hosted private meta-search engine. Agrega results de multiplos mecanismos de busca without rastreamento.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'search', 'list_instances', 'configure'.",
      },
      query: {
        type: 'string',
        description: 'Search term.',
      },
      instance_url: {
        type: 'string',
        description: 'Instance URL SearXNG (ex: http://localhost:8888).',
      },
      categories: {
        type: 'string',
        description: "Categorias: 'general', 'images', 'news', 'science', 'it', 'files'.",
      },
      engines: {
        type: 'string',
        description: "Motores especificos: 'google,bing,duckduckgo,wikipedia'.",
      },
      language: {
        type: 'string',
        description: "Language: 'pt-BR', 'en-US', etc. Default: 'auto'.",
      },
      max_results: {
        type: 'number',
        description: 'Maximum results. Default: 10.',
      },
      time_range: {
        type: 'string',
        description: "Periodo: 'day', 'week', 'month', 'year'.",
      },
    },
    required: ['action'],
  };

  private readonly defaultInstances = [
    'http://localhost:8888',
    'https://searx.be',
    'https://search.disroot.org',
    'https://searxng.site',
    'https://paulgo.io',
  ];

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    switch (action) {
      case 'search': return await this.search(args);
      case 'list_instances': return this.listInstances();
      case 'configure': return this.configure(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async search(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query || '');
    if (!query) return 'Error: "query" is required.';

    const instanceUrl = String(args.instance_url || process.env.SEARXNG_URL || this.defaultInstances[0]);
    const categories = typeof args.categories === 'string' ? args.categories : 'general';
    const engines = typeof args.engines === 'string' ? args.engines : undefined;
    const language = String(args.language || 'auto');
    const maxResults = typeof args.max_results === 'number' ? args.max_results : 10;
    const timeRange = typeof args.time_range === 'string' ? args.time_range : undefined;

    try {
      const { execFileSync } = await import('child_process');

      const params = new URLSearchParams({
        q: query,
        format: 'json',
        categories,
        language,
      });
      if (engines) params.set('engines', engines);
      if (timeRange) params.set('time_range', timeRange);

      const url = `${instanceUrl}/search...${params.toString()}`;

      const result = execFileSync('curl', [
        '-s', '--max-time', '15',
        url,
      ], { timeout: 20000, maxBuffer: 10 * 1024 * 1024 }).toString();

      const parsed = JSON.parse(result);
      if (parsed.error) return `SearXNG error: ${parsed.error}`;

      const results = (parsed.results || []).slice(0, maxResults);
      if (results.length === 0) return `No results para "${query}" no SearXNG.`;

      const lines: string[] = [
        `SearXNG: "${query}" (${results.length} results, instance: ${instanceUrl})`,
        '',
      ];

      for (const r of results) {
        lines.push(`[${(r.score || 0).toFixed(2)}] ${r.title}`);
        lines.push(`  ${r.url}`);
        if (r.content) lines.push(`  ${r.content.slice(0, 200)}`);
        if (r.engine) lines.push(`  source: ${r.engine}`);
        lines.push('');
      }

      if (parsed.number_of_results) {
        lines.push(`Total available: ${parsed.number_of_results}`);
      }

      return lines.join('\n');
    } catch (error: unknown) {logger.warn('[Search Sear X N G] parsing failed', error); return ''; }
  }

  private listInstances(): string {
    const lines: string[] = [
      'Instancias SearXNG:',
      '',
      '  Locais:',
      `    ${this.defaultInstances[0]} (localhost — self-hosted)`,
      '',
      '  Publicas:',
      ...this.defaultInstances.slice(1).map((u) => `    ${u}`),
      '',
      '  Configure SearXNG_URL for your instance.',
      '  Instalar: pip install searxng ou docker run searxng/searxng',
    ];
    return lines.join('\n');
  }

  private configure(args: Record<string, unknown>): string {
    const instanceUrl = String(args.instance_url || '');
    if (!instanceUrl) return 'Error: "instance_url" is required. for configure.';

    return [
      `SearXNG configured para: ${instanceUrl}`,
      '',
      'Para tornar permanente, adicione ao .env:',
      `  SEARXNG_URL=${instanceUrl}`,
      '',
      'Check if the instance responds:',
      `  curl ${instanceUrl}/search?q=test&format=json`,
    ].join('\n');
  }
}
