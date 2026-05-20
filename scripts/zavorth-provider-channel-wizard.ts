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
};

const CHANNEL_OPTIONS: Array<{ value: ZavorthChannelWizardId; label: string; hint: string }> = [
  { value: 'telegram', label: 'Telegram', hint: 'Bot token + allowlist de usuario.' },
  { value: 'discord', label: 'Discord', hint: 'Bot token + guild/channel allowlist.' },
  { value: 'slack', label: 'Slack', hint: 'Token + allowlist de workspace/canal quando usado.' },
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
  const providerId = flags.provider || (interactive ? await selectProvider() : 'deferred');
  const provider = resolveSetupStudioProvider(providerId);
  const modelId = flags.model || (interactive && provider.id !== 'deferred'
    ? await textPrompt('Modelo padrao deste provider', provider.defaultModel)
    : provider.defaultModel);
  const providerSecret = readSecretFromEnv(flags.secretEnv)
    || (interactive && provider.needsSecret ? await optionalSecret(`Chave de API para ${provider.label}`) : null);
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

async function runChannel(initialChannelId: string | null): Promise<void> {
  const interactive = isInteractive();
  const channelId = initialChannelId
    ? normalizeZavorthChannelWizardId(initialChannelId)
    : interactive
      ? await selectChannel()
      : normalizeZavorthChannelWizardId(flags.channel || 'telegram');
  const token = readSecretFromEnv(flags.tokenEnv)
    || (interactive ? await optionalSecret(`Token/credencial para ${channelId}`) : null);
  const allowedUserIds = flags.allowedUsers || (interactive ? await optionalText('Usuarios permitidos, separados por virgula', '') : null);
  const allowedGuildIds = flags.allowedGuilds || (interactive && channelId === 'discord' ? await optionalText('Guilds permitidas, separadas por virgula', '') : null);
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
    throw new Error(`A variavel ${envName} nao esta definida.`);
  }
  return value;
}

async function selectProvider(): Promise<string> {
  const selected = await p.select({
    message: 'Qual provider voce quer configurar?',
    options: ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.filter((provider) => provider.id !== 'deferred').map((provider) => ({
      value: provider.id,
      label: provider.label,
      hint: provider.needsSecret ? 'Pode salvar chave por prompt secreto.' : 'Nao exige chave.',
    })),
    initialValue: 'gemini',
  });
  if (p.isCancel(selected)) throw new Error('Wizard cancelado.');
  return String(selected);
}

async function selectChannel(): Promise<ZavorthChannelWizardId> {
  const selected = await p.select({
    message: 'Qual canal voce quer configurar?',
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
    validate: (input) => String(input || '').trim() ? undefined : 'Informe um valor.',
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
    message: `${message}: salvar agora?`,
    initialValue: false,
  });
  if (p.isCancel(wantsSecret) || !wantsSecret) return null;
  const value = await p.password({ message });
  if (p.isCancel(value)) throw new Error('Wizard cancelado.');
  return String(value || '').trim() || null;
}

async function confirmApply(): Promise<boolean> {
  const confirmed = await p.confirm({
    message: 'Gravar essas configuracoes no .env agora?',
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
      message: 'O teste live falhou. Como deseja seguir?',
      options: [
        { value: 'retry', label: 'Tentar novamente', hint: 'Repete o ping com a mesma chave/modelo.' },
        { value: 'save', label: 'Salvar mesmo assim', hint: 'Guarda prova sanitizada da falha.' },
        { value: 'skip', label: 'Pular teste', hint: 'Nao grava prova live.' },
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
    message: 'Testar esse provider agora com uma chamada live leve?',
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
  spinner.stop(validation.status === 'passed' ? 'Provider validado.' : 'Teste live concluido com atencao.');
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
    '  zavorth providers switch --provider gemini --model gemini-2.5-flash --apply',
    '  zavorth channels telegram',
    '  zavorth channels discord --allowed-guilds 123 --allowed-channels 456 --apply',
    '',
    'Segredos:',
    '  Use o prompt interativo ou --secret-env NOME_DA_ENV / --token-env NOME_DA_ENV.',
    '  O wizard nunca imprime o valor bruto da chave.',
    '',
    'Opcoes:',
    '  --json              Saida estruturada.',
    '  --apply             Grava no .env. Sem isso, e preview.',
    '  --test-live         Executa ping real leve, somente quando pedido.',
    '  --skip-live-test    Nao pergunta por teste live.',
    '  --provider <id>     Provider alvo.',
    '  --model <id>        Modelo padrao.',
    '  --channel <id>      Canal alvo.',
    '  --allowed-users <ids>',
    '  --allowed-guilds <ids>',
    '  --allowed-channels <ids>',
    '  --owners <ids>',
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
