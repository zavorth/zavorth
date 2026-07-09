import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';export type MarketplaceAgent = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  adapter: 'cli' | 'http' | 'acp' | 'mcp';
  command: string | null;
  endpoint: string | null;
  category: string;
  tags: string[];
  downloads: number;
  rating: number;
  ratingCount: number;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  config: Record<string, unknown>;
};

export type MarketplaceConfig = {
  maxAgents?: number;
  requireVerification?: boolean;
  allowedCategories?: string[];
};

export type MarketplaceRuntime = {
  now?: () => Date;
  dataDir?: string;
  config?: MarketplaceConfig;
  logger?: typeof logger;
};

const DEFAULT_CONFIG: Required<MarketplaceConfig> = {
  maxAgents: 500,
  requireVerification: false,
  allowedCategories: ['coding', 'analysis', 'review', 'testing', 'devops', 'research', 'creative', 'automation'],
};

export class AgentMarketplace {
  private readonly now: () => Date;
  private readonly dataDir: string;
  private readonly agentsFile: string;
  private readonly config: Required<MarketplaceConfig>;
  private readonly log: typeof logger;

  constructor(runtime: MarketplaceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.dataDir = runtime.dataDir || path.join(process.cwd(), 'data', 'runtime', 'marketplace');
    this.agentsFile = path.join(this.dataDir, 'agents.json');
    this.config = { ...DEFAULT_CONFIG, ...runtime.config };
    this.log = runtime.logger || logger;
  }

  public publish(agent: Omit<MarketplaceAgent, 'id' | 'downloads' | 'rating' | 'ratingCount' | 'verified' | 'createdAt' | 'updatedAt'>): MarketplaceAgent {
    if (this.config.allowedCategories.length > 0 && !this.config.allowedCategories.includes(agent.category)) {
      throw new Error(`Category "${agent.category}" is not allowed. Allowed: ${this.config.allowedCategories.join(', ')}`);
    }

    const existing = this.readAgents();
    if (existing.length >= this.config.maxAgents) {
      throw new Error(`Marketplace is full (${this.config.maxAgents} agents)`);
    }

    const fullAgent: MarketplaceAgent = {
      ...agent,
      id: `${agent.author}-${agent.name}-${Date.now()}`,
      downloads: 0,
      rating: 0,
      ratingCount: 0,
      verified: false,
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    };

    const agents = this.readAgents();
    agents.push(fullAgent);
    this.writeAgents(agents);

    this.log.info(`[Marketplace] Published agent "${agent.name}" by ${agent.author}`);
    return fullAgent;
  }

  public search(query: string, options?: { category?: string; adapter?: string; verified?: boolean }): MarketplaceAgent[] {
    const agents = this.readAgents();
    const lower = query.toLowerCase();

    return agents.filter((a) => {
      if (options?.category && a.category !== options.category) return false;
      if (options?.adapter && a.adapter !== options.adapter) return false;
      if (options?.verified !== undefined && a.verified !== options.verified) return false;

      if (query) {
        const matchesName = a.name.toLowerCase().includes(lower);
        const matchesDesc = a.description.toLowerCase().includes(lower);
        const matchesTags = a.tags.some((tag) => tag.toLowerCase().includes(lower));
        if (!matchesName && !matchesDesc && !matchesTags) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      if (a.rating !== b.rating) return b.rating - a.rating;
      return b.downloads - a.downloads;
    });
  }

  public get(agentId: string): MarketplaceAgent | null {
    const agents = this.readAgents();
    return agents.find((a) => a.id === agentId) || null;
  }

  public install(agentId: string): MarketplaceAgent | null {
    const agents = this.readAgents();
    const agent = agents.find((a) => a.id === agentId);

    if (!agent) return null;

    agent.downloads++;
    agent.updatedAt = this.now().toISOString();
    this.writeAgents(agents);

    this.log.info(`[Marketplace] Installed agent "${agent.name}" (${agent.downloads} downloads)`);
    return agent;
  }

  public rate(agentId: string, rating: number): MarketplaceAgent | null {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const agents = this.readAgents();
    const agent = agents.find((a) => a.id === agentId);

    if (!agent) return null;

    agent.rating = (agent.rating * agent.ratingCount + rating) / (agent.ratingCount + 1);
    agent.ratingCount++;
    agent.updatedAt = this.now().toISOString();
    this.writeAgents(agents);

    return agent;
  }

  public verify(agentId: string): MarketplaceAgent | null {
    const agents = this.readAgents();
    const agent = agents.find((a) => a.id === agentId);

    if (!agent) return null;

    agent.verified = true;
    agent.updatedAt = this.now().toISOString();
    this.writeAgents(agents);

    this.log.info(`[Marketplace] Verified agent "${agent.name}"`);
    return agent;
  }

  public remove(agentId: string): boolean {
    const agents = this.readAgents();
    const index = agents.findIndex((a) => a.id === agentId);

    if (index < 0) return false;

    agents.splice(index, 1);
    this.writeAgents(agents);
    return true;
  }

  public getStats(): { total: number; verified: number; byCategory: Record<string, number>; byAdapter: Record<string, number> } {
    const agents = this.readAgents();
    const byCategory: Record<string, number> = {};
    const byAdapter: Record<string, number> = {};

    for (const agent of agents) {
      byCategory[agent.category] = (byCategory[agent.category] || 0) + 1;
      byAdapter[agent.adapter] = (byAdapter[agent.adapter] || 0) + 1;
    }

    return {
      total: agents.length,
      verified: agents.filter((a) => a.verified).length,
      byCategory,
      byAdapter,
    };
  }

  public formatAgentList(agents: MarketplaceAgent[]): string {
    const lines: string[] = [];
    lines.push('Agent Marketplace');
    lines.push(`${'═'.repeat(60)}`);

    if (agents.length === 0) {
      lines.push('No agents found.');
      return lines.join('\n');
    }

    for (const agent of agents) {
      const verified = agent.verified ? '✓' : ' ';
      const rating = agent.rating > 0 ? `${'★'.repeat(Math.round(agent.rating))}${'☆'.repeat(5 - Math.round(agent.rating))}` : 'No ratings';
      lines.push(`  ${verified} ${agent.name} v${agent.version} (${agent.author})`);
      lines.push(`    ${agent.description}`);
      lines.push(`    ${rating} | ${agent.downloads} downloads | ${agent.adapter}`);
      if (agent.tags.length > 0) {
        lines.push(`    Tags: ${agent.tags.join(', ')}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private readAgents(): MarketplaceAgent[] {
    try {
      if (!fs.existsSync(this.agentsFile)) return [];
      return JSON.parse(fs.readFileSync(this.agentsFile, 'utf-8')) as MarketplaceAgent[];
    } catch (error: unknown) {logger.warn('[Agent Marketplace] JSON parse failed', error); return []; }
  }

  private writeAgents(agents: MarketplaceAgent[]): void {
    fs.mkdirSync(path.dirname(this.agentsFile), { recursive: true });
    fs.writeFileSync(this.agentsFile, JSON.stringify(agents, null, 2), 'utf-8');
  }
}
