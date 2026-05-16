#!/usr/bin/env node

import { ZavorthConnectorExperienceService } from '../src/services/ZavorthConnectorExperienceService.js';

type ParsedArgs = {
  action: 'doctor' | 'setup';
  channelId: string | null;
  mode: string | null;
  apply: boolean;
  asJson: boolean;
  localOnly: boolean;
  allowedUserIds: string[];
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  ownerUserIds: string[];
  allowDms: boolean | null;
};

function parseArgs(argv: string[]): ParsedArgs {
  const tokens = argv.filter((entry) => String(entry || '').trim());
  const first = String(tokens[0] || '').trim().toLowerCase();
  const action: ParsedArgs['action'] = first === 'setup' ? 'setup' : 'doctor';
  const positional = String(tokens[1] || '').trim();
  const channelId = first === 'setup' || first === 'doctor'
    ? positional && !positional.startsWith('--') ? positional : null
    : first || null;
  return {
    action,
    channelId,
    mode: readFlag(tokens, 'mode'),
    apply: tokens.includes('--apply'),
    asJson: tokens.includes('--json'),
    localOnly: tokens.includes('--local-only'),
    allowedUserIds: readMany(tokens, ['allowed-user', 'allowed-users', 'user']),
    allowedGuildIds: readMany(tokens, ['guild', 'guilds', 'allowed-guild', 'allowed-guilds']),
    allowedChannelIds: readMany(tokens, ['channel', 'channels', 'allowed-channel', 'allowed-channels']),
    ownerUserIds: readMany(tokens, ['owner', 'owners', 'owner-user', 'owner-users']),
    allowDms: tokens.includes('--allow-dms')
      ? true
      : tokens.includes('--no-dms')
        ? false
        : null,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const service = new ZavorthConnectorExperienceService();
  if (args.action === 'setup') {
    if (!args.channelId) {
      throw new Error('Use: zavorth connectors setup <telegram|discord|github> [--apply]');
    }
    const result = args.apply
      ? await service.applySetup(args)
      : service.buildSetup(args);
    process.stdout.write(args.asJson ? `${JSON.stringify(result, null, 2)}\n` : service.renderSetup(result));
    return;
  }

  const result = await service.runDoctor({
    selectedId: args.channelId,
    localOnly: args.localOnly,
  });
  process.stdout.write(args.asJson ? `${JSON.stringify(result, null, 2)}\n` : service.renderDoctor(result));
}

function readFlag(tokens: string[], name: string): string | null {
  const inlinePrefix = `--${name}=`;
  const inline = tokens.find((token) => token.startsWith(inlinePrefix));
  if (inline) {
    return inline.slice(inlinePrefix.length).trim() || null;
  }
  const index = tokens.indexOf(`--${name}`);
  return index >= 0 ? String(tokens[index + 1] || '').trim() || null : null;
}

function readMany(tokens: string[], names: string[]): string[] {
  const values: string[] = [];
  for (const name of names) {
    const inlinePrefix = `--${name}=`;
    for (const token of tokens) {
      if (token.startsWith(inlinePrefix)) {
        values.push(token.slice(inlinePrefix.length));
      }
    }
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index] === `--${name}` && tokens[index + 1]) {
        values.push(tokens[index + 1]);
      }
    }
  }
  return values;
}

main().catch((error) => {
  console.error(`[zavorth-connectors] falha: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
