#!/usr/bin/env node

import { ZavorthCapabilityMeshService } from '../src/services/ZavorthCapabilityMeshService.js';

type CliOptions = {
  json: boolean;
  requestText: string | null;
  requestedBy: string | null;
  channel: string | null;
  preferExternal: boolean;
  allowExternalAgents: boolean;
  allowSkillCreation: boolean;
  allowExternalAdaptation: boolean;
  maxCandidates: number | null;
  requirePass: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  return {
    json: argv.includes('--json'),
    requestText: readFlexibleStringFlag(argv, 'request')
      || readFlexibleStringFlag(argv, 'intent')
      || readFlexibleStringFlag(argv, 'prompt')
      || argv.filter((arg) => !arg.startsWith('--')).join(' ')
      || null,
    requestedBy: readFlexibleStringFlag(argv, 'requested-by') || readFlexibleStringFlag(argv, 'user-id'),
    channel: readFlexibleStringFlag(argv, 'channel'),
    preferExternal: argv.includes('--prefer-external'),
    allowExternalAgents: !argv.includes('--no-external-agents'),
    allowSkillCreation: !argv.includes('--no-skill-creation'),
    allowExternalAdaptation: !argv.includes('--no-external-adaptation'),
    maxCandidates: readNumberFlag(argv, 'max-candidates'),
    requirePass: argv.includes('--require-pass') || argv.includes('--strict'),
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write([
      'Zavorth Capability Mesh',
      '',
      'Usage:',
      '  zavorth capability-mesh --request "revise esse code Rust"',
      '  zavorth capability-mesh --request "crie uma skill para parser CSV" --json',
      '  zavorth capability-mesh --request "use um agente external para review" --prefer-external',
      '',
      'Safety:',
      '  Inventory is read-only.',
      '  No external agent is invoked during arbitration.',
      '  No skill is installed during arbitration.',
      '  External delegation, adaptation and skill installation remain approval-gated.',
      '',
    ].join('\n'));
    return;
  }

  const options = parseArgs(argv);
  const service = new ZavorthCapabilityMeshService();
  const snapshot = service.buildSnapshot({
    requestText: options.requestText,
    requestedBy: options.requestedBy,
    channel: options.channel || 'cli',
    preferExternal: options.preferExternal,
    allowExternalAgents: options.allowExternalAgents,
    allowSkillCreation: options.allowSkillCreation,
    allowExternalAdaptation: options.allowExternalAdaptation,
    maxCandidates: options.maxCandidates,
  });

  process.stdout.write(options.json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));

  if (options.requirePass && snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
}

function readNumberFlag(argv: string[], name: string): number | null {
  const raw = readFlexibleStringFlag(argv, name);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

main().catch((error) => {
  console.error(`[zavorth-capability-mesh] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
