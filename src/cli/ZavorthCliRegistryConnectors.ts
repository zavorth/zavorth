import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import { ZavorthConnectorExperienceService } from '../services/ZavorthConnectorExperienceService.js';
import { ZavorthProductDemoService } from '../services/ZavorthProductDemoService.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  normalized: string;
  args: string;
  writer: CliWriter;
};

function readConnectorFlag(tokens: string[], name: string): string | null {
  const inlinePrefix = `--${name}=`;
  const inline = tokens.find((token) => token.startsWith(inlinePrefix));
  if (inline) {
    return inline.slice(inlinePrefix.length).trim() || null;
  }
  const index = tokens.indexOf(`--${name}`);
  return index >= 0 ? String(tokens[index + 1] || '').trim() || null : null;
}

function readConnectorMany(tokens: string[], names: string[]): string[] {
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

function parseConnectorCliArgs(args: string): {
  action: 'doctor' | 'setup';
  channelId: string | null;
  mode: string | null;
  apply: boolean;
  localOnly: boolean;
  allowedUserIds: string[];
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  ownerUserIds: string[];
  allowDms: boolean | null;
} {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const first = String(tokens[0] || '').trim().toLowerCase();
  const action = first === 'setup' ? 'setup' : 'doctor';
  const positional = String(tokens[1] || '').trim();
  const channelId = first === 'setup' || first === 'doctor'
    ? positional && !positional.startsWith('--') ? positional : null
    : first || null;
  return {
    action,
    channelId,
    mode: readConnectorFlag(tokens, 'mode'),
    apply: tokens.includes('--apply'),
    localOnly: tokens.includes('--local-only'),
    allowedUserIds: readConnectorMany(tokens, ['allowed-user', 'allowed-users', 'user']),
    allowedGuildIds: readConnectorMany(tokens, ['guild', 'guilds', 'allowed-guild', 'allowed-guilds']),
    allowedChannelIds: readConnectorMany(tokens, ['channel', 'channels', 'allowed-channel', 'allowed-channels']),
    ownerUserIds: readConnectorMany(tokens, ['owner', 'owners', 'owner-user', 'owner-users']),
    allowDms: tokens.includes('--allow-dms')
      ? true
      : tokens.includes('--no-dms')
        ? false
        : null,
  };
}

export async function handleZavorthCliRegistryConnectorsCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { effectiveFlags, commandName, args, writer } = params;

  if (commandName === 'connectors' || commandName === 'connector') {
    const service = new ZavorthConnectorExperienceService();
    const parsed = parseConnectorCliArgs(args);
    if (parsed.action === 'setup') {
      if (!parsed.channelId) {
        const error = 'Use: zavorth connectors setup <telegram|discord|github> [--apply]';
        writer.error(error);
        return { ok: false, handled: true, output: [], error };
      }
      const result = parsed.apply
        ? await service.applySetup({ ...parsed, channelId: parsed.channelId })
        : service.buildSetup({ ...parsed, channelId: parsed.channelId });
      const body = effectiveFlags.json ? JSON.stringify(result, null, 2) : service.renderSetup(result);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    const result = await service.runDoctor({
      selectedId: parsed.channelId,
      localOnly: parsed.localOnly,
    });
    const body = effectiveFlags.json ? JSON.stringify(result, null, 2) : service.renderDoctor(result);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'start' || commandName === 'quickstart') {
    const service = new ZavorthProductDemoService();
    const snapshot = service.buildSnapshot();
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : [
          'Zavorth Start',
          'One command path: setup preview, Home, optional browser demo and connector doctor.',
          '',
          service.renderText(snapshot),
        ].join('\n');
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'demo') {
    const service = new ZavorthProductDemoService();
    const snapshot = service.buildSnapshot();
    const wantsDoctor = /\b(?:doctor|check|status)\b/i.test(args);
    const wantsBrowser = /\b(?:browser|visual)\b/i.test(args);
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : wantsBrowser
        ? [
            'Zavorth Browser Demo',
            `file: ${snapshot.visualHome.browserDemoPath}`,
            `open: ${snapshot.visualHome.browserDemoCommand}`,
            'This demo is local-only and does not require connector secrets.',
          ].join('\n')
        : wantsDoctor
          ? service.renderDoctor(snapshot)
          : service.renderText(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  return null;
}
