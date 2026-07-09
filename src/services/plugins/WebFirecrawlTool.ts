import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { logger } from '../../logger.js';

export class WebFirecrawlTool extends BaseTool {
  public readonly name = 'zavorth_firecrawl';

  public readonly description =
    'Firecrawl — advanced web scraping that converts pages to clean Markdown. Supports scrape, crawl, map, and extract.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'scrape', 'crawl', 'map', 'extract', 'check_status'.",
      },
      url: {
        type: 'string',
        description: 'URL to scrape.',
      },
      urls: {
        type: 'string',
        description: 'JSON array of URLs for batch scrape.',
      },
      formats: {
        type: 'string',
        description: "Output formats: 'markdown', 'html', 'rawHtml', 'screenshot', 'links'. Default: 'markdown'.",
      },
      only_main_content: {
        type: 'boolean',
        description: 'Extract only main content (without header/footer/nav). Default: true.',
      },
      max_pages: {
        type: 'number',
        description: 'Maximum pages for crawl. Default: 10.',
      },
      extract_schema: {
        type: 'string',
        description: 'JSON schema for structured extraction.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: the "action" parameter is required.';

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey && action !== 'check_status') return 'Error: FIRECRAWL_API_KEY not configured. Get one at https://firecrawl.dev';

    switch (action) {
      case 'scrape': return await this.scrape(args, apiKey!);
      case 'crawl': return await this.crawl(args, apiKey!);
      case 'map': return await this.map(args, apiKey!);
      case 'extract': return await this.extract(args, apiKey!);
      case 'check_status': return this.checkStatus(apiKey || '');
      default: return `Error: invalid action "${action}".`;
    }
  }

  private async scrape(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required for scrape.';

    try {
      const { execFileSync } = await import('child_process');
      const formats = typeof args.formats === 'string' ? args.formats.split(',').map((f) => f.trim()) : ['markdown'];
      const onlyMain = args.only_main_content !== false;

      const payload = JSON.stringify({
        url,
        formats,
        onlyMainContent: onlyMain,
      });

      const tmpFile = path.join(os.tmpdir(), `firecrawl_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        'https://api.firecrawl.dev/v1/scrape',
      ], { timeout: 60000, maxBuffer: 20 * 1024 * 1024 }).toString();

      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Web Firecrawl] file cleanup failed', error); }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Firecrawl Error: ${parsed.error}`;

      const data = parsed.data || {};
      const lines: string[] = [
        `Scrape: ${url}`,
        `  Title: ${data.metadata?.title || 'N/A'}`,
        `  Description: ${data.metadata?.description || 'N/A'}`,
        `  Formats: ${formats.join(', ')}`,
      ];

      if (data.markdown) {
        const md = data.markdown.slice(0, 3000);
        lines.push('', 'Content (Markdown):', md);
        if (data.markdown.length > 3000) lines.push(`\n... (${data.markdown.length} chars total)`);
      }

      if (data.links && data.links.length > 0) {
        lines.push('', `Links found: ${data.links.length}`);
        for (const link of data.links.slice(0, 10)) {
          lines.push(`  - ${link}`);
        }
      }

      return lines.join('\n');
    } catch (error: unknown) {logger.warn('[Web Firecrawl] operation failed', error); return ''; }
  }

  private async crawl(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required for crawl.';

    const maxPages = typeof args.max_pages === 'number' ? args.max_pages : 10;

    try {
      const { execFileSync } = await import('child_process');
      const payload = JSON.stringify({
        url,
        limit: maxPages,
        scrapeOptions: { formats: ['markdown'] },
      });

      const tmpFile = path.join(os.tmpdir(), `firecrawl_crawl_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        'https://api.firecrawl.dev/v1/crawl',
      ], { timeout: 60000 }).toString();

      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Web Firecrawl] file cleanup failed', error); }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Firecrawl Error: ${parsed.error}`;

      const lines: string[] = [
        `Crawl started: ${url}`,
        `  Job ID: ${parsed.id}`,
        `  Status: ${parsed.status}`,
        `  Max pages: ${maxPages}`,
      ];

      if (parsed.data) {
        lines.push(`  Pages collected: ${parsed.data.length}`);
      } else {
        lines.push('  Use the job ID to check status.');
      }

      return lines.join('\n');
    } catch (error: unknown) {logger.warn('[Web Firecrawl] parsing failed', error); return ''; }
  }

  private async map(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required for map.';

    try {
      const { execFileSync } = await import('child_process');
      const payload = JSON.stringify({ url });
      const tmpFile = path.join(os.tmpdir(), `firecrawl_map_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        'https://api.firecrawl.dev/v1/map',
      ], { timeout: 30000 }).toString();

      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Web Firecrawl] file cleanup failed', error); }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Firecrawl Error: ${parsed.error}`;

      const links = parsed.links || [];
      const lines: string[] = [`Map of ${url} (${links.length} links found):`];
      for (const link of links.slice(0, 30)) {
        lines.push(`  - ${link}`);
      }
      if (links.length > 30) lines.push(`  ... and ${links.length - 30} more links`);

      return lines.join('\n');
    } catch (error: unknown) {logger.warn('[Web Firecrawl] parsing failed', error); return ''; }
  }

  private async extract(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const urlsRaw = String(args.urls || '');
    if (!urlsRaw) return 'Error: "urls" is required for extract.';

    let urls: string[];
    try { urls = JSON.parse(urlsRaw); } catch (error: unknown) {logger.warn('[Web Firecrawl] JSON parse failed', error); return 'Error: Invalid "urls" JSON.'; }

    let schema: Record<string, unknown> = {};
    if (typeof args.extract_schema === 'string') {
      try { schema = JSON.parse(args.extract_schema); } catch (error: unknown) {/* ignore */ logger.warn('[Web Firecrawl] JSON parse failed', error); }
    }

    try {
      const { execFileSync } = await import('child_process');
      const payload = JSON.stringify({ urls, schema });
      const tmpFile = path.join(os.tmpdir(), `firecrawl_ext_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `Authorization: Bearer ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        'https://api.firecrawl.dev/v1/extract',
      ], { timeout: 120000 }).toString();

      try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Web Firecrawl] file cleanup failed', error); }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Firecrawl Error: ${parsed.error}`;

      return `Extract de ${urls.length} URL(s): ${JSON.stringify(parsed.data || parsed).slice(0, 2000)}`;
    } catch (error: unknown) {logger.warn('[Web Firecrawl] JSON parse failed', error); return ''; }
  }

  private checkStatus(apiKey: string): string {
    if (!apiKey) return 'Firecrawl: API key not configured.';
    return 'Firecrawl: API key configured. Use scrape/crawl/map/extract to test connection.';
  }
}
