#!/usr/bin/env node

import { ChannelSetupAssistantService } from '../src/services/ChannelSetupAssistantService.js';
import { normalizePlatformKey, type PlatformKey } from '../src/contracts/PlatformContract.js';
import type { ChannelInstallMode } from '../src/services/ChannelInstallScaffoldService.js';

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
  doctor: boolean;
  localOnly: boolean;
  asJson: boolean;
  intentText: string | null;
};

function parseArgs(argv: string[]): ParsedArgs {
  let channelId: PlatformKey | null = null;
  let mode: ChannelInstallMode | null = null;
  let apply = false;
  let doctor = false;
  let localOnly = false;
  let asJson = false;
  let intentText: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim();
    const normalized = current.toLowerCase();
    if (normalized === '--channel') {
      channelId = normalizePlatformKey(String(argv[index + 1] || '').trim());
      index += 1;
      continue;
    }
    if (normalized === '--mode') {
      const candidate = String(argv[index + 1] || '').trim().toLowerCase();
      mode = CHANNEL_INSTALL_MODES.includes(candidate as ChannelInstallMode)
        ? candidate as ChannelInstallMode
        : null;
      index += 1;
      continue;
    }
    if (normalized === '--apply') {
      apply = true;
      continue;
    }
    if (normalized === '--doctor') {
      doctor = true;
      continue;
    }
    if (normalized === '--local-only') {
      localOnly = true;
      continue;
    }
    if (normalized === '--json') {
      asJson = true;
      continue;
    }
    if (normalized === '--intent' || normalized === '--text') {
      intentText = String(argv[index + 1] || '').trim() || null;
      index += 1;
      continue;
    }
  }

  return {
    channelId,
    mode,
    apply,
    doctor,
    localOnly,
    asJson,
    intentText,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const service = new ChannelSetupAssistantService();

  if (args.apply) {
    if (!args.channelId) {
      throw new Error('Use --channel <telegram|discord|slack|whatsapp|signal|imessage|teams|email> with --apply.');
    }
    const result = await service.apply({
      channelId: args.channelId,
      mode: args.mode,
      requestedBy: 'cli',
    });
    if (args.asJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    renderAssistant(result.assistant);
    console.log('');
    console.log(`[channels:assistant] scaffold aplicado em ${result.applyReport.env.filePath}`);
    console.log(`[channels:assistant] written keys: ${result.applyReport.env.writtenKeys.join(', ') || 'none'}`);
    return;
  }

  if (args.doctor) {
    const result = await service.runDoctor({
      selectedId: args.channelId,
      localOnly: args.localOnly,
    });
    if (args.asJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    renderAssistant(result.assistant);
    console.log('');
    console.log(`[channels:assistant] doctor: ${result.doctor.status} - ${result.doctor.summary}`);
    if (result.selectedItem) {
      console.log(`[channels:assistant] ${result.selectedItem.channelId}: ${result.selectedItem.status} - ${result.selectedItem.summary}`);
    }
    return;
  }

  const session = service.buildSession({
    channelId: args.channelId,
    mode: args.mode,
    intentText: args.intentText,
  });
  if (args.asJson) {
    process.stdout.write(`${JSON.stringify(session, null, 2)}\n`);
    return;
  }
  renderAssistant(session);
}

function renderAssistant(session: ReturnType<ChannelSetupAssistantService['buildSession']>): void {
  console.log('[channels:assistant] Channel setup assistant');
  console.log(`[channels:assistant] status: ${session.status}`);
  console.log(`[channels:assistant] response: ${session.naturalReply}`);
  if (session.selected) {
    console.log(`[channels:assistant] channel: ${session.selected.label}`);
    console.log(`[channels:assistant] modo: ${session.selected.setupMode}`);
    console.log(`[channels:assistant] faltando: ${session.selected.missingEnvKeys.join(', ') || 'nada'}`);
    console.log(`[channels:assistant] next passo: ${session.selected.operatorNextStep}`);
  } else {
    console.log('[channels:assistant] available channels:');
    for (const option of session.options) {
      console.log(`- ${option.label}: ${option.operatorNextStep}`);
    }
  }
}

main().catch((error) => {
  console.error(`[channels:assistant] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
