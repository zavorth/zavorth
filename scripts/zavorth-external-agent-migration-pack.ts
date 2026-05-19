#!/usr/bin/env node

import { ZavorthExternalAgentMigrationPackService } from '../src/services/ZavorthExternalAgentMigrationPackService.js';
import type { ZavorthExternalAgentMigrationPreset } from '../src/contracts/ZavorthExternalAgentMigrationPackContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  consent: boolean;
  pathHint: string | null;
  approximatePathHint: string | null;
  commandHint: string | null;
  endpointHint: string | null;
  requestedBy: string | null;
  preset: ZavorthExternalAgentMigrationPreset | null;
  apply: boolean;
  approvalId: string | null;
  overwrite: boolean;
  registerAsArm: boolean;
  enableLive: boolean;
  maxDepth: number | null;
  maxFiles: number | null;
  targetRoot: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  return {
    json: argv.includes('--json'),
    requirePass: argv.includes('--require-pass') || argv.includes('--strict'),
    consent: argv.includes('--consent') || argv.includes('--read-only-consent'),
    pathHint: readFlexibleStringFlag(argv, 'path'),
    approximatePathHint: readFlexibleStringFlag(argv, 'approx-path') || readFlexibleStringFlag(argv, 'approximate-path'),
    commandHint: readFlexibleStringFlag(argv, 'command') || readFlexibleStringFlag(argv, 'cli'),
    endpointHint: readFlexibleStringFlag(argv, 'endpoint') || readFlexibleStringFlag(argv, 'url'),
    requestedBy: readFlexibleStringFlag(argv, 'requested-by') || readFlexibleStringFlag(argv, 'user-id'),
    preset: normalizePreset(readFlexibleStringFlag(argv, 'preset')),
    apply: argv.includes('--apply'),
    approvalId: readFlexibleStringFlag(argv, 'approval-id'),
    overwrite: argv.includes('--overwrite'),
    registerAsArm: argv.includes('--register-as-arm') || argv.includes('--arm'),
    enableLive: argv.includes('--enable-live'),
    maxDepth: readNumberFlag(argv, 'max-depth'),
    maxFiles: readNumberFlag(argv, 'max-files'),
    targetRoot: readFlexibleStringFlag(argv, 'target-root'),
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write([
      'Zavorth External Agent Migration Pack',
      '',
      'Usage:',
      '  zavorth agent import --path <path> --consent --dry-run',
      '  zavorth agent import --path <path> --consent --preset user-data',
      '  zavorth agent import --path <path> --consent --apply --approval-id <approval-id>',
      '  zavorth agent import --path <path> --consent --apply --approval-id <approval-id> --register-as-arm',
      '',
      'Presets:',
      '  preview, user-data, capabilities, full',
      '',
      'Safety:',
      '  Reads only the consented scope.',
      '  Does not read .env, token, secret or credential files.',
      '  Does not execute external agents or call endpoints.',
      '  Real writes require --apply and --approval-id.',
      '',
    ].join('\n'));
    return;
  }

  const options = parseArgs(argv);
  const service = new ZavorthExternalAgentMigrationPackService();
  const snapshot = service.buildSnapshot({
    consent: options.consent,
    pathHint: options.pathHint,
    approximatePathHint: options.approximatePathHint,
    commandHint: options.commandHint,
    endpointHint: options.endpointHint,
    requestedBy: options.requestedBy,
    preset: options.preset,
    apply: options.apply,
    approvalId: options.approvalId,
    overwrite: options.overwrite,
    registerAsArm: options.registerAsArm,
    enableLive: options.enableLive,
    maxDepth: options.maxDepth,
    maxFiles: options.maxFiles,
    targetRoot: options.targetRoot,
    writeReceipt: true,
  });

  process.stdout.write(options.json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
  if (options.requirePass && ['blocked', 'partial'].includes(snapshot.status)) {
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

function normalizePreset(value: string | null): ZavorthExternalAgentMigrationPreset | null {
  if (value === 'preview' || value === 'user-data' || value === 'capabilities' || value === 'full') return value;
  return null;
}

try {
  main();
} catch (error) {
  console.error(`[zavorth-external-agent-migration-pack] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
