import { BaseTool } from './BaseTool.js';
import { CapabilityDiscoveryService } from '../services/CapabilityDiscoveryService.js';

export class CapabilityDiscoveryTool extends BaseTool {
  public readonly name = 'capability_discovery';
  public readonly description = 'Discover all capabilities Zavorth has. Use this when the user asks what Zavorth can do, what features are available, or how to accomplish something.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'search', 'category', 'suggest'],
        description: 'Action: list all, search by keyword, filter by category, or suggest capabilities for a task.',
      },
      query: {
        type: 'string',
        description: 'Search keyword or task description (for search/suggest actions).',
      },
      category: {
        type: 'string',
        description: 'Filter by category (for category action). Categories: tool, agent, channel, provider, integration, skill, workflow, memory, security, automation, media, data, hardware.',
      },
      format: {
        type: 'string',
        enum: ['full', 'compact', 'llm'],
        description: 'Output format (default: compact).',
      },
    },
    required: ['action'],
  };

  private service: CapabilityDiscoveryService;

  constructor() {
    super();
    this.service = new CapabilityDiscoveryService();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'list').toLowerCase();
    const query = String(args.query || '').toLowerCase();
    const category = String(args.category || '').toLowerCase();
    const format = String(args.format || 'compact').toLowerCase();

    const manifest = this.service.discover();

    switch (action) {
      case 'list': {
        if (format === 'llm') return this.service.formatForLLM(manifest);
        if (format === 'full') return this.service.formatForUser(manifest);
        return this.service.formatCompact(manifest);
      }

      case 'search': {
        if (!query) return JSON.stringify({ error: 'Query is required for search action.' });
        const results = manifest.capabilities.filter((c) =>
          c.name.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query) ||
          c.tags.some((t) => t.includes(query)),
        );
        return JSON.stringify({
          query,
          count: results.length,
          capabilities: results.map((c) => ({
            name: c.name,
            category: c.category,
            description: c.description,
            tags: c.tags,
          })),
        });
      }

      case 'category': {
        if (!category) return JSON.stringify({ error: 'Category is required.' });
        const results = manifest.capabilities.filter((c) => c.category === category);
        return JSON.stringify({
          category,
          count: results.length,
          capabilities: results.map((c) => ({
            name: c.name,
            description: c.description,
            tags: c.tags,
          })),
        });
      }

      case 'suggest': {
        if (!query) return JSON.stringify({ error: 'Task description is required for suggest action.' });
        const suggestions = this.suggestCapabilities(query, manifest.capabilities);
        return JSON.stringify({
          task: query,
          suggestions: suggestions.map((c) => ({
            name: c.name,
            category: c.category,
            description: c.description,
            relevance: this.calculateRelevance(query, c),
          })),
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  }

  private suggestCapabilities(task: string, capabilities: CapabilityDiscoveryService extends never ? never : Array<{ name: string; description: string; tags: string[]; category: string }>): Array<{ name: string; description: string; tags: string[]; category: string }> {
    const lower = task.toLowerCase();

    const scored = capabilities.map((cap) => {
      let score = 0;

      if (lower.includes('agent') && cap.category === 'agent') score += 3;
      if (lower.includes('chain') && cap.tags.includes('orchestration')) score += 4;
      if (lower.includes('parallel') && cap.tags.includes('parallel')) score += 4;
      if (lower.includes('memory') && cap.tags.includes('memory')) score += 3;
      if (lower.includes('security') && cap.tags.includes('security')) score += 3;
      if (lower.includes('channel') && cap.category === 'channel') score += 3;
      if (lower.includes('provider') && cap.category === 'provider') score += 3;
      if (lower.includes('voice') && cap.tags.includes('voice')) score += 3;
      if (lower.includes('automat') && cap.tags.includes('automation')) score += 3;
      if (lower.includes('skill') && cap.tags.includes('skill')) score += 3;
      if (lower.includes('marketplace') && cap.tags.includes('marketplace')) score += 3;
      if (lower.includes('stream') && cap.tags.includes('streaming')) score += 3;
      if (lower.includes('cost') && cap.tags.includes('cost')) score += 3;

      const words = lower.split(/\s+/);
      for (const word of words) {
        if (cap.name.toLowerCase().includes(word)) score += 2;
        if (cap.description.toLowerCase().includes(word)) score += 1;
        if (cap.tags.some((t) => t.includes(word))) score += 1;
      }

      return { cap, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((s) => s.cap);
  }

  private calculateRelevance(task: string, cap: { name: string; description: string; tags: string[] }): number {
    const lower = task.toLowerCase();
    let score = 0;
    const words = lower.split(/\s+/);
    for (const word of words) {
      if (cap.name.toLowerCase().includes(word)) score += 2;
      if (cap.description.toLowerCase().includes(word)) score += 1;
      if (cap.tags.some((t) => t.includes(word))) score += 1;
    }
    return score;
  }
}
