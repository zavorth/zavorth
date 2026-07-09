import fs from 'fs';
import path from 'path';
import { config as defaultConfig } from '../config/index.js';
import { logger } from '../logger.js';

export type ZavorthInspectStatus = 'ready' | 'attention' | 'offline';

export type ZavorthInspectEntry = {
  id: string;
  label: string;
  status: ZavorthInspectStatus;
  detail: string;
};

export type ZavorthInspectSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  source: 'ZavorthInspectService';
  provider: {
    id: string;
    model: string;
    routeId: string | null;
    familyId: string | null;
    configured: boolean;
    credentialRefs: ZavorthInspectEntry[];
  };
  workspace: {
    root: string;
    packageName: string;
    packageVersion: string;
    git: ZavorthInspectEntry;
  };
  instructions: ZavorthInspectEntry[];
  skills: {
    localSkillDirectories: string[];
    packageScripts: number;
  };
  plugins: ZavorthInspectEntry[];
  mcp: ZavorthInspectEntry[];
  hooks: ZavorthInspectEntry[];
  channels: ZavorthInspectEntry[];
  mnemos: ZavorthInspectEntry;
  trust: ZavorthInspectEntry[];
  receipts: {
    known: number;
    recentIds: string[];
  };
  pendingApprovals: {
    count: number;
    ids: string[];
  };
  nextActions: string[];
};

export type ZavorthInspectRuntimeOverlay = {
  pendingApprovals?: Array<{ id?: string; status?: string }>;
  receiptIds?: string[];
};

export class ZavorthInspectService {
  constructor(private readonly projectRoot = defaultConfig.projectRoot, private readonly config = defaultConfig) {}

  public buildSnapshot(input: { runtime?: ZavorthInspectRuntimeOverlay | null } = {}): ZavorthInspectSnapshot {
    const packageJson = this.readPackageJson();
    const provider = this.resolveProvider();
    const pendingApprovals = (input.runtime?.pendingApprovals || [])
      .filter((approval) => approval.status === 'pending' || !approval.status)
      .map((approval) => String(approval.id || '').trim())
      .filter(Boolean)
      .slice(0, 12);
    const receiptIds = (input.runtime?.receiptIds || [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .slice(0, 12);

    const snapshot: ZavorthInspectSnapshot = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: 'ZavorthInspectService',
      provider,
      workspace: {
        root: this.projectRoot,
        packageName: String(packageJson.name || 'zavorth'),
        packageVersion: String(packageJson.version || '0.0.0'),
        git: this.entry(
          'git',
          'Git workspace',
          this.exists('.git') ? 'ready' : 'attention',
          this.exists('.git') ? 'Repository metadata is present.' : 'No .git directory detected in this root.',
        ),
      },
      instructions: this.resolveInstructions(),
      skills: {
        localSkillDirectories: this.resolveSkillDirectories(),
        packageScripts: Object.keys((packageJson.scripts || {}) as Record<string, unknown>).length,
      },
      plugins: this.resolvePlugins(packageJson),
      mcp: this.resolveMcp(packageJson),
      hooks: this.resolveHooks(),
      channels: this.resolveChannels(),
      mnemos: this.entry(
        'mnemos',
        'Mnemos memory layer',
        this.exists('data') || this.exists('.zavorth') ? 'ready' : 'attention',
        this.exists('data') ? 'Runtime data directory is present.' : 'Memory runtime data will be created on first use.',
      ),
      trust: this.resolveTrust(),
      receipts: {
        known: receiptIds.length,
        recentIds: receiptIds,
      },
      pendingApprovals: {
        count: pendingApprovals.length,
        ids: pendingApprovals,
      },
      nextActions: [],
    };

    snapshot.nextActions = this.resolveNextActions(snapshot);
    return snapshot;
  }

  private resolveProvider(): ZavorthInspectSnapshot['provider'] {
    const providerId = String(this.config.llmProvider || process.env.LLM_PROVIDER || 'gemini').trim().toLowerCase();
    const model = String(
      this.config.modelSelectionModelId
      || this.modelForProvider(providerId)
      || 'default',
    ).trim();
    const credentialRefs = this.providerCredentialRefs(providerId);
    return {
      id: providerId,
      model,
      routeId: String(this.config.modelSelectionRouteId || '').trim() || null,
      familyId: String(this.config.modelSelectionFamilyId || '').trim() || null,
      configured: credentialRefs.some((entry) => entry.status === 'ready') || providerId === 'ollama' || providerId === 'lmstudio',
      credentialRefs,
    };
  }

  private modelForProvider(providerId: string): string {
    const c = this.config;
    const map: Record<string, string> = {
      gemini: c.geminiModel,
      google: c.geminiModel,
      aistudio: c.aiStudioModel,
      openai: c.openaiModel,
      deepseek: c.deepseekModel,
      groq: c.groqModel || c.groqTranscriptionModel,
      openrouter: c.openRouterModel,
      opencode: c.openCodeModel,
      minimax: c.minimaxModel,
      aigateway: c.AIGatewayModel,
      ollama: process.env.OLLAMA_MODEL || 'local',
      lmstudio: process.env.LMSTUDIO_MODEL || 'local',
    };
    return String(map[providerId] || c.geminiModel || 'default').trim();
  }

  private providerCredentialRefs(providerId: string): ZavorthInspectEntry[] {
    const providerEnv: Record<string, string[]> = {
      gemini: ['GEMINI_API_KEY'],
      google: ['GEMINI_API_KEY'],
      aistudio: ['AISTUDIO_API_KEY', 'GEMINI_API_KEY'],
      openai: ['OPENAI_API_KEY'],
      deepseek: ['DEEPSEEK_API_KEY'],
      groq: ['GROQ_API_KEY'],
      openrouter: ['OPENROUTER_API_KEY'],
      opencode: ['OPENCODE_API_KEY'],
      minimax: ['MINIMAX_API_KEY'],
      aigateway: ['AIGateway_API_KEY'],
      ollama: [],
      lmstudio: [],
    };
    const names = providerEnv[providerId] || [`${providerId.toUpperCase()}_API_KEY`];
    if (names.length === 0) {
      return [this.entry(`${providerId}:local`, 'Local provider', 'ready', 'No API key is required for this local route.')];
    }
    return names.map((name) => this.entry(
      name.toLowerCase(),
      name,
      process.env[name] ? 'ready' : 'attention',
      process.env[name] ? 'Configured in environment.' : 'Not configured in environment.',
    ));
  }

  private resolveInstructions(): ZavorthInspectEntry[] {
    const candidates = [
      'AGENTS.md',
      'CLAUDE.md',
      'README.md',
      '.github/copilot-instructions.md',
      'docs/README.md',
    ];
    return candidates
      .filter((file) => this.exists(file))
      .map((file) => this.entry(file, file, 'ready', 'Instruction/context file found.'));
  }

  private resolveSkillDirectories(): string[] {
    return [
      'skills',
      '.codex/skills',
      '.agents/skills',
      'src/runtime/capabilities',
    ].filter((dir) => this.exists(dir));
  }

  private resolvePlugins(packageJson: Record<string, any>): ZavorthInspectEntry[] {
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    return [
      this.entry('grammy', 'Telegram plugin/runtime', deps.grammy ? 'ready' : 'attention', deps.grammy ? 'grammy dependency installed.' : 'Telegram dependency not found.'),
      this.entry('discord.js', 'Discord plugin/runtime', deps['discord.js'] ? 'ready' : 'attention', deps['discord.js'] ? 'discord.js dependency installed.' : 'Discord dependency not found.'),
      this.entry('@slack/web-api', 'Slack plugin/runtime', deps['@slack/web-api'] ? 'ready' : 'attention', deps['@slack/web-api'] ? 'Slack dependency installed.' : 'Slack dependency not found.'),
    ];
  }

  private resolveMcp(packageJson: Record<string, any>): ZavorthInspectEntry[] {
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    return [
      this.entry('mcp-sdk', 'MCP SDK', deps['@modelcontextprotocol/sdk'] ? 'ready' : 'attention', deps['@modelcontextprotocol/sdk'] ? 'SDK dependency installed.' : 'SDK dependency not found.'),
      this.entry('mcp-config', 'MCP config', this.exists('.mcp.json') || this.exists('mcp.json') ? 'ready' : 'attention', 'Looks for .mcp.json or mcp.json in the workspace root.'),
    ];
  }

  private resolveHooks(): ZavorthInspectEntry[] {
    return [
      this.entry('workspace-hooks', 'Workspace hooks', this.exists('hooks') || this.exists('.zavorth/hooks') ? 'ready' : 'attention', 'Looks for hooks/ or .zavorth/hooks/.'),
      this.entry('package-scripts', 'Package scripts', this.readPackageScriptCount() > 0 ? 'ready' : 'attention', `${this.readPackageScriptCount()} package script(s) available.`),
    ];
  }

  private resolveChannels(): ZavorthInspectEntry[] {
    const channels = [
      ['telegram', 'Telegram', ['TELEGRAM_BOT_TOKEN']],
      ['discord', 'Discord', ['DISCORD_BOT_TOKEN']],
      ['slack', 'Slack', ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN']],
      ['email', 'Email', ['SMTP_URL', 'SMTP_HOST']],
      ['signal', 'Signal', ['SIGNAL_ACCOUNT_NUMBER']],
      ['whatsapp', 'WhatsApp', ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_SESSION_DIR']],
      ['teams', 'Microsoft Teams', ['TEAMS_APP_ID', 'TEAMS_APP_PASSWORD', 'TEAMS_CLIENT_SECRET']],
    ] as const;
    return channels.map(([id, label, envNames]) => {
      const configured = envNames.some((name) => Boolean(process.env[name]));
      return this.entry(id, label, configured ? 'ready' : 'attention', configured ? 'Credential marker configured.' : 'Not configured yet.');
    });
  }

  private resolveTrust(): ZavorthInspectEntry[] {
    const mode = String(process.env.ZAVORTH_TRUST_MODE || process.env.ZAVORTH_APPROVAL_MODE || 'governed').trim();
    return [
      this.entry('trust-mode', 'Trust mode', 'ready', mode),
      this.entry('redaction', 'Secret redaction', 'ready', 'Inspect reports credential presence only; raw secret values are never serialized.'),
      this.entry('policy', 'Policy broker', 'ready', 'Sensitive actions remain policy/approval gated.'),
    ];
  }

  private resolveNextActions(snapshot: ZavorthInspectSnapshot): string[] {
    const actions: string[] = [];
    if (!snapshot.provider.configured) {
      actions.push(`Configure provider credentials for ${snapshot.provider.id}.`);
    }
    if (snapshot.pendingApprovals.count > 0) {
      actions.push('Review pending approvals with zavorth approve.');
    }
    if (!snapshot.instructions.length) {
      actions.push('Add a README or AGENTS.md file to improve project context.');
    }
    actions.push('Run zavorth doctor for deeper setup diagnostics.');
    return actions;
  }

  private readPackageJson(): Record<string, any> {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
    } catch (error: unknown) {logger.warn('[Inspect] Failed to read package.json:', error);
      return {};
    }
  }

  private readPackageScriptCount(): number {
    return Object.keys((this.readPackageJson().scripts || {}) as Record<string, unknown>).length;
  }

  private exists(relativePath: string): boolean {
    return fs.existsSync(path.join(this.projectRoot, relativePath));
  }

  private entry(id: string, label: string, status: ZavorthInspectStatus, detail: string): ZavorthInspectEntry {
    return { id, label, status, detail };
  }
}
