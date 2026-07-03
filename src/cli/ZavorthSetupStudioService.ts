import fs from 'fs';
import path from 'path';
import { ProviderIntegrationRegistry } from '../services/providers/catalog/ProviderIntegrationRegistry.js';
import type { ProviderIntegrationRouteManifest } from '../services/providers/catalog/ProviderIntegrationManifest.js';

export type ZavorthSetupStudioProviderId = string;
export type ZavorthSetupStudioSearchProvider =
  | 'skip'
  | 'local'
  | 'ollama-web'
  | 'brave'
  | 'google'
  | 'grok'
  | 'kimi'
  | 'minimax'
  | 'perplexity'
  | 'tavily'
  | 'firecrawl';

export type ZavorthSetupStudioProviderOption = {
  id: ZavorthSetupStudioProviderId;
  label: string;
  defaultModel: string;
  modelEnvKey: string | null;
  secretEnvKeys: string[];
  needsSecret: boolean;
};

export type ZavorthSetupStudioEnvUpdate = {
  key: string;
  value: string;
  redactedValue: string;
  reason: string;
};

export type ZavorthSetupStudioPlan = {
  contractVersion: 'zavorth-setup-studio/1';
  envFile: string;
  skillGovernance: {
    mode: 'casual' | 'governed';
    summary: string;
  };
  provider: {
    id: ZavorthSetupStudioProviderId;
    modelId: string;
    secretStored: boolean;
    secretEnvKey: string | null;
  };
  channels: {
    telegram: 'skip' | 'configured-placeholder' | 'configured-secret';
    discord: 'skip' | 'configured-secret';
    slack: 'skip' | 'configured-secret';
    email: 'skip' | 'configured-secret';
  };
  webSearch: {
    provider: ZavorthSetupStudioSearchProvider;
    secretStored: boolean;
    secretEnvKey: string | null;
  };
  memory: {
    mode: 'off' | 'local-metadata' | 'local-summary';
    vaultScope: 'skip' | 'documents' | 'downloads' | 'custom' | 'whole-pc';
    scanDirs: string[];
  };
  wakeDetector: {
    mode: 'disabled' | 'default-local' | 'custom-command';
    summary: string;
    commandConfigured: boolean;
    rawAudioPersisted: false;
  };
  hooks: {
    enabled: boolean;
    templates: Array<{
      path: string;
      redactedPath: string;
      reason: string;
    }>;
  };
  envUpdates: ZavorthSetupStudioEnvUpdate[];
  safety: {
    rawSecretsInPlan: false;
    rawSecretsInSummary: false;
    writesEnvFile: boolean;
    providerExecutionPerformed: false;
    runtimePersistentStartPerformed: false;
    warnings: string[];
  };
  nextCommands: string[];
};

export type ZavorthSetupStudioApplyResult = {
  written: boolean;
  envFile: string;
  keys: string[];
  backupFile: string | null;
  removedKeys: string[];
};

export type BuildZavorthSetupStudioPlanInput = {
  projectRoot: string;
  providerId: string;
  modelId?: string | null;
  providerSecret?: string | null;
  telegramBotToken?: string | null;
  telegramAllowedUserIds?: string | null;
  discordBotToken?: string | null;
  slackBotToken?: string | null;
  emailSmtpUrl?: string | null;
  searchProvider?: string | null;
  searchSecret?: string | null;
  enableHooks?: boolean;
  memoryMode: 'off' | 'local-metadata' | 'local-summary';
  vaultScope: 'skip' | 'documents' | 'downloads' | 'custom' | 'whole-pc';
  scanDirs?: string[] | null;
  zavorthHome?: string | null;
  skillsGovernanceMode?: 'casual' | 'governed' | string | null;
  wakeDetectorMode?: 'disabled' | 'default-local' | 'custom-command' | string | null;
  wakeCommand?: string | null;
  wakeArgs?: string | null;
};

const CORE_SETUP_STUDIO_PROVIDER_OPTIONS: ZavorthSetupStudioProviderOption[] = [
  {
    id: 'deferred',
    label: 'Configure later',
    defaultModel: 'deferred',
    modelEnvKey: null,
    secretEnvKeys: [],
    needsSecret: false,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    modelEnvKey: 'GEMINI_MODEL',
    secretEnvKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    needsSecret: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    modelEnvKey: 'OPENAI_MODEL',
    secretEnvKeys: ['OPENAI_API_KEY'],
    needsSecret: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'openrouter/auto',
    modelEnvKey: 'OPENROUTER_MODEL',
    secretEnvKeys: ['OPENROUTER_API_KEY'],
    needsSecret: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    modelEnvKey: 'GROQ_MODEL',
    secretEnvKeys: ['GROQ_API_KEY'],
    needsSecret: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    modelEnvKey: 'DEEPSEEK_MODEL',
    secretEnvKeys: ['DEEPSEEK_API_KEY'],
    needsSecret: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultModel: 'claude-3-5-sonnet-latest',
    modelEnvKey: 'ANTHROPIC_MODEL',
    secretEnvKeys: ['ANTHROPIC_API_KEY'],
    needsSecret: true,
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    defaultModel: 'auto',
    modelEnvKey: 'HUGGINGFACE_MODEL',
    secretEnvKeys: ['HF_TOKEN', 'HUGGINGFACE_API_KEY'],
    needsSecret: true,
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    defaultModel: 'eleven_multilingual_v2',
    modelEnvKey: 'ELEVENLABS_MODEL',
    secretEnvKeys: ['ELEVENLABS_API_KEY', 'XI_API_KEY'],
    needsSecret: true,
  },
  {
    id: 'local',
    label: 'Local/Ollama',
    defaultModel: 'local-default',
    modelEnvKey: 'LOCAL_MODEL',
    secretEnvKeys: [],
    needsSecret: false,
  },
];

export const ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS: ZavorthSetupStudioProviderOption[] = buildSetupStudioProviderOptions();

export function resolveSetupStudioProvider(rawProviderId: string): ZavorthSetupStudioProviderOption {
  const normalized = String(rawProviderId || '').trim().toLowerCase();
  return ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.find((provider) => provider.id === normalized)
    || ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS[0];
}

export function buildZavorthSetupStudioPlan(input: BuildZavorthSetupStudioPlanInput): ZavorthSetupStudioPlan {
  const provider = resolveSetupStudioProvider(input.providerId);
  const modelId = String(input.modelId || provider.defaultModel).trim() || provider.defaultModel;
  const envFile = path.join(input.projectRoot, '.env');
  const envUpdates: ZavorthSetupStudioEnvUpdate[] = [];
  const zavorthHome = String(input.zavorthHome || '').trim();
  const skillsGovernanceMode = normalizeSkillsGovernanceMode(input.skillsGovernanceMode);
  const wakeDetectorMode = normalizeWakeDetectorMode(input.wakeDetectorMode, input.wakeCommand);
  const wakeCommand = String(input.wakeCommand || '').trim();
  const wakeArgs = String(input.wakeArgs || '').trim();

  if (zavorthHome) {
    const resolvedHome = path.resolve(zavorthHome);
    envUpdates.push({
      key: 'ZAVORTH_HOME',
      value: resolvedHome,
      redactedValue: resolvedHome,
      reason: 'isolated Zavorth instance home selected during setup',
    });
  }

  envUpdates.push({
    key: 'ZAVORTH_SKILLS_GOVERNANCE_MODE',
    value: skillsGovernanceMode,
    redactedValue: skillsGovernanceMode,
    reason: 'skill import governance selected during setup',
  });

  envUpdates.push({
    key: 'ZAVORTH_WAKE_TTL_SECONDS',
    value: String(Math.max(30, Number(process.env.ZAVORTH_WAKE_TTL_SECONDS || 900))),
    redactedValue: String(Math.max(30, Number(process.env.ZAVORTH_WAKE_TTL_SECONDS || 900))),
    reason: 'wake detector session TTL selected during setup',
  });
  if (wakeDetectorMode === 'default-local') {
    envUpdates.push(
      {
        key: 'ZAVORTH_WAKE_EMBEDDED',
        value: '1',
        redactedValue: '1',
        reason: 'default local wake detector selected during setup',
      },
      {
        key: 'ZAVORTH_WAKE_COMMAND',
        value: '',
        redactedValue: '',
        reason: 'no custom wake process selected',
      },
      {
        key: 'ZAVORTH_WAKE_ARGS',
        value: '',
        redactedValue: '',
        reason: 'no custom wake process arguments selected',
      },
    );
  } else if (wakeDetectorMode === 'custom-command') {
    envUpdates.push(
      {
        key: 'ZAVORTH_WAKE_EMBEDDED',
        value: '0',
        redactedValue: '0',
        reason: 'custom wake detector selected during setup',
      },
      {
        key: 'ZAVORTH_WAKE_COMMAND',
        value: wakeCommand,
        redactedValue: redactShellToken(wakeCommand),
        reason: 'custom wake detector command selected during setup',
      },
      {
        key: 'ZAVORTH_WAKE_ARGS',
        value: wakeArgs,
        redactedValue: redactShellToken(wakeArgs),
        reason: 'custom wake detector args selected during setup',
      },
    );
  } else {
    envUpdates.push({
      key: 'ZAVORTH_WAKE_EMBEDDED',
      value: '0',
      redactedValue: '0',
      reason: 'wake detector disabled during setup',
    });
  }

  if (provider.id !== 'deferred') {
    envUpdates.push({
      key: 'ZAVORTH_DEFAULT_PROVIDER',
      value: provider.id,
      redactedValue: provider.id,
      reason: 'default provider selected during setup',
    });
  }
  if (provider.modelEnvKey && modelId && modelId !== 'deferred') {
    envUpdates.push({
      key: provider.modelEnvKey,
      value: modelId,
      redactedValue: modelId,
      reason: 'default model selected during setup',
    });
  }

  const providerSecret = String(input.providerSecret || '').trim();
  const providerSecretEnvKey = provider.secretEnvKeys[0] || null;
  if (provider.needsSecret && providerSecret && providerSecretEnvKey) {
    envUpdates.push({
      key: providerSecretEnvKey,
      value: providerSecret,
      redactedValue: redactSecret(providerSecret),
      reason: 'provider credential captured through a secret field',
    });
  }

  const telegramBotToken = String(input.telegramBotToken || '').trim();
  if (telegramBotToken) {
    envUpdates.push({
      key: 'TELEGRAM_BOT_TOKEN',
      value: telegramBotToken,
      redactedValue: redactSecret(telegramBotToken),
      reason: 'Telegram bot token captured through a secret field',
    });
  }
  const telegramAllowedUserIds = String(input.telegramAllowedUserIds || '').trim();
  if (telegramAllowedUserIds) {
    envUpdates.push({
      key: 'TELEGRAM_ALLOWED_USER_IDS',
      value: telegramAllowedUserIds,
      redactedValue: telegramAllowedUserIds,
      reason: 'Telegram user allowlist',
    });
  }
  const discordBotToken = String(input.discordBotToken || '').trim();
  if (discordBotToken) {
    envUpdates.push({
      key: 'DISCORD_BOT_TOKEN',
      value: discordBotToken,
      redactedValue: redactSecret(discordBotToken),
      reason: 'Discord bot token captured through a secret field',
    });
  }
  const slackBotToken = String(input.slackBotToken || '').trim();
  if (slackBotToken) {
    envUpdates.push({
      key: 'SLACK_BOT_TOKEN',
      value: slackBotToken,
      redactedValue: redactSecret(slackBotToken),
      reason: 'Slack bot token captured through a secret field',
    });
  }
  const emailSmtpUrl = String(input.emailSmtpUrl || '').trim();
  if (emailSmtpUrl) {
    envUpdates.push({
      key: 'EMAIL_SMTP_URL',
      value: emailSmtpUrl,
      redactedValue: redactConnectionUrl(emailSmtpUrl),
      reason: 'SMTP URL captured through a secret field',
    });
  }

  const searchProvider = normalizeSearchProvider(input.searchProvider);
  const searchSecret = String(input.searchSecret || '').trim();
  const searchSecretEnvKey = searchSecretEnvKeyForProvider(searchProvider);
  if (searchProvider !== 'skip') {
    envUpdates.push({
      key: 'ZAVORTH_SEARCH_PROVIDER',
      value: searchProvider,
      redactedValue: searchProvider,
      reason: 'web/search provider selected during setup',
    });
  }
  if (searchSecretEnvKey && searchSecret) {
    envUpdates.push({
      key: searchSecretEnvKey,
      value: searchSecret,
      redactedValue: redactSecret(searchSecret),
      reason: 'web/search credential captured through a secret field',
    });
  }

  const scanDirs = normalizeScanDirs(input.scanDirs);
  if (scanDirs.length > 0) {
    envUpdates.push({
      key: 'MNEMOS_SCAN_DIRS',
      value: scanDirs.join(path.delimiter),
      redactedValue: scanDirs.map((entry) => redactHome(entry)).join(path.delimiter),
      reason: 'Mnemos local vault scope',
    });
  }

  return {
    contractVersion: 'zavorth-setup-studio/1',
    envFile,
    skillGovernance: {
      mode: skillsGovernanceMode,
      summary: skillsGovernanceMode === 'casual'
        ? 'Fast daily-use imports, while hard security and license blockers still stay active.'
        : 'Strict enterprise-style review for skill imports, licenses, risk and audit.',
    },
    provider: {
      id: provider.id,
      modelId,
      secretStored: Boolean(providerSecret && providerSecretEnvKey),
      secretEnvKey: providerSecret && providerSecretEnvKey ? providerSecretEnvKey : null,
    },
    channels: {
      telegram: telegramBotToken ? 'configured-secret' : telegramAllowedUserIds ? 'configured-placeholder' : 'skip',
      discord: discordBotToken ? 'configured-secret' : 'skip',
      slack: slackBotToken ? 'configured-secret' : 'skip',
      email: emailSmtpUrl ? 'configured-secret' : 'skip',
    },
    webSearch: {
      provider: searchProvider,
      secretStored: Boolean(searchSecretEnvKey && searchSecret),
      secretEnvKey: searchSecretEnvKey && searchSecret ? searchSecretEnvKey : null,
    },
    memory: {
      mode: input.memoryMode,
      vaultScope: input.vaultScope,
      scanDirs,
    },
    wakeDetector: {
      mode: wakeDetectorMode,
      summary: wakeDetectorSummary(wakeDetectorMode),
      commandConfigured: wakeDetectorMode === 'custom-command' && Boolean(wakeCommand),
      rawAudioPersisted: false,
    },
    hooks: {
      enabled: input.enableHooks === true,
      templates: input.enableHooks === true ? buildHookTemplates(input.projectRoot) : [],
    },
    envUpdates,
    safety: {
      rawSecretsInPlan: false,
      rawSecretsInSummary: false,
      writesEnvFile: envUpdates.length > 0,
      providerExecutionPerformed: false,
      runtimePersistentStartPerformed: false,
      warnings: [
        ...(provider.needsSecret && !providerSecret ? [`${provider.label} was selected without a key; it will be configurable, not live.`] : []),
        ...(searchSecretEnvKey && !searchSecret ? [`${searchProvider} search was selected without a key; it will be configurable, not live.`] : []),
        ...(input.vaultScope === 'whole-pc' ? ['Whole-PC Mnemos scanning can expose sensitive files; use it only after confirming that risk.'] : []),
      ],
    },
    nextCommands: [
      'zavorth ready',
      'zavorth home status',
      'zavorth start',
      'zavorth open',
    ],
  };
}

export function applyZavorthSetupStudioEnvPlan(
  plan: ZavorthSetupStudioPlan,
  options: { resetManagedEnv?: boolean; backupStamp?: string } = {},
): ZavorthSetupStudioApplyResult {
  const writtenKeys: string[] = [];
  let backupFile: string | null = null;
  let removedKeys: string[] = [];
  if (plan.envUpdates.length > 0) {
    const current = fs.existsSync(plan.envFile) ? fs.readFileSync(plan.envFile, 'utf8') : '';
    const reset = options.resetManagedEnv === true
      ? removeEnvKeys(current, getZavorthSetupStudioManagedEnvKeys())
      : { content: current, removedKeys: [] };
    removedKeys = reset.removedKeys;
    if (options.resetManagedEnv === true && current.trim()) {
      backupFile = writeEnvBackup(plan.envFile, current, options.backupStamp);
    }
    const next = mergeEnvContent(reset.content, plan.envUpdates);
    fs.writeFileSync(plan.envFile, next, 'utf8');
    writtenKeys.push(...plan.envUpdates.map((entry) => entry.key));
  } else if (options.resetManagedEnv === true && fs.existsSync(plan.envFile)) {
    const current = fs.readFileSync(plan.envFile, 'utf8');
    const reset = removeEnvKeys(current, getZavorthSetupStudioManagedEnvKeys());
    removedKeys = reset.removedKeys;
    if (removedKeys.length > 0) {
      backupFile = writeEnvBackup(plan.envFile, current, options.backupStamp);
      fs.writeFileSync(plan.envFile, normalizeEnvContent(reset.content), 'utf8');
    }
  }
  if (plan.hooks.enabled) {
    for (const hook of plan.hooks.templates) {
      fs.mkdirSync(path.dirname(hook.path), { recursive: true });
      if (!fs.existsSync(hook.path) || shouldReplaceLegacyHookTemplate(hook.path)) {
        fs.writeFileSync(hook.path, renderHookTemplate(hook.path), 'utf8');
      }
    }
  }
  return {
    written: writtenKeys.length > 0 || removedKeys.length > 0 || plan.hooks.enabled,
    envFile: plan.envFile,
    keys: writtenKeys,
    backupFile,
    removedKeys,
  };
}

export function getZavorthSetupStudioManagedEnvKeys(): string[] {
  const providerKeys = ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.flatMap((provider) => [
    provider.modelEnvKey,
    ...provider.secretEnvKeys,
  ]);
  return Array.from(new Set([
    'ZAVORTH_HOME',
    'ZAVORTH_DEFAULT_PROVIDER',
    'DEFAULT_LLM_PROVIDER',
    'ZAVORTH_DEFAULT_MODEL',
    'ZAVORTH_SKILLS_GOVERNANCE_MODE',
    'ZAVORTH_WAKE_TTL_SECONDS',
    'ZAVORTH_WAKE_EMBEDDED',
    'ZAVORTH_WAKE_COMMAND',
    'ZAVORTH_WAKE_ARGS',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_ALLOWED_USER_IDS',
    'DISCORD_BOT_TOKEN',
    'SLACK_BOT_TOKEN',
    'EMAIL_SMTP_URL',
    'ZAVORTH_SEARCH_PROVIDER',
    'BRAVE_SEARCH_API_KEY',
    'GOOGLE_SEARCH_API_KEY',
    'GOOGLE_API_KEY',
    'GEMINI_API_KEY',
    'XAI_API_KEY',
    'KIMI_API_KEY',
    'MOONSHOT_API_KEY',
    'MINIMAX_API_KEY',
    'MINIMAX_CODE_PLAN_KEY',
    'MINIMAX_CODING_API_KEY',
    'PERPLEXITY_API_KEY',
    'TAVILY_API_KEY',
    'FIRECRAWL_API_KEY',
    'MNEMOS_SCAN_DIRS',
    ...providerKeys.filter((key): key is string => Boolean(key)),
  ])).sort();
}

export function removeEnvKeys(current: string, keys: string[]): { content: string; removedKeys: string[] } {
  const managed = new Set(keys);
  const removed = new Set<string>();
  const lines = current.split(/\r?\n/).filter((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) {
      return true;
    }
    const key = match[1];
    if (!managed.has(key)) {
      return true;
    }
    removed.add(key);
    return false;
  });
  return {
    content: normalizeEnvContent(lines.join('\n')),
    removedKeys: Array.from(removed).sort(),
  };
}

function writeEnvBackup(envFile: string, content: string, stamp?: string): string {
  const backupRoot = path.join(path.dirname(envFile), '.zavorth', 'backups');
  fs.mkdirSync(backupRoot, { recursive: true });
  const safeStamp = String(stamp || new Date().toISOString()).replace(/[^0-9A-Za-z_-]/g, '-');
  const backupFile = path.join(backupRoot, `env-reset-${safeStamp}.env`);
  fs.writeFileSync(backupFile, normalizeEnvContent(content), 'utf8');
  return backupFile;
}

function normalizeEnvContent(content: string): string {
  const lines = String(content || '').split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

export function mergeEnvContent(current: string, updates: ZavorthSetupStudioEnvUpdate[]): string {
  const lines = current.split(/\r?\n/);
  const used = new Set<string>();
  const updateMap = new Map(updates.map((entry) => [entry.key, entry.value]));
  const merged = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) {
      return line;
    }
    const key = match[1];
    if (!updateMap.has(key)) {
      return line;
    }
    used.add(key);
    return `${key}=${quoteEnvValue(updateMap.get(key) || '')}`;
  });
  for (const update of updates) {
    if (!used.has(update.key)) {
      merged.push(`${update.key}=${quoteEnvValue(update.value)}`);
    }
  }
  while (merged.length > 0 && merged[merged.length - 1] === '') {
    merged.pop();
  }
  return `${merged.join('\n')}\n`;
}

export function renderZavorthSetupStudioPlan(plan: ZavorthSetupStudioPlan): string {
  return [
    'Setup Studio will prepare:',
    `- Provider: ${plan.provider.id}/${plan.provider.modelId}`,
    `- Skill governance: ${plan.skillGovernance.mode} (${plan.skillGovernance.summary})`,
    `- Credential: ${plan.provider.secretStored ? `${plan.provider.secretEnvKey} (${redactSecret('configured-secret')})` : 'not stored'}`,
    `- Telegram: ${plan.channels.telegram}`,
    `- Discord: ${plan.channels.discord}`,
    `- Slack: ${plan.channels.slack}`,
    `- Email: ${plan.channels.email}`,
    `- Web/search: ${plan.webSearch.provider}${plan.webSearch.secretStored ? ` (${plan.webSearch.secretEnvKey} configured)` : ''}`,
    `- Mnemos Memory: ${plan.memory.mode} / ${plan.memory.vaultScope}`,
    `- Echo wake: ${plan.wakeDetector.mode} (${plan.wakeDetector.summary})`,
    plan.memory.scanDirs.length > 0 ? `- Vaults: ${plan.memory.scanDirs.map((entry) => redactHome(entry)).join(', ')}` : '- Vaults: not configured',
    `- Automation templates: ${plan.hooks.enabled ? `${plan.hooks.templates.length} prepared, disabled by default` : 'skip'}`,
    '',
    '.env updates:',
    ...(plan.envUpdates.length > 0
      ? plan.envUpdates.map((entry) => `- ${entry.key}=${entry.redactedValue} (${entry.reason})`)
      : ['- none']),
    '',
    'Guarantees:',
    '- never prints keys on screen',
    '- live provider tests only run after explicit confirmation',
    '- does not start persistent runtime services during setup',
    ...(plan.safety.warnings.length > 0 ? ['', 'Attention:', ...plan.safety.warnings.map((warning) => `- ${warning}`)] : []),
    '',
    'After setup:',
    ...plan.nextCommands.map((command) => `- ${command}`),
  ].join('\n');
}

function normalizeSkillsGovernanceMode(value: unknown): 'casual' | 'governed' {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'governed' || normalized === 'strict' || normalized === 'enterprise'
    ? 'governed'
    : 'casual';
}

function normalizeWakeDetectorMode(value: unknown, command: unknown): 'disabled' | 'default-local' | 'custom-command' {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'off' || normalized === 'disabled' || normalized === 'disable') return 'disabled';
  if (normalized === 'custom' || normalized === 'custom-command' || String(command || '').trim()) return 'custom-command';
  return 'default-local';
}

function wakeDetectorSummary(mode: 'disabled' | 'default-local' | 'custom-command'): string {
  if (mode === 'disabled') return 'off until the operator explicitly configures it later';
  if (mode === 'custom-command') return 'operator-provided detector, still opt-in and TTL-bound';
  return 'default local detector path, still opt-in and TTL-bound';
}

function redactShellToken(value: string): string {
  return String(value || '').replace(/\b(token|secret|password|api[_-]?key)=\S+/gi, '$1=[REDACTED_SECRET]');
}

function normalizeScanDirs(scanDirs: string[] | null | undefined): string[] {
  return Array.from(new Set((scanDirs || [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry))));
}

function normalizeSearchProvider(
  value: string | null | undefined,
): ZavorthSetupStudioSearchProvider {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'brave'
    || normalized === 'ollama-web'
    || normalized === 'google'
    || normalized === 'grok'
    || normalized === 'kimi'
    || normalized === 'minimax'
    || normalized === 'perplexity'
    || normalized === 'tavily'
    || normalized === 'firecrawl'
    || normalized === 'skip'
    ? normalized
    : 'local';
}

function searchSecretEnvKeyForProvider(provider: string): string | null {
  switch (provider) {
    case 'brave':
      return 'BRAVE_SEARCH_API_KEY';
    case 'google':
      return 'GEMINI_API_KEY';
    case 'grok':
      return 'XAI_API_KEY';
    case 'kimi':
      return 'KIMI_API_KEY';
    case 'minimax':
      return 'MINIMAX_API_KEY';
    case 'perplexity':
      return 'PERPLEXITY_API_KEY';
    case 'tavily':
      return 'TAVILY_API_KEY';
    case 'firecrawl':
      return 'FIRECRAWL_API_KEY';
    default:
      return null;
  }
}

function buildSetupStudioProviderOptions(): ZavorthSetupStudioProviderOption[] {
  const registry = new ProviderIntegrationRegistry();
  const catalogOptions = registry.listRoutes().map(routeToSetupProviderOption);
  const byId = new Map<string, ZavorthSetupStudioProviderOption>();
  for (const option of [...CORE_SETUP_STUDIO_PROVIDER_OPTIONS, ...catalogOptions]) {
    if (!byId.has(option.id)) {
      byId.set(option.id, option);
    }
  }
  return Array.from(byId.values()).sort((left, right) => {
    if (left.id === 'deferred') return -1;
    if (right.id === 'deferred') return 1;
    if (left.id === 'local') return -1;
    if (right.id === 'local') return 1;
    return left.label.localeCompare(right.label);
  });
}

function routeToSetupProviderOption(route: ProviderIntegrationRouteManifest): ZavorthSetupStudioProviderOption {
  const providerId = normalizeProviderId(route.providerId || route.routeId);
  const credentialRefs = normalizeCredentialRefs(route.credentialRefs, providerId);
  const primaryModel = route.models?.find((model) => model.primary)?.modelId
    || route.models?.[0]?.modelId
    || (route.passthroughModels ? 'provider/default' : 'configured-later');
  const modalitySuffix = route.modalities.length > 0 ? ` (${route.modalities.join('/')})` : '';
  return {
    id: providerId,
    label: `${route.label}${modalitySuffix}`,
    defaultModel: primaryModel,
    modelEnvKey: `${envPrefix(providerId)}_MODEL`,
    secretEnvKeys: credentialRefs,
    needsSecret: route.mode !== 'local' && route.authKind !== 'none' && credentialRefs.length > 0,
  };
}

function normalizeCredentialRefs(refs: string[] | undefined, providerId: string): string[] {
  const normalized = Array.from(new Set((refs || [])
    .map((ref) => envKey(ref))
    .filter((ref) => /(?:API_KEY|TOKEN|SECRET|KEY)$/.test(ref))));
  if (normalized.length > 0) {
    return normalized;
  }
  return providerId === 'local' || providerId === 'deferred' ? [] : [`${envPrefix(providerId)}_API_KEY`];
}

function normalizeProviderId(value: unknown): string {
  return String(value || '').trim().toLowerCase() || 'deferred';
}

function envPrefix(value: string): string {
  return envKey(value).replace(/_+$/g, '');
}

function envKey(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function buildHookTemplates(projectRoot: string): ZavorthSetupStudioPlan['hooks']['templates'] {
  const hooksRoot = path.join(projectRoot, '.zavorth', 'hooks');
  return [
    {
      path: path.join(hooksRoot, 'after-run-summary.json'),
      redactedPath: redactHome(path.join(hooksRoot, 'after-run-summary.json')),
      reason: 'stores a local summary after completed runs for approved learning',
    },
    {
      path: path.join(hooksRoot, 'approval-expiry-notice.json'),
      redactedPath: redactHome(path.join(hooksRoot, 'approval-expiry-notice.json')),
      reason: 'prepares approval-expiry notifications for authorized channels',
    },
  ];
}

function renderHookTemplate(filePath: string): string {
  const name = path.basename(filePath, '.json');
  const templates: Record<string, Record<string, unknown>> = {
    'after-run-summary': {
      contractVersion: 'zavorth-automation-hook/1',
      id: 'after-run-summary',
      title: 'Summarize completed runtime work',
      description: 'When a governed action completes, stage a local Mnemos summary and automation evidence.',
      enabled: false,
      event: 'runtime.after_execute',
      safety: {
        noSecrets: true,
        requiresPolicy: true,
        canSendExternalData: false,
      },
      actions: [
        {
          type: 'mnemos.write_summary',
          summaryTemplate: 'Runtime action completed through {{toolName}}. Result length: {{resultLength}}.',
        },
        {
          type: 'receipt.create',
          title: 'Runtime automation summary',
          summary: 'A local automation summary was staged after {{toolName}} completed.',
        },
      ],
    },
    'approval-expiry-notice': {
      contractVersion: 'zavorth-automation-hook/1',
      id: 'approval-expiry-notice',
      title: 'Stage approval reminders',
      description: 'When an approval is created, stage a local reminder card. Remote delivery remains approval-gated.',
      enabled: false,
      event: 'before-approval-request',
      aliases: ['approval.pending'],
      safety: {
        noSecrets: true,
        requiresPolicy: true,
        canSendExternalData: false,
      },
      actions: [
        {
          type: 'notification.create',
          channel: 'local',
          title: 'Approval pending',
          message: 'A governed action is waiting for review. Open zavorth approve or the ZavorthControl.',
          requiresApproval: false,
        },
        {
          type: 'receipt.create',
          title: 'Approval reminder staged',
          summary: 'A local approval reminder was staged without sending external data.',
        },
      ],
    },
  };
  const template = templates[name] || {
    contractVersion: 'zavorth-automation-hook/1',
    id: name,
    title: name,
    description: 'Governed automation hook prepared by Zavorth setup.',
    enabled: false,
    event: 'runtime.after_execute',
    safety: {
      noSecrets: true,
      requiresPolicy: true,
      canSendExternalData: false,
    },
    actions: [
      {
        type: 'receipt.create',
        title: 'Automation hook evidence',
        summary: 'This hook can create local evidence after you review and enable it.',
      },
    ],
  };
  return `${JSON.stringify({
    ...template,
    createdBy: 'zavorth setup',
  }, null, 2)}\n`;
}

function shouldReplaceLegacyHookTemplate(filePath: string): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed?.contractVersion === 'zavorth-hook-template/1'
      && parsed?.enabled !== true
      && Array.isArray(parsed?.actions)
      && parsed.actions.length === 0;
  } catch {
    return false;
  }
}

function quoteEnvValue(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function redactSecret(value: string): string {
  const raw = String(value || '');
  if (!raw) {
    return '[redacted]';
  }
  if (raw === 'configured-secret') {
    return '[redacted]';
  }
  return raw.length <= 8 ? '[redacted]' : `${raw.slice(0, 3)}...${raw.slice(-3)}`;
}

function redactConnectionUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username) {
      url.username = '[redacted]';
    }
    if (url.password) {
      url.password = '[redacted]';
    }
    return url.toString();
  } catch {
    return redactSecret(value);
  }
}

function redactHome(value: string): string {
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) {
    return value;
  }
  const normalizedHome = path.resolve(home);
  const normalizedValue = path.resolve(value);
  return normalizedValue.toLowerCase().startsWith(normalizedHome.toLowerCase())
    ? normalizedValue.replace(normalizedHome, '~')
    : normalizedValue;
}
