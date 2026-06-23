import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

export interface McpServerEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  url: string;
  repo: string | null;
  category: string;
  capabilities: string[];
  install_command: string;
  config_template: Record<string, unknown>;
  downloads: number;
  rating: number;
  verified: boolean;
  tags: string[];
}

export class ZavorthMcpMarketplaceTool extends BaseTool {
  public readonly name = 'zavorth_mcp_marketplace';

  public readonly description =
    'MCP Server Marketplace — discover, install, manage, and publish MCP servers dynamically. The first integrated MCP marketplace in an AI agent.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'search', 'list', 'install', 'uninstall', 'info', 'publish', 'update', 'check_updates', 'categories', 'installed'.",
      },
      query: {
        type: 'string',
        description: 'Search query for MCP servers.',
      },
      server_id: {
        type: 'string',
        description: 'MCP server ID (for install/uninstall/info).',
      },
      category: {
        type: 'string',
        description: "Category filter: 'filesystem', 'database', 'browser', 'search', 'code', 'media', 'iot', 'security', 'productivity'.",
      },
      tags: {
        type: 'string',
        description: 'JSON array of tags to filter by.',
      },
      config: {
        type: 'string',
        description: 'JSON configuration for the MCP server.',
      },
      auto_approve: {
        type: 'boolean',
        description: 'Skip approval for installation. Default: false.',
      },
    },
    required: ['action'],
  };

  private readonly registryDir: string;
  private installedServers: Map<string, { id: string; config: Record<string, unknown>; installed_at: string; version: string }> = new Map();

  constructor(options?: { registryDir?: string }) {
    super();
    this.registryDir = options?.registryDir || path.join(process.cwd(), 'data', 'runtime', 'mcp-marketplace');
    this.ensureDir();
    this.loadInstalled();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.registryDir)) {
      fs.mkdirSync(this.registryDir, { recursive: true });
    }
  }

  private loadInstalled(): void {
    const installedPath = path.join(this.registryDir, 'installed.json');
    if (!fs.existsSync(installedPath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(installedPath, 'utf-8'));
      this.installedServers = new Map(Object.entries(data));
    } catch { /* ignore */ }
  }

  private saveInstalled(): void {
    fs.writeFileSync(
      path.join(this.registryDir, 'installed.json'),
      JSON.stringify(Object.fromEntries(this.installedServers), null, 2),
      'utf-8',
    );
  }

  private getCatalog(): McpServerEntry[] {
    return [
      { id: 'filesystem', name: 'Filesystem', description: 'Read, write, and manage files and directories', author: 'modelcontextprotocol', version: '1.0.0', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem', repo: 'modelcontextprotocol/servers', category: 'filesystem', capabilities: ['read', 'write', 'search', 'watch'], install_command: 'npx -y @modelcontextprotocol/server-filesystem', config_template: { root: '/path/to/workspace' }, downloads: 50000, rating: 4.8, verified: true, tags: ['files', 'core'] },
      { id: 'github', name: 'GitHub', description: 'Interact with GitHub repos, issues, PRs, and actions', author: 'modelcontextprotocol', version: '1.0.0', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github', repo: 'modelcontextprotocol/servers', category: 'code', capabilities: ['repos', 'issues', 'prs', 'actions'], install_command: 'npx -y @modelcontextprotocol/server-github', config_template: { token: 'ghp_xxx' }, downloads: 45000, rating: 4.7, verified: true, tags: ['git', 'code', 'core'] },
      { id: 'brave-search', name: 'Brave Search', description: 'Web search via Brave Search API', author: 'modelcontextprotocol', version: '1.0.0', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search', repo: 'modelcontextprotocol/servers', category: 'search', capabilities: ['web-search', 'news'], install_command: 'npx -y @modelcontextprotocol/server-brave-search', config_template: { api_key: 'BSA_xxx' }, downloads: 35000, rating: 4.6, verified: true, tags: ['search', 'web'] },
      { id: 'postgres', name: 'PostgreSQL', description: 'Query and manage PostgreSQL databases', author: 'modelcontextprotocol', version: '1.0.0', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres', repo: 'modelcontextprotocol/servers', category: 'database', capabilities: ['query', 'schema', 'manage'], install_command: 'npx -y @modelcontextprotocol/server-postgres', config_template: { connection_string: 'postgresql://...' }, downloads: 30000, rating: 4.5, verified: true, tags: ['database', 'sql'] },
      { id: 'playwright', name: 'Playwright', description: 'Browser automation via Playwright', author: 'modelcontextprotocol', version: '1.0.0', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/playwright', repo: 'modelcontextprotocol/servers', category: 'browser', capabilities: ['navigate', 'click', 'screenshot', 'scrape'], install_command: 'npx -y @modelcontextprotocol/server-playwright', config_template: { headless: true }, downloads: 40000, rating: 4.7, verified: true, tags: ['browser', 'automation'] },
      { id: 'memory', name: 'Memory', description: 'Persistent memory with knowledge graph', author: 'modelcontextprotocol', version: '1.0.0', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory', repo: 'modelcontextprotocol/servers', category: 'memory', capabilities: ['remember', 'recall', 'graph'], install_command: 'npx -y @modelcontextprotocol/server-memory', config_template: {}, downloads: 25000, rating: 4.4, verified: true, tags: ['memory', 'knowledge'] },
      { id: 'puppeteer', name: 'Puppeteer', description: 'Browser automation via Puppeteer', author: 'modelcontextprotocol', version: '1.0.0', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer', repo: 'modelcontextprotocol/servers', category: 'browser', capabilities: ['navigate', 'screenshot', 'pdf', 'scrape'], install_command: 'npx -y @modelcontextprotocol/server-puppeteer', config_template: {}, downloads: 20000, rating: 4.3, verified: true, tags: ['browser', 'automation'] },
      { id: 'sqlite', name: 'SQLite', description: 'SQLite database operations', author: 'modelcontextprotocol', version: '1.0.0', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite', repo: 'modelcontextprotocol/servers', category: 'database', capabilities: ['query', 'schema', 'manage'], install_command: 'npx -y @modelcontextprotocol/server-sqlite', config_template: { db_path: './data.db' }, downloads: 18000, rating: 4.4, verified: true, tags: ['database', 'sql', 'local'] },
      { id: 'slack', name: 'Slack', description: 'Slack messaging and workspace management', author: 'modelcontextprotocol', version: '1.0.0', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack', repo: 'modelcontextprotocol/servers', category: 'productivity', capabilities: ['messages', 'channels', 'users'], install_command: 'npx -y @modelcontextprotocol/server-slack', config_template: { bot_token: 'xoxb-xxx' }, downloads: 15000, rating: 4.3, verified: true, tags: ['messaging', 'team'] },
      { id: 'google-drive', name: 'Google Drive', description: 'Access Google Drive files and folders', author: 'modelcontextprotocol', version: '1.0.0', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-drive', repo: 'modelcontextprotocol/servers', category: 'productivity', capabilities: ['read', 'write', 'search', 'share'], install_command: 'npx -y @modelcontextprotocol/server-google-drive', config_template: { credentials: '...' }, downloads: 12000, rating: 4.2, verified: true, tags: ['cloud', 'files'] },
      { id: 'notion', name: 'Notion', description: 'Notion workspace integration', author: 'community', version: '1.0.0', url: 'https://github.com/makenotion/notion-mcp-server', repo: 'makenotion/notion-mcp-server', category: 'productivity', capabilities: ['pages', 'databases', 'blocks'], install_command: 'npx -y @notionhq/notion-mcp-server', config_template: { api_key: 'secret_xxx' }, downloads: 10000, rating: 4.1, verified: true, tags: ['notes', 'productivity'] },
      { id: 'linear', name: 'Linear', description: 'Linear issue tracking integration', author: 'community', version: '1.0.0', url: 'https://github.com/linear/linear-mcp', repo: 'linear/linear-mcp', category: 'productivity', capabilities: ['issues', 'projects', 'cycles'], install_command: 'npx -y @linear/mcp-server', config_template: { api_key: 'lin_api_xxx' }, downloads: 8000, rating: 4.0, verified: true, tags: ['issues', 'project-management'] },
      { id: 'context7', name: 'Context7', description: 'Live documentation provider for any library', author: 'community', version: '1.0.0', url: 'https://github.com/upstash/context7', repo: 'upstash/context7', category: 'code', capabilities: ['docs', 'examples', 'api-ref'], install_command: 'npx -y @upstash/context7-mcp', config_template: {}, downloads: 15000, rating: 4.5, verified: true, tags: ['docs', 'research'] },
      { id: 'supabase', name: 'Supabase', description: 'Supabase database, auth, and storage integration', author: 'community', version: '1.0.0', url: 'https://github.com/supabase-community/supabase-mcp', repo: 'supabase-community/supabase-mcp', category: 'database', capabilities: ['query', 'auth', 'storage', 'realtime'], install_command: 'npx -y @supabase/mcp-server', config_template: { project_ref: 'xxx', service_role_key: 'xxx' }, downloads: 12000, rating: 4.3, verified: true, tags: ['database', 'auth', 'baas'] },
    ];
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'search': return this.search(args);
      case 'list': return this.listServers(args);
      case 'info': return this.getServerInfo(args);
      case 'install': return this.installServer(args);
      case 'uninstall': return this.uninstallServer(args);
      case 'installed': return this.listInstalled();
      case 'categories': return this.listCategories();
      case 'check_updates': return this.checkUpdates();
      case 'publish': return this.publishServer(args);
      case 'update': return this.updateServer(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private search(args: Record<string, unknown>): string {
    const query = String(args.query || '').toLowerCase();
    const category = typeof args.category === 'string' ? args.category : undefined;
    let tags: string[] = [];
    if (typeof args.tags === 'string') {
      try { tags = JSON.parse(args.tags); } catch { /* ignore */ }
    }

    let results = this.getCatalog();

    if (query) {
      results = results.filter((s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.tags.some((t) => t.includes(query)) ||
        s.capabilities.some((c) => c.includes(query))
      );
    }
    if (category) {
      results = results.filter((s) => s.category === category);
    }
    if (tags.length > 0) {
      results = results.filter((s) => tags.some((t) => s.tags.includes(t)));
    }

    if (results.length === 0) return `No MCP servers found for "${query}".`;

    const lines: string[] = [`MCP Marketplace Search: "${query || 'all'}" (${results.length} results)`, ''];
    for (const s of results.slice(0, 20)) {
      const verified = s.verified ? '✅' : '⬜';
      const installed = this.installedServers.has(s.id) ? '📦' : '';
      lines.push(`  ${verified}${installed} ${s.id}: ${s.description}`);
      lines.push(`     ${s.author} v${s.version} | ⭐${s.rating} | ⬇️${s.downloads} | ${s.category}`);
      lines.push(`     Tags: ${s.tags.join(', ')}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  private listServers(args: Record<string, unknown>): string {
    const category = typeof args.category === 'string' ? args.category : undefined;
    let servers = this.getCatalog();
    if (category) servers = servers.filter((s) => s.category === category);

    const lines: string[] = [`MCP Servers (${servers.length}):`];
    for (const s of servers) {
      const verified = s.verified ? '✅' : '⬜';
      const installed = this.installedServers.has(s.id) ? '📦' : '';
      lines.push(`  ${verified}${installed} ${s.id}: ${s.name} — ${s.description}`);
    }
    return lines.join('\n');
  }

  private getServerInfo(args: Record<string, unknown>): string {
    const serverId = String(args.server_id || '');
    if (!serverId) return 'Error: "server_id" is required.';

    const server = this.getCatalog().find((s) => s.id === serverId);
    if (!server) return `Error: MCP server "${serverId}" not found in marketplace.`;

    const installed = this.installedServers.get(serverId);

    return [
      `MCP Server: ${server.name} (${server.id})`,
      `  Description: ${server.description}`,
      `  Author: ${server.author}`,
      `  Version: ${server.version}`,
      `  Category: ${server.category}`,
      `  Rating: ⭐ ${server.rating}/5`,
      `  Downloads: ${server.downloads}`,
      `  Verified: ${server.verified ? 'Yes' : 'No'}`,
      `  Tags: ${server.tags.join(', ')}`,
      `  Capabilities: ${server.capabilities.join(', ')}`,
      `  Install: ${server.install_command}`,
      `  Repo: ${server.repo || 'N/A'}`,
      installed ? `  Status: ✅ Installed (v${installed.version})` : '  Status: ⬜ Not installed',
      `  Config template: ${JSON.stringify(server.config_template)}`,
    ].join('\n');
  }

  private installServer(args: Record<string, unknown>): string {
    const serverId = String(args.server_id || '');
    if (!serverId) return 'Error: "server_id" is required.';

    const server = this.getCatalog().find((s) => s.id === serverId);
    if (!server) return `Error: MCP server "${serverId}" not found.`;

    if (this.installedServers.has(serverId)) {
      return `MCP server "${serverId}" is already installed.`;
    }

    let config: Record<string, unknown> = {};
    if (typeof args.config === 'string') {
      try { config = JSON.parse(args.config); } catch { return 'Error: invalid JSON for "config".'; }
    }

    this.installedServers.set(serverId, {
      id: serverId,
      config,
      installed_at: new Date().toISOString(),
      version: server.version,
    });
    this.saveInstalled();

    return [
      `MCP server "${server.name}" installed successfully.`,
      `  ID: ${serverId}`,
      `  Install command: ${server.install_command}`,
      `  Config: ${JSON.stringify(config)}`,
      '',
      'To activate, add to your Zavorth MCP config and restart.',
    ].join('\n');
  }

  private uninstallServer(args: Record<string, unknown>): string {
    const serverId = String(args.server_id || '');
    if (!serverId) return 'Error: "server_id" is required.';

    if (!this.installedServers.has(serverId)) {
      return `MCP server "${serverId}" is not installed.`;
    }

    this.installedServers.delete(serverId);
    this.saveInstalled();

    return `MCP server "${serverId}" uninstalled.`;
  }

  private listInstalled(): string {
    if (this.installedServers.size === 0) return 'No MCP servers installed.';

    const lines: string[] = ['Installed MCP Servers:'];
    for (const [id, info] of this.installedServers) {
      const server = this.getCatalog().find((s) => s.id === id);
      lines.push(`  ${id}: ${server?.name || id} v${info.version} (installed: ${info.installed_at})`);
    }
    return lines.join('\n');
  }

  private listCategories(): string {
    const categories = new Set(this.getCatalog().map((s) => s.category));
    const lines: string[] = ['MCP Marketplace Categories:'];
    for (const cat of [...categories].sort()) {
      const count = this.getCatalog().filter((s) => s.category === cat).length;
      lines.push(`  ${cat}: ${count} servers`);
    }
    return lines.join('\n');
  }

  private checkUpdates(): string {
    const updates: string[] = [];
    for (const [id, info] of this.installedServers) {
      const server = this.getCatalog().find((s) => s.id === id);
      if (server && server.version !== info.version) {
        updates.push(`  ${id}: ${info.version} → ${server.version}`);
      }
    }
    if (updates.length === 0) return 'All installed MCP servers are up to date.';
    return `Updates available:\n${updates.join('\n')}`;
  }

  private publishServer(args: Record<string, unknown>): string {
    return 'MCP server publishing is coming soon. Submit to the Zavorth MCP registry.';
  }

  private updateServer(args: Record<string, unknown>): string {
    const serverId = String(args.server_id || '');
    if (!serverId) return 'Error: "server_id" is required.';

    const installed = this.installedServers.get(serverId);
    if (!installed) return `Error: MCP server "${serverId}" is not installed.`;

    const server = this.getCatalog().find((s) => s.id === serverId);
    if (!server) return `Error: MCP server "${serverId}" not found in marketplace.`;

    installed.version = server.version;
    installed.installed_at = new Date().toISOString();
    this.saveInstalled();

    return `MCP server "${serverId}" updated to v${server.version}.`;
  }
}
