import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export interface CachedDoc {
  id: string;
  library: string;
  version: string;
  topic: string;
  content: string;
  url: string;
  cached_at: string;
  expires_at: string;
}

export class ZavorthDocProviderTool extends BaseTool {
  public readonly name = 'zavorth_doc_provider';

  public readonly description =
    'Live documentation provider — fetch up-to-date docs for any library/framework in real-time. Like Context7 but native.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'lookup', 'search', 'list_cached', 'clear_cache', 'register_library'.",
      },
      library: {
        type: 'string',
        description: 'Library name (e.g., react, express, nextjs, tailwind, prisma).',
      },
      version: {
        type: 'string',
        description: 'Specific version (default: latest).',
      },
      topic: {
        type: 'string',
        description: 'Specific topic or function to look up.',
      },
      query: {
        type: 'string',
        description: 'Search query within docs.',
      },
      max_results: {
        type: 'number',
        description: 'Max results. Default: 5.',
      },
    },
    required: ['action'],
  };

  private readonly cacheDir: string;
  private cache: Map<string, CachedDoc> = new Map();
  private readonly KNOWN_LIBRARIES: Record<string, { name: string; docsUrl: string; npm: string }> = {
    react: { name: 'React', docsUrl: 'https://react.dev/reference', npm: 'react' },
    nextjs: { name: 'Next.js', docsUrl: 'https://nextjs.org/docs', npm: 'next' },
    express: { name: 'Express', docsUrl: 'https://expressjs.com/en/api.html', npm: 'express' },
    tailwind: { name: 'Tailwind CSS', docsUrl: 'https://tailwindcss.com/docs', npm: 'tailwindcss' },
    prisma: { name: 'Prisma', docsUrl: 'https://www.prisma.io/docs', npm: 'prisma' },
    typescript: { name: 'TypeScript', docsUrl: 'https://www.typescriptlang.org/docs', npm: 'typescript' },
    vite: { name: 'Vite', docsUrl: 'https://vitejs.dev/guide', npm: 'vite' },
    astro: { name: 'Astro', docsUrl: 'https://docs.astro.build', npm: 'astro' },
    svelte: { name: 'Svelte', docsUrl: 'https://svelte.dev/docs', npm: 'svelte' },
    vue: { name: 'Vue', docsUrl: 'https://vuejs.org/guide', npm: 'vue' },
    angular: { name: 'Angular', docsUrl: 'https://angular.dev', npm: '@angular/core' },
    django: { name: 'Django', docsUrl: 'https://docs.djangoproject.com', npm: '' },
    flask: { name: 'Flask', docsUrl: 'https://flask.palletsprojects.com', npm: '' },
    fastapi: { name: 'FastAPI', docsUrl: 'https://fastapi.tiangolo.com', npm: '' },
    supabase: { name: 'Supabase', docsUrl: 'https://supabase.com/docs', npm: '@supabase/supabase-js' },
    firebase: { name: 'Firebase', docsUrl: 'https://firebase.google.com/docs', npm: 'firebase' },
    docker: { name: 'Docker', docsUrl: 'https://docs.docker.com/reference', npm: '' },
    kubernetes: { name: 'Kubernetes', docsUrl: 'https://kubernetes.io/docs', npm: '' },
    terraform: { name: 'Terraform', docsUrl: 'https://developer.hashicorp.com/terraform/docs', npm: '' },
    jest: { name: 'Jest', docsUrl: 'https://jestjs.io/docs', npm: 'jest' },
    vitest: { name: 'Vitest', docsUrl: 'https://vitest.dev/guide', npm: 'vitest' },
    playwright: { name: 'Playwright', docsUrl: 'https://playwright.dev/docs', npm: 'playwright' },
    webpack: { name: 'Webpack', docsUrl: 'https://webpack.js.org/concepts', npm: 'webpack' },
    redis: { name: 'Redis', docsUrl: 'https://redis.io/docs', npm: 'redis' },
    postgres: { name: 'PostgreSQL', docsUrl: 'https://www.postgresql.org/docs', npm: 'pg' },
    mongodb: { name: 'MongoDB', docsUrl: 'https://www.mongodb.com/docs', npm: 'mongodb' },
    graphql: { name: 'GraphQL', docsUrl: 'https://graphql.org/learn', npm: 'graphql' },
    apollo: { name: 'Apollo', docsUrl: 'https://www.apollographql.com/docs', npm: '@apollo/client' },
    zod: { name: 'Zod', docsUrl: 'https://zod.dev', npm: 'zod' },
    drizzle: { name: 'Drizzle ORM', docsUrl: 'https://orm.drizzle.team/docs', npm: 'drizzle-orm' },
  };

  constructor(options?: { cacheDir?: string }) {
    super();
    this.cacheDir = options?.cacheDir || path.join(process.cwd(), 'data', 'runtime', 'doc-provider');
    this.ensureDir();
    this.loadCache();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  private loadCache(): void {
    const cachePath = path.join(this.cacheDir, 'cache.json');
    if (!fs.existsSync(cachePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      this.cache = new Map(Object.entries(data));
    } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Doc] JSON parse failed', error); }
  }

  private saveCache(): void {
    fs.writeFileSync(path.join(this.cacheDir, 'cache.json'), JSON.stringify(Object.fromEntries(this.cache), null, 2), 'utf-8');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'lookup': return await this.lookup(args);
      case 'search': return this.searchDocs(args);
      case 'list_cached': return this.listCached();
      case 'clear_cache': return this.clearCache();
      case 'register_library': return this.registerLibrary(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async lookup(args: Record<string, unknown>): Promise<string> {
    const library = String(args.library || '').toLowerCase();
    if (!library) return 'Error: "library" is required.';

    const libInfo = this.KNOWN_LIBRARIES[library];
    if (!libInfo) return `Error: library "${library}" not known. Use "register_library" to add it.`;

    const topic = String(args.topic || '');
    const version = String(args.version || 'latest');

    const cacheKey = `${library}:${version}:${topic}`;
    const cached = this.cache.get(cacheKey);
    if (cached && new Date(cached.expires_at) > new Date()) {
      return `Docs for ${library} (cached):\n${cached.content}`;
    }

    try {
      const { execFileSync } = await import('child_process');
      let url = libInfo.docsUrl;
      if (topic) url += `/${topic}`;

      const result = execFileSync('curl', ['-s', '-L', '--max-time', '15', url], {
        timeout: 20000,
        maxBuffer: 5 * 1024 * 1024,
      }).toString();

      const textContent = result
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 5000);

      this.cache.set(cacheKey, {
        id: `doc_${Date.now()}`,
        library,
        version,
        topic: topic || 'general',
        content: textContent,
        url,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
      this.saveCache();

      return `Docs for ${libInfo.name}${topic ? ` (${topic})` : ''}:\n${textContent.slice(0, 3000)}`;
    } catch (error: unknown) {logger.warn('[Zavorth Doc] cache operation failed', error); return ''; }
  }

  private searchDocs(args: Record<string, unknown>): string {
    const query = String(args.query || '').toLowerCase();
    if (!query) return 'Error: "query" is required.';

    const results: Array<{ library: string; topic: string; score: number }> = [];
    for (const [key, lib] of Object.entries(this.KNOWN_LIBRARIES)) {
      let score = 0;
      if (key.includes(query)) score += 3;
      if (lib.name.toLowerCase().includes(query)) score += 2;
      if (lib.docsUrl.includes(query)) score += 1;
      if (score > 0) results.push({ library: key, topic: lib.name, score });
    }

    results.sort((a, b) => b.score - a.score);

    if (results.length === 0) return `No libraries found for "${query}".`;

    const lines: string[] = [`Search results for "${query}" (${results.length}):`];
    for (const r of results.slice(0, 10)) {
      const lib = this.KNOWN_LIBRARIES[r.library];
      lines.push(`  ${lib.name} (${r.library}): ${lib.docsUrl}`);
    }
    return lines.join('\n');
  }

  private listCached(): string {
    if (this.cache.size === 0) return 'No cached documentation.';

    const lines: string[] = ['Cached Docs:'];
    for (const [, doc] of this.cache) {
      const expired = new Date(doc.expires_at) < new Date() ? ' ⏰' : '';
      lines.push(`  ${doc.library}:${doc.version}:${doc.topic}${expired} (${doc.content.length} chars)`);
    }
    return lines.join('\n');
  }

  private clearCache(): string {
    const count = this.cache.size;
    this.cache.clear();
    this.saveCache();
    return `Cleared ${count} cached documents.`;
  }

  private registerLibrary(args: Record<string, unknown>): string {
    const name = String(args.library || '');
    const url = String(args.url || '');
    if (!name || !url) return 'Error: "library" and "url" are required.';

    this.KNOWN_LIBRARIES[name.toLowerCase()] = {
      name,
      docsUrl: url,
      npm: '',
    };

    return `Library "${name}" registered with docs URL: ${url}`;
  }
}
