import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';

export type CapabilityCategory =
  | 'tool'
  | 'agent'
  | 'channel'
  | 'provider'
  | 'integration'
  | 'skill'
  | 'workflow'
  | 'memory'
  | 'security'
  | 'automation'
  | 'media'
  | 'data'
  | 'hardware';

export type CapabilityStatus = 'available' | 'configured' | 'unconfigured' | 'disabled';

export type CapabilityEntry = {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  status: CapabilityStatus;
  source: string;
  surfaces: string[];
  tags: string[];
  configRequired: string[];
  discoveredAt: string;
};

export type CapabilityManifest = {
  generatedAt: string;
  version: string;
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  capabilities: CapabilityEntry[];
};

export type CapabilityDiscoveryRuntime = {
  projectRoot?: string;
  now?: () => Date;
};

const CAPABILITY_INDICATORS: Array<{
  pattern: RegExp;
  category: CapabilityCategory;
  nameExtractor: (match: RegExpMatchArray, filePath: string) => string;
  descriptionExtractor: (match: RegExpMatchArray, filePath: string) => string;
}> = [
  {
    pattern: /class\s+(\w+Tool)\s+extends\s+BaseTool/,
    category: 'tool',
    nameExtractor: (m) => m[1].replace(/Tool$/, '').replace(/([A-Z])/g, ' $1').trim(),
    descriptionExtractor: (m, f) => `Tool from ${path.basename(f)}`,
  },
  {
    pattern: /class\s+(\w+Provider)\s+implements\s+ILlmProvider/,
    category: 'provider',
    nameExtractor: (m) => m[1].replace(/Provider$/, ''),
    descriptionExtractor: (m, f) => `LLM provider from ${path.basename(f)}`,
  },
  {
    pattern: /class\s+(\w+Gateway)\s+extends/,
    category: 'channel',
    nameExtractor: (m) => m[1].replace(/Gateway$/, '').replace(/([A-Z])/g, ' $1').trim(),
    descriptionExtractor: (m, f) => `Channel gateway from ${path.basename(f)}`,
  },
  {
    pattern: /class\s+(\w+Service)\s+\{/,
    category: 'integration',
    nameExtractor: (m) => m[1].replace(/Service$/, '').replace(/([A-Z])/g, ' $1').trim(),
    descriptionExtractor: (m, f) => `Service from ${path.basename(f)}`,
  },
  {
    pattern: /register\(\s*\{[^}]*name:\s*['"]([^'"]+)['"]/,
    category: 'tool',
    nameExtractor: (m) => m[1],
    descriptionExtractor: (m, f) => `Registered tool from ${path.basename(f)}`,
  },
  {
    pattern: /zavorth external-agent|zavorth agent/,
    category: 'agent',
    nameExtractor: () => 'External Agent System',
    descriptionExtractor: () => 'Register, manage, and orchestrate external AI agents',
  },
  {
    pattern: /n8n|composio|zapier|make\.com/,
    category: 'integration',
    nameExtractor: (m) => `${m[0]} Integration`,
    descriptionExtractor: (m) => `Integration with ${m[0]} workflow automation`,
  },
  {
    pattern: /swarm|multi?.agent|agent?.team/,
    category: 'agent',
    nameExtractor: () => 'Multi-Agent Swarm',
    descriptionExtractor: () => 'Coordinate multiple agents working together',
  },
];

export class CapabilityDiscoveryService {
  private readonly projectRoot: string;
  private readonly now: () => Date;

  constructor(runtime: CapabilityDiscoveryRuntime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
  }

  public discover(): CapabilityManifest {
    const capabilities: CapabilityEntry[] = [];
    const scannedFiles = new Set<string>();

    this.scanDirectory(path.join(this.projectRoot, 'src', 'tools'), capabilities, scannedFiles);
    this.scanDirectory(path.join(this.projectRoot, 'src', 'providers'), capabilities, scannedFiles);
    this.scanDirectory(path.join(this.projectRoot, 'src', 'channels'), capabilities, scannedFiles);
    this.scanDirectory(path.join(this.projectRoot, 'src', 'services'), capabilities, scannedFiles);
    this.scanDirectory(path.join(this.projectRoot, 'src', 'agents'), capabilities, scannedFiles);
    this.scanDirectory(path.join(this.projectRoot, 'src', 'integrations'), capabilities, scannedFiles);
    this.scanDirectory(path.join(this.projectRoot, 'src', 'adapters'), capabilities, scannedFiles);

    this.addManualCapabilities(capabilities);

    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const cap of capabilities) {
      byCategory[cap.category] = (byCategory[cap.category] || 0) + 1;
      byStatus[cap.status] = (byStatus[cap.status] || 0) + 1;
    }

    return {
      generatedAt: this.now().toISOString(),
      version: '1.0.0',
      total: capabilities.length,
      byCategory,
      byStatus,
      capabilities: capabilities.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  private scanDirectory(dir: string, capabilities: CapabilityEntry[], scannedFiles: Set<string>): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.scanDirectory(fullPath, capabilities, scannedFiles);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
        this.scanFile(fullPath, capabilities, scannedFiles);
      }
    }
  }

  private scanFile(filePath: string, capabilities: CapabilityEntry[], scannedFiles: Set<string>): void {
    if (scannedFiles.has(filePath)) return;
    scannedFiles.add(filePath);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(this.projectRoot, filePath);

      for (const indicator of CAPABILITY_INDICATORS) {
        const matches = content.match(new RegExp(indicator.pattern, 'g'));
        if (matches) {
          for (const match of matches) {
            const singleMatch = match.match(indicator.pattern);
            if (singleMatch) {
              const name = indicator.nameExtractor(singleMatch, filePath);
              const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

              if (!capabilities.find((c) => c.id === id)) {
                capabilities.push({
                  id,
                  name,
                  category: indicator.category,
                  description: indicator.descriptionExtractor(singleMatch, filePath),
                  status: this.determineStatus(content, indicator.category),
                  source: relativePath,
                  surfaces: this.detectSurfaces(content),
                  tags: this.detectTags(content, indicator.category),
                  configRequired: this.detectConfig(content),
                  discoveredAt: this.now().toISOString(),
                });
              }
            }
          }
        }
      }
    } catch (error: unknown) {// skip unreadable files
      logger.warn('[Capability Discovery] operation failed', error);
    }
  }

  private determineStatus(content: string, category: CapabilityCategory): CapabilityStatus {
    if (content.includes('requiresConfirmation: true')) return 'configured';
    if (content.includes('check_requirements') || content.includes('checkRequirements')) {
      if (content.includes('return false')) return 'unconfigured';
    }
    return 'available';
  }

  private detectSurfaces(content: string): string[] {
    const surfaces: string[] = [];
    if (content.includes("'cli'") || content.includes('"cli"')) surfaces.push('cli');
    if (content.includes("'zavorthControl'") || content.includes('"zavorthControl"')) surfaces.push('zavorthControl');
    if (content.includes("'channel'") || content.includes('"channel"')) surfaces.push('channel');
    if (content.includes("'tui'") || content.includes('"tui"')) surfaces.push('tui');
    if (content.includes("'api'") || content.includes('"api"')) surfaces.push('api');
    if (surfaces.length === 0) surfaces.push('all');
    return surfaces;
  }

  private detectTags(content: string, category: CapabilityCategory): string[] {
    const tags: string[] = [category];
    if (content.includes('approval') || content.includes('Approval')) tags.push('governed');
    if (content.includes('external') || content.includes('External')) tags.push('external');
    if (content.includes('parallel') || content.includes('Parallel')) tags.push('parallel');
    if (content.includes('stream') || content.includes('Stream')) tags.push('streaming');
    if (content.includes('memory') || content.includes('Memory')) tags.push('memory');
    if (content.includes('security') || content.includes('Security')) tags.push('security');
    return tags;
  }

  private detectConfig(content: string): string[] {
    const config: string[] = [];
    const envMatches = content.matchAll(/process\.env\.([A-Z_]+)/g);
    for (const match of envMatches) {
      if (!config.includes(match[1])) config.push(match[1]);
    }
    return config.slice(0, 5);
  }

  private addManualCapabilities(capabilities: CapabilityEntry[]): void {
    const manual: Array<Omit<CapabilityEntry, 'discoveredAt'>> = [
      {
        id: 'agent-orchestration',
        name: 'Agent Orchestration',
        category: 'agent',
        description: 'Chain, parallel execute, fallback, and orchestrate multiple external AI agents',
        status: 'available',
        source: 'src/agents/AgentChainBuilder.ts',
        surfaces: ['cli', 'zavorthControl', 'channel', 'api'],
        tags: ['agent', 'orchestration', 'parallel', 'fallback'],
        configRequired: [],
      },
      {
        id: 'external-agent-gateway',
        name: 'External Agent Gateway',
        category: 'agent',
        description: 'Register, manage, and invoke external agents through governed CLI, HTTP, or ACP adapters',
        status: 'available',
        source: 'src/services/ZavorthExternalAgentGatewayService.ts',
        surfaces: ['cli', 'zavorthControl', 'channel'],
        tags: ['agent', 'external', 'governed'],
        configRequired: [],
      },
      {
        id: 'shared-memory',
        name: 'Agent Shared Memory',
        category: 'memory',
        description: 'Share memory between agents with approval workflow, scope control, and expiration',
        status: 'available',
        source: 'src/agents/AgentSharedMemory.ts',
        surfaces: ['all'],
        tags: ['memory', 'sharing', 'governed'],
        configRequired: [],
      },
      {
        id: 'skill-sharing',
        name: 'Agent Skill Sharing',
        category: 'skill',
        description: 'Share skills between agents with categories, usage tracking, and success rate',
        status: 'available',
        source: 'src/agents/AgentSkillSharing.ts',
        surfaces: ['all'],
        tags: ['skill', 'sharing'],
        configRequired: [],
      },
      {
        id: 'agent-marketplace',
        name: 'Agent Marketplace',
        category: 'agent',
        description: 'Publish, search, install, rate, and verify agent configurations',
        status: 'available',
        source: 'src/agents/AgentMarketplace.ts',
        surfaces: ['cli', 'zavorthControl'],
        tags: ['marketplace', 'community'],
        configRequired: [],
      },
      {
        id: 'cost-tracking',
        name: 'Agent Cost Tracking',
        category: 'data',
        description: 'Track cost per agent with token counting, pricing, and reporting',
        status: 'available',
        source: 'src/agents/AgentCostTracker.ts',
        surfaces: ['cli', 'zavorthControl'],
        tags: ['cost', 'analytics'],
        configRequired: [],
      },
      {
        id: 'streaming',
        name: 'Agent Streaming',
        category: 'automation',
        description: 'Real-time streaming output from external agents',
        status: 'available',
        source: 'src/agents/AgentStreamService.ts',
        surfaces: ['all'],
        tags: ['streaming', 'realtime'],
        configRequired: [],
      },
      {
        id: 'governed-execution',
        name: 'Governed Execution',
        category: 'security',
        description: 'All sensitive actions go through preview, approval, and receipt workflow',
        status: 'available',
        source: 'src/runtime/actions/',
        surfaces: ['all'],
        tags: ['security', 'governance', 'approval'],
        configRequired: [],
      },
      {
        id: 'cognitive-firewall',
        name: 'Cognitive Firewall',
        category: 'security',
        description: 'Security layer that validates agent decisions before execution',
        status: 'available',
        source: 'src/cognitive-firewall/',
        surfaces: ['all'],
        tags: ['security', 'ai-safety'],
        configRequired: [],
      },
      {
        id: 'swarm-v2',
        name: 'Swarm V2',
        category: 'agent',
        description: 'Multi-agent swarm with budgets, isolation, and coordination',
        status: 'available',
        source: 'src/agents/SwarmV2Service.ts',
        surfaces: ['cli', 'zavorthControl'],
        tags: ['agent', 'swarm', 'multi-agent'],
        configRequired: [],
      },
      {
        id: 'skill-evolution',
        name: 'Skill Evolution',
        category: 'skill',
        description: 'Auto-creates skills from workflow patterns, improves them over time',
        status: 'available',
        source: 'src/skills/ZavorthSkillEvolutionService.ts',
        surfaces: ['all'],
        tags: ['skill', 'self-improvement', 'learning'],
        configRequired: [],
      },
      {
        id: 'native-learning-loop',
        name: 'Native Learning Loop',
        category: 'memory',
        description: 'Agent learns from past sessions, creates skills from experience',
        status: 'available',
        source: 'src/services/ZavorthNativeLearningLoopService.ts',
        surfaces: ['all'],
        tags: ['memory', 'learning', 'self-improvement'],
        configRequired: [],
      },
      {
        id: 'channel-mesh',
        name: 'Channel Mesh',
        category: 'channel',
        description: '35+ channels: Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Teams, Email, Instagram, Matrix, IRC, and 24 more',
        status: 'available',
        source: 'src/services/ChannelLongTailActivationService.ts',
        surfaces: ['channel'],
        tags: ['channel', 'messaging', 'multi-platform'],
        configRequired: ['TELEGRAM_BOT_TOKEN', 'DISCORD_BOT_TOKEN'],
      },
      {
        id: 'provider-mesh',
        name: 'Provider Mesh',
        category: 'provider',
        description: '36+ AI providers: OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, Groq, Mistral, xAI, Cerebras, Together, and 26 more',
        status: 'available',
        source: 'src/providers/ProviderFactory.ts',
        surfaces: ['all'],
        tags: ['provider', 'llm', 'multi-model'],
        configRequired: ['OPENAI_API_KEY'],
      },
      {
        id: 'mcp-system',
        name: 'MCP System',
        category: 'integration',
        description: 'Model Context Protocol client and server with security guard and tool policy',
        status: 'available',
        source: 'src/mcp/',
        surfaces: ['all'],
        tags: ['mcp', 'integration', 'protocol'],
        configRequired: [],
      },
      {
        id: 'canvas-rendering',
        name: 'Canvas Rendering',
        category: 'media',
        description: 'Render interactive UI components in chat through the native live canvas surface',
        status: 'available',
        source: 'src/canvas/',
        surfaces: ['zavorthControl', 'channel'],
        tags: ['ui', 'canvas', 'interactive'],
        configRequired: [],
      },
      {
        id: 'voice-stack',
        name: 'Voice Stack',
        category: 'media',
        description: 'TTS, STT, Voice Mode, Local Dictation',
        status: 'available',
        source: 'src/voice/',
        surfaces: ['cli', 'zavorthControl'],
        tags: ['voice', 'tts', 'stt'],
        configRequired: [],
      },
      {
        id: 'cron-scheduler',
        name: 'Cron Scheduler',
        category: 'automation',
        description: 'Schedule recurring tasks and automations',
        status: 'available',
        source: 'src/tools/ZavorthCronSchedulerTool.ts',
        surfaces: ['all'],
        tags: ['automation', 'scheduling'],
        configRequired: [],
      },
      {
        id: 'kanban',
        name: 'Kanban Board',
        category: 'automation',
        description: 'Multi-agent task board with dispatch and coordination',
        status: 'available',
        source: 'src/tools/KanbanTool.ts',
        surfaces: ['cli', 'zavorthControl'],
        tags: ['kanban', 'tasks', 'multi-agent'],
        configRequired: [],
      },
      {
        id: 'edge-computing',
        name: 'Edge Computing',
        category: 'hardware',
        description: 'Run agents on edge devices and IoT',
        status: 'available',
        source: 'src/tools/ZavorthEdgeComputingTool.ts',
        surfaces: ['all'],
        tags: ['edge', 'iot', 'hardware'],
        configRequired: [],
      },
      {
        id: 'satellite-companion',
        name: 'Satellite Companion',
        category: 'hardware',
        description: 'Mobile companion app for remote approval and monitoring',
        status: 'available',
        source: 'src/satellite/',
        surfaces: ['mobile'],
        tags: ['mobile', 'companion', 'remote'],
        configRequired: [],
      },
      {
        id: 'integration-n8n',
        name: 'n8n Workflow Integration',
        category: 'integration',
        description: 'Trigger and receive n8n workflows as governed integrations',
        status: 'available',
        source: 'src/services/CapabilityDiscoveryService.ts',
        surfaces: ['cli', 'zavorthControl', 'channel'],
        tags: ['integration', 'n8n', 'workflow'],
        configRequired: [],
      },
      {
        id: 'integration-composio',
        name: 'Composio Tool Integration',
        category: 'integration',
        description: 'Wire external tools through Composio with governed approvals',
        status: 'available',
        source: 'src/services/CapabilityDiscoveryService.ts',
        surfaces: ['cli', 'zavorthControl', 'channel'],
        tags: ['integration', 'composio', 'tools'],
        configRequired: [],
      },
      {
        id: 'integration-obsidian',
        name: 'Obsidian Vault Integration',
        category: 'integration',
        description: 'Read and write Obsidian vaults as governed workspace content',
        status: 'available',
        source: 'src/services/CapabilityDiscoveryService.ts',
        surfaces: ['cli', 'zavorthControl', 'channel'],
        tags: ['integration', 'obsidian', 'notes'],
        configRequired: [],
      },
      {
        id: 'skill-marketplace',
        name: 'Skill Marketplace',
        category: 'skill',
        description: 'Discover, vet, and install third-party skills through a governed marketplace',
        status: 'available',
        source: 'src/services/PluginCuratedMarketplaceService.ts',
        surfaces: ['cli', 'zavorthControl', 'channel'],
        tags: ['skill', 'marketplace', 'curated'],
        configRequired: [],
      },
    ];

    for (const cap of manual) {
      if (!capabilities.find((c) => c.id === cap.id)) {
        capabilities.push({ ...cap, discoveredAt: this.now().toISOString() });
      }
    }
  }

  public formatForUser(manifest: CapabilityManifest): string {
    const lines: string[] = [];
    lines.push('Zavorth Capabilities');
    lines.push(`${'═'.repeat(60)}`);
    lines.push(`Total: ${manifest.total} capabilities`);
    lines.push('');

    const byCategory = new Map<string, CapabilityEntry[]>();
    for (const cap of manifest.capabilities) {
      if (!byCategory.has(cap.category)) byCategory.set(cap.category, []);
      byCategory.get(cap.category)!.push(cap);
    }

    for (const [category, caps] of byCategory) {
      lines.push(`${category.toUpperCase()} (${caps.length}):`);
      lines.push(`${'─'.repeat(60)}`);
      for (const cap of caps) {
        lines.push(`  ${cap.name}`);
        lines.push(`    ${cap.description}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  public formatForLLM(manifest: CapabilityManifest): string {
    const lines: string[] = [];
    lines.push('# Zavorth Capabilities');
    lines.push('');

    for (const cap of manifest.capabilities) {
      lines.push(`- **${cap.name}** [${cap.category}]: ${cap.description}`);
    }

    return lines.join('\n');
  }

  public formatCompact(manifest: CapabilityManifest): string {
    return manifest.capabilities
      .map((c) => `${c.name} (${c.category}): ${c.description}`)
      .join('\n');
  }
}
