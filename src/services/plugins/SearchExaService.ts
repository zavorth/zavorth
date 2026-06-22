import fs from 'fs';
import path from 'path';

export interface ExaSearchResult {
  id: string;
  url: string;
  title: string;
  score: number;
  published_date: string | null;
  author: string | null;
  image: string | null;
  favicon: string | null;
  text: string;
  highlights: string[];
}

export interface ExaSearchOptions {
  query: string;
  num_results?: number;
  type?: 'neural' | 'keyword' | 'auto';
  category?: 'company' | 'research paper' | 'news' | 'linkedin profile' | 'github' | 'tweet' | 'movie' | 'song' | 'personal site' | 'pdf';
  use_autoprompt?: boolean;
  start_crawl_date?: string;
  end_crawl_date?: string;
  include_domains?: string[];
  exclude_domains?: string[];
  include_text?: boolean;
  text_max_characters?: number;
}

export class SearchExaService {
  private readonly baseUrl = 'https://api.exa.ai';
  private readonly cacheDir: string;

  constructor(options?: { cacheDir?: string }) {
    this.cacheDir = options?.cacheDir || path.join(process.cwd(), 'data', 'runtime', 'exa-cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  public async search(options: ExaSearchOptions): Promise<string> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return 'Erro: EXA_API_KEY nao configurada. Obtenha em https://exa.ai';

    if (!options.query) return 'Erro: query e obrigatoria.';

    try {
      const { execFileSync } = await import('child_process');
      const payload: Record<string, unknown> = {
        query: options.query,
        numResults: options.num_results || 10,
        type: options.type || 'auto',
        useAutoprompt: options.use_autoprompt !== false,
      };

      if (options.category) payload.category = options.category;
      if (options.start_crawl_date) payload.startCrawlDate = options.start_crawl_date;
      if (options.end_crawl_date) payload.endCrawlDate = options.end_crawl_date;
      if (options.include_domains) payload.includeDomains = options.include_domains;
      if (options.exclude_domains) payload.excludeDomains = options.exclude_domains;
      if (options.include_text) {
        payload.contents = {
          text: { maxCharacters: options.text_max_characters || 2000 },
        };
      }

      const tmpFile = path.join(this.cacheDir, `search_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, JSON.stringify(payload));

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `x-api-key: ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        `${this.baseUrl}/search`,
      ], { timeout: 30000, maxBuffer: 20 * 1024 * 1024 }).toString();

      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Erro Exa: ${parsed.error.message || JSON.stringify(parsed.error)}`;

      const results: ExaSearchResult[] = (parsed.results || []).map((r: Record<string, unknown>) => ({
        id: r.id,
        url: r.url,
        title: r.title,
        score: r.score,
        published_date: r.publishedDate || null,
        author: r.author || null,
        image: r.image || null,
        favicon: r.favicon || null,
        text: (r.text || '').slice(0, 500),
        highlights: r.highlights || [],
      }));

      if (results.length === 0) return `Nenhum resultado para "${options.query}".`;

      const lines: string[] = [
        `Exa Search: "${options.query}" (${results.length} resultados, tipo: ${options.type || 'auto'})`,
        '',
      ];

      for (const r of results) {
        lines.push(`[${(r.score * 100).toFixed(0)}%] ${r.title}`);
        lines.push(`  ${r.url}`);
        if (r.published_date) lines.push(`  Data: ${r.published_date}`);
        if (r.text) lines.push(`  ${r.text.slice(0, 200)}...`);
        if (r.highlights.length > 0) {
          lines.push(`  Destaque: ${r.highlights[0].slice(0, 150)}`);
        }
        lines.push('');
      }

      return lines.join('\n');
    } catch (error: unknown) {
      return `Erro na busca Exa: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  public async findSimilar(url: string, options?: { num_results?: number }): Promise<string> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return 'Erro: EXA_API_KEY nao configurada.';

    try {
      const { execFileSync } = await import('child_process');
      const payload = JSON.stringify({
        url,
        numResults: options?.num_results || 5,
      });

      const tmpFile = path.join(this.cacheDir, `similar_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `x-api-key: ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        `${this.baseUrl}/findSimilar`,
      ], { timeout: 30000 }).toString();

      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      const parsed = JSON.parse(result);
      if (parsed.error) return `Erro Exa: ${parsed.error.message}`;

      const results = parsed.results || [];
      const lines: string[] = [`Paginas similares a ${url} (${results.length}):`];
      for (const r of results) {
        lines.push(`  - ${r.title}: ${r.url}`);
      }
      return lines.join('\n');
    } catch (error: unknown) {
      return `Erro: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  public async getContents(urls: string[], options?: { max_characters?: number }): Promise<string> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return 'Erro: EXA_API_KEY nao configurada.';

    try {
      const { execFileSync } = await import('child_process');
      const payload = JSON.stringify({
        ids: urls,
        contents: {
          text: { maxCharacters: options?.max_characters || 2000 },
        },
      });

      const tmpFile = path.join(this.cacheDir, `contents_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);

      const result = execFileSync('curl', [
        '-s', '-X', 'POST',
        '-H', `x-api-key: ${apiKey}`,
        '-H', 'Content-Type: application/json',
        '-d', `@${tmpFile}`,
        `${this.baseUrl}/contents`,
      ], { timeout: 30000 }).toString();

      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

      const parsed = JSON.parse(result);
      const results = parsed.results || [];
      const lines: string[] = [`Conteudos (${results.length}):`];
      for (const r of results) {
        lines.push(`\n--- ${r.title || r.url} ---`);
        lines.push((r.text || '').slice(0, 500));
      }
      return lines.join('\n');
    } catch (error: unknown) {
      return `Erro: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
