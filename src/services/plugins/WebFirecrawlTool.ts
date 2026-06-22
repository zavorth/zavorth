import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';

export class WebFirecrawlTool extends BaseTool {
  public readonly name = 'zavorth_firecrawl';

  public readonly description =
    'Firecrawl — web scraping avancado que converte paginas em Markdown limpo. Suporta scrape, crawl, map e extract.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'scrape', 'crawl', 'map', 'extract', 'check_status'.",
      },
      url: {
        type: 'string',
        description: 'URL para scrapear.',
      },
      urls: {
        type: 'string',
        description: 'JSON array de URLs para batch scrape.',
      },
      formats: {
        type: 'string',
        description: "Formatos de saida: 'markdown', 'html', 'rawHtml', 'screenshot', 'links'. Default: 'markdown'.",
      },
      only_main_content: {
        type: 'boolean',
        description: 'Extrair apenas conteudo principal (sem header/footer/nav). Default: true.',
      },
      max_pages: {
        type: 'number',
        description: 'Maximo de paginas para crawl. Default: 10.',
      },
      extract_schema: {
        type: 'string',
        description: 'JSON schema para extracao estruturada.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Erro: o parametro "action" e obrigatorio.';

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey && action !== 'check_status') return 'Erro: FIRECRAWL_API_KEY nao configurada. Obtenha em https://firecrawl.dev';

    switch (action) {
      case 'scrape': return await this.scrape(args, apiKey!);
      case 'crawl': return await this.crawl(args, apiKey!);
      case 'map': return await this.map(args, apiKey!);
      case 'extract': return await this.extract(args, apiKey!);
      case 'check_status': return this.checkStatus(apiKey || '');
      default: return `Erro: acao "${action}" invalida.`;
    }
  }

  private async scrape(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Erro: "url" e obrigatoria para scrape.';

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

      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Erro Firecrawl: ${parsed.error}`;

      const data = parsed.data || {};
      const lines: string[] = [
        `Scrape: ${url}`,
        `  Titulo: ${data.metadata?.title || 'N/A'}`,
        `  Descricao: ${data.metadata?.description || 'N/A'}`,
        `  Formatos: ${formats.join(', ')}`,
      ];

      if (data.markdown) {
        const md = data.markdown.slice(0, 3000);
        lines.push('', 'Conteudo (Markdown):', md);
        if (data.markdown.length > 3000) lines.push(`\n... (${data.markdown.length} chars total)`);
      }

      if (data.links && data.links.length > 0) {
        lines.push('', `Links encontrados: ${data.links.length}`);
        for (const link of data.links.slice(0, 10)) {
          lines.push(`  - ${link}`);
        }
      }

      return lines.join('\n');
    } catch (error: unknown) {
      return `Erro: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async crawl(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Erro: "url" e obrigatoria para crawl.';

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

      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Erro Firecrawl: ${parsed.error}`;

      const lines: string[] = [
        `Crawl iniciado: ${url}`,
        `  Job ID: ${parsed.id}`,
        `  Status: ${parsed.status}`,
        `  Max paginas: ${maxPages}`,
      ];

      if (parsed.data) {
        lines.push(`  Paginas coletadas: ${parsed.data.length}`);
      } else {
        lines.push('  Use o job ID para verificar status.');
      }

      return lines.join('\n');
    } catch (error: unknown) {
      return `Erro: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async map(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Erro: "url" e obrigatoria para map.';

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

      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Erro Firecrawl: ${parsed.error}`;

      const links = parsed.links || [];
      const lines: string[] = [`Map de ${url} (${links.length} links encontrados):`];
      for (const link of links.slice(0, 30)) {
        lines.push(`  - ${link}`);
      }
      if (links.length > 30) lines.push(`  ... e mais ${links.length - 30} links`);

      return lines.join('\n');
    } catch (error: unknown) {
      return `Erro: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async extract(args: Record<string, unknown>, apiKey: string): Promise<string> {
    const urlsRaw = String(args.urls || '');
    if (!urlsRaw) return 'Erro: "urls" e obrigatorio para extract.';

    let urls: string[];
    try { urls = JSON.parse(urlsRaw); } catch { return 'Erro: JSON de "urls" invalido.'; }

    let schema: Record<string, unknown> = {};
    if (typeof args.extract_schema === 'string') {
      try { schema = JSON.parse(args.extract_schema); } catch { /* ignore */ }
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

      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Erro Firecrawl: ${parsed.error}`;

      return `Extract de ${urls.length} URL(s): ${JSON.stringify(parsed.data || parsed).slice(0, 2000)}`;
    } catch (error: unknown) {
      return `Erro: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private checkStatus(apiKey: string): string {
    if (!apiKey) return 'Firecrawl: API key nao configurada.';
    return 'Firecrawl: API key configurada. Use scrape/crawl/map/extract para testar conexao.';
  }
}
