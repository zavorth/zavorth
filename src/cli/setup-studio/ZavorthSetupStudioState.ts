import fs from 'fs';
import path from 'path';
import {
  buildZavorthSetupStudioPlan,
  type BuildZavorthSetupStudioPlanInput,
} from '../ZavorthSetupStudioService.js';
import { INTEGRATION_CHANNEL_MANIFESTS } from '../../domain/platform-ecosystem/infrastructure/integration-registry/IntegrationRegistryCatalogChannels.js';
import { ChannelLongTailActivationService } from '../../services/ChannelLongTailActivationService.js';
import { ZavorthSetupStudioConfigStore } from './ZavorthSetupStudioConfigStore.js';
import type {
  ZavorthSetupStudioConfigHandling,
  ZavorthSetupStudioMode,
  ZavorthSetupStudioSnapshot,
  ZavorthSetupStudioChannelGuide,
  ZavorthSetupStudioControlUiReadiness,
  ZavorthSetupStudioGatewayReadiness,
  ZavorthSetupStudioHatchPlan,
  ZavorthSetupStudioHooksReadiness,
  ZavorthSetupStudioSkillReadiness,
  ZavorthSetupStudioWebSearchReadiness,
} from './ZavorthSetupStudioSchema.js';
import { buildZavorthSetupStudioSteps } from './steps/ZavorthSetupStudioSteps.js';

export type BuildZavorthSetupStudioSnapshotInput = Partial<BuildZavorthSetupStudioPlanInput> & {
  projectRoot: string;
  mode?: ZavorthSetupStudioMode;
  configHandling?: ZavorthSetupStudioConfigHandling;
  dryRun?: boolean;
  now?: () => Date;
};

export function buildZavorthSetupStudioSnapshot(
  input: BuildZavorthSetupStudioSnapshotInput,
): ZavorthSetupStudioSnapshot {
  const projectRoot = path.resolve(input.projectRoot || process.cwd());
  const configStore = new ZavorthSetupStudioConfigStore(projectRoot);
  const existingConfig = configStore.inspect();
  const plan = buildZavorthSetupStudioPlan({
    projectRoot,
    providerId: input.providerId || existingConfig.configuredProvider || 'deferred',
    modelId: input.modelId || existingConfig.configuredModel || null,
    providerSecret: input.providerSecret || null,
    telegramBotToken: input.telegramBotToken || null,
    telegramAllowedUserIds: input.telegramAllowedUserIds || null,
    discordBotToken: input.discordBotToken || null,
    slackBotToken: input.slackBotToken || null,
    emailSmtpUrl: input.emailSmtpUrl || null,
    searchProvider: input.searchProvider || null,
    searchSecret: input.searchSecret || null,
    enableHooks: input.enableHooks === true,
    memoryMode: input.memoryMode || 'local-metadata',
    vaultScope: input.vaultScope || 'skip',
    scanDirs: input.scanDirs || [],
  });
  const dryRun = input.dryRun !== false;
  const channelGuide = buildChannelGuide(existingConfig.configuredChannels, plan.channels);
  const webSearch = buildWebSearchReadiness(projectRoot, plan.webSearch.provider, plan.webSearch.secretStored);
  const skills = buildSkillReadiness(projectRoot);
  const hooks = buildHooksReadiness(projectRoot, plan.hooks.enabled);
  const gateway = buildGatewayReadiness(projectRoot);
  const controlUi = buildControlUiReadiness(projectRoot);
  const hatch = buildHatchPlan();
  return {
    contractVersion: 'zavorth-setup-studio-snapshot/1',
    generatedAt: (input.now || (() => new Date()))().toISOString(),
    projectRoot,
    mode: input.mode || 'quickstart',
    configHandling: input.configHandling || (existingConfig.envExists || existingConfig.profileExists ? 'keep' : 'review'),
    existingConfig,
    plan,
    channelGuide,
    webSearch,
    skills,
    hooks,
    gateway,
    controlUi,
    hatch,
    steps: buildZavorthSetupStudioSteps({
      existingConfig,
      plan,
      dryRun,
      webSearch,
      skills,
      hooks,
      gateway,
      controlUi,
    }),
    nextActions: [
      { label: 'Preview setup', command: 'zavorth setup --dry-run', detail: 'safe no-write preview' },
      { label: 'Apply setup', command: 'zavorth setup', detail: 'interactive guided flow' },
      { label: 'Check readiness', command: 'zavorth ready' },
      { label: 'Open Command Center', command: 'zavorth open' },
    ],
    safety: {
      dryRun,
      writesRequireConfirmation: true,
      noSecretInOutput: true,
      noRuntimeStart: true,
      liveProviderProbeRequiresConsent: true,
    },
  };
}

function buildChannelGuide(
  configuredChannels: string[],
  plannedChannels: {
    telegram: 'skip' | 'configured-placeholder' | 'configured-secret';
    discord: 'skip' | 'configured-secret';
    slack: 'skip' | 'configured-secret';
    email: 'skip' | 'configured-secret';
  },
): ZavorthSetupStudioChannelGuide[] {
  const configured = new Set(configuredChannels);
  const firstClass: ZavorthSetupStudioChannelGuide[] = [
    {
      id: 'terminal',
      label: 'Terminal',
      status: 'ready',
      setupCommand: 'zavorth hatch',
      detail: 'primary local channel, ready for chat and approvals',
    },
    {
      id: 'control',
      label: 'Command Center',
      status: 'recommended',
      setupCommand: 'zavorth open',
      detail: 'visual dashboard for timeline, diffs, receipts and learning',
    },
    {
      id: 'telegram',
      label: 'Telegram',
      status: configured.has('telegram') || plannedChannels.telegram !== 'skip' ? 'ready' : 'missing-config',
      setupCommand: 'zavorth setup --telegram-token <token> --telegram-users <id>',
      detail: 'remote ChatOps with allowlist, approvals and short receipts',
    },
    {
      id: 'discord',
      label: 'Discord',
      status: configured.has('discord') || plannedChannels.discord !== 'skip' ? 'ready' : 'available',
      setupCommand: 'zavorth channels discord',
      detail: 'remote channel planned for communities and teams',
    },
    {
      id: 'slack',
      label: 'Slack',
      status: configured.has('slack') || plannedChannels.slack !== 'skip' ? 'ready' : 'available',
      setupCommand: 'zavorth channels slack',
      detail: 'operational channel for teams and automation',
    },
    {
      id: 'email',
      label: 'Email',
      status: plannedChannels.email !== 'skip' ? 'ready' : 'available',
      setupCommand: 'zavorth channels email',
      detail: 'async input/output with policy before external sends',
    },
  ];
  const existing = new Set(firstClass.map((entry) => entry.id));
  const catalogChannels = INTEGRATION_CHANNEL_MANIFESTS
    .filter((manifest) => !existing.has(manifest.id))
    .map((manifest): ZavorthSetupStudioChannelGuide => ({
      id: manifest.id,
      label: manifest.label,
      status: configured.has(manifest.id)
        ? 'ready'
        : manifest.supportLevel === 'native'
          ? 'available'
          : 'missing-config',
      setupCommand: `zavorth channels ${manifest.id}`,
      detail: manifest.summary,
    }))
    .sort((left, right) => {
      const statusRank = (value: ZavorthSetupStudioChannelGuide) => value.status === 'ready' ? 0 : value.status === 'available' ? 1 : 2;
      return statusRank(left) - statusRank(right) || left.label.localeCompare(right.label);
    });
  const longTailChannels = new ChannelLongTailActivationService()
    .buildSnapshot()
    .entries
    .filter((entry) => !existing.has(entry.channelId))
    .map((entry): ZavorthSetupStudioChannelGuide => ({
      id: entry.channelId,
      label: labelFromId(entry.channelId),
      status: configured.has(entry.channelId)
        ? 'ready'
        : entry.status === 'partial-live' || entry.status === 'configured-only'
          ? 'available'
          : 'missing-config',
      setupCommand: `zavorth channels ${entry.channelId}`,
      detail: `${entry.runtimeTarget}. ${entry.gaps[0] || 'Optional long-tail channel pack.'}`,
    }));
  const sourceChannelPacks: ZavorthSetupStudioChannelGuide[] = [
    {
      id: 'whatsapp-cloud',
      label: 'WhatsApp Cloud',
      status: configured.has('whatsapp-cloud') ? 'ready' : 'available',
      setupCommand: 'zavorth channels whatsapp-cloud',
      detail: 'Official WhatsApp Cloud API route with allowlist and explicit live-send approval.',
    },
    {
      id: 'whatsapp-baileys',
      label: 'WhatsApp Baileys',
      status: configured.has('whatsapp-baileys') ? 'ready' : 'missing-config',
      setupCommand: 'zavorth channels whatsapp-baileys',
      detail: 'Owner-gated WhatsApp bridge; requires explicit patch-risk decision before live use.',
    },
    {
      id: 'msteams',
      label: 'Microsoft Teams',
      status: configured.has('msteams') ? 'ready' : 'available',
      setupCommand: 'zavorth channels msteams',
      detail: 'Microsoft Graph/Bot Framework channel pack with allowlisted conversations.',
    },
    {
      id: 'signal',
      label: 'Signal',
      status: configured.has('signal') ? 'ready' : 'available',
      setupCommand: 'zavorth channels signal',
      detail: 'Signal CLI/JSON-RPC route with pairing, allowlist and governed live-send approval.',
    },
  ];
  const merged = new Map<string, ZavorthSetupStudioChannelGuide>();
  for (const entry of [...catalogChannels, ...longTailChannels, ...sourceChannelPacks]) {
    if (!existing.has(entry.id) && !merged.has(entry.id)) {
      merged.set(entry.id, entry);
    }
  }
  return [
    ...firstClass,
    ...Array.from(merged.values()).sort((left, right) => {
      const statusRank = (value: ZavorthSetupStudioChannelGuide) => value.status === 'ready' ? 0 : value.status === 'available' ? 1 : 2;
      return statusRank(left) - statusRank(right) || left.label.localeCompare(right.label);
    }),
  ];
}

function buildWebSearchReadiness(
  projectRoot: string,
  plannedProvider?: string,
  plannedSecretStored = false,
): ZavorthSetupStudioWebSearchReadiness {
  const env = readEnv(path.join(projectRoot, '.env'));
  const provider = plannedProvider
    || env.ZAVORTH_SEARCH_PROVIDER
    || (env.BRAVE_SEARCH_API_KEY ? 'brave' : null)
    || (env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_SEARCH_API_KEY ? 'google' : null)
    || (env.OLLAMA_HOST || env.OLLAMA_BASE_URL ? 'ollama-web' : null)
    || (env.XAI_API_KEY ? 'grok' : null)
    || (env.KIMI_API_KEY || env.MOONSHOT_API_KEY ? 'kimi' : null)
    || (env.MINIMAX_CODE_PLAN_KEY || env.MINIMAX_CODING_API_KEY || env.MINIMAX_OAUTH_TOKEN || env.MINIMAX_API_KEY ? 'minimax' : null)
    || (env.PERPLEXITY_API_KEY ? 'perplexity' : null)
    || (env.TAVILY_API_KEY ? 'tavily' : null)
    || (env.FIRECRAWL_API_KEY ? 'firecrawl' : null)
    || 'local';
  const hasSearchSecret = plannedSecretStored
    || (provider === 'brave' && Boolean(env.BRAVE_SEARCH_API_KEY))
    || (provider === 'google' && Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_SEARCH_API_KEY))
    || (provider === 'ollama-web' && Boolean(env.OLLAMA_HOST || env.OLLAMA_BASE_URL))
    || (provider === 'grok' && Boolean(env.XAI_API_KEY))
    || (provider === 'kimi' && Boolean(env.KIMI_API_KEY || env.MOONSHOT_API_KEY))
    || (provider === 'minimax' && Boolean(env.MINIMAX_CODE_PLAN_KEY || env.MINIMAX_CODING_API_KEY || env.MINIMAX_OAUTH_TOKEN || env.MINIMAX_API_KEY))
    || (provider === 'perplexity' && Boolean(env.PERPLEXITY_API_KEY))
    || (provider === 'tavily' && Boolean(env.TAVILY_API_KEY))
    || (provider === 'firecrawl' && Boolean(env.FIRECRAWL_API_KEY));
  return {
    status: provider === 'local' ? 'recommended' : hasSearchSecret ? 'ready' : 'available',
    provider,
    options: [
      { id: 'local', label: 'Local/no key', detail: 'uses model knowledge and local context first', requiresSecret: false },
      { id: 'ollama-web', label: 'Ollama Web Search', detail: 'local Ollama-hosted search route when available', requiresSecret: false },
      { id: 'brave', label: 'Brave Search', detail: 'live web search with an explicit key', requiresSecret: true },
      { id: 'google', label: 'Google/Gemini Search', detail: 'web search or Gemini grounding through the configured provider', requiresSecret: true },
      { id: 'grok', label: 'Grok', detail: 'xAI web search provider route', requiresSecret: true },
      { id: 'kimi', label: 'Kimi', detail: 'Moonshot/Kimi web search provider route', requiresSecret: true },
      { id: 'minimax', label: 'MiniMax Search', detail: 'MiniMax search route with token plan or API key', requiresSecret: true },
      { id: 'perplexity', label: 'Perplexity', detail: 'Perplexity search provider route', requiresSecret: true },
      { id: 'tavily', label: 'Tavily', detail: 'Tavily search provider route', requiresSecret: true },
      { id: 'firecrawl', label: 'Firecrawl', detail: 'Firecrawl crawl/search provider route', requiresSecret: true },
      { id: 'skip', label: 'Skip for now', detail: 'keeps the agent local-first', requiresSecret: false },
    ],
  };
}

function buildSkillReadiness(projectRoot: string): ZavorthSetupStudioSkillReadiness {
  const capabilityDirs = [
    path.join(projectRoot, 'src', 'runtime', 'capabilities'),
    path.join(projectRoot, 'src', 'tools'),
    path.join(projectRoot, 'src', 'services'),
  ];
  const eligible = capabilityDirs.reduce((total, dir) => total + countTypeScriptFiles(dir), 0);
  const packageJson = readJson(path.join(projectRoot, 'package.json')) as { scripts?: Record<string, string> } | null;
  const scripts = packageJson?.scripts || {};
  const missingRequirements = [
    scripts['runtime:check'] ? null : 'runtime:check',
    scripts['security:prepush'] ? null : 'security:prepush',
    scripts['zavorth:cli-hud:check'] ? null : 'zavorth:cli-hud:check',
  ].filter(Boolean).length;
  return {
    eligible,
    missingRequirements,
    unsupportedOnThisOs: process.platform === 'win32' ? 2 : 0,
    blockedByPolicy: 0,
    recommendedSetupCommand: 'zavorth doctor',
    highlights: [
      'Effect Boundary governs tools before real effects',
      'Experience Core synchronizes CLI, dashboard and channels',
      'Receipts and approvals remain the audit trail',
    ],
  };
}

function buildHooksReadiness(projectRoot: string, plannedEnabled = false): ZavorthSetupStudioHooksReadiness {
  const hooksDir = path.join(projectRoot, '.zavorth', 'hooks');
  const configured = fs.existsSync(hooksDir) && fs.readdirSync(hooksDir).length > 0;
  return {
    configured: configured || plannedEnabled,
    available: true,
    examples: [
      'save relevant context when a mission finishes',
      'run doctor after setup',
      'notify Telegram when an approval expires',
    ],
    setupCommand: 'zavorth hooks',
  };
}

function buildGatewayReadiness(projectRoot: string): ZavorthSetupStudioGatewayReadiness {
  const distHost = path.join(projectRoot, 'dist', 'host.js');
  const srcHost = path.join(projectRoot, 'src', 'host.ts');
  const installed = fs.existsSync(distHost) || fs.existsSync(srcHost);
  return {
    installed,
    recommendedRuntime: 'node',
    startCommand: 'zavorth start',
    foregroundCommand: 'npm run dev:supervised',
    detail: installed
      ? 'local gateway detected; setup does not start persistent processes automatically'
      : 'gateway still needs build/install before continuous use',
  };
}

function buildControlUiReadiness(projectRoot: string): ZavorthSetupStudioControlUiReadiness {
  const env = readEnv(path.join(projectRoot, '.env'));
  const port = env.PORT || env.ZAVORTH_PORT || '3000';
  return {
    url: `http://127.0.0.1:${port}/control`,
    tokenStatus: env.ZAVORTH_CONTROL_TOKEN ? 'configured' : 'generated-at-runtime',
    openCommand: 'zavorth open',
    docsCommand: 'zavorth help control',
  };
}

function buildHatchPlan(): ZavorthSetupStudioHatchPlan {
  return {
    recommendedMode: 'terminal',
    bootstrapPrompt: 'Wake up, explain your state, validate the provider and tell me the next safe step.',
    commands: [
      'zavorth hatch',
      'zavorth ask "what is your current state?"',
      'zavorth open',
    ],
  };
}

function readEnv(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const entries: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (match) {
      entries[match[1]] = String(match[2] || '').trim().replace(/^["']|["']$/g, '');
    }
  }
  return entries;
}

function readJson(filePath: string): unknown {
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
  } catch {
    return null;
  }
}

function countTypeScriptFiles(dir: string): number {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countTypeScriptFiles(fullPath);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      count += 1;
    }
  }
  return count;
}

function labelFromId(value: string): string {
  return String(value || '')
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.length <= 3 ? part.toUpperCase() : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
