#!/usr/bin/env node
import { IntegrationConnectorMeshService } from '../src/services/IntegrationConnectorMeshService.js';
import { ZavorthActionGateway } from '../src/runtime/actions/ZavorthActionGateway.js';

type Command = 'status' | 'doctor' | 'preview' | 'execute';

type ParsedArgs = {
  command: Command;
  connectorId: string | null;
  toolSlug: string | null;
  input: Record<string, unknown>;
  apply: boolean;
  json: boolean;
};

function readFlag(tokens: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = tokens.find((token) => token.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || null;
  const index = tokens.indexOf(`--${name}`);
  return index >= 0 ? String(tokens[index + 1] || '').trim() || null : null;
}

function parseInput(value: string | null): Record<string, unknown> {
  if (!value) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--input-json must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const tokens = argv.filter((token) => String(token || '').trim());
  const commandToken = String(tokens[0] || 'status').toLowerCase();
  const command: Command = ['doctor', 'preview', 'execute'].includes(commandToken)
    ? commandToken as Command
    : 'status';
  const positionalOffset = commandToken === command ? 1 : 0;
  return {
    command,
    connectorId: tokens[positionalOffset] && !tokens[positionalOffset].startsWith('--')
      ? tokens[positionalOffset]
      : readFlag(tokens, 'connector'),
    toolSlug: tokens[positionalOffset + 1] && !tokens[positionalOffset + 1].startsWith('--')
      ? tokens[positionalOffset + 1]
      : readFlag(tokens, 'tool') || readFlag(tokens, 'tool-slug'),
    input: parseInput(readFlag(tokens, 'input-json') || readFlag(tokens, 'input')),
    apply: tokens.includes('--apply'),
    json: tokens.includes('--json'),
  };
}

function writeOutput(value: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (typeof value === 'string') {
    process.stdout.write(`${value}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const service = new IntegrationConnectorMeshService();
  if (args.command === 'status') {
    writeOutput(await service.snapshot(), args.json);
    return;
  }
  if (!args.connectorId) {
    throw new Error(`Use: zavorth:integration-connectors ${args.command} <connectorId> [toolSlug]`);
  }
  if (args.command === 'doctor') {
    writeOutput(await service.doctor(args.connectorId), args.json);
    return;
  }
  if (args.command === 'preview') {
    writeOutput(service.buildExecutePreview({
      connectorId: args.connectorId,
      toolSlug: args.toolSlug,
      input: args.input,
    }), args.json);
    return;
  }

  const gateway = new ZavorthActionGateway({ root: process.cwd() });
  const payload = {
    connectorId: args.connectorId,
    toolSlug: args.toolSlug,
    input: args.input,
  };
  const result = args.apply
    ? await gateway.apply('integration.connectors.execute', payload, {
      trustedOperatorConfirmation: true,
      actorId: 'operator',
      sourceSurface: 'cli',
    })
    : await gateway.preview('integration.connectors.execute', payload);
  writeOutput(result, args.json);
}

main().catch((error) => {
  console.error(`[zavorth-integration-connectors] falha: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
