#!/usr/bin/env node

import {
  ChannelSetupGuideService,
  type ChannelSetupApplyInput,
  type ChannelSetupChannelId,
  type ChannelSetupMode,
} from '../src/services/ChannelSetupGuideService.js';

type ParsedArgs = {
  json: boolean;
  apply: boolean;
  channelId: ChannelSetupChannelId | null;
  mode: ChannelSetupMode | null;
  values: Record<string, string | undefined>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const values: Record<string, string | undefined> = {};

  const readFlag = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const inline = argv.find((entry) => entry.startsWith(prefix));
    if (inline) {
      return inline.slice(prefix.length);
    }
    const index = argv.findIndex((entry) => entry === `--${name}`);
    if (index >= 0) {
      return argv[index + 1];
    }
    return undefined;
  };

  values.allowedUserIds = readFlag('allowed-user-ids');
  values.userRoles = readFlag('user-roles');
  values.allowedGuildIds = readFlag('allowed-guild-ids');
  values.allowedChannelIds = readFlag('allowed-channel-ids');
  values.ownerUserIds = readFlag('owner-user-ids');
  values.allowDms = readFlag('allow-dms');
  values.publicServerMode = readFlag('public-server-mode');
  values.commandExposure = readFlag('command-exposure');
  values.botToken = readFlag('bot-token');
  values.bridgeSecret = readFlag('bridge-secret');
  values.bridgeSecretFile = readFlag('bridge-secret-file');
  values.workspaceId = readFlag('workspace-id');
  values.signingSecret = readFlag('signing-secret');
  values.allowedChatIds = readFlag('allowed-chat-ids');
  values.phoneNumberId = readFlag('phone-number-id');
  values.accessToken = readFlag('access-token');
  values.webhookVerifyToken = readFlag('webhook-verify-token');
  values.sessionDir = readFlag('session-dir');
  values.cloudApiVersion = readFlag('cloud-api-version');
  values.cliPath = readFlag('cli-path');
  values.jsonRpcUrl = readFlag('json-rpc-url');
  values.accountNumber = readFlag('account-number');
  values.allowedRecipients = readFlag('allowed-recipients');
  values.nodeId = readFlag('node-id');
  values.bridgeScript = readFlag('bridge-script');
  values.readOnly = readFlag('read-only');
  values.appId = readFlag('app-id');
  values.appPassword = readFlag('app-password');
  values.clientSecret = readFlag('client-secret');
  values.tenantId = readFlag('tenant-id');
  values.allowedConversationIds = readFlag('allowed-conversation-ids');
  values.smtpHost = readFlag('smtp-host');
  values.smtpPort = readFlag('smtp-port');
  values.smtpUser = readFlag('smtp-user');
  values.smtpPass = readFlag('smtp-pass');
  values.imapHost = readFlag('imap-host');
  values.outboxDir = readFlag('outbox-dir');
  values.statusFile = readFlag('status-file');

  return {
    json: argv.includes('--json'),
    apply: argv.includes('--apply'),
    channelId: normalizeChannelId(readFlag('channel') || ''),
    mode: normalizeMode(readFlag('mode') || ''),
    values,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const service = new ChannelSetupGuideService();

  if (!args.apply) {
    const report = service.buildCatalog();
    if (args.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    console.log('[zavorth-channels] catalogo de setup de canais');
    console.log(`[zavorth-channels] resumo: ${report.summary}`);
    console.log(`[zavorth-channels] comando base: ${report.command}`);
    for (const entry of report.entries) {
      console.log(`[zavorth-channels] ${entry.channelId}: ${entry.status} | mode=${entry.currentMode} | ${entry.summary}`);
      console.log(`  setup: ${entry.setupCommand}`);
      console.log(`  doctor: ${entry.doctorCommand}`);
      console.log(`  docs: ${entry.docsPath}`);
      if (entry.webhookPath) {
        console.log(`  webhook: ${entry.webhookPath}`);
      }
      if (entry.requiredEnvKeys.length > 0) {
        console.log(`  env obrigatorias: ${entry.requiredEnvKeys.join(', ')}`);
      }
      if (entry.optionalEnvKeys.length > 0) {
        console.log(`  env opcionais: ${entry.optionalEnvKeys.join(', ')}`);
      }
      for (const note of entry.notes.slice(0, 3)) {
        console.log(`  - ${note}`);
      }
    }
    console.log('[zavorth-channels] para o caminho guiado oficial, use: npm run setup:channels');
    console.log('[zavorth-channels] para aplicar um preset legado direto: npm run ops:channels -- --channel slack --mode stub --apply');
    return;
  }

  if (!args.channelId) {
    throw new Error('Use --channel telegram|discord|slack|whatsapp|signal|imessage|teams|email junto com --apply.');
  }
  if (!args.mode) {
    throw new Error('Use --mode native|bridge|stub|local-outbox|cloud-api|baileys|signal-cli|mac-bridge|graph-bot|smtp-imap junto com --apply.');
  }

  const result = service.apply({
    channelId: args.channelId,
    mode: args.mode,
    values: args.values,
  } satisfies ChannelSetupApplyInput);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-channels] preset aplicado');
  console.log(`[zavorth-channels] resumo: ${result.summary}`);
  console.log(`[zavorth-channels] canal: ${result.channelId} | modo: ${result.mode}`);
  console.log(`[zavorth-channels] env atualizadas: ${result.envKeysWritten.join(', ') || 'nenhuma'}`);
  if (result.filesTouched.length > 0) {
    console.log('[zavorth-channels] arquivos/dirs tocados:');
    for (const target of result.filesTouched) {
      console.log(`- ${target}`);
    }
  }
  if (result.nextSteps.length > 0) {
    console.log('[zavorth-channels] proximos passos:');
    for (const step of result.nextSteps) {
      console.log(`- ${step}`);
    }
  }
}

function normalizeChannelId(value: string): ChannelSetupChannelId | null {
  const normalized = String(value || '').trim().toLowerCase();
  switch (normalized) {
    case 'telegram':
    case 'discord':
    case 'slack':
    case 'whatsapp':
    case 'signal':
    case 'imessage':
    case 'teams':
    case 'email':
      return normalized;
    default:
      return null;
  }
}

function normalizeMode(value: string): ChannelSetupMode | null {
  const normalized = String(value || '').trim().toLowerCase();
  switch (normalized) {
    case 'native':
    case 'bridge':
    case 'stub':
    case 'local-outbox':
    case 'cloud-api':
    case 'baileys':
    case 'signal-cli':
    case 'mac-bridge':
    case 'graph-bot':
    case 'smtp-imap':
      return normalized;
    default:
      return null;
  }
}

main().catch((error) => {
  console.error('[zavorth-channels] falha ao preparar os canais.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
