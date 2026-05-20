import fs from 'fs';
import path from 'path';

export type ZavorthSetupStudioProviderId =
  | 'deferred'
  | 'gemini'
  | 'openai'
  | 'openrouter'
  | 'groq'
  | 'deepseek'
  | 'anthropic'
  | 'huggingface'
  | 'elevenlabs'
  | 'local';

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
  provider: {
    id: ZavorthSetupStudioProviderId;
    modelId: string;
    secretStored: boolean;
    secretEnvKey: string | null;
  };
  channels: {
    telegram: 'skip' | 'configured-placeholder' | 'configured-secret';
  };
  memory: {
    mode: 'off' | 'local-metadata' | 'local-summary';
    vaultScope: 'skip' | 'documents' | 'downloads' | 'custom' | 'whole-pc';
    scanDirs: string[];
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

export type BuildZavorthSetupStudioPlanInput = {
  projectRoot: string;
  providerId: string;
  modelId?: string | null;
  providerSecret?: string | null;
  telegramBotToken?: string | null;
  telegramAllowedUserIds?: string | null;
  memoryMode: 'off' | 'local-metadata' | 'local-summary';
  vaultScope: 'skip' | 'documents' | 'downloads' | 'custom' | 'whole-pc';
  scanDirs?: string[] | null;
};

export const ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS: ZavorthSetupStudioProviderOption[] = [
  {
    id: 'deferred',
    label: 'Configurar depois',
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

  if (provider.id !== 'deferred') {
    envUpdates.push({
      key: 'ZAVORTH_DEFAULT_PROVIDER',
      value: provider.id,
      redactedValue: provider.id,
      reason: 'provider padrao escolhido no setup',
    });
  }
  if (provider.modelEnvKey && modelId && modelId !== 'deferred') {
    envUpdates.push({
      key: provider.modelEnvKey,
      value: modelId,
      redactedValue: modelId,
      reason: 'modelo padrao escolhido no setup',
    });
  }

  const providerSecret = String(input.providerSecret || '').trim();
  const providerSecretEnvKey = provider.secretEnvKeys[0] || null;
  if (provider.needsSecret && providerSecret && providerSecretEnvKey) {
    envUpdates.push({
      key: providerSecretEnvKey,
      value: providerSecret,
      redactedValue: redactSecret(providerSecret),
      reason: 'credencial do provider capturada por campo secreto',
    });
  }

  const telegramBotToken = String(input.telegramBotToken || '').trim();
  if (telegramBotToken) {
    envUpdates.push({
      key: 'TELEGRAM_BOT_TOKEN',
      value: telegramBotToken,
      redactedValue: redactSecret(telegramBotToken),
      reason: 'bot token do Telegram capturado por campo secreto',
    });
  }
  const telegramAllowedUserIds = String(input.telegramAllowedUserIds || '').trim();
  if (telegramAllowedUserIds) {
    envUpdates.push({
      key: 'TELEGRAM_ALLOWED_USER_IDS',
      value: telegramAllowedUserIds,
      redactedValue: telegramAllowedUserIds,
      reason: 'allowlist de usuario Telegram',
    });
  }

  const scanDirs = normalizeScanDirs(input.scanDirs);
  if (scanDirs.length > 0) {
    envUpdates.push({
      key: 'MNEMOS_SCAN_DIRS',
      value: scanDirs.join(path.delimiter),
      redactedValue: scanDirs.map((entry) => redactHome(entry)).join(path.delimiter),
      reason: 'cofre/escopo local do Mnemos',
    });
  }

  return {
    contractVersion: 'zavorth-setup-studio/1',
    envFile,
    provider: {
      id: provider.id,
      modelId,
      secretStored: Boolean(providerSecret && providerSecretEnvKey),
      secretEnvKey: providerSecret && providerSecretEnvKey ? providerSecretEnvKey : null,
    },
    channels: {
      telegram: telegramBotToken ? 'configured-secret' : telegramAllowedUserIds ? 'configured-placeholder' : 'skip',
    },
    memory: {
      mode: input.memoryMode,
      vaultScope: input.vaultScope,
      scanDirs,
    },
    envUpdates,
    safety: {
      rawSecretsInPlan: false,
      rawSecretsInSummary: false,
      writesEnvFile: envUpdates.length > 0,
      providerExecutionPerformed: false,
      runtimePersistentStartPerformed: false,
      warnings: [
        ...(provider.needsSecret && !providerSecret ? [`${provider.label} foi escolhido sem chave; ficara configuravel, nao live.`] : []),
        ...(input.vaultScope === 'whole-pc' ? ['Mnemos em PC inteiro pode expor arquivos sensiveis; use somente se voce confirmou esse risco.'] : []),
      ],
    },
    nextCommands: [
      'zavorth ready',
      'zavorth start',
      'zavorth open',
    ],
  };
}

export function applyZavorthSetupStudioEnvPlan(plan: ZavorthSetupStudioPlan): { written: boolean; envFile: string; keys: string[] } {
  if (plan.envUpdates.length === 0) {
    return { written: false, envFile: plan.envFile, keys: [] };
  }
  const current = fs.existsSync(plan.envFile) ? fs.readFileSync(plan.envFile, 'utf8') : '';
  const next = mergeEnvContent(current, plan.envUpdates);
  fs.writeFileSync(plan.envFile, next, 'utf8');
  return {
    written: true,
    envFile: plan.envFile,
    keys: plan.envUpdates.map((entry) => entry.key),
  };
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
    'Setup Studio vai preparar:',
    `- Provider: ${plan.provider.id}/${plan.provider.modelId}`,
    `- Credencial: ${plan.provider.secretStored ? `${plan.provider.secretEnvKey} (${redactSecret('configured-secret')})` : 'nao gravada'}`,
    `- Telegram: ${plan.channels.telegram}`,
    `- Mnemos: ${plan.memory.mode} / ${plan.memory.vaultScope}`,
    plan.memory.scanDirs.length > 0 ? `- Cofres: ${plan.memory.scanDirs.map((entry) => redactHome(entry)).join(', ')}` : '- Cofres: nao configurados',
    '',
    'Atualizacoes em .env:',
    ...(plan.envUpdates.length > 0
      ? plan.envUpdates.map((entry) => `- ${entry.key}=${entry.redactedValue} (${entry.reason})`)
      : ['- nenhuma']),
    '',
    'Garantias:',
    '- nao imprime chave em tela',
    '- teste live do provider so roda com confirmacao explicita',
    '- nao inicia runtime persistente durante setup',
    ...(plan.safety.warnings.length > 0 ? ['', 'Atencao:', ...plan.safety.warnings.map((warning) => `- ${warning}`)] : []),
    '',
    'Depois:',
    ...plan.nextCommands.map((command) => `- ${command}`),
  ].join('\n');
}

function normalizeScanDirs(scanDirs: string[] | null | undefined): string[] {
  return Array.from(new Set((scanDirs || [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry))));
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
