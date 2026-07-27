#!/usr/bin/env node

import * as p from '@clack/prompts';
import color from 'picocolors';
import {
  ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS,
  resolveSetupStudioProvider,
} from '../src/cli/ZavorthSetupStudioService.js';
import {
  type ZavorthChannelWizardId,
  ZavorthProviderChannelWizardService,
  normalizeZavorthChannelWizardId,
} from '../src/cli/ZavorthProviderChannelWizardService.js';
import {
  type ZavorthProviderLiveValidationResult,
  renderZavorthProviderLiveValidationResult,
  validateZavorthProviderLive,
} from '../src/cli/ZavorthProviderLiveValidationService.js';

type WizardFlags = {
  json: boolean;
  apply: boolean;
  help: boolean;
  provider: string | null;
  model: string | null;
  channel: string | null;
  secretEnv: string | null;
  tokenEnv: string | null;
  allowedUsers: string | null;
  allowedGuilds: string | null;
  allowedChannels: string | null;
  owners: string | null;
  testLive: boolean;
  skipLiveTest: boolean;
  discover: boolean;
  baseUrl: string | null;
  apiKey: string | null;
  discoverKind: string | null;
};

const CHANNEL_OPTIONS: Array<{ value: ZavorthChannelWizardId; label: string; hint: string }> = [
  { value: 'telegram', label: 'Telegram', hint: 'Bot token + user allowlist.' },
  { value: 'discord', label: 'Discord', hint: 'Bot token + guild/channel allowlist.' },
  { value: 'slack', label: 'Slack', hint: 'Token + allowlist de workspace/channel when used.' },
  { value: 'whatsapp', label: 'WhatsApp', hint: 'Token/bridge configuravel.' },
  { value: 'signal', label: 'Signal', hint: 'Bridge local configuravel.' },
  { value: 'email', label: 'Email', hint: 'Mailbox/SMTP configuravel.' },
];

const rawArgs = process.argv.slice(2);
const flags = parseFlags(rawArgs);
const mode = resolveMode(rawArgs);
const projectRoot = process.cwd();
const wizard = new ZavorthProviderChannelWizardService();

async function main(): Promise<void> {
  if (flags.help || !mode) {
    printHelp();
    return;
  }

  if (mode.kind === 'provider') {
    await runProvider(mode.action);
    return;
  }

  await runChannel(mode.channelId);
}

async function runProvider(action: 'add' | 'switch'): Promise<void> {
  const interactive = isInteractive();

  if (flags.discover) {
    await runAutoDiscovery(action, interactive);
    return;
  }

  const providerId = flags.provider || (interactive ? await selectProvider() : 'deferred');
  const provider = resolveSetupStudioProvider(providerId);
  const modelId = flags.model || (interactive && provider.id !== 'deferred'
    ? await textPrompt('Modelo default deste provider', provider.defaultModel)
    : provider.defaultModel);
  const providerSecret = readSecretFromEnv(flags.secretEnv)
    || (interactive && provider.needsSecret ? await optionalSecret(`API key for ${provider.label}`) : null);
  const liveValidation = await maybeRunProviderLiveValidation({
    interactive,
    providerId,
    modelId,
    providerSecret,
    providerNeedsSecret: provider.needsSecret,
  });
  const apply = flags.apply || (interactive ? await confirmApply() : false);

  const result = wizard.buildProvider({
    projectRoot,
    action,
    providerId,
    modelId,
    providerSecret,
    liveValidation,
    apply,
  });
  printResult(result);
}

async function runAutoDiscovery(action: 'add' | 'switch', interactive: boolean): Promise<void> {
  const { ProviderAutoDiscoveryService } = await import('../src/services/providers/catalog/ProviderAutoDiscoveryService.js');

  const providerId = flags.provider || (interactive ? await textPrompt('ID do provider (ex: groq, together)', '') : null);
  if (!providerId) {
    p.log.error('Provider ID e required para auto-discovery.');
    return;
  }

  const baseUrl = flags.baseUrl || (interactive ? await textPrompt('Base URL do provider (ex: https://api.groq.com/openai/v1)', '') : null);
  if (!baseUrl) {
    p.log.error('Base URL e obrigatoria para auto-discovery.');
    return;
  }

  const apiKey = flags.apiKey || readSecretFromEnv(flags.secretEnv) || (interactive ? await optionalSecret(`API key for ${providerId}`) : null);
  const kind = (flags.discoverKind as 'openai_compatible' | 'anthropic_compatible') || 'openai_compatible';

  p.log.info(`Descobrindo modelos de ${providerId} em ${baseUrl}...`);

  const service = new ProviderAutoDiscoveryService();
  const result = await service.discover({
    providerId,
    baseUrl,
    apiKey: apiKey || undefined,
    kind,
  });

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      p.log.warn(warning);
    }
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      p.log.error(error);
    }
    return;
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  p.log.success(`Descobertos ${result.models.length} modelos de ${result.label}:`);

  const modelTable = result.models.map((m) => ({
    ID: m.id,
    Nome: m.name,
    Tipo: m.type,
  }));

  p.table(modelTable, {
    columns: [
      { key: 'ID', header: 'Modelo' },
      { key: 'Nome', header: 'Nome' },
      { key: 'Tipo', header: 'Tipo' },
    ],
  });

  if (interactive) {
    const apply = await confirmApply();
    if (apply) {
      const { ZavorthSetupStudioService } = await import('../src/cli/ZavorthSetupStudioService.js');
      const plan = ZavorthSetupStudioService.buildZavorthSetupStudioPlan({
        projectRoot,
        providerId,
        modelId: result.models[0]?.id || 'default',
        providerSecret: apiKey,
        memoryMode: 'local-metadata',
        vaultScope: 'skip',
        scanDirs: [],
      });
      ZavorthSetupStudioService.applyZavorthSetupStudioEnvPlan(plan);
      p.log.success('Configuraction gravada em .env');
    }
  }
}

async function runChannel(initialChannelId: string | null): Promise<void> {
  const interactive = isInteractive();
  const channelId = initialChannelId
    ? normalizeZavorthChannelWizardId(initialChannelId)
    : interactive
      ? await selectChannel()
      : normalizeZavorthChannelWizardId(flags.channel || 'telegram');
  const token = readSecretFromEnv(flags.tokenEnv)
    || (interactive ? await optionalSecret(`Token/credential para ${channelId}`) : null);
  const allowedUserIds = flags.allowedUsers || (interactive ? await optionalText('Users permitidos, separados por virgula', '') : null);
  const allowedGuildIds = flags.allowedGuilds || (interactive && channelId === 'discord' ? await optionalText('Allowed guilds, comma-separated', '') : null);
  const allowedChannelIds = flags.allowedChannels || (interactive && ['discord', 'slack'].includes(channelId)
    ? await optionalText('Canais permitidos, separados por virgula', '')
    : null);
  const ownerUserIds = flags.owners || (interactive ? await optionalText('Owners/admins permitidos, separados por virgula', '') : null);
  const apply = flags.apply || (interactive ? await confirmApply() : false);

  const result = wizard.buildChannel({
    projectRoot,
    channelId,
    token,
    allowedUserIds,
    allowedGuildIds,
    allowedChannelIds,
    ownerUserIds,
    apply,
  });
  printResult(result);
}

function parseFlags(argv: string[]): WizardFlags {
  return {
    json: argv.includes('--json'),
    apply: argv.includes('--apply'),
    help: argv.includes('--help') || argv.includes('-h'),
    provider: readFlag(argv, 'provider'),
    model: readFlag(argv, 'model'),
    channel: readFlag(argv, 'channel'),
    secretEnv: readFlag(argv, 'secret-env'),
    tokenEnv: readFlag(argv, 'token-env'),
    allowedUsers: readFlag(argv, 'allowed-users'),
    allowedGuilds: readFlag(argv, 'allowed-guilds'),
    allowedChannels: readFlag(argv, 'allowed-channels'),
    owners: readFlag(argv, 'owners'),
    testLive: argv.includes('--test-live') || argv.includes('--live-test'),
    skipLiveTest: argv.includes('--skip-live-test') || argv.includes('--no-live-test'),
    discover: argv.includes('--discover'),
    baseUrl: readFlag(argv, 'base-url') || readFlag(argv, 'baseUrl'),
    apiKey: readFlag(argv, 'api-key') || readFlag(argv, 'apiKey'),
    discoverKind: readFlag(argv, 'discover-kind') || readFlag(argv, 'kind'),
  };
}

function resolveMode(argv: string[]): { kind: 'provider'; action: 'add' | 'switch' } | { kind: 'channel'; channelId: string | null } | null {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const first = String(positional[0] || '').toLowerCase();
  const second = String(positional[1] || '').toLowerCase();
  if (first === 'provider' || first === 'providers') {
    return { kind: 'provider', action: second === 'switch' || second === 'select' || second === 'use' ? 'switch' : 'add' };
  }
  if (first === 'channel' || first === 'channels') {
    const candidate = second && !['add', 'setup', 'configure'].includes(second) ? second : (flags.channel || null);
    return { kind: 'channel', channelId: candidate };
  }
  if (first === 'add' || first === 'switch' || first === 'select' || first === 'use') {
    return { kind: 'provider', action: first === 'add' ? 'add' : 'switch' };
  }
  if (CHANNEL_OPTIONS.some((entry) => entry.value === first)) {
    return { kind: 'channel', channelId: first };
  }
  return null;
}

function readFlag(argv: string[], name: string): string | null {
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : null;
}

function readSecretFromEnv(envName: string | null): string | null {
  if (!envName) return null;
  const value = process.env[envName];
  if (!value) {
    throw new Error(`Variable ${envName} is not defined.`);
  }
  return value;
}

async function selectProvider(): Promise<string> {
  const selected = await p.select({
    message: 'Which provider do you want to configure...',
    options: ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.filter((provider) => provider.id !== 'deferred').map((provider) => ({
      value: provider.id,
      label: provider.label,
      hint: provider.needsSecret ? 'Can save key through secret prompt.' : 'Does not require a key.',
    })),
    initialValue: 'gemini',
  });
  if (p.isCancel(selected)) throw new Error('Wizard cancelado.');
  return String(selected);
}

async function selectChannel(): Promise<ZavorthChannelWizardId> {
  const selected = await p.select({
    message: 'Which channel do you want to configure...',
    options: CHANNEL_OPTIONS,
    initialValue: 'telegram',
  });
  if (p.isCancel(selected)) throw new Error('Wizard cancelado.');
  return selected as ZavorthChannelWizardId;
}

async function textPrompt(message: string, initialValue: string): Promise<string> {
  const value = await p.text({
    message,
    initialValue,
    validate: (input) => String(input || '').trim() ? undefined : 'Informe um value.',
  });
  if (p.isCancel(value)) throw new Error('Wizard cancelado.');
  return String(value).trim();
}

async function optionalText(message: string, initialValue: string): Promise<string | null> {
  const value = await p.text({ message, initialValue });
  if (p.isCancel(value)) throw new Error('Wizard cancelado.');
  return String(value || '').trim() || null;
}

async function optionalSecret(message: string): Promise<string | null> {
  const wantsSecret = await p.confirm({
    message: `${message}: salvar agora...`,
    initialValue: false,
  });
  if (p.isCancel(wantsSecret) || !wantsSecret) return null;
  const value = await p.password({ message });
  if (p.isCancel(value)) throw new Error('Wizard cancelado.');
  return String(value || '').trim() || null;
}

async function confirmApply(): Promise<boolean> {
  const confirmed = await p.confirm({
    message: 'Gravar essas configurations no .env agora...',
    initialValue: false,
  });
  if (p.isCancel(confirmed)) throw new Error('Wizard cancelado.');
  return Boolean(confirmed);
}

async function maybeRunProviderLiveValidation(input: {
  interactive: boolean;
  providerId: string;
  modelId: string;
  providerSecret: string | null;
  providerNeedsSecret: boolean;
}): Promise<ZavorthProviderLiveValidationResult | null> {
  if (flags.skipLiveTest) {
    return null;
  }
  if (input.providerNeedsSecret && !input.providerSecret) {
    return null;
  }
  const shouldTest = flags.testLive || (input.interactive ? await confirmLiveTest() : false);
  if (!shouldTest) {
    return null;
  }

  while (true) {
    const validation = await runProviderLiveValidation(input);
    if (!flags.json) {
      process.stdout.write(`${renderZavorthProviderLiveValidationResult(validation)}\n`);
    }
    if (validation.status === 'passed' || validation.status === 'unsupported' || !input.interactive) {
      return validation;
    }
    const next = await p.select({
      message: 'O teste live failed. Como deseja seguir...',
      options: [
        { value: 'retry', label: 'try again', hint: 'Repete o ping com a mesma chave/modelo.' },
        { value: 'save', label: 'Salvar mesmo assim', hint: 'Guarda prova sanitizada da failure.' },
        { value: 'skip', label: 'Skip test', hint: 'Does not write live proof.' },
      ],
      initialValue: 'retry',
    });
    if (p.isCancel(next) || next === 'skip') {
      return null;
    }
    if (next === 'save') {
      return validation;
    }
  }
}

async function confirmLiveTest(): Promise<boolean> {
  const confirmed = await p.confirm({
    message: 'Testar esse provider agora com uma call live leve...',
    initialValue: false,
  });
  if (p.isCancel(confirmed)) throw new Error('Wizard cancelado.');
  return Boolean(confirmed);
}

async function runProviderLiveValidation(input: {
  providerId: string;
  modelId: string;
  providerSecret: string | null;
}): Promise<ZavorthProviderLiveValidationResult> {
  if (flags.json) {
    return validateZavorthProviderLive({
      projectRoot,
      providerId: input.providerId,
      modelId: input.modelId,
      providerSecret: input.providerSecret,
      explicitUserConsent: true,
    });
  }
  const spinner = p.spinner();
  spinner.start('Testando provider com ping live...');
  const validation = await validateZavorthProviderLive({
    projectRoot,
    providerId: input.providerId,
    modelId: input.modelId,
    providerSecret: input.providerSecret,
    explicitUserConsent: true,
  });
  spinner.stop(validation.status === 'passed' ? 'Provider validated.' : 'Teste live completed com attention.');
  return validation;
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !flags.json);
}

function printResult(result: ReturnType<ZavorthProviderChannelWizardService['buildProvider']>): void {
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${wizard.render(result)}\n`);
}

function printHelp(): void {
  process.stdout.write([
    color.bold('Zavorth Provider & Channel Wizard'),
    '',
    'Comandos:',
    '  zavorth providers add',
    '  zavorth providers add --discover --provider groq --base-url https://api.groq.com/openai/v1',
    '  zavorth providers switch --provider gemini --model gemini-2.5-flash --apply',
    '  zavorth channels telegram',
    '  zavorth channels discord --allowed-guilds 123 --allowed-channels 456 --apply',
    '',
    'Auto-Discovery:',
    '  Use --discover para descobrir modelos automaticamente via API do provider.',
    '  Requer --provider e --base-url. optional: --api-key, --kind (openai_compatible|anthropic_compatible).',
    '  Exemplo: zavorth providers add --discover --provider groq --base-url https://api.groq.com/openai/v1 --api-key $GROQ_API_KEY',
    '',
    'secrets:',
    '  Use the interactive prompt or --secret-env ENV_NAME / --token-env ENV_NAME.',
    '  O wizard nunca imprime o value bruto da chave.',
    '',
    'Opcoes:',
    '  --json              Output estruturada.',
    '  --apply             Grava no .env. without isso, e preview.',
    '  --test-live         Runs a lightweight live ping only when requested.',
    '  --skip-live-test    Does not ask for live test.',
    '  --provider <id>     Provider alvo.',
    '  --model <id>        Modelo default.',
    '  --channel <id>      Channel alvo.',
    '  --allowed-users <ids>',
    '  --allowed-guilds <ids>',
    '  --allowed-channels <ids>',
    '  --owners <ids>',
    '  --discover          Enables model auto-discovery through the API.',
    '  --base-url <url>    Base URL do provider (required com --discover).',
    '  --api-key <key>     API key (optional com --discover).',
    '  --kind <type>       Tipo de compatibilidade: openai_compatible ou anthropic_compatible.',
    '',
  ].join('\n'));
}

main().catch((error) => {
  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  } else {
    process.stderr.write(`${color.red('Wizard failed:')} ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exitCode = 1;
});
