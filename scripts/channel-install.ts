#!/usr/bin/env node

import { ChannelInstallScaffoldService, type ChannelInstallMode } from '../src/services/ChannelInstallScaffoldService.js';
import { normalizePlatformKey, type PlatformKey } from '../src/contracts/PlatformContract.js';

const CHANNEL_INSTALL_MODES = [
  'native',
  'bridge',
  'local',
  'cloud-api',
  'baileys',
  'signal-cli',
  'mac-bridge',
  'graph-bot',
  'smtp-imap',
] as const satisfies readonly ChannelInstallMode[];

type ParsedArgs = {
  channelId: PlatformKey | null;
  mode: ChannelInstallMode | null;
  apply: boolean;
  asJson: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  let channelId: PlatformKey | null = null;
  let mode: ChannelInstallMode | null = null;
  let apply = false;
  let asJson = false;

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim().toLowerCase();
    if (current === '--channel') {
      channelId = normalizePlatformKey(String(argv[index + 1] || '').trim()) || null;
      index += 1;
      continue;
    }
    if (current === '--mode') {
      const candidate = String(argv[index + 1] || '').trim().toLowerCase();
      if (CHANNEL_INSTALL_MODES.includes(candidate as ChannelInstallMode)) {
        mode = candidate;
      }
      index += 1;
      continue;
    }
    if (current === '--apply') {
      apply = true;
      continue;
    }
    if (current === '--json') {
      asJson = true;
    }
  }

  return {
    channelId,
    mode,
    apply,
    asJson,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const service = new ChannelInstallScaffoldService();

  if (args.apply) {
    if (!args.channelId || !args.mode) {
      throw new Error('Use --channel <telegram|discord|slack|whatsapp|signal|imessage|teams|email> and --mode <native|bridge|local|cloud-api|baileys|signal-cli|mac-bridge|graph-bot|smtp-imap> with --apply.');
    }

    const report = service.applyScaffold({
      channelId: args.channelId,
      mode: args.mode,
    });

    if (args.asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    console.log('[channels:install] scaffold aplicado');
    console.log(`[channels:install] canal: ${report.channelId}`);
    console.log(`[channels:install] modo: ${report.mode}`);
    console.log(`[channels:install] .env: ${report.env.filePath}`);
    console.log(`[channels:install] written keys: ${report.env.writtenKeys.join(', ') || 'none'}`);
    if (report.env.preservedKeys.length > 0) {
      console.log(`[channels:install] chaves preservadas: ${report.env.preservedKeys.join(', ')}`);
    }
    if (report.directoriesCreated.length > 0) {
      console.log('[channels:install] diretorios criados:');
      for (const directory of report.directoriesCreated) {
        console.log(`- ${directory}`);
      }
    }
    if (report.nextSteps.length > 0) {
      console.log('[channels:install] proximos passos:');
      for (const step of report.nextSteps) {
        console.log(`- ${step}`);
      }
    }
    console.log('[channels:install] doctor: npm run test:channels:smoke');
    return;
  }

  const report = service.buildReport();
  if (args.asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('[channels:install] panorama');
  console.log(`[channels:install] .env: ${report.envFilePath}`);
  console.log(`[channels:install] local: ${report.localBaseUrl}`);
  console.log(`[channels:install] public: ${report.publicBaseUrl || 'not configured'}`);
  for (const channel of report.channels) {
    console.log(
      `[channels:install] ${channel.channelId}: readiness=${channel.readiness} | configured=${channel.configured ? 'yes' : 'no'} | current=${channel.currentMode || 'not configured'} | recommended=${channel.recommendedMode}`,
    );
    console.log(`- ${channel.summary}`);
    if (channel.localWebhookUrl) {
      console.log(`- webhook local: ${channel.localWebhookUrl}`);
    }
    if (channel.publicWebhookUrl) {
      console.log(`- public webhook: ${channel.publicWebhookUrl}`);
    }
    if (channel.missingEnvKeys.length > 0) {
      console.log(`- faltando: ${channel.missingEnvKeys.join(', ')}`);
    }
    if (Array.isArray(channel.notes) && channel.notes.length > 0) {
      console.log(`- next passo: ${channel.notes[0]}`);
    }
    console.log(`- aplicar: ${channel.commands.apply}`);
  }
}

main().catch((error) => {
  console.error(`[channels:install] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
